import streamlit as st
import pandas as pd
import altair as alt
from utils import load_dataset_cached

st.set_page_config(page_title="Team Stats", layout="wide")
st.title("🛡️ Team Stats Analysis")

# Sidebar
with st.sidebar:
    st.header("Settings")
    season = st.selectbox("Season", options=list(range(2024, 1998, -1)), index=0)
    week_filter = st.slider("Weeks", 1, 22, (1, 18))

# Load Data
with st.spinner(f"Loading data for {season}..."):
    df = load_dataset_cached("nflreadpy", "player_stats", [season])

# Filter Weeks
df = df[(df["week"] >= week_filter[0]) & (df["week"] <= week_filter[1])]

# Aggregate by Team
team_stats = df.groupby("recent_team").agg({
    "passing_yards": "sum",
    "rushing_yards": "sum",
    "passing_tds": "sum",
    "rushing_tds": "sum",
    "fantasy_points": "sum" # Standard scoring usually available
}).reset_index()

team_stats["total_yards"] = team_stats["passing_yards"] + team_stats["rushing_yards"]
team_stats["total_tds"] = team_stats["passing_tds"] + team_stats["rushing_tds"]

# Display Table
st.subheader("Team Offense Summary")
st.dataframe(team_stats.sort_values("total_yards", ascending=False), use_container_width=True)

# Visuals
col1, col2 = st.columns(2)

with col1:
    st.subheader("Total Yards by Team")
    chart_yards = alt.Chart(team_stats).mark_bar().encode(
        x=alt.X("total_yards", title="Total Yards"),
        y=alt.Y("recent_team", sort="-x", title="Team"),
        tooltip=["recent_team", "total_yards", "passing_yards", "rushing_yards"]
    ).properties(height=600)
    st.altair_chart(chart_yards, use_container_width=True)

with col2:
    st.subheader("Pass vs Rush Ratio (Yards)")
    # Melt for stacked bar
    melted = team_stats.melt(id_vars="recent_team", value_vars=["passing_yards", "rushing_yards"], var_name="type", value_name="yards")
    
    chart_ratio = alt.Chart(melted).mark_bar().encode(
        x=alt.X("yards", stack="normalize", axis=alt.Axis(format="%"), title="Percentage of Yards"),
        y=alt.Y("recent_team", sort=alt.EncodingSortField(field="yards", op="sum", order="descending"), title="Team"),
        color=alt.Color("type", legend=alt.Legend(title="Type")),
        tooltip=["recent_team", "type", "yards"]
    ).properties(height=600)
    st.altair_chart(chart_ratio, use_container_width=True)
