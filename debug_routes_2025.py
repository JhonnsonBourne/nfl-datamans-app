import nflreadpy
import pandas as pd

print("Checking 2025 routes calculation...")

# Load player stats
print("\n1. Loading player_stats for 2025...")
try:
    stats_df = nflreadpy.load_player_stats(seasons=[2025])
    print(f"   Loaded {len(stats_df)} rows")
    print(f"   Columns: {stats_df.columns.tolist()[:10]}...")
    
    # Check for routes column
    if 'routes' in stats_df.columns:
        print(f"   'routes' column exists")
        print(f"   Sample routes values: {stats_df['routes'].head(10).tolist()}")
    else:
        print("   'routes' column NOT in player_stats")
except Exception as e:
    print(f"   Error: {e}")

# Load PBP data
print("\n2. Loading PBP for 2025...")
try:
    pbp_df = nflreadpy.load_pbp(seasons=[2025])
    print(f"   Loaded {len(pbp_df)} rows")
    print(f"   Columns with 'play': {[c for c in pbp_df.columns if 'play' in c.lower()]}")
    
    # Check play_type values
    if 'play_type' in pbp_df.columns:
        print(f"   play_type values: {pbp_df['play_type'].value_counts().head()}")
        pass_plays = pbp_df[pbp_df['play_type'] == 'pass']
        print(f"   Pass plays: {len(pass_plays)}")
    else:
        print("   'play_type' column not found")
        print(f"   Available columns: {pbp_df.columns.tolist()[:20]}")
except Exception as e:
    print(f"   Error: {e}")

# Load Participation
print("\n3. Loading Participation for 2025...")
try:
    part_df = nflreadpy.load_participation(seasons=[2025])
    print(f"   Loaded {len(part_df)} rows")
    print(f"   Columns: {part_df.columns.tolist()}")
    
    if 'offense_players' in part_df.columns:
        sample = part_df['offense_players'].head(3)
        print(f"   Sample offense_players: {sample.tolist()}")
    else:
        print("   'offense_players' column not found")
except Exception as e:
    print(f"   Error: {e}")

print("\nDone!")
