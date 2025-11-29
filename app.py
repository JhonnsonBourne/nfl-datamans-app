import streamlit as st

st.set_page_config(
    page_title="NFL Data One-Stop Shop",
    page_icon="🏈",
    layout="wide",
    initial_sidebar_state="expanded",
)

st.title("🏈 NFL Data One-Stop Shop")

st.markdown("""
Welcome to your **NFL Data Hub**, powered by `nflreadpy` and `nflverse` data.

This application is designed to be your go-to resource for NFL statistics, player analysis, and fantasy football insights.

### 🚀 Features
- **Player Stats Explorer**: Deep dive into player performance with advanced filtering and metrics (WOPR, RACR, etc.).
- **Player Comparison**: Compare players side-by-side to make better start/sit decisions.
- **Leaderboards**: View top performers by position and category.
- **Team Stats**: Analyze team-level trends and matchups.

### 📚 Data Source
Data is sourced from the [nflverse](https://nflverse.nflverse.com/), an open-source collection of R and Python packages for NFL data.

### 👈 Get Started
Select a page from the sidebar or use the quick links below:
""")

st.divider()

# Quick Navigation Links
st.markdown("""
<div style="display: flex; justify-content: space-around; flex-wrap: wrap; gap: 10px;">
    <a href="Player_Stats" target="_self" style="text-decoration: none; background-color: #f0f2f6; padding: 10px 20px; border-radius: 5px; color: #31333F; font-weight: bold;">📊 Player Stats</a>
    <a href="Player_Comparison" target="_self" style="text-decoration: none; background-color: #f0f2f6; padding: 10px 20px; border-radius: 5px; color: #31333F; font-weight: bold;">⚔️ Player Comparison</a>
    <a href="Leaderboards" target="_self" style="text-decoration: none; background-color: #f0f2f6; padding: 10px 20px; border-radius: 5px; color: #31333F; font-weight: bold;">🏆 Leaderboards</a>
    <a href="Team_Stats" target="_self" style="text-decoration: none; background-color: #f0f2f6; padding: 10px 20px; border-radius: 5px; color: #31333F; font-weight: bold;">🛡️ Team Stats</a>
</div>
""", unsafe_allow_html=True)

st.divider()

col1, col2, col3 = st.columns(3)

with col1:
    st.info("**Latest Season Data**\n\nWe automatically fetch the latest available data for the current season.")

with col2:
    st.info("**Advanced Metrics**\n\nIncludes advanced stats like Air Yards, Target Share, and Expected Points Added (EPA).")

with col3:
    st.info("**Export Ready**\n\nDownload any view as a CSV for your own custom analysis.")


