import requests
import json

print("Checking API response for Interceptions and Sacks...\n")

r = requests.get('http://localhost:8000/v1/data/player_stats?seasons_csv=2024&limit=100')
data = r.json()
qbs = [p for p in data['data'] if p.get('position') == 'QB'][:5]

for p in qbs:
    name = p.get('player_name', 'unknown')
    ints = p.get('interceptions', 'N/A')
    sacks = p.get('sacks', 'N/A')
    print(f"   {name}: INT={ints}, Sacks={sacks}")
