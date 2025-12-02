import nflreadpy
import pandas as pd

print("Checking Snap Counts 2024...")
try:
    df = nflreadpy.load_snap_counts(seasons=[2024])
    print(f"Loaded {len(df)} rows")
    print("Columns:", list(df.columns))
    print("Sample:", df.iloc[0].to_dict())
except Exception as e:
    print(f"Error: {e}")
