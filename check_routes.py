import nflreadpy
import pandas as pd

try:
    print("Loading 2024 player stats...")
    df = nflreadpy.load_player_stats(seasons=[2024])
    
    route_cols = [c for c in df.columns if 'route' in c.lower()]
    print(f"Route columns found: {route_cols}")
    
except Exception as e:
    print(f"Error: {e}")
