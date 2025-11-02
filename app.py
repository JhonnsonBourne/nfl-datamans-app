import datetime as dt
from typing import List, Optional

import numpy as np
import pandas as pd
import altair as alt
import streamlit as st

from nflread_adapter import (
    DATASET_CANDIDATES,
    available_dataset_functions,
    call_dataset,
    import_library,
)


st.set_page_config(page_title="NFL Data Explorer", layout="wide")
st.title("NFL Data Explorer (nflreadpy)")
st.caption(
    "Interactive viewer for nflverse datasets via the nflreadpy/nflreadr library."
)


@st.cache_resource(show_spinner=False)
def get_library_module(preferred: Optional[str] = None):
    return import_library(preferred)


@st.cache_data(show_spinner=False)
def load_dataset_cached(
    module_name: str, dataset: str, seasons: List[int]
) -> pd.DataFrame:
    module = get_library_module(module_name if module_name else None)
    df, _ = call_dataset(module, dataset, seasons=seasons)
    return df


with st.sidebar:
    st.subheader("Settings")
    lib_override = st.text_input(
        "Library module override",
        value="",
        placeholder="e.g. nflreadpy or nflreadr (optional)",
        help=(
            "If import fails or you prefer a specific name, set it here. "
            "You can also set the NFLREADPY_MODULE environment variable."
        ),
    )

    current_year = dt.date.today().year
    min_year = 1999  # nflverse data commonly available from 1999+
    years = list(range(min_year, current_year + 1))
    default_years = [current_year]
    selected_years = st.multiselect(
        "Seasons",
        options=years,
        default=default_years,
        help="Choose one or more seasons.",
    )

    st.divider()
    st.markdown("Trouble importing? Try installing with:")
    st.code("pip install nflreadpy  # or: pip install nflreadr", language="bash")


datasets_sorted = sorted(DATASET_CANDIDATES.keys())
default_dataset = "player_stats" if "player_stats" in DATASET_CANDIDATES else datasets_sorted[0]
dataset = st.selectbox(
    "Dataset",
    options=datasets_sorted,
    index=datasets_sorted.index(default_dataset),
)

colA, colB = st.columns([1, 3])
with colA:
    load_btn = st.button("Load Data", type="primary")
with colB:
    reset_btn = st.button("Reset View")

# Persist loaded state across reruns so filters don't drop the results
if "loaded" not in st.session_state:
    st.session_state["loaded"] = False
if load_btn:
    st.session_state["loaded"] = True
if reset_btn:
    st.session_state["loaded"] = False


def _present_filters(df: pd.DataFrame) -> pd.DataFrame:
    # Generic team-like filters
    team_like = [
        "team",
        "recent_team",
        "club_code",
        "team_abbr",
        "abbr",
        "home_team",
        "away_team",
    ]
    week_like = ["week"]

    lower_cols = {c.lower(): c for c in df.columns}
    present_team_cols = [lower_cols[c] for c in lower_cols.keys() if c in team_like]
    present_week_cols = [lower_cols[c] for c in lower_cols.keys() if c in week_like]

    with st.expander("Filters", expanded=False):
        filtered = df
        if present_team_cols:
            team_col = st.selectbox("Team column", options=present_team_cols)
            teams = sorted([str(x) for x in filtered[team_col].dropna().unique()])
            selected = st.multiselect("Teams", options=teams)
            if selected:
                filtered = filtered[filtered[team_col].astype(str).isin(selected)]

        if present_week_cols:
            week_col = present_week_cols[0]
            weeks = sorted([int(x) for x in pd.to_numeric(filtered[week_col], errors="coerce").dropna().unique()])
            selected_w = st.multiselect("Weeks", options=weeks)
            if selected_w:
                filtered = filtered[filtered[week_col].isin(selected_w)]

    return filtered


# --- Player Stats helpers ---
def _first_present(df: pd.DataFrame, candidates: list[str]) -> Optional[str]:
    lower_map = {c.lower(): c for c in df.columns}
    for nm in candidates:
        c = lower_map.get(nm.lower())
        if c is not None:
            return c
    return None


def _compute_fantasy_points(df: pd.DataFrame, ppr: float = 1.0) -> pd.Series:
    # Prefer built-in if available
    for c in ["fantasy_points_ppr", "ppr", "fantasy_points"]:
        if c in df.columns:
            # If it's fantasy_points (unknown scoring), still return it
            return pd.to_numeric(df[c], errors="coerce")

    # Derive from available stats; missing inputs are treated as 0
    def col(*names: str) -> pd.Series:
        for n in names:
            if n in df.columns:
                return pd.to_numeric(df[n], errors="coerce").fillna(0)
        return pd.Series(0, index=df.index)

    pass_yd = col("passing_yards", "pass_yards", "pass_yds")
    pass_td = col("passing_tds", "pass_tds")
    interceptions = col("interceptions", "pass_int", "ints")
    rush_yd = col("rushing_yards", "rush_yards", "rush_yds")
    rush_td = col("rushing_tds", "rush_tds")
    rec_yd = col("receiving_yards", "rec_yards")
    rec_td = col("receiving_tds", "rec_tds")
    receptions = col("receptions", "rec", "targets_caught")
    fum_lost = col("fumbles_lost", "fum_lost")
    two_pt = col("two_pt_conversions", "two_point_conversions", "two_pt", "two_point")

    # Standard ESPN-ish scoring baseline
    pts = (
        pass_yd * 0.04
        + pass_td * 4
        - interceptions * 2
        + rush_yd * 0.1
        + rush_td * 6
        + rec_yd * 0.1
        + rec_td * 6
        + receptions * ppr
        - fum_lost * 2
        + two_pt * 2
    )
    return pts


def _compute_shares_and_adv_metrics(df: pd.DataFrame) -> pd.DataFrame:
    out = df.copy()
    # Aliases
    ay_col = _first_present(out, ["air_yards", "airyards"])  # player air yards
    team_ay_col = _first_present(out, ["team_air_yards"])  # team air yards
    targets_col = _first_present(out, ["targets"])  # player targets
    team_tgt_col = _first_present(out, ["team_targets"])  # team targets
    rec_yards_col = _first_present(out, ["receiving_yards", "rec_yards"])  # receiving yards
    pass_yards_col = _first_present(out, ["passing_yards", "pass_yards"])  # QB passing yards
    qb_ay_col = _first_present(out, ["pass_air_yards", "air_yards_thrown"])  # QB air yards thrown

    # target_share
    if "target_share" not in out.columns and targets_col and team_tgt_col:
        with np.errstate(divide="ignore", invalid="ignore"):
            out["target_share"] = pd.to_numeric(out[targets_col], errors="coerce") / pd.to_numeric(
                out[team_tgt_col], errors="coerce"
            )

    # air_yards_share
    if "air_yards_share" not in out.columns and ay_col and team_ay_col:
        with np.errstate(divide="ignore", invalid="ignore"):
            out["air_yards_share"] = pd.to_numeric(out[ay_col], errors="coerce") / pd.to_numeric(
                out[team_ay_col], errors="coerce"
            )

    # racr (receiver)
    if "racr" not in out.columns and rec_yards_col and ay_col:
        ay = pd.to_numeric(out[ay_col], errors="coerce")
        with np.errstate(divide="ignore", invalid="ignore"):
            out["racr"] = pd.to_numeric(out[rec_yards_col], errors="coerce") / ay.replace(0, np.nan)

    # pacr (passer)
    if "pacr" not in out.columns and pass_yards_col and qb_ay_col:
        qb_ay = pd.to_numeric(out[qb_ay_col], errors="coerce")
        with np.errstate(divide="ignore", invalid="ignore"):
            out["pacr"] = pd.to_numeric(out[pass_yards_col], errors="coerce") / qb_ay.replace(0, np.nan)

    # wopr
    if "wopr" not in out.columns and {"target_share", "air_yards_share"}.issubset(out.columns):
        ts = pd.to_numeric(out.get("target_share"), errors="coerce")
        ays = pd.to_numeric(out.get("air_yards_share"), errors="coerce")
        out["wopr"] = 1.5 * ts + 0.7 * ays

    return out


def _render_player_stats(df: pd.DataFrame):
    st.subheader("Player Stats Explorer")

    # Column detection
    season_col = _first_present(df, ["season", "year"]) or "season"
    week_col = _first_present(df, ["week"])  # optional
    player_col = _first_present(df, ["player", "player_name", "name", "full_name"]) or "player"
    pos_col = _first_present(df, ["position", "pos", "player_position"])  # optional
    team_col = _first_present(df, ["team", "recent_team", "team_abbr", "abbr", "club_code"])  # optional
    opp_col = _first_present(df, ["opponent_team", "opp_team", "opponent", "opp", "opp_abbr"])  # optional

    # Scoring
    scoring = st.radio("Scoring", ["PPR", "Half-PPR", "Standard"], horizontal=True)
    ppr = {"PPR": 1.0, "Half-PPR": 0.5, "Standard": 0.0}[scoring]

    # Compute fantasy points and advanced metrics
    df = df.copy()
    df["fantasy_points_calc"] = _compute_fantasy_points(df, ppr=ppr)
    df = _compute_shares_and_adv_metrics(df)

    # Filters panel
    with st.expander("Filters", expanded=True):
        # Core categorical filters
        if pos_col and df[pos_col].notna().any():
            positions = sorted([str(x) for x in df[pos_col].dropna().unique()])
            pos_sel = st.multiselect("Positions", positions)
        else:
            pos_sel = []

        if team_col and df[team_col].notna().any():
            teams = sorted([str(x) for x in df[team_col].dropna().unique()])
            team_sel = st.multiselect("Teams", teams)
        else:
            team_sel = []

        if opp_col and df[opp_col].notna().any():
            opps = sorted([str(x) for x in df[opp_col].dropna().unique()])
            opp_sel = st.multiselect("Opponent Teams", opps)
        else:
            opp_sel = []

        # Season/year filter
        if season_col in df.columns:
            seasons = (
                pd.to_numeric(df[season_col], errors="coerce").dropna().astype(int).sort_values().unique().tolist()
            )
            season_sel = st.multiselect("Seasons (filter)", seasons)
        else:
            season_sel = []

        # Week filter (range)
        if week_col and week_col in df.columns:
            weeks_series = pd.to_numeric(df[week_col], errors="coerce").dropna().astype(int)
            if not weeks_series.empty:
                wk_min, wk_max = int(weeks_series.min()), int(weeks_series.max())
                week_range = st.slider("Week range", min_value=wk_min, max_value=wk_max, value=(wk_min, wk_max))
            else:
                week_range = None
        else:
            week_range = None

        # Name contains
        name_q = st.text_input("Player name contains", value="")

        st.markdown("More filters (categorical, low cardinality)")
        # Suggest additional categorical filters with low cardinality
        cat_candidates = []
        for c in df.columns:
            if c in {player_col, pos_col, team_col, opp_col, season_col, week_col}:
                continue
            if not pd.api.types.is_numeric_dtype(df[c]) and df[c].nunique(dropna=True) <= 30:
                cat_candidates.append(c)
        sel_cats = st.multiselect("Add category filters", sorted(cat_candidates))

        extra_cat_selections = {}
        for c in sel_cats:
            vals = sorted([str(x) for x in df[c].dropna().unique()])
            pick = st.multiselect(f"{c}", vals)
            if pick:
                extra_cat_selections[c] = pick

        st.markdown("Metric thresholds (apply if present)")
        metric_candidates = [
            "fantasy_points_calc",
            "fantasy_points_ppr",
            "epa",
            "cpoe",
            "pacr",
            "racr",
            "wopr",
            "target_share",
            "air_yards_share",
            "targets",
            "receiving_yards",
            "rushing_yards",
            "passing_yards",
            "air_yards",
        ]
        metric_filters = {}
        for m in metric_candidates:
            if m in df.columns and pd.api.types.is_numeric_dtype(df[m]):
                series = pd.to_numeric(df[m], errors="coerce")
                if series.dropna().empty:
                    continue
                lo, hi = float(np.nanmin(series)), float(np.nanmax(series))
                if not np.isfinite(lo) or not np.isfinite(hi):
                    continue
                enable = st.checkbox(f"Filter {m}", value=False)
                if enable:
                    sel = st.slider(f"{m} range", min_value=float(round(lo, 2)), max_value=float(round(hi, 2)), value=(float(round(lo, 2)), float(round(hi, 2))))
                    metric_filters[m] = sel

    # Apply filters
    mask = pd.Series(True, index=df.index)
    if pos_col and pos_sel:
        mask &= df[pos_col].astype(str).isin(pos_sel)
    if team_col and team_sel:
        mask &= df[team_col].astype(str).isin(team_sel)
    if opp_col and opp_sel and opp_col in df.columns:
        mask &= df[opp_col].astype(str).isin(opp_sel)
    if season_col in df.columns and season_sel:
        mask &= pd.to_numeric(df[season_col], errors="coerce").astype("Int64").isin(season_sel)
    if week_range and week_col in df.columns:
        wk = pd.to_numeric(df[week_col], errors="coerce")
        mask &= (wk >= week_range[0]) & (wk <= week_range[1])
    if name_q:
        mask &= df[player_col].astype(str).str.contains(name_q, case=False, na=False)
    for c, values in (extra_cat_selections or {}).items():
        mask &= df[c].astype(str).isin(values)
    for m, (lo, hi) in (metric_filters or {}).items():
        series = pd.to_numeric(df[m], errors="coerce")
        mask &= (series >= float(lo)) & (series <= float(hi))
    df_f = df[mask].copy()

    # Aggregation
    st.markdown("Grouping")
    group_choice = st.selectbox(
        "Aggregate to",
        [
            "Row Level",
            "Player + Season",
            "Team + Season",
            "Position + Season",
            "Player + Season + Week",
            "Team + Season + Week",
            "Position + Season + Week",
        ],
        index=1,
    )

    group_cols: list[str] = []
    if group_choice == "Row Level":
        grouped = df_f
    else:
        if group_choice == "Player + Season":
            group_cols = [c for c in [player_col, season_col] if c in df_f.columns]
        elif group_choice == "Team + Season":
            group_cols = [c for c in [team_col, season_col] if c in df_f.columns]
        elif group_choice == "Position + Season":
            group_cols = [c for c in [pos_col, season_col] if c in df_f.columns]
        elif group_choice == "Player + Season + Week":
            group_cols = [c for c in [player_col, season_col, week_col] if c in df_f.columns and c]
        elif group_choice == "Team + Season + Week":
            group_cols = [c for c in [team_col, season_col, week_col] if c in df_f.columns and c]
        elif group_choice == "Position + Season + Week":
            group_cols = [c for c in [pos_col, season_col, week_col] if c in df_f.columns and c]

        # Exclude dimension-like columns from numeric aggregation to avoid
        # duplicate index insertion and to prevent aggregating week/season.
        dims_exclude = set([x for x in [season_col, week_col, player_col, team_col, pos_col] if x])
        dims_exclude |= set(group_cols)

        num_cols = [
            c
            for c in df_f.select_dtypes(include=[np.number]).columns.tolist()
            if c not in dims_exclude
        ]

        # Default aggregation: sum. Override specific rate stats to mean.
        agg_dict = {c: "sum" for c in num_cols}
        for r in ["wopr", "air_yards_share", "target_share", "racr", "pacr", "cpoe"]:
            if r in agg_dict:
                agg_dict[r] = "mean"
        grouped = (
            df_f.groupby(group_cols, dropna=False).agg(agg_dict).reset_index()
            if group_cols
            else df_f
        )

    # Display grid
    st.dataframe(grouped, use_container_width=True, height=460)

    # Top N bar chart by fantasy points
    top_n = st.slider("Top N by Fantasy Points", min_value=5, max_value=50, value=15)
    metric_col = _first_present(grouped, ["fantasy_points_calc", "fantasy_points_ppr", "fantasy_points"]) or "fantasy_points_calc"
    chart_df = grouped.dropna(subset=[metric_col]).sort_values(metric_col, ascending=False).head(top_n)
    label_col = None
    for c in [player_col, team_col, pos_col]:
        if c in chart_df.columns:
            label_col = c
            break
    if label_col:
        bar = (
            alt.Chart(chart_df)
            .mark_bar()
            .encode(x=alt.X(f"{metric_col}:Q", title="Fantasy Points"), y=alt.Y(f"{label_col}:N", sort='-x'))
            .properties(height=400)
        )
        st.altair_chart(bar, use_container_width=True)

    # Scatter: WOPR vs Fantasy Points sized by Target Share
    wopr_col = _first_present(grouped, ["wopr"]) or "wopr"
    ts_col = _first_present(grouped, ["target_share"]) or "target_share"
    if wopr_col in grouped.columns and metric_col in grouped.columns and ts_col in grouped.columns:
        scatter = (
            alt.Chart(grouped)
            .mark_circle(opacity=0.7)
            .encode(
                x=alt.X(f"{wopr_col}:Q", title="WOPR"),
                y=alt.Y(f"{metric_col}:Q", title="Fantasy Points"),
                size=alt.Size(f"{ts_col}:Q", title="Target Share"),
                color=alt.Color(f"{pos_col}:N", title="Pos") if pos_col in grouped.columns else alt.value("#1f77b4"),
                tooltip=[c for c in [player_col, team_col, pos_col, season_col, wopr_col, ts_col, metric_col] if c in grouped.columns],
            )
            .properties(height=380)
        )
        st.altair_chart(scatter, use_container_width=True)

    # Weekly time series for a selected player (if week available)
    if week_col and player_col in df_f.columns:
        with st.expander("Weekly Time Series", expanded=False):
            players = sorted([str(x) for x in df_f[player_col].dropna().unique()])
            focus = st.selectbox("Focus player", options=[""] + players)
            if focus:
                ts = df_f[df_f[player_col].astype(str) == focus].copy()
                if season_col in ts.columns:
                    ts = ts.sort_values([season_col, week_col])
                else:
                    ts = ts.sort_values(week_col)
                ts_metric = metric_col if metric_col in ts.columns else "fantasy_points_calc"
                line = (
                    alt.Chart(ts)
                    .mark_line(point=True)
                    .encode(
                        x=alt.X(f"{week_col}:O", title="Week"),
                        y=alt.Y(f"{ts_metric}:Q", title="Fantasy Points"),
                        color=alt.Color(f"{season_col}:N", title="Season") if season_col in ts.columns else alt.value("#e45756"),
                        tooltip=[c for c in [season_col, week_col, team_col, opp_col, ts_metric] if c in ts.columns],
                    )
                    .properties(height=320)
                )
                st.altair_chart(line, use_container_width=True)


if st.session_state.get("loaded"):
    try:
        with st.spinner("Importing library and loading data..."):
            # Import first to report available functions
            module = get_library_module(lib_override if lib_override else None)
            funcs = available_dataset_functions(module)
            df = load_dataset_cached(lib_override, dataset, selected_years or [])

        st.success("Data loaded")

        # Show a quick summary
        st.write(
            f"Using library: `{module.__name__}` — dataset: `{dataset}` — "
            f"rows: {len(df):,}, columns: {df.shape[1]}"
        )

        if dataset in {"player_stats", "weekly"}:
            _render_player_stats(df)
        else:
            # Generic filters and table
            df_filtered = _present_filters(df)
            st.dataframe(df_filtered, use_container_width=True, height=520)

            csv = df_filtered.to_csv(index=False).encode("utf-8")
            st.download_button(
                label="Download CSV",
                data=csv,
                file_name=f"{dataset}_{'-'.join(map(str, selected_years or ['all']))}.csv",
                mime="text/csv",
            )

        with st.expander("Library details", expanded=False):
            st.json({k: v for k, v in funcs.items() if v})
            if not any(funcs.values()):
                st.warning(
                    "No known dataset readers were found on the imported module. "
                    "Check your installed package and version."
                )

    except Exception as e:  # noqa: BLE001
        st.error(f"Failed to load data: {e}")
        st.exception(e)
else:
    st.info("Choose a dataset and seasons, then click Load Data.")
