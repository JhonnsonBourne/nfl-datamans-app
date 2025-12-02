import nflreadpy
import pandas as pd

try:
    df = nflreadpy.load_player_stats(seasons=[2024])
    advanced = ['target_share', 'wopr', 'racr', 'air_yards_share', 'cpoe', 'dakota', 'pacr']
    found = []
    missing = []
    for col in advanced:
        if col in df.columns:
            found.append(col)
        else:
            missing.append(col)
    print(f"FOUND: {found}")
    print(f"MISSING: {missing}")
except Exception as e:
    print(f"Error: {e}")
