import datetime as dt
from typing import List, Optional

import numpy as np
import pandas as pd
import streamlit as st

from nflread_adapter import (
    call_dataset,
    import_library,
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
