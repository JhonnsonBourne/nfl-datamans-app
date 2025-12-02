import requests

r = requests.get('http://localhost:8000/v1/data/player_stats?seasons_csv=2024&limit=100')
data = r.json()

wr_data = [p for p in data['data'] if p.get('position') == 'WR'][:5]

print('Sample WR routes data:')
for p in wr_data:
    name = p.get('player_name', 'unknown')
    routes = p.get('routes', 'N/A')
    targets = p.get('targets', 'N/A')
    print(f"{name}: routes={routes}, targets={targets}")
