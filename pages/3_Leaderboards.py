import streamlit as st
import pandas as pd
from utils import load_dataset_cached, _compute_fantasy_points

st.set_page_config(page_title="Leaderboards", layout="wide")
st.title("🏆 Leaderboards")

# Sidebar
with st.sidebar:
    st.header("Settings")
    season = st.selectbox("Season", options=list(range(2024, 1998, -1)), index=0)
    week_filter = st.slider("Weeks", 1, 22, (1, 18))
    scoring = st.radio("Scoring", ["PPR", "Half-PPR", "Standard"], horizontal=True)

# Load Data
with st.spinner(f"Loading data for {season}..."):
    df = load_dataset_cached("nflreadpy", "player_stats", [season])

# Filter Weeks
df = df[(df["week"] >= week_filter[0]) & (df["week"] <= week_filter[1])]

# Calculate Fantasy
ppr = {"PPR": 1.0, "Half-PPR": 0.5, "Standard": 0.0}[scoring]
df["fantasy_points_calc"] = _compute_fantasy_points(df, ppr=ppr)

# Aggregation
agg_cols = {
    "passing_yards": "sum", "passing_tds": "sum", "interceptions": "sum",
    "rushing_yards": "sum", "rushing_tds": "sum",
    "receptions": "sum", "receiving_yards": "sum", "receiving_tds": "sum",
    "fantasy_points_calc": "sum",
    "team": "last", "position": "last" # Approximate
}
# Only aggregate columns that exist
valid_agg = {k: v for k, v in agg_cols.items() if k in df.columns}

grouped = df.groupby(["player_display_name", "player_id"], as_index=False).agg(valid_agg)

# Tabs
tab1, tab2, tab3, tab4 = st.tabs(["Fantasy", "Passing", "Rushing", "Receiving"])

def show_leaderboard(data, sort_col, display_cols, top_n=20):
    if sort_col not in data.columns:
        st.warning(f"Column {sort_col} not found.")
        return
    
    leaderboard = data.sort_values(sort_col, ascending=False).head(top_n).reset_index(drop=True)
    leaderboard.index += 1 # Rank 1-based
    
    # Format
    st.dataframe(leaderboard[display_cols], use_container_width=True)

with tab1:
    st.subheader("Fantasy Leaders")
    cols = ["player_display_name", "team", "position", "fantasy_points_calc"]
    show_leaderboard(grouped, "fantasy_points_calc", cols)

with tab2:
    st.subheader("Passing Leaders")
    cols = ["player_display_name", "team", "passing_yards", "passing_tds", "interceptions"]
    show_leaderboard(grouped, "passing_yards", cols)

with tab3:
    st.subheader("Rushing Leaders")
    cols = ["player_display_name", "team", "rushing_yards", "rushing_tds"]
    show_leaderboard(grouped, "rushing_yards", cols)

with tab4:
    st.subheader("Receiving Leaders")
    cols = ["player_display_name", "team", "receptions", "receiving_yards", "receiving_tds"]
    show_leaderboard(grouped, "receiving_yards", cols)
