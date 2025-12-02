import nflreadpy
import pandas as pd

print("Loading player stats...")
df = nflreadpy.load_player_stats(seasons=[2024])

if isinstance(df, list):
    df = pd.concat(df, ignore_index=True)

print(f"\nDataframe shape: {df.shape}")
print(f"\nAll column names:")
for col in sorted(df.columns.tolist()):
    print(f"  - {col}")
