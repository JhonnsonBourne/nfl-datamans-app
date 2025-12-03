# Performance Analysis & Bottlenecks

## Critical Issues Identified

### 🔴 CRITICAL: Synchronous Dataset Loading
**Location**: All endpoints using `call_dataset()`  
**Impact**: **5-30 second delays** per request  
**Root Cause**: 
- Loading entire datasets from nflreadpy synchronously
- No caching
- Blocking I/O operations

**Example**:
```python
# This blocks for 5-30 seconds!
df, func_name = call_dataset(mod, "player_stats", seasons=[2024])
```

**Solution**: 
1. **Immediate**: Add caching layer
2. **Short-term**: Use PostgreSQL (already set up!)
3. **Long-term**: Pre-load data in Airflow, serve from DB

---

### 🔴 CRITICAL: Large DataFrame Conversions
**Location**: `df.to_dict(orient="records")`  
**Impact**: **2-10 second delays** for large datasets  
**Root Cause**:
- Converting entire DataFrames to Python dicts
- High memory usage
- Frontend requesting 5000-10000 records

**Example**:
```python
# Frontend requests 5000 records, backend loads ALL data then converts
records = df.to_dict(orient="records")  # SLOW!
```

**Solution**:
1. Apply limit BEFORE conversion
2. Use streaming for large datasets
3. Paginate properly

---

### 🔴 CRITICAL: Multiple Sequential Dataset Loads
**Location**: `/v1/player/{player_id}` endpoint  
**Impact**: **10-60 second delays**  
**Root Cause**:
- Loading 4+ datasets sequentially:
  1. `players` dataset
  2. `rosters` dataset  
  3. `player_stats` dataset (TWICE!)
  4. `schedules` dataset

**Example**:
```python
players_df, _ = call_dataset(mod, "players")  # 5s
roster_df, _ = call_dataset(mod, "rosters")   # 5s
stats_df, _ = call_dataset(mod, "player_stats")  # 10s
stats_df, _ = call_dataset(mod, "player_stats")  # 10s AGAIN!
schedule_df, _ = call_dataset(mod, "schedules")  # 5s
# Total: 35+ seconds!
```

**Solution**:
1. Load datasets in parallel (async)
2. Cache dataset loads
3. Use PostgreSQL (single query instead of 4+ loads)

---

### 🟡 HIGH: Complex Data Processing
**Location**: Routes calculation in `/v1/data/player_stats`  
**Impact**: **5-20 second delays**  
**Root Cause**:
- Loading PBP + Participation datasets
- Merging large DataFrames
- Exploding player lists
- Complex aggregations

**Example**:
```python
pbp_df, _ = call_dataset(mod, "pbp", seasons=participation_years)  # 10s
part_df, _ = call_dataset(mod, "participation", seasons=participation_years)  # 10s
merged = pd.merge(pbp_df, part_df, ...)  # 5s
# Process millions of rows
```

**Solution**:
1. Pre-calculate in dbt/Airflow
2. Store results in PostgreSQL
3. Cache calculations

---

### 🟡 HIGH: Frontend Over-fetching
**Location**: Frontend requesting 5000-10000 records  
**Impact**: **Unnecessary data transfer**  
**Root Cause**:
- Frontend requests high limits to account for filtering
- Backend loads ALL data, then frontend filters

**Example**:
```javascript
// Frontend requests 5000 records
const result = await getPlayerStats([2025], 5000);
// Then filters client-side
const qbs = result.data.filter(p => p.position === 'QB');
```

**Solution**:
1. Add position filter to backend
2. Use proper pagination
3. Backend should filter before returning

---

## Performance Targets

| Endpoint | Current | Target | Priority |
|----------|---------|--------|----------|
| `/health` | < 50ms ✅ | < 50ms | Low |
| `/v1/data/player_stats` | 10-30s ❌ | < 1s | **CRITICAL** |
| `/v1/player/{id}` | 20-60s ❌ | < 500ms | **CRITICAL** |
| `/v1/players` | 5-10s ❌ | < 500ms | High |
| `/v1/leaderboards/top` | 5-15s ❌ | < 1s | High |

---

## Immediate Actions

### 1. Add Performance Monitoring ✅
- Created `utils/performance.py`
- Added timing decorators
- Added debug endpoints

### 2. Add Logging to Identify Bottlenecks ✅
- Added `PerformanceTimer` context managers
- Logging slow operations
- Tracking endpoint timings

### 3. Quick Wins (Can Do Now)

#### A. Add Request-Level Caching
```python
from functools import lru_cache
import hashlib

@lru_cache(maxsize=100)
def cached_call_dataset(dataset, seasons_hash):
    # Cache dataset loads for 5 minutes
    pass
```

#### B. Limit Data Before Conversion
```python
# Apply limit BEFORE to_dict()
if limit and len(df) > limit:
    df = df.head(limit)
records = df.to_dict(orient="records")
```

#### C. Parallel Dataset Loading
```python
import asyncio

async def load_datasets_parallel():
    players, rosters, stats = await asyncio.gather(
        load_players(),
        load_rosters(),
        load_stats()
    )
```

### 4. Medium-Term (This Week)

#### A. Migrate to PostgreSQL
- Use `database/queries.py` instead of `call_dataset()`
- 10-100x faster queries
- Already implemented!

#### B. Add Redis Caching
- Cache dataset loads
- Cache query results
- TTL: 5-15 minutes

#### C. Optimize DataFrame Operations
- Use Polars instead of Pandas (faster)
- Stream large datasets
- Use generators

---

## Monitoring

### Check Performance Now
```bash
# Start API with performance monitoring
uvicorn api:app --reload

# In another terminal, check metrics
curl http://localhost:8000/debug/performance
curl http://localhost:8000/debug/slow-operations
```

### Watch Logs
Look for:
- `⏱️  SLOW OPERATION` - Operations > 1 second
- `🐌 SLOW ENDPOINT` - Endpoints > 2 seconds
- `ℹ️  Loaded {dataset}` - Dataset load times

---

## Next Steps

1. **Test performance monitoring** - Check `/debug/performance`
2. **Identify slowest endpoints** - Review logs
3. **Implement quick wins** - Caching, limits, parallel loading
4. **Migrate to PostgreSQL** - Use existing query layer
5. **Add Redis caching** - Cache frequently accessed data

---

## Expected Improvements

| Optimization | Expected Improvement |
|--------------|---------------------|
| PostgreSQL migration | **10-100x faster** |
| Request caching | **5-10x faster** (repeated requests) |
| Parallel loading | **3-4x faster** (multi-dataset endpoints) |
| Limit before conversion | **2-5x faster** (large datasets) |
| Frontend filtering | **80% less data transfer** |

**Total Expected**: **50-200x faster** for most endpoints!

