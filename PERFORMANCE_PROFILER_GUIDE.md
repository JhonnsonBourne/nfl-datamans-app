# Performance Profiler Guide

## Overview

The Performance Profiler is a comprehensive debugging framework that tracks:
- **Render cycles** and timing
- **Function call counts** and durations
- **Memory usage**
- **UI thread blocking** detection
- **Infinite loop** detection
- **Stack traces** when hangs occur

## Usage

### When the Site Hangs

1. **Before it hangs**: Open the browser console and run:
   ```javascript
   // Set up auto-export when hang is detected
   window.__playerStatsDebug.exportProfilerData();
   ```

2. **If console is still accessible**:
   ```javascript
   // Get quick summary
   window.__playerStatsDebug.getProfilerSummary()
   
   // Get full detailed report
   window.__playerStatsDebug.getProfilerReport()
   
   // Export data for analysis
   window.__playerStatsDebug.exportProfilerData()
   ```

3. **Check for patterns**:
   ```javascript
   const report = window.__playerStatsDebug.getProfilerReport();
   
   // Check for rapid renders (infinite loop)
   console.log('Suspicious patterns:', report.suspiciousPatterns);
   
   // Check for blocking operations
   console.log('Blocking detections:', report.blockingDetections);
   
   // Check function call counts
   console.log('Function stats:', report.functionStats);
   
   // Check render history
   console.log('Recent renders:', report.renderHistory.slice(-10));
   ```

### Key Metrics to Check

#### 1. Infinite Loop Detection
```javascript
const report = window.__playerStatsDebug.getProfilerReport();
const rapidRenders = report.suspiciousPatterns.filter(p => p.type === 'rapid_renders');
if (rapidRenders.length > 0) {
    console.error('INFINITE LOOP DETECTED:', rapidRenders);
}
```

#### 2. Excessive Function Calls
```javascript
const summary = window.__playerStatsDebug.getProfilerSummary();
Object.entries(summary.functionStats).forEach(([name, stats]) => {
    if (stats.count > 1000) {
        console.warn(`Excessive calls to ${name}: ${stats.count} calls`);
    }
});
```

#### 3. Long Renders (Blocking)
```javascript
const report = window.__playerStatsDebug.getProfilerReport();
const longRenders = report.blockingDetections.filter(b => b.duration > 100);
if (longRenders.length > 0) {
    console.error('Long renders detected:', longRenders);
}
```

#### 4. UI Thread Blocking
```javascript
const report = window.__playerStatsDebug.getProfilerReport();
const uiBlocks = report.blockingDetections.filter(b => b.delay);
if (uiBlocks.length > 0) {
    console.error('UI thread blocked:', uiBlocks);
}
```

### Analyzing the Data

#### Export and Analyze
1. Export the profiler data:
   ```javascript
   window.__playerStatsDebug.exportProfilerData();
   ```
   This downloads a JSON file with all profiling data.

2. Look for patterns:
   - **Rapid renders** (< 16ms between renders) = infinite loop
   - **High function call counts** (> 1000) = excessive recalculation
   - **Long render durations** (> 100ms) = blocking operation
   - **UI thread delays** (> 100ms) = main thread blocked

#### Common Issues and Solutions

1. **Infinite Loop (rapid_renders)**
   - Check `renderHistory` for props that change on every render
   - Look for `useEffect` dependencies that cause re-renders
   - Check for state updates in render functions

2. **Excessive Function Calls**
   - Check `functionStats` for functions called > 1000 times
   - Look for functions called in loops without memoization
   - Check for functions recalculated on every render

3. **Long Renders**
   - Check `blockingDetections` for operations > 100ms
   - Look for synchronous operations blocking the UI
   - Check for large data processing in render

4. **UI Thread Blocking**
   - Check `blockingDetections` for `delay` property
   - Look for synchronous operations that block `requestAnimationFrame`
   - Check for memory leaks (increasing `memoryUsage`)

### Example Analysis Script

```javascript
// Run this in the console to get a comprehensive analysis
function analyzePerformance() {
    const report = window.__playerStatsDebug.getProfilerReport();
    
    console.group('🔍 Performance Analysis');
    
    // Check for infinite loops
    const rapidRenders = report.suspiciousPatterns.filter(p => p.type === 'rapid_renders');
    if (rapidRenders.length > 0) {
        console.error('🚨 INFINITE LOOP DETECTED:', rapidRenders);
    } else {
        console.log('✅ No infinite loops detected');
    }
    
    // Check for excessive function calls
    const excessiveCalls = Object.entries(report.functionStats)
        .filter(([name, stats]) => stats.count > 1000)
        .map(([name, stats]) => ({ name, count: stats.count }));
    if (excessiveCalls.length > 0) {
        console.warn('⚠️ Excessive function calls:', excessiveCalls);
    } else {
        console.log('✅ Function call counts are reasonable');
    }
    
    // Check for blocking operations
    const blockingOps = report.blockingDetections.filter(b => b.duration > 100 || b.delay > 100);
    if (blockingOps.length > 0) {
        console.error('🚨 Blocking operations detected:', blockingOps);
    } else {
        console.log('✅ No blocking operations detected');
    }
    
    // Check render frequency
    const recentRenders = report.renderHistory.slice(-10);
    const avgTimeBetween = recentRenders.reduce((sum, r, i) => {
        if (i === 0) return sum;
        return sum + r.timeSinceLastRender;
    }, 0) / (recentRenders.length - 1);
    console.log(`📊 Average time between renders: ${avgTimeBetween.toFixed(2)}ms`);
    
    // Check memory usage
    if (report.summary.memoryUsage) {
        const memMB = report.summary.memoryUsage.used / 1024 / 1024;
        console.log(`💾 Memory usage: ${memMB.toFixed(2)} MB`);
    }
    
    console.groupEnd();
    
    return report;
}

// Run the analysis
analyzePerformance();
```

### Tips

1. **Start profiling early**: The profiler starts automatically when the component mounts
2. **Export before it hangs**: Set up auto-export or export periodically
3. **Look for patterns**: Check `suspiciousPatterns` and `blockingDetections` first
4. **Check function stats**: Look for functions called excessively
5. **Review render history**: Check what props/state change between renders

### Accessing Profiler Data

All profiler data is available via:
- `window.__playerStatsDebug.getProfilerSummary()` - Quick summary
- `window.__playerStatsDebug.getProfilerReport()` - Full detailed report
- `window.__playerStatsDebug.exportProfilerData()` - Export to JSON file
- `window.__performanceProfiler.PlayerStats` - Direct access to profiler instance

