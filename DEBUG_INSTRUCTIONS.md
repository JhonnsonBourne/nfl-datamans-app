# Debug Instructions - Player Stats Page Hang

## How to Debug in Browser Console

Since I cannot access the browser directly, please follow these steps:

### Step 1: Open Browser Console
1. Press **F12** (or Right-click → Inspect)
2. Go to **Console** tab
3. Clear the console (trash icon or Ctrl+L)

### Step 2: Check Debug API
After the page loads, type this in the console:
```javascript
window.__playerStatsDebug.getState()
```

This will show the current component state.

### Step 3: Try Filtering
1. Change position filter to "RB" or "WR"
2. Watch the console for logs
3. If it hangs, wait 5 seconds then type:
```javascript
window.__playerStatsDebug.getLogs()
```

This will show all recent logs.

### Step 4: Check for Infinite Loops
If you see rapid re-render warnings, type:
```javascript
// Get render count
window.__playerStatsDebug.getState().renderCount

// Get all logs
const logs = window.__playerStatsDebug.getLogs();
logs.filter(l => l.message.includes('RENDER')).slice(-20)
```

### Step 5: Share the Output
Copy and paste:
1. The output of `window.__playerStatsDebug.getLogs()`
2. Any error messages (red text)
3. The last 20 console log entries

## What to Look For

**Signs of Infinite Loop:**
- Rapid re-render warnings appearing repeatedly
- Render count increasing rapidly (> 50 renders in a few seconds)
- Same log messages repeating over and over

**Signs of Performance Issue:**
- `💾 [CELL_CACHE]` logs appearing repeatedly
- `📊 [COLUMN_RANGES]` taking > 500ms
- `🔀 [SORT]` taking > 200ms

## Quick Fixes to Try

If the page is hung, try in console:
```javascript
// Force stop any running operations
window.location.reload();

// Or clear React state
if (window.__playerStatsDebug) {
    window.__playerStatsDebug.clearLogs();
}
```

