import streamlit as st
import pandas as pd
import altair as alt
from utils import load_dataset_cached, _compute_fantasy_points, _compute_shares_and_adv_metrics

st.set_page_config(page_title="Player Comparison", layout="wide")
st.title("⚔️ Player Comparison Tool")

# Sidebar Controls
with st.sidebar:
    st.header("Settings")
    current_year = 2023 # Default, ideally dynamic
    selected_years = st.multiselect("Select Seasons", options=list(range(1999, 2025)), default=[2023])
    scoring = st.radio("Scoring", ["PPR", "Half-PPR", "Standard"], horizontal=True)

# Load Data
if not selected_years:
    st.info("Please select at least one season.")
    st.stop()

with st.spinner("Loading data..."):
    df = load_dataset_cached("nflreadpy", "player_stats", selected_years)

# Process Data
ppr = {"PPR": 1.0, "Half-PPR": 0.5, "Standard": 0.0}[scoring]
df = _compute_fantasy_points(df, ppr=ppr).to_frame(name="fantasy_points_calc").join(df)
df = _compute_shares_and_adv_metrics(df)

# Player Selection
all_players = sorted(df["player_display_name"].dropna().unique().tolist())
selected_players = st.multiselect("Select Players to Compare (Max 5)", options=all_players, max_selections=5)

if not selected_players:
    st.info("Select players to see their comparison.")
    st.stop()

# Filter Data
player_data = df[df["player_display_name"].isin(selected_players)].copy()

# Aggregation Choice
agg_type = st.radio("Aggregation", ["Season Total", "Weekly Average"], horizontal=True)

# Metrics to compare
comparison_metrics = {
    "Fantasy Points": "fantasy_points_calc",
    "Passing Yards": "passing_yards",
    "Passing TDs": "passing_tds",
    "Rushing Yards": "rushing_yards",
    "Rushing TDs": "rushing_tds",
    "Receptions": "receptions",
    "Receiving Yards": "receiving_yards",
    "Receiving TDs": "receiving_tds",
    "Target Share": "target_share",
    "WOPR": "wopr",
}

# Aggregate
if agg_type == "Season Total":
    agg_funcs = {v: "sum" for v in comparison_metrics.values()}
    # Fix rates
    for rate in ["target_share", "wopr"]:
        agg_funcs[rate] = "mean"
    
    grouped = player_data.groupby("player_display_name")[list(comparison_metrics.values())].agg(agg_funcs).reset_index()
else:
    agg_funcs = {v: "mean" for v in comparison_metrics.values()}
    grouped = player_data.groupby("player_display_name")[list(comparison_metrics.values())].agg(agg_funcs).reset_index()

# Transpose for side-by-side view
st.subheader("Side-by-Side Comparison")
display_df = grouped.set_index("player_display_name").T
display_df.index = [k for k, v in comparison_metrics.items() if v in display_df.index] # Rename index to pretty names if possible, simplified here
# Actually, let's rename the index properly
inv_map = {v: k for k, v in comparison_metrics.items()}
display_df = display_df.rename(index=inv_map)

st.dataframe(display_df, use_container_width=True)

# Visual Comparison
st.subheader("Visual Comparison")
metric_to_chart = st.selectbox("Select Metric to Chart", options=list(comparison_metrics.keys()))
col_name = comparison_metrics[metric_to_chart]

chart = alt.Chart(grouped).mark_bar().encode(
    x=alt.X("player_display_name", title="Player", axis=alt.Axis(labelAngle=0)),
    y=alt.Y(col_name, title=metric_to_chart),
    color="player_display_name",
    tooltip=["player_display_name", col_name]
).properties(height=400)

st.altair_chart(chart, use_container_width=True)

# Weekly Trend (if multiple weeks/seasons)
st.subheader("Weekly Trend (Fantasy Points)")
weekly_chart = alt.Chart(player_data).mark_line(point=True).encode(
    x=alt.X("week", title="Week"),
    y=alt.Y("fantasy_points_calc", title="Fantasy Points"),
    color="player_display_name",
    tooltip=["season", "week", "player_display_name", "fantasy_points_calc"]
).properties(height=300)
st.altair_chart(weekly_chart, use_container_width=True)
