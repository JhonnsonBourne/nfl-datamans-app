import nflreadpy
import time

print("Starting nflreadpy test...")
start = time.time()
try:
    df = nflreadpy.load_player_stats(seasons=[2024])
    end = time.time()
    print(f"Success! Loaded {len(df)} records in {end - start:.2f} seconds.")
    print(df.head())
except Exception as e:
    print(f"Error: {e}")
