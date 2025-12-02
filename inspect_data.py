import nflreadpy
import pandas as pd

print("Loading player stats...")
df = nflreadpy.load_player_stats(seasons=[2024])

print(f"\nDataframe shape: {df.shape}")
print(f"\nColumn names (first 20):")
print(list(df.columns[:20]))

print(f"\nColumn dtypes (first 10):")
print(df.dtypes.head(10))

print(f"\nFirst row:")
print(df.iloc[0].head(20))

print(f"\nSample data:")
print(df[['player_display_name', 'recent_team', 'position', 'fantasy_points_ppr']].head(10))
