import nflreadpy
import pandas as pd

# Load 2025 player stats
df = nflreadpy.load_player_stats(seasons=[2025])

# Check Aaron Rodgers specifically
rodgers = df[df['player_display_name'].str.contains('Rodgers', case=False, na=False)]

print("Aaron Rodgers records in 2025:")
print(f"Number of records: {len(rodgers)}")
print("\nColumns available:")
print(list(df.columns))

print("\nRodgers data sample:")
print(rodgers[['player_display_name', 'week', 'fantasy_points_ppr', 'passing_yards', 'passing_tds', 'rushing_tds', 'receiving_tds']].head(15))

print("\nIs this weekly data?")
print(f"Unique weeks: {sorted(df['week'].unique())}")

print("\nSeason totals for Rodgers:")
rodgers_totals = rodgers.groupby('player_display_name').agg({
    'fantasy_points_ppr': 'sum',
    'passing_yards': 'sum',
    'passing_tds': 'sum',
    'rushing_tds': 'sum',
    'receiving_tds': 'sum'
}).reset_index()
print(rodgers_totals)
