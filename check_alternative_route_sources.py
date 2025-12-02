import nflreadpy
import pandas as pd

print("Checking for alternative route data sources for 2025...\n")

# Check Next Gen Stats
print("1. Checking Next Gen Stats...")
try:
    ngs = nflreadpy.load_nextgen_stats(seasons=[2025], stat_type='receiving')
    ngs_df = ngs.to_pandas() if hasattr(ngs, 'to_pandas') else ngs
    print(f"   Loaded {len(ngs_df)} rows")
    print(f"   Columns: {[c for c in ngs_df.columns if 'route' in c.lower() or 'cushion' in c.lower() or 'separation' in c.lower()]}")
except Exception as e:
    print(f"   Error: {e}")

# Check Snap Counts
print("\n2. Checking Snap Counts...")
try:
    snaps = nflreadpy.load_snap_counts(seasons=[2025])
    snaps_df = snaps.to_pandas() if hasattr(snaps, 'to_pandas') else snaps
    print(f"   Loaded {len(snaps_df)} rows")
    print(f"   Columns: {snaps_df.columns.tolist()}")
    
    # Check if we can use offense_pct to estimate routes
    if 'offense_pct' in snaps_df.columns:
        print("\n   Found offense_pct!")
        print(f"   Sample data:")
        sample = snaps_df[snaps_df['position'].isin(['WR', 'TE'])].head(3)
        print(sample[['player', 'position', 'week', 'offense_snaps', 'offense_pct']].to_string(index=False))
except Exception as e:
    print(f"   Error: {e}")

# Check FTN Charting (sometimes has route data)
print("\n3. Checking FTN Charting...")
try:
    ftn = nflreadpy.load_ftn_charting(seasons=[2025])
    ftn_df = ftn.to_pandas() if hasattr(ftn, 'to_pandas') else ftn
    print(f"   Loaded {len(ftn_df)} rows")
    route_cols = [c for c in ftn_df.columns if 'route' in c.lower()]
    print(f"   Route columns: {route_cols}")
except Exception as e:
    print(f"   Error: {e}")

print("\n=== Conclusion ===")
print("Best available option for 2025 routes:")
print("  - Snap counts data (if available) + pass play %")
print("  - OR Targeted receiver counts (underestimates but better than 0)")
