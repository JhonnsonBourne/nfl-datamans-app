"""Simple test of NextGen Stats"""
import pandas as pd
from nflread_adapter import import_library, call_dataset

mod = import_library()
print(f"Using library: {mod.__name__}\n")

# Test receiving stats (most relevant for WRs)
print("Testing NextGen Stats - Receiving")
print("=" * 60)
try:
    df, func_name = call_dataset(mod, "nextgen_stats", seasons=[2024], stat_type="receiving")
    print(f"✅ Loaded {len(df):,} rows using {func_name}")
    print(f"Shape: {df.shape[0]:,} rows × {df.shape[1]} columns\n")
    
    print("COLUMNS:")
    print("-" * 60)
    for i, col in enumerate(df.columns, 1):
        print(f"{i:3d}. {col}")
    
    print(f"\n\nSAMPLE DATA (First 2 rows):")
    print("-" * 60)
    pd.set_option('display.max_columns', None)
    pd.set_option('display.width', 200)
    print(df.head(2))
    
    print(f"\n\nKEY METRICS FOR RECEIVING:")
    print("-" * 60)
    receiving_metrics = [col for col in df.columns if any(x in col.lower() for x in 
        ['cushion', 'separation', 'air_yards', 'yac', 'expected', 'catch', 'target'])]
    for col in receiving_metrics:
        print(f"  - {col}")
    
    # Check player matching
    print(f"\n\nPLAYER IDENTIFIERS:")
    print("-" * 60)
    id_cols = [col for col in df.columns if any(x in col.lower() for x in 
        ['player_id', 'gsis', 'player_name', 'player_display'])]
    for col in id_cols:
        if col in df.columns:
            print(f"  - {col}: {df[col].nunique():,} unique values")
            print(f"    Sample: {df[col].iloc[0] if len(df) > 0 else 'N/A'}")
    
except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()






