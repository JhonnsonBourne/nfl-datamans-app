import nflreadpy
import pandas as pd
import numpy as np
import json

df = nflreadpy.load_player_stats(seasons=[2024])
print("Original columns:", list(df.columns[:10]))

# Test different approaches
print("\n1. Direct to_dict:")
records1 = df.head(2).to_dict(orient="records")
print(json.dumps(records1[0], default=str)[:200])

print("\n2. With fillna + replace:")
df2 = df.head(2).copy()
df2 = df2.fillna(value=np.nan)
df2 = df2.replace([np.nan, np.inf, -np.inf], None)
records2 = df2.to_dict(orient="records")
print("Columns after replace:", list(df2.columns[:10]))
print(json.dumps(records2[0], default=str)[:200])

print("\n3. With astype(object) + fillna:")
df3 = df.head(2).copy()
df3 = df3.astype(object).where(pd.notnull(df3), None)
records3 = df3.to_dict(orient="records")
print("Columns after where:", list(df3.columns[:10]))
print(json.dumps(records3[0], default=str)[:200])
