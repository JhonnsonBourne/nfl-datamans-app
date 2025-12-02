import requests

print("Testing 2025 ESTIMATED routes...\n")

r = requests.get('http://localhost:8000/v1/data/player_stats?seasons_csv=2025&limit=100')
data = r.json()
wr_data = [p for p in data['data'] if p.get('position') == 'WR'][:10]

print("Top 10 WRs (by appearance):")
for p in wr_data:
    name = p.get('player_name', 'unknown')
    routes = p.get('routes', 'N/A')
    targets = p.get('targets', 'N/A')
    print(f"   {name}: routes={routes}, targets={targets}")
