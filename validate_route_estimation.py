import nflreadpy
import pandas as pd
import numpy as np

print("Validating Route Estimation Logic (2024 Data)...\n")

# 1. Load Data for 2024 (where we have both actual routes and snaps)
print("Loading 2024 data...")
pbp = nflreadpy.load_pbp(seasons=[2024])
snaps = nflreadpy.load_snap_counts(seasons=[2024])
participation = nflreadpy.load_participation(seasons=[2024])

# Convert to pandas if needed
pbp = pbp.to_pandas() if hasattr(pbp, 'to_pandas') else pbp
snaps = snaps.to_pandas() if hasattr(snaps, 'to_pandas') else snaps
participation = participation.to_pandas() if hasattr(participation, 'to_pandas') else participation

print(f"Loaded: PBP({len(pbp)}), Snaps({len(snaps)}), Participation({len(participation)})")

# 2. Calculate Actual Routes (Ground Truth)
print("\nCalculating ACTUAL routes from Participation...")
pbp_cols = ["game_id", "play_id", "play_type", "week", "season", "posteam"]
pbp_lite = pbp[pbp_cols].copy()

part_cols = ["nflverse_game_id", "play_id", "offense_players"]
part_lite = participation[part_cols].copy()

pass_plays = pbp_lite[pbp_lite['play_type'] == 'pass']
merged = pd.merge(pass_plays, part_lite, left_on=['game_id', 'play_id'], right_on=['nflverse_game_id', 'play_id'])

merged['offense_players'] = merged['offense_players'].astype(str)
merged['player_id_split'] = merged['offense_players'].str.split(';')
exploded = merged.explode('player_id_split')

actual_routes = exploded.groupby(['player_id_split', 'season', 'week']).size().reset_index(name='actual_routes')
actual_routes.rename(columns={'player_id_split': 'player_id'}, inplace=True)
print(f"Calculated actual routes for {len(actual_routes)} player-weeks")

# 3. Calculate Estimated Routes (Snaps * Pass Rate)
print("\nCalculating ESTIMATED routes from Snaps * Pass Rate...")

# A. Calculate Team Pass Rate per Game
# Group by game_id and posteam
game_stats = pbp_lite.groupby(['game_id', 'posteam']).agg(
    pass_plays=('play_type', lambda x: (x == 'pass').sum()),
    total_plays=('play_type', lambda x: x.isin(['pass', 'run']).sum())
).reset_index()

game_stats['pass_rate'] = game_stats['pass_plays'] / game_stats['total_plays']
# Fill NaN or infinite rates (e.g. 0 plays)
game_stats['pass_rate'] = game_stats['pass_rate'].fillna(0)

print("Sample Team Pass Rates:")
print(game_stats[['posteam', 'pass_rate']].head())

# B. Get Player Snaps
# Snaps data has pfr_player_id, need to map to nflverse_id or use name?
# Snaps has 'player' (name) and 'team'. 
# Let's try to join on player name and team for this test, or use pfr_id map if available.
# Ideally we'd map IDs, but for a quick test, let's use Name + Team + Week.

# Filter snaps to offense only
off_snaps = snaps[(snaps['offense_snaps'] > 0) & (snaps['position'].isin(['WR', 'TE', 'RB']))].copy()

# Join Pass Rate to Snaps
# Snaps has 'game_id' which is PFR game id, not nflverse game id.
# But it has 'season', 'week', 'team'.
# game_stats has 'game_id' (nflverse), 'posteam'. We need to join on season/week/team.
# We need to add season/week to game_stats from pbp
game_meta = pbp_lite[['game_id', 'season', 'week']].drop_duplicates()
game_stats = game_stats.merge(game_meta, on='game_id')

# Now join snaps to game_stats
estimated = pd.merge(
    off_snaps,
    game_stats,
    left_on=['season', 'week', 'team'],
    right_on=['season', 'week', 'posteam'],
    how='inner'
)

estimated['estimated_routes'] = (estimated['offense_snaps'] * estimated['pass_rate']).round(1)

# 4. Compare Actual vs Estimated
print("\nComparing Actual vs Estimated...")

# We need to join actual_routes (by player_id) with estimated (by name).
# Let's load player map to bridge the gap
players_raw = nflreadpy.load_players()
players = players_raw.to_pandas() if hasattr(players_raw, 'to_pandas') else players_raw

players_map = players[['gsis_id', 'display_name', 'position']].copy()
players_map.rename(columns={'gsis_id': 'player_id'}, inplace=True)

actual_with_name = pd.merge(actual_routes, players_map, on='player_id')

# Join on Name + Week + Season (approximate but good enough for validation)
comparison = pd.merge(
    actual_with_name,
    estimated,
    left_on=['display_name', 'week', 'season'],
    right_on=['player', 'week', 'season'],
    how='inner'
)

# Filter to WRs only for cleanest comparison
wr_comp = comparison[comparison['position_x'] == 'WR'].copy()

# Calculate Error
wr_comp['diff'] = wr_comp['estimated_routes'] - wr_comp['actual_routes']
wr_comp['abs_diff'] = wr_comp['diff'].abs()
wr_comp['pct_error'] = (wr_comp['abs_diff'] / wr_comp['actual_routes']).replace([np.inf, -np.inf], 0)

print(f"\nComparison for {len(wr_comp)} WR game-weeks:")
print(f"Correlation: {wr_comp['actual_routes'].corr(wr_comp['estimated_routes']):.4f}")
print(f"Mean Absolute Error: {wr_comp['abs_diff'].mean():.2f} routes")
print(f"Median Absolute Error: {wr_comp['abs_diff'].median():.2f} routes")

print("\nSample Comparisons (Top WRs):")
sample = wr_comp.sort_values('actual_routes', ascending=False).head(10)
print(sample[['player', 'week', 'actual_routes', 'estimated_routes', 'diff']].to_string(index=False))

print("\nSample Comparisons (Large Errors):")
errors = wr_comp.sort_values('abs_diff', ascending=False).head(5)
print(errors[['player', 'week', 'actual_routes', 'estimated_routes', 'diff']].to_string(index=False))
