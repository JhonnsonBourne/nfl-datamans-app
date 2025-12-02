import nflreadpy

df = nflreadpy.load_player_stats(seasons=[2024])
print(f"Type: {type(df)}")
print(f"Has to_dict: {hasattr(df, 'to_dict')}")
print(f"Dir: {[m for m in dir(df) if 'dict' in m.lower()]}")

# Try to convert to pandas if it's Polars
if hasattr(df, 'to_pandas'):
    print("\nConverting from Polars to Pandas...")
    df_pd = df.to_pandas()
    print(f"Pandas type: {type(df_pd)}")
    print(f"Columns: {list(df_pd.columns[:10])}")
    
    # Test dict conversion
    import json
    records = df_pd.head(2).to_dict(orient='records')
    print(f"\nFirst record keys: {list(records[0].keys())[:10]}")
    print(f"Sample: {json.dumps(records[0], default=str)[:300]}")
