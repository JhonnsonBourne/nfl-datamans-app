"""Test API endpoint to see exact error"""
import requests
import json

url = "http://127.0.0.1:8000/v1/data/player_stats?seasons=2025&limit=1&include_ngs=true&ngs_stat_type=receiving"

print("Testing API endpoint...")
print(f"URL: {url}\n")

try:
    response = requests.get(url, timeout=60)
    print(f"Status Code: {response.status_code}")
    print(f"Headers: {dict(response.headers)}\n")
    
    if response.status_code == 200:
        data = response.json()
        print("✅ Success!")
        if 'data' in data and len(data['data']) > 0:
            player = data['data'][0]
            ngs_keys = [k for k in player.keys() if k.startswith('ngs_')]
            print(f"Player keys: {list(player.keys())[:15]}")
            print(f"NextGen keys found: {len(ngs_keys)}")
            if ngs_keys:
                print(f"NextGen columns: {ngs_keys}")
            else:
                print("❌ No NextGen Stats columns in response")
    else:
        print(f"❌ Error {response.status_code}")
        print(f"Response: {response.text[:500]}")
        
except requests.exceptions.RequestException as e:
    print(f"❌ Request failed: {e}")
except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()






