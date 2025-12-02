import nflreadpy
import pandas as pd

print("Checking Participation Format...")
try:
    df = nflreadpy.load_participation(seasons=[2024])
    print(f"Loaded {len(df)} rows")
    sample = df['offense_players'].dropna().iloc[0]
    print(f"Sample offense_players ({type(sample)}): {sample}")
except Exception as e:
    print(f"Error: {e}")
