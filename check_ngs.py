import nflreadpy
import pandas as pd

def check_dataset(name, loader):
    print(f"\nChecking {name}...")
    try:
        df = loader(seasons=[2024], stat_type='receiving') # NGS needs stat_type
        # Convert to pandas if it's not
        if not isinstance(df, pd.DataFrame):
            if hasattr(df, 'to_pandas'):
                df = df.to_pandas()
                
        print(f"Loaded {len(df)} rows")
        cols = df.columns.tolist() if hasattr(df.columns, 'tolist') else list(df.columns)
        
        route_cols = [c for c in cols if 'route' in c.lower()]
        print(f"Route columns: {route_cols}")
        print("Columns:", cols)
        
    except Exception as e:
        print(f"Error: {e}")

check_dataset("NGS Receiving", nflreadpy.load_nextgen_stats)
