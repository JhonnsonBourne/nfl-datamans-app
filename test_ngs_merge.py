"""
Test script to diagnose NextGen Stats merge issue
"""
import requests
import json

print("=" * 80)
print("Testing NextGen Stats API Integration")
print("=" * 80)

# Test 1: Check if server is running
print("\n1. Checking server health...")
try:
    r = requests.get('http://127.0.0.1:8000/health', timeout=5)
    print(f"   ✅ Server is running: {r.status_code}")
    print(f"   Response: {r.json()}")
except Exception as e:
    print(f"   ❌ Server not responding: {e}")
    print("   Please make sure the server is running: uvicorn api:app --reload")
    exit(1)

# Test 2: Request player stats WITHOUT NextGen Stats
print("\n2. Testing player_stats WITHOUT NextGen Stats (2024)...")
try:
    r = requests.get('http://127.0.0.1:8000/v1/data/player_stats?seasons=2024&limit=1', timeout=30)
    data = r.json()
    if data.get('data') and len(data['data']) > 0:
        player = data['data'][0]
        print(f"   ✅ Got {len(data['data'])} players")
        print(f"   Sample player keys: {list(player.keys())[:10]}")
        print(f"   Has player_id: {'player_id' in player}")
        print(f"   Has season: {'season' in player}")
    else:
        print(f"   ⚠️  No data returned")
except Exception as e:
    print(f"   ❌ Error: {e}")

# Test 3: Request player stats WITH NextGen Stats (2024)
print("\n3. Testing player_stats WITH NextGen Stats (2024)...")
try:
    r = requests.get('http://127.0.0.1:8000/v1/data/player_stats?seasons=2024&include_ngs=true&ngs_stat_type=receiving&limit=1', timeout=60)
    data = r.json()
    if data.get('data') and len(data['data']) > 0:
        player = data['data'][0]
        print(f"   ✅ Got {len(data['data'])} players")
        ngs_keys = [k for k in player.keys() if k.startswith('ngs_')]
        print(f"   NextGen Stats keys found: {len(ngs_keys)}")
        if ngs_keys:
            print(f"   ✅ NextGen Stats columns: {ngs_keys[:10]}")
            # Show sample values
            for key in ngs_keys[:3]:
                print(f"      {key}: {player.get(key)}")
        else:
            print(f"   ❌ No NextGen Stats columns found!")
            print(f"   All player keys: {list(player.keys())[:20]}")
    else:
        print(f"   ⚠️  No data returned")
except Exception as e:
    print(f"   ❌ Error: {e}")
    import traceback
    traceback.print_exc()

# Test 4: Request player stats WITH NextGen Stats (2025)
print("\n4. Testing player_stats WITH NextGen Stats (2025)...")
try:
    r = requests.get('http://127.0.0.1:8000/v1/data/player_stats?seasons=2025&include_ngs=true&ngs_stat_type=receiving&limit=1', timeout=60)
    data = r.json()
    if data.get('data') and len(data['data']) > 0:
        player = data['data'][0]
        print(f"   ✅ Got {len(data['data'])} players")
        ngs_keys = [k for k in player.keys() if k.startswith('ngs_')]
        print(f"   NextGen Stats keys found: {len(ngs_keys)}")
        if ngs_keys:
            print(f"   ✅ NextGen Stats columns: {ngs_keys[:10]}")
        else:
            print(f"   ❌ No NextGen Stats columns found!")
            print(f"   (This is expected if 2025 NextGen Stats aren't available yet)")
    else:
        print(f"   ⚠️  No data returned")
except Exception as e:
    print(f"   ❌ Error: {e}")

print("\n" + "=" * 80)
print("Test Complete")
print("=" * 80)
print("\n💡 Check your backend terminal (where uvicorn is running) for detailed logs")
print("   Look for messages like:")
print("   - 'Loading NextGen Stats...'")
print("   - 'Loaded X NextGen Stats rows...'")
print("   - 'Merging NextGen Stats on: ...'")
print("   - Any error messages")






