import nflreadpy
import pandas as pd

print("Checking Player Stats Granularity...")
try:
    df = nflreadpy.load_player_stats(seasons=[2024])
    print(f"Loaded {len(df)} rows")
    print("Columns:", list(df.columns))
    if 'week' in df.columns:
        print("Has 'week' column - likely weekly")
    else:
        print("No 'week' column - likely season")
except Exception as e:
    print(f"Error: {e}")
