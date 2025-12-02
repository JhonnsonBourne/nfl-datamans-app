# Frontend Performance Optimization Analysis

## Executive Summary
This document identifies areas where client-side calculations can be moved to the backend to improve performance, reduce bundle size, and enhance user experience.

---

## 🔴 Critical Optimizations (High Impact)

### 1. **PlayerStatsTanStack.jsx - Efficiency Metrics Calculation**
**Current State:**
- All efficiency metrics (completion %, YPA, EPA/dropback, YPRR, etc.) are calculated client-side in `getCellValue()` callback
- Called for every cell render (potentially thousands of times per page load)
- Calculations include: completion_percentage, yards_per_attempt, epa_per_dropback, yprr, tprr, adot, racr, etc.

**Impact:**
- High CPU usage during table rendering
- Slower initial render, especially with large datasets
- Recalculations on every sort/filter

**Recommendation:**
- **Move all efficiency metrics to backend** in `/v1/player_stats` endpoint
- Pre-calculate: completion_pct, yards_per_attempt, epa_per_dropback, yards_per_carry, yprr, tprr, adot, racr, etc.
- Frontend should only format/display pre-calculated values

**Estimated Performance Gain:** 50-70% faster table rendering

---

### 2. **Home.jsx - Top Players Fetching**
**Current State:**
```javascript
const stats = await getPlayerStats([2025], 5000); // Fetches ALL players
const players = stats.data || [];
// Then filters and sorts client-side:
const qbs = players
    .filter(p => p.position === 'QB' && (p.fantasy_points_ppr || 0) > 0)
    .sort((a, b) => (b.fantasy_points_ppr || 0) - (a.fantasy_points_ppr || 0))
    .slice(0, 5);
```

**Impact:**
- Downloads 5000+ player records unnecessarily
- Client-side filtering/sorting of large dataset
- Slower initial page load

**Recommendation:**
- **Create `/v1/leaderboards/top` endpoint** that returns top N players by position
- Parameters: `season`, `position`, `limit`, `metric` (fantasy_points_ppr, passing_yards, etc.)
- Backend handles filtering, sorting, limiting

**Estimated Performance Gain:** 80-90% reduction in data transfer, 60-70% faster load

---

### 3. **Leaderboards.jsx - Client-Side Sorting**
**Current State:**
```javascript
const getTopPlayers = (metric, count = 20) => {
    return [...data]
        .sort((a, b) => (b[metric] || 0) - (a[metric] || 0))
        .slice(0, count);
};
```
- Fetches all players, sorts client-side

**Impact:**
- Unnecessary data transfer
- Client-side processing overhead

**Recommendation:**
- **Enhance `/v1/leaderboards` endpoint** with sorting/limiting
- Parameters: `season`, `metric`, `limit`, `position` (optional)
- Return pre-sorted, limited results

**Estimated Performance Gain:** 70-80% reduction in data transfer

---

## 🟡 Medium Priority Optimizations

### 4. **PlayerComparison.jsx - Similarity Calculation**
**Current State:**
- Simple similarity calculation done client-side
- Only uses 5-6 stats per position
- Calculated for every player in the list

**Impact:**
- Moderate CPU usage
- Less accurate than backend version (doesn't use efficiency metrics)

**Recommendation:**
- **Reuse `/v1/player/{player_id}/similar` endpoint** for comparison page
- Or create `/v1/players/compare` endpoint that takes multiple player IDs
- Ensures consistency with profile page similarity

**Estimated Performance Gain:** 30-40% faster, more accurate comparisons

---

### 5. **PlayerProfile.jsx - Game Log Aggregations**
**Current State:**
- Multiple `reduce()` operations for season totals:
  - `filteredLogs.reduce((s, g) => s + (g.passing_yards || 0), 0)`
  - `filteredLogs.reduce((s, g) => s + (g.completions || 0), 0)`
  - etc. (10+ reduce operations)

**Impact:**
- Moderate CPU usage
- Recalculated on every filter change

**Recommendation:**
- **Add aggregated totals to `/v1/player/{player_id}` response**
- Include: `season_totals`, `career_totals` objects
- Pre-calculate all aggregations on backend

**Estimated Performance Gain:** 20-30% faster profile page, smoother filtering

---

### 6. **GameDetail.jsx - Stat Calculations**
**Current State:**
- Some calculations like completion % done client-side:
  ```javascript
  {player.attempts > 0 ? ((player.completions / player.attempts) * 100).toFixed(1) : '-'}%
  ```

**Impact:**
- Low-moderate impact
- Inconsistent with other pages

**Recommendation:**
- **Include efficiency metrics in game detail player stats**
- Pre-calculate completion %, YPA, YPC, etc. on backend

**Estimated Performance Gain:** 10-15% faster, consistency improvement

---

## 🟢 Low Priority (Already Optimized)

### 7. **TeamStats.jsx - Sorting**
**Current State:**
- Client-side sorting of 32 teams
- Uses `sortTeams()` helper function

**Impact:**
- Minimal (only 32 items)
- Acceptable for small datasets

**Recommendation:**
- **Keep as-is** - sorting 32 teams is fast enough client-side
- Optional: Add backend sorting if needed for future features

---

## Implementation Priority

### Phase 1 (Immediate - High Impact)
1. ✅ **Player Similarity** - Already moved to backend
2. **PlayerStats Efficiency Metrics** - Move all calculations to backend
3. **Home Page Top Players** - Create dedicated endpoint

### Phase 2 (Short-term - Medium Impact)
4. **Leaderboards** - Add backend sorting/limiting
5. **Player Profile Aggregations** - Pre-calculate totals
6. **Player Comparison** - Use backend similarity

### Phase 3 (Long-term - Polish)
7. **Game Detail** - Include efficiency metrics
8. **Consistency** - Ensure all pages use backend-calculated metrics

---

## Backend Endpoint Changes Needed

### New Endpoints:
1. `GET /v1/leaderboards/top`
   - Parameters: `season`, `position`, `limit`, `metric`
   - Returns: Top N players by metric for position

2. `GET /v1/leaderboards` (enhance existing)
   - Add: `sort_by`, `limit`, `position` parameters
   - Return pre-sorted, limited results

### Enhanced Endpoints:
1. `GET /v1/player_stats` (enhance existing)
   - Add all efficiency metrics to response:
     - `completion_pct`, `yards_per_attempt`, `epa_per_dropback`
     - `yards_per_carry`, `rushing_epa_per_carry`
     - `yprr`, `tprr`, `adot`, `racr`, `catch_pct`
     - All per-game metrics

2. `GET /v1/player/{player_id}` (enhance existing)
   - Add `season_totals` object with aggregated stats
   - Add `career_totals` object
   - Pre-calculate all reduce operations

3. `GET /v1/game/{game_id}` (enhance existing)
   - Include efficiency metrics in player stats
     - Completion %, YPA, YPC, etc.

---

## Performance Metrics to Track

### Before Optimization:
- PlayerStats page load: ~X seconds
- Home page load: ~X seconds
- Leaderboards page load: ~X seconds
- Player Profile load: ~X seconds

### After Optimization (Expected):
- PlayerStats page load: 50-70% faster
- Home page load: 60-70% faster
- Leaderboards page load: 70-80% faster
- Player Profile load: 20-30% faster

---

## Notes

- **Data Consistency**: Moving calculations to backend ensures consistency across all pages
- **Caching**: Backend can cache calculated metrics more effectively
- **Bundle Size**: Removing calculation logic reduces frontend bundle size
- **Maintainability**: Single source of truth for metric calculations
- **Testing**: Easier to test calculations in isolation on backend



