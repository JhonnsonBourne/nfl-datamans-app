import nflreadpy
import pandas as pd

print("Checking FTN Charting 2024...")
try:
    df_ftn = nflreadpy.load_ftn_charting(seasons=[2024])
    print(f"FTN Loaded: {len(df_ftn)} rows")
    print("Columns:", df_ftn.columns.tolist())
except Exception as e:
    print(f"FTN Error: {e}")

print("\nChecking Participation 2024...")
try:
    df_part = nflreadpy.load_participation(seasons=[2024])
    print(f"Participation Loaded: {len(df_part)} rows")
    print("Columns:", df_part.columns.tolist())
except Exception as e:
    print(f"Participation Error: {e}")
