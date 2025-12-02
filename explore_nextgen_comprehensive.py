"""
Comprehensive exploration of NextGen Stats
NextGen Stats requires a stat_type parameter
"""
import pandas as pd
from nflread_adapter import import_library, call_dataset

def explore_stat_type(stat_type, season=2024):
    """Explore a specific stat_type"""
    print(f"\n{'='*80}")
    print(f"Exploring stat_type: {stat_type}")
    print(f"{'='*80}")
    
    try:
        mod = import_library()
        
        # Try calling with stat_type parameter
        # First, get the function
        from nflread_adapter import resolve_dataset_callable
        func, func_name = resolve_dataset_callable(mod, "nextgen_stats")
        
        # Check function signature
        import inspect
        sig = inspect.signature(func)
        params = list(sig.parameters.keys())
        print(f"Function: {func_name}")
        print(f"Parameters: {params}")
        
        # Try calling with stat_type
        if 'stat_type' in params:
            result = func(seasons=[season], stat_type=stat_type)
        elif 'statType' in params:
            result = func(seasons=[season], statType=stat_type)
        else:
            # Try without stat_type first
            result = func(seasons=[season])
        
        # Convert to DataFrame
        if hasattr(result, 'to_pandas'):
            df = result.to_pandas()
        elif isinstance(result, pd.DataFrame):
            df = result
        else:
            df = pd.DataFrame(result)
        
        print(f"\n✅ Successfully loaded {len(df)} rows")
        print(f"Shape: {df.shape[0]:,} rows × {df.shape[1]} columns")
        
        print(f"\nColumns ({len(df.columns)}):")
        for i, col in enumerate(df.columns, 1):
            dtype = df[col].dtype
            non_null = df[col].notna().sum()
            pct = (non_null / len(df)) * 100 if len(df) > 0 else 0
            print(f"  {i:3d}. {col:30s} ({dtype}) - {non_null:,} non-null ({pct:.1f}%)")
        
        print(f"\nSample data (first 2 rows):")
        print(df.head(2).to_string())
        
        # Check for key columns
        key_cols = ['player_id', 'gsis_id', 'player_name', 'player', 'season', 'week', 'team', 'position']
        found_keys = [col for col in key_cols if col in df.columns]
        if found_keys:
            print(f"\nKey identifier columns found: {found_keys}")
        
        return df
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return None

# Common stat_types for NextGen Stats
stat_types = ['receiving', 'rushing', 'passing']

print("="*80)
print("NEXTGEN STATS EXPLORATION")
print("="*80)
print("\nNextGen Stats typically requires a stat_type parameter.")
print("Common stat_types: receiving, rushing, passing")

results = {}
for stat_type in stat_types:
    df = explore_stat_type(stat_type)
    if df is not None:
        results[stat_type] = df

# Summary
print("\n" + "="*80)
print("SUMMARY")
print("="*80)
for stat_type, df in results.items():
    print(f"\n{stat_type.upper()}:")
    print(f"  Rows: {len(df):,}")
    print(f"  Columns: {len(df.columns)}")
    if 'player_id' in df.columns or 'gsis_id' in df.columns:
        player_col = 'player_id' if 'player_id' in df.columns else 'gsis_id'
        print(f"  Unique players: {df[player_col].nunique():,}")
    if 'season' in df.columns:
        print(f"  Seasons: {sorted(df['season'].unique())}")






