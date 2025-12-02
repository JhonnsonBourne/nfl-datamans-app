import nflreadpy
import pandas as pd

print("Checking column names and data for Interceptions and Sacks...\n")

# Load 2024 player stats
df = nflreadpy.load_player_stats(seasons=[2024])
if hasattr(df, 'to_pandas'):
    df = df.to_pandas()

print(f"Columns: {sorted(df.columns.tolist())}")

# Check for interception/sack related columns
int_cols = [c for c in df.columns if 'int' in c.lower() or 'intercept' in c.lower()]
sack_cols = [c for c in df.columns if 'sack' in c.lower()]

print(f"\nInterception columns: {int_cols}")
print(f"Sack columns: {sack_cols}")

# Check values for top QBs
print("\nTop 5 QBs by attempts:")
qbs = df[df['position'] == 'QB'].sort_values('attempts', ascending=False).head(5)
cols_to_show = ['player_name', 'attempts', 'completions'] + int_cols + sack_cols
print(qbs[cols_to_show].to_string())

# Check CPOE column
cpoe_cols = [c for c in df.columns if 'cpoe' in c.lower()]
print(f"\nCPOE columns: {cpoe_cols}")
