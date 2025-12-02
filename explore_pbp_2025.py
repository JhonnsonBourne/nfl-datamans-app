import nflreadpy
import pandas as pd

print("Exploring 2025 PBP data for route calculation...\n")

# Load 2025 PBP data
pbp_raw = nflreadpy.load_pbp(seasons=[2025])
print(f"Loaded {len(pbp_raw)} plays for 2025")
print(f"Type: {type(pbp_raw)}")

# Convert to pandas if it's Polars
if hasattr(pbp_raw, 'to_pandas'):
    pbp = pbp_raw.to_pandas()
else:
    pbp = pbp_raw

# Filter to pass plays only
pass_plays = pbp[pbp['play_type'] == 'pass']
print(f"Pass plays: {len(pass_plays)}")

# Look for receiver-related columns
receiver_cols = [c for c in pbp.columns if any(x in c.lower() for x in ['receiver', 'target', 'route', 'snap', 'personnel'])]
print(f"\nReceiver-related columns: {receiver_cols}")

# Check for player ID columns
player_cols = [c for c in pbp.columns if 'player' in c.lower() or '_id' in c.lower()]
print(f"\nPlayer-related columns (first 30): {player_cols[:30]}")

# Look at a sample pass play
print("\nSample pass play - interesting columns:")
sample = pass_plays.iloc[0]
interesting_cols = [c for c in pbp.columns if any(x in c.lower() for x in 
    ['receiver', 'target', 'passer', 'rusher', 'player', 'personnel', 'offense', 'defense', 'formation'])]

for col in sorted(interesting_cols)[:40]:
    value = sample[col]
    if pd.notna(value) and value != '':
        print(f"  {col}: {value}")

# Check specific columns that might help
print("\n=== Key Columns for Route Calculation ===")

if 'receiver_player_id' in pbp.columns:
    print(f"\n✓ receiver_player_id found!")
    non_null = pbp['receiver_player_id'].notna().sum()
    print(f"  Non-null values: {non_null} ({non_null/len(pbp)*100:.1f}%)")
    print(f"  Sample values: {pbp['receiver_player_id'].dropna().unique()[:5].tolist()}")

if 'passer_player_id' in pbp.columns:
    print(f"\n✓ passer_player_id found!")
    pass_non_null = pbp['passer_player_id'].notna().sum()
    print(f"  Non-null values: {pass_non_null}")

# Check personnel / formation
if 'offense_personnel' in pbp.columns:
    print(f"\n✓ offense_personnel found!")
    print(f"  Sample values: {pbp['offense_personnel'].dropna().unique()[:5].tolist()}")
    
print("\n=== Analysis ===")
print("Can we identify receivers on pass plays?")
if 'receiver_player_id' in pbp.columns:
    targeted = pass_plays['receiver_player_id'].notna().sum()
    print(f"  Pass plays with receiver_player_id: {targeted}/{len(pass_plays)} ({targeted/len(pass_plays)*100:.1f}%)")

