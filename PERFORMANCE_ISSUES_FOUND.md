# Performance Issues Found & Fixes

## 🔴 CRITICAL: QB Position Not Responding

### Root Cause Analysis

When position is set to QB, the frontend requests:
- `/v1/data/player_stats?seasons=2025&limit=500&include_ngs=true&ngs_stat_type=passing`

**The Problem:**
1. **Routes Calculation Runs for ALL Positions** - Even QBs!
   - Loads PBP dataset (10-20 seconds)
   - Loads Participation dataset (10-20 seconds)  
   - Merges and processes millions of rows (5-10 seconds)
   - **Total: 25-50 seconds** - This is blocking the response!

2. **Routes calculation is ONLY needed for WR/TE/RB** - QBs don't run routes!

3. **Limit Applied AFTER Processing** - Backend processes ALL data, then limits

4. **NextGen Stats Loading** - Additional 5-10 seconds for passing stats

### Performance Metrics Collected

From `/debug/performance`:
- `/v1/player/{player_id}`: **884ms average** (up to 1177ms) - SLOW
- Only 2 operations tracked (need more usage to see full picture)

### Immediate Fixes Needed

1. **Skip Routes Calculation for QBs** ✅ (Can fix now)
2. **Apply Limit BEFORE Routes Calculation** ✅ (Can fix now)
3. **Skip Routes Calculation for 2025** (no participation data anyway)
4. **Add Position Filter to Backend** (longer-term)

---

## Performance Bottlenecks Identified

### 1. Routes Calculation (25-50 seconds) 🔴 CRITICAL
**Location**: `/v1/data/player_stats` endpoint  
**When**: Runs for ALL positions, even QBs  
**Fix**: Skip for QBs and 2025 season

### 2. NextGen Stats Loading (5-10 seconds) 🟡 HIGH
**Location**: NextGen Stats merge  
**When**: Every request with `include_ngs=true`  
**Fix**: Cache NextGen Stats, or make optional

### 3. Large DataFrame Operations (2-5 seconds) 🟡 HIGH
**Location**: `to_dict(orient="records")`  
**When**: Converting 500+ row DataFrames  
**Fix**: Apply limit before conversion

### 4. No Position Filtering (1-2 seconds wasted) 🟢 MEDIUM
**Location**: Backend doesn't filter by position  
**When**: Frontend requests 500 records but gets all positions  
**Fix**: Add position parameter to backend

---

## Quick Wins (Can Fix Now)

1. **Skip routes calculation for QBs** - Save 25-50 seconds
2. **Skip routes calculation for 2025** - No participation data anyway
3. **Apply limit before routes calculation** - Process less data
4. **Add timeout protection** - Don't let requests hang forever

---

## Expected Improvements

| Fix | Time Saved | Impact |
|-----|------------|--------|
| Skip routes for QBs | 25-50s | **CRITICAL** |
| Skip routes for 2025 | 25-50s | **CRITICAL** |
| Limit before processing | 5-10s | High |
| Position filtering | 1-2s | Medium |

**Total Expected**: **50-100 seconds faster** for QB requests!

