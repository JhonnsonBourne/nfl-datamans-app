"""
Explore NextGen Stats data structure from nflreadpy
"""

import pandas as pd
from nflread_adapter import import_library, call_dataset

def explore_nextgen_stats():
    """Load and explore nextgen stats data."""
    print("=" * 80)
    print("Exploring NextGen Stats Data")
    print("=" * 80)
    
    # Import library
    try:
        mod = import_library()
        print(f"\n✅ Successfully imported: {mod.__name__}\n")
    except Exception as e:
        print(f"❌ Error importing library: {e}")
        return
    
    # Load nextgen stats - try recent season first
    print("Loading NextGen Stats for 2024 season...")
    try:
        df, func_name = call_dataset(mod, "nextgen_stats", seasons=[2024])
        print(f"✅ Successfully loaded using: {func_name}\n")
    except Exception as e:
        print(f"⚠️  Error loading 2024 data: {e}")
        print("Trying without season filter...")
        try:
            df, func_name = call_dataset(mod, "nextgen_stats", seasons=None)
            print(f"✅ Successfully loaded using: {func_name}\n")
        except Exception as e2:
            print(f"❌ Error loading data: {e2}")
            return
    
    # Basic info
    print("=" * 80)
    print("DATASET OVERVIEW")
    print("=" * 80)
    print(f"Shape: {df.shape[0]:,} rows × {df.shape[1]} columns")
    print(f"Memory usage: {df.memory_usage(deep=True).sum() / 1024**2:.2f} MB")
    
    # Column information
    print("\n" + "=" * 80)
    print("COLUMNS")
    print("=" * 80)
    print(f"\nTotal columns: {len(df.columns)}")
    print("\nColumn names:")
    for i, col in enumerate(df.columns, 1):
        print(f"  {i:3d}. {col}")
    
    # Data types
    print("\n" + "=" * 80)
    print("DATA TYPES")
    print("=" * 80)
    dtype_counts = df.dtypes.value_counts()
    for dtype, count in dtype_counts.items():
        print(f"  {dtype}: {count} columns")
    
    # Sample data
    print("\n" + "=" * 80)
    print("SAMPLE DATA (First 5 rows)")
    print("=" * 80)
    pd.set_option('display.max_columns', None)
    pd.set_option('display.width', None)
    pd.set_option('display.max_colwidth', 30)
    print(df.head())
    
    # Check for key identifier columns
    print("\n" + "=" * 80)
    print("KEY IDENTIFIER COLUMNS")
    print("=" * 80)
    identifier_candidates = ['player_id', 'gsis_id', 'player_name', 'player', 'name', 
                            'season', 'week', 'team', 'position', 'pos']
    found_identifiers = [col for col in identifier_candidates if col in df.columns]
    if found_identifiers:
        print("Found identifier columns:")
        for col in found_identifiers:
            print(f"  - {col}")
            if col in ['player_id', 'gsis_id']:
                print(f"    Unique values: {df[col].nunique():,}")
    else:
        print("⚠️  No standard identifier columns found. Available columns:")
        print(f"  {list(df.columns[:10])}")
    
    # Check for season/week columns
    print("\n" + "=" * 80)
    print("TEMPORAL COLUMNS")
    print("=" * 80)
    temporal_cols = [col for col in df.columns if any(x in col.lower() for x in ['season', 'week', 'year', 'date', 'game'])]
    if temporal_cols:
        for col in temporal_cols:
            print(f"  - {col}: {df[col].dtype}")
            if df[col].dtype in ['int64', 'int32']:
                print(f"    Range: {df[col].min()} - {df[col].max()}")
                print(f"    Unique values: {df[col].nunique()}")
    else:
        print("⚠️  No temporal columns found")
    
    # Check for position/team columns
    print("\n" + "=" * 80)
    print("POSITION/TEAM COLUMNS")
    print("=" * 80)
    pos_team_cols = [col for col in df.columns if any(x in col.lower() for x in ['position', 'pos', 'team', 'club'])]
    if pos_team_cols:
        for col in pos_team_cols:
            print(f"  - {col}:")
            if df[col].dtype == 'object':
                unique_vals = df[col].dropna().unique()
                print(f"    Unique values ({len(unique_vals)}): {sorted(unique_vals)[:10]}")
            else:
                print(f"    Type: {df[col].dtype}")
    else:
        print("⚠️  No position/team columns found")
    
    # Look for NextGen-specific metrics
    print("\n" + "=" * 80)
    print("NEXTGEN-SPECIFIC METRICS")
    print("=" * 80)
    ngs_keywords = ['speed', 'acceleration', 'distance', 'time', 'separation', 
                    'cushion', 'target', 'catch', 'epa', 'expected', 'actual',
                    'air_yards', 'yac', 'completion', 'interception']
    ngs_cols = []
    for col in df.columns:
        col_lower = col.lower()
        if any(keyword in col_lower for keyword in ngs_keywords):
            ngs_cols.append(col)
    
    if ngs_cols:
        print(f"Found {len(ngs_cols)} potential NextGen metric columns:")
        for col in sorted(ngs_cols):
            dtype = df[col].dtype
            non_null = df[col].notna().sum()
            pct = (non_null / len(df)) * 100
            print(f"  - {col} ({dtype}): {non_null:,} non-null ({pct:.1f}%)")
            if dtype in ['float64', 'float32', 'int64', 'int32']:
                print(f"    Range: {df[col].min():.2f} - {df[col].max():.2f}")
    else:
        print("⚠️  No obvious NextGen metric columns found")
    
    # Check data granularity
    print("\n" + "=" * 80)
    print("DATA GRANULARITY")
    print("=" * 80)
    if 'season' in df.columns and 'week' in df.columns:
        print("Granularity: Weekly")
        print(f"Seasons: {sorted(df['season'].unique())}")
        print(f"Weeks per season (sample):")
        for season in sorted(df['season'].unique())[:3]:
            weeks = df[df['season'] == season]['week'].unique()
            print(f"  {season}: {len(weeks)} weeks ({min(weeks)}-{max(weeks)})")
    elif 'season' in df.columns:
        print("Granularity: Season-level")
        print(f"Seasons: {sorted(df['season'].unique())}")
    else:
        print("⚠️  Could not determine granularity")
    
    # Sample statistics
    print("\n" + "=" * 80)
    print("SAMPLE STATISTICS")
    print("=" * 80)
    numeric_cols = df.select_dtypes(include=['float64', 'int64', 'float32', 'int32']).columns
    if len(numeric_cols) > 0:
        print(f"\nNumeric columns summary (showing first 10):")
        print(df[numeric_cols[:10]].describe())
    
    # Check for player matching
    print("\n" + "=" * 80)
    print("PLAYER MATCHING POTENTIAL")
    print("=" * 80)
    if 'player_id' in df.columns or 'gsis_id' in df.columns:
        player_col = 'player_id' if 'player_id' in df.columns else 'gsis_id'
        print(f"✅ Can match on: {player_col}")
        print(f"   Unique players: {df[player_col].nunique():,}")
    elif 'player_name' in df.columns or 'player' in df.columns:
        name_col = 'player_name' if 'player_name' in df.columns else 'player'
        print(f"⚠️  Can match on name: {name_col}")
        print(f"   Unique players: {df[name_col].nunique():,}")
    else:
        print("❌ No clear player identifier found")
    
    print("\n" + "=" * 80)
    print("EXPLORATION COMPLETE")
    print("=" * 80)

if __name__ == "__main__":
    explore_nextgen_stats()






