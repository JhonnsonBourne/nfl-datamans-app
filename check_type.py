import nflreadpy
import pandas as pd

print("Checking DF Type...")
try:
    df = nflreadpy.load_participation(seasons=[2024])
    print(f"Type: {type(df)}")
    
    if hasattr(df, 'to_pandas'):
        print("Has to_pandas()")
        df_pd = df.to_pandas()
        print(f"Converted Type: {type(df_pd)}")
        print(f"Sample: {df_pd['offense_players'].dropna().iloc[0]}")
    else:
        print("No to_pandas()")
        
except Exception as e:
    print(f"Error: {e}")
