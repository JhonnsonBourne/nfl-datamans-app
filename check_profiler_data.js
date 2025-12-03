// Quick script to check localStorage for profiler data
// Run this in browser console after a hang

console.log('=== Checking for Profiler Data ===');

// Check localStorage
const saved = localStorage.getItem('__profiler_autosave');
if (saved) {
    console.log('✅ Found profiler data in localStorage!');
    const data = JSON.parse(saved);
    console.log('Blocking detections:', data.blockingDetections?.length || 0);
    console.log('Render count:', data.recentRenders?.length || 0);
    console.log('Function stats:', Object.keys(data.functionStats || {}));
    
    // Export it
    const blob = new Blob([saved], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `profiler-autosave-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    console.log('✅ Data exported!');
} else {
    console.log('❌ No profiler data in localStorage');
}

// Check if profiler exists
if (window.__performanceProfiler?.PlayerStats) {
    console.log('✅ Profiler exists');
    const summary = window.__performanceProfiler.PlayerStats.getSummary();
    console.log('Summary:', summary);
} else {
    console.log('❌ Profiler not found');
}

