# Analyzing the Hang - Quick Commands

## The profiler detected UI thread blocking!

The profiler is working and has detected:
- **2.4 second UI thread block** (this is why the site hangs!)
- Multiple message handlers taking 800ms+
- Forced reflows taking 300ms+

## Export the profiler data:

Run this in the console to export all the data:

```javascript
// Export profiler data
window.__performanceProfiler.PlayerStats.exportData()
```

This will download a JSON file with all the profiling data.

## Quick Analysis Commands:

```javascript
// Get summary
const summary = window.__performanceProfiler.PlayerStats.getSummary();
console.log('Summary:', summary);

// Get blocking detections
const report = window.__performanceProfiler.PlayerStats.getDetailedReport();
console.log('Blocking detections:', report.blockingDetections);
console.log('Suspicious patterns:', report.suspiciousPatterns);
console.log('Function stats:', report.functionStats);

// Check render history
console.log('Recent renders:', report.renderHistory.slice(-10));
```

## What to look for:

1. **Blocking detections** - operations that took >100ms
2. **Rapid renders** - infinite loops (renders <16ms apart)
3. **Excessive function calls** - functions called >1000 times
4. **Long renders** - renders that took >100ms

## Run this comprehensive analysis:

```javascript
function analyzeHang() {
    const profiler = window.__performanceProfiler.PlayerStats;
    const report = profiler.getDetailedReport();
    
    console.group('🔍 Hang Analysis');
    
    // Blocking operations
    const blocks = report.blockingDetections;
    console.log('🚨 Blocking Operations:', blocks.length);
    blocks.forEach(b => {
        if (b.delay) {
            console.error(`UI Thread Blocked: ${b.delay.toFixed(2)}ms`, b);
        } else if (b.duration) {
            console.warn(`Long Render: ${b.duration.toFixed(2)}ms`, b);
        }
    });
    
    // Rapid renders (infinite loops)
    const rapidRenders = report.suspiciousPatterns.filter(p => p.type === 'rapid_renders');
    if (rapidRenders.length > 0) {
        console.error('🚨 INFINITE LOOP DETECTED:', rapidRenders);
    }
    
    // Excessive function calls
    const excessiveCalls = Object.entries(report.functionStats)
        .filter(([name, stats]) => stats.count > 1000)
        .map(([name, stats]) => ({ name, count: stats.count, avgDuration: stats.totalDuration / stats.count }));
    if (excessiveCalls.length > 0) {
        console.warn('⚠️ Excessive Function Calls:', excessiveCalls);
    }
    
    // Render frequency
    const recentRenders = report.renderHistory.slice(-20);
    const avgTimeBetween = recentRenders.slice(1).reduce((sum, r, i) => sum + r.timeSinceLastRender, 0) / (recentRenders.length - 1);
    console.log(`📊 Average time between renders: ${avgTimeBetween.toFixed(2)}ms`);
    console.log(`📊 Total renders: ${report.renderHistory.length}`);
    
    console.groupEnd();
    
    return report;
}

// Run it
analyzeHang();
```

