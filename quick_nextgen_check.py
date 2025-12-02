"""Quick check of nextgen stats"""
from nflread_adapter import import_library, call_dataset
import pandas as pd

mod = import_library()
print(f"Library: {mod.__name__}")

# Try loading nextgen stats
try:
    df, func_name = call_dataset(mod, "nextgen_stats", seasons=[2024])
    print(f"\n✅ Loaded {len(df)} rows using {func_name}")
    print(f"\nColumns ({len(df.columns)}):")
    for col in df.columns:
        print(f"  - {col}")
    print(f"\nShape: {df.shape}")
    print(f"\nFirst few rows:")
    print(df.head(3))
    print(f"\nData types:")
    print(df.dtypes)
except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()






