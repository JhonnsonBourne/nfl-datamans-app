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
Select a page from the sidebar to begin exploring!
""")

st.divider()

col1, col2, col3 = st.columns(3)

with col1:
    st.info("**Latest Season Data**\n\nWe automatically fetch the latest available data for the current season.")

with col2:
    st.info("**Advanced Metrics**\n\nIncludes advanced stats like Air Yards, Target Share, and Expected Points Added (EPA).")

with col3:
    st.info("**Export Ready**\n\nDownload any view as a CSV for your own custom analysis.")
