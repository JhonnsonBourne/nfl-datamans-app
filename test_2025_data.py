import nflreadpy
from datetime import datetime

# Test if 2025 data is available
print("Testing 2025 data availability...")
try:
    df = nflreadpy.load_player_stats(seasons=[2025])
    print(f"✓ 2025 data available: {len(df)} records")
    print(f"Sample players: {df['player_display_name'].head(5).tolist()}")
except Exception as e:
    print(f"✗ 2025 data not available: {e}")

# Get current year
current_year = datetime.now().year
print(f"\nCurrent year: {current_year}")

# Generate season list
seasons = list(range(current_year, current_year - 10, -1))
print(f"Suggested seasons: {seasons}")
