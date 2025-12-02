"""Check nextgen stats and write to file"""
from nflread_adapter import import_library, call_dataset
import pandas as pd

mod = import_library()
print(f"Library: {mod.__name__}")

# Try loading nextgen stats
try:
    df, func_name = call_dataset(mod, "nextgen_stats", seasons=[2024])
    
    with open('nextgen_exploration.txt', 'w', encoding='utf-8') as f:
        f.write(f"NextGen Stats Exploration\n")
        f.write("=" * 80 + "\n\n")
        f.write(f"Loaded {len(df)} rows using {func_name}\n")
        f.write(f"Shape: {df.shape[0]:,} rows × {df.shape[1]} columns\n\n")
        
        f.write("COLUMNS:\n")
        f.write("-" * 80 + "\n")
        for i, col in enumerate(df.columns, 1):
            f.write(f"{i:3d}. {col}\n")
        
        f.write("\n\nSAMPLE DATA (First 3 rows):\n")
        f.write("-" * 80 + "\n")
        f.write(df.head(3).to_string())
        
        f.write("\n\nDATA TYPES:\n")
        f.write("-" * 80 + "\n")
        f.write(str(df.dtypes))
        
        f.write("\n\nCOLUMN INFO:\n")
        f.write("-" * 80 + "\n")
        for col in df.columns:
            dtype = df[col].dtype
            non_null = df[col].notna().sum()
            pct = (non_null / len(df)) * 100
            f.write(f"{col}: {dtype}, {non_null:,} non-null ({pct:.1f}%)\n")
            if dtype in ['float64', 'int64']:
                try:
                    f.write(f"  Range: {df[col].min()} - {df[col].max()}\n")
                except:
                    pass
    
    print(f"✅ Results written to nextgen_exploration.txt")
    print(f"   Shape: {df.shape}")
    print(f"   Columns: {len(df.columns)}")
    
except Exception as e:
    print(f"Error: {e}")
    import traceback
    with open('nextgen_error.txt', 'w') as f:
        f.write(str(e))
        f.write("\n\n")
        traceback.print_exc(file=f)
    print("Error details written to nextgen_error.txt")






