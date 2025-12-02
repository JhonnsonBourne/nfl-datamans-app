import nflreadpy
import pandas as pd

print("Checking FTN Charting 2024...")
try:
    df_ftn = nflreadpy.load_ftn_charting(seasons=[2024])
    print(f"FTN Loaded: {len(df_ftn)} rows")
    print("Columns:", list(df_ftn.columns))
    print("Sample row:", df_ftn.iloc[0].to_dict())
except Exception as e:
    print(f"FTN Error: {e}")
