import nflreadpy
import pandas as pd

print("Testing route estimation from PBP receiver data for 2025...\n")

# Load 2025 PBP and convert to pandas
pbp_raw = nflreadpy.load_pbp(seasons=[2025])
pbp = pbp_raw.to_pandas() if hasattr(pbp_raw, 'to_pandas') else pbp_raw

# Filter to pass plays
pass_plays = pbp[pbp['play_type'] == 'pass'].copy()
print(f"Pass plays in 2025: {len(pass_plays)}")

# Approach 1: Count targeted receivers per player/week
print("\n=== Approach 1: Targeted Receiver Routes ===")
print("Count each pass play where player was the target as a route")

targeted_routes = pass_plays[pass_plays['receiver_player_id'].notna()].copy()
targeted_routes = targeted_routes.groupby(['receiver_player_id', 'season', 'week']).size().reset_index(name='targeted_routes')

print(f"Unique receivers with targets in 2025: {targeted_routes['receiver_player_id'].nunique()}")
print(f"\nTop 5 by targeted routes:")
top_receivers = targeted_routes.groupby('receiver_player_id')['targeted_routes'].sum().sort_values(ascending=False).head()
for player_id, routes in top_receivers.items():
    print(f"  {player_id}: {routes} routes")

# Check if we can join to player names
print("\n=== Trying to get player names ===")
# Get unique receiver IDs and names from PBP
receiver_info = pbp[pbp['receiver_player_id'].notna()][['receiver_player_id', 'receiver_player_name']].drop_duplicates()
print(f"Found {len(receiver_info)} unique receivers")

if len(receiver_info) > 0:
    # Merge names
    targeted_routes = targeted_routes.merge(
        receiver_info,
        left_on='receiver_player_id',
        right_on='receiver_player_id',
        how='left'
    )
    
    # Show top receivers with names
    print(f"\nTop 10 WRs by total targeted routes (with names):")
    top_by_name = targeted_routes.groupby(['receiver_player_id', 'receiver_player_name'])['targeted_routes'].sum().sort_values(ascending=False).head(10)
    for (pid, name), routes in top_by_name.items():
        print(f"  {name}: {routes} routes")

# Compare to players in player_stats
print("\n=== Comparing to player_stats ===")
stats_raw = nflreadpy.load_player_stats(seasons=[2025])
stats = stats_raw.to_pandas() if hasattr(stats_raw, 'to_pandas') else stats_raw

# Get WRs/TEs with targets
wr_te = stats[stats['position'].isin(['WR', 'TE'])].copy()
print(f"WRs/TEs in player_stats: {len(wr_te)}")
print(f"WRs/TEs with targets > 0: {len(wr_te[wr_te['targets'] > 0])}")

# Sample comparison
print("\n=== Sample Comparison ===")
sample_players = wr_te.nlargest(5, 'targets')[['player_id', 'player_name', 'targets', 'week']]
print("Top 5 WRs by targets in player_stats (weekly):")
print(sample_players.to_string(index=False))

print("\nThis approach counts routes = times player was targeted")
print("Limitation: Doesn't count routes where player wasn't targeted")
print("But gives us SOME data for 2025!")
