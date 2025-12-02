import nflreadpy
import pandas as pd

print("Debugging columns in detail...\n")

years = [2024]

# 1. Load Player Stats
print("Loading player stats...")
df = nflreadpy.load_player_stats(seasons=years)
if hasattr(df, 'to_pandas'):
    df = df.to_pandas()
print(f"Initial columns: {sorted(df.columns.tolist())}")

if 'interceptions' in df.columns:
    print("✅ 'interceptions' found in initial load")
else:
    print("❌ 'interceptions' NOT found in initial load")

if 'sacks' in df.columns:
    print("✅ 'sacks' found in initial load")
else:
    print("❌ 'sacks' NOT found in initial load")

# 2. Mimic Routes Calculation (simplified)
print("\nMimicking routes merge...")
# Create dummy routes
routes_counts = pd.DataFrame({
    'player_id': df['player_id'].unique(),
    'season': 2024,
    'week': df['week'].unique()[0],
    'routes': 10
})

# Merge
df = pd.merge(df, routes_counts, on=['player_id', 'season', 'week'], how='left')
print(f"Columns after merge: {sorted(df.columns.tolist())}")

if 'interceptions' in df.columns:
    print("✅ 'interceptions' still present")
else:
    print("❌ 'interceptions' LOST after merge")

# 3. Mimic Aggregation Check
sum_cols = [
    'completions', 'attempts', 'passing_yards', 'passing_tds', 'interceptions',
    'sacks', 'sack_yards', 'sack_fumbles', 'sack_fumbles_lost',
    'passing_air_yards', 'passing_yards_after_catch', 'passing_first_downs', 'passing_epa',
    'passing_2pt_conversions', 'carries', 'rushing_yards', 'rushing_tds',
    'rushing_fumbles', 'rushing_fumbles_lost', 'rushing_first_downs', 'rushing_epa',
    'rushing_2pt_conversions', 'receptions', 'targets', 'receiving_yards',
    'receiving_tds', 'receiving_fumbles', 'receiving_fumbles_lost',
    'receiving_air_yards', 'receiving_yards_after_catch', 'receiving_first_downs',
    'receiving_epa', 'receiving_2pt_conversions', 'special_teams_tds',
    'fantasy_points', 'fantasy_points_ppr', 'routes'
]

missing = [c for c in sum_cols if c not in df.columns]
print(f"\nMissing columns from sum_cols: {missing}")
