# Player Stats Page - Performance Logging Guide

## Overview

Comprehensive logging has been added to the PlayerStats component to diagnose performance issues when filtering. All logs are prefixed with emojis for easy identification.

## Log Categories

### 🔄 [RENDER] - Component Re-renders
- **When**: Every time the component re-renders (throttled to every 5th render)
- **What to look for**: 
  - Rapid re-renders (< 50ms apart) = potential infinite loop
  - High render counts = excessive re-rendering
- **Example**:
  ```
  🔄 [RENDER] Render #15 {
    allDataLength: 1882,
    filteredDataLength: 73,
    sortedDataLength: 73,
    selectedPosition: "QB",
    ...
  }
  ```

### 🎯 [POSITION_CHANGE] - Position Filter Changes
- **When**: User changes position dropdown (ALL → QB, etc.)
- **What to look for**: Should only fire once per change
- **Example**:
  ```
  🎯 [POSITION_CHANGE] Position changed to: QB
    → Setting threshold: 50, sortKey: passing_epa
  ✅ [POSITION_CHANGE] Complete
  ```

### 🔍 [FILTER] - Data Filtering
- **When**: `filterByPosition()` runs
- **What to look for**: 
  - Should complete quickly (< 100ms for < 2000 rows)
  - Check row counts before/after each filter step
- **Example**:
  ```
  🔍 [FILTER] Starting filter { allDataLength: 1882, selectedPosition: "QB", ... }
    ✓ Position filter: 1882 → 73 rows
    ✓ Threshold filter: 73 → 44 rows
  ✅ [FILTER] Complete: 44 rows in 2.15ms
  ```

### 🔀 [SORT] - Data Sorting
- **When**: `sortedData` useMemo recalculates
- **What to look for**: 
  - Should use direct property access (faster)
  - Should complete quickly (< 50ms for < 200 rows)
  - Check `renderCellValue` call count
- **Example**:
  ```
  🔀 [SORT] Starting sort { filteredDataLength: 44, sortKey: "passing_epa", ... }
  ✅ [SORT] Complete: 44 rows in 1.23ms (0 renderCellValue calls)
  ```

### 📊 [COLUMN_RANGES] - Color Gradient Calculation
- **When**: `columnRanges` useMemo recalculates
- **What to look for**: 
  - Should use sample (100 rows) for large datasets
  - Should complete quickly (< 200ms)
- **Example**:
  ```
  📊 [COLUMN_RANGES] Starting calculation { sortedDataLength: 44, columnsCount: 25 }
    📈 Using full dataset: 44 rows
  ✅ [COLUMN_RANGES] Complete: 25 columns in 5.67ms
  ```

### 📥 [LOAD_DATA] - Data Fetching
- **When**: Component loads data from API
- **What to look for**: 
  - Fetch duration (should be < 500ms with cache)
  - Total players loaded
- **Example**:
  ```
  📥 [LOAD_DATA] Starting data load { selectedSeason: 2025, ... }
    → Fetching data with includeNgs=true
    ✓ Fetch complete: 1882 players in 28.26ms
  ✅ [LOAD_DATA] Complete in 35.12ms
  ```

### ⏱️ [PERF] - Performance Timing
- **When**: Any operation takes > 10ms
- **What to look for**: Slow operations that need optimization
- **Example**:
  ```
  ⏱️ [PERF] Sort 73 rows by passing_epa: 15.23ms
  ```

### ⚠️ Warnings
- **Rapid re-renders**: `⚠️ [RENDER] Rapid re-renders detected!`
- **Excessive function calls**: `⚠️ [RENDER_CELL_VALUE] Called 1000 times`

## How to Debug Filtering Issues

1. **Open Browser DevTools Console** (F12 or Right-click → Inspect → Console)

2. **Clear the console** to start fresh

3. **Change position filter** (e.g., ALL → QB)

4. **Watch for these patterns**:

   **Problem: Infinite Loop**
   ```
   🔄 [RENDER] Render #1
   🔄 [RENDER] Render #2
   🔄 [RENDER] Render #3
   ⚠️ [RENDER] Rapid re-renders detected! Render #6 (12ms since last)
   ```
   **Solution**: Check useEffect dependencies - something is causing state updates in a loop

   **Problem: Slow Filtering**
   ```
   🔍 [FILTER] Starting filter { allDataLength: 1882, ... }
   ✅ [FILTER] Complete: 73 rows in 5000.00ms  ← TOO SLOW!
   ```
   **Solution**: The filter function is taking too long - check for expensive operations

   **Problem: Slow Sorting**
   ```
   🔀 [SORT] Starting sort { filteredDataLength: 73, ... }
   ✅ [SORT] Complete: 73 rows in 2000.00ms (146 renderCellValue calls)  ← TOO MANY CALLS!
   ```
   **Solution**: Sort is calling renderCellValue too many times - should use direct property access

   **Problem: Slow Column Ranges**
   ```
   📊 [COLUMN_RANGES] Starting calculation { sortedDataLength: 73, columnsCount: 25 }
   ✅ [COLUMN_RANGES] Complete: 25 columns in 5000.00ms  ← TOO SLOW!
   ```
   **Solution**: Column range calculation is too expensive - may need further optimization

## Performance Benchmarks

| Operation | Good | Warning | Critical |
|-----------|------|---------|----------|
| Filter (< 2000 rows) | < 50ms | 50-200ms | > 200ms |
| Sort (< 200 rows) | < 20ms | 20-100ms | > 100ms |
| Column Ranges | < 100ms | 100-500ms | > 500ms |
| Render (time between) | > 100ms | 50-100ms | < 50ms |

## Next Steps

If you see performance issues:

1. **Check the console logs** - identify which operation is slow
2. **Look for patterns** - is it always the same operation?
3. **Check data size** - how many rows are being processed?
4. **Report findings** - share the console logs with the issue

## Disabling Logs

To disable logging for production, search for `console.log` and `console.warn` in `PlayerStats.jsx` and comment them out or wrap in a debug flag.

