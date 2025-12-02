import requests

print("Testing 2025 routes after fix...\n")

# Test with 2025
print("1. Testing 2025 season:")
r = requests.get('http://localhost:8000/v1/data/player_stats?seasons_csv=2025&limit=100')
data = r.json()
wr_data = [p for p in data['data'] if p.get('position') == 'WR'][:5]

for p in wr_data:
    name = p.get('player_name', 'unknown')
    routes = p.get('routes', 'N/A')
    targets = p.get('targets', 'N/A')
    print(f"   {name}: routes={routes}, targets={targets}")

print("\n2. Testing 2024 season (should have routes):")
r2 = requests.get('http://localhost:8000/v1/data/player_stats?seasons_csv=2024&limit=100')
data2 = r2.json()
wr_data2 = [p for p in data2['data'] if p.get('position') == 'WR'][:5]

for p in wr_data2:
    name = p.get('player_name', 'unknown')
    routes = p.get('routes', 'N/A')
    targets = p.get('targets', 'N/A')
    print(f"   {name}: routes={routes}, targets={targets}")
