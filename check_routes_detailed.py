import nflreadpy
import pandas as pd

def check_dataset(name, loader):
    print(f"\nChecking {name}...")
    try:
        df = loader(seasons=[2024])
        # Convert to pandas if it's not (simple check)
        if not isinstance(df, pd.DataFrame):
            if hasattr(df, 'to_pandas'):
                df = df.to_pandas()
            else:
                print("Unknown DataFrame type")
                
        print(f"Loaded {len(df)} rows")
        cols = df.columns.tolist() if hasattr(df.columns, 'tolist') else list(df.columns)
        
        route_cols = [c for c in cols if 'route' in c.lower()]
        print(f"Route columns: {route_cols}")
        
        # Check for player identifiers
        id_cols = [c for c in cols if 'id' in c.lower() or 'player' in c.lower()]
        print(f"ID columns (first 5): {id_cols[:5]}")
        
    except Exception as e:
        print(f"Error: {e}")

check_dataset("FTN", nflreadpy.load_ftn_charting)
check_dataset("Participation", nflreadpy.load_participation)
