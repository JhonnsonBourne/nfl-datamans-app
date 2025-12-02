import nflreadpy

df = nflreadpy.load_player_stats(seasons=[2025])

print(f"Total records: {len(df)}")
print(f"\nFirst few column names: {list(df.columns[:20])}")
print(f"\nChecking if 'week' column exists: {'week' in df.columns}")

if 'week' in df.columns:
    print(f"Unique weeks: {sorted(df['week'].unique())}")
    print("\nThis appears to be WEEKLY data!")
    
    # Find Rodgers
    rodgers = df[df['player_display_name'] == 'Aaron Rodgers']
    if len(rodgers) > 0:
        print(f"\nAaron Rodgers has {len(rodgers)} weekly records")
        print("\nFirst 5 weeks:")
        print(rodgers[['week', 'fantasy_points_ppr', 'passing_yards', 'passing_tds']].head())
        
        print(f"\nSeason total fantasy points: {rodgers['fantasy_points_ppr'].sum():.1f}")
else:
    print("\nNo 'week' column - this might be season totals already")
