/**
 * Performance Profiler for React Components
 * 
 * This profiler tracks:
 * - Render cycles and timing
 * - Function call counts and durations
 * - Memory usage
 * - UI thread blocking detection
 * - Infinite loop detection
 * - Stack traces when hangs occur
 */

// Global profiler registry - accessible from anywhere
if (typeof window !== 'undefined' && !window.__performanceProfiler) {
    window.__performanceProfiler = {};
}

class PerformanceProfiler {
    constructor(componentName = 'Component') {
        this.componentName = componentName;
        this.renderHistory = [];
        this.functionCalls = new Map();
        this.blockingDetections = [];
        this.maxHistorySize = 1000;
        this.isProfiling = false;
        this.renderStartTime = null;
        this.lastRenderTime = null;
        this.suspiciousPatterns = [];
        
        // Track if UI thread is blocked
        this.uiThreadMonitor = null;
        this.lastHeartbeat = performance.now();
        
        // Expose to window for debugging
        if (typeof window !== 'undefined') {
            window.__performanceProfiler = window.__performanceProfiler || {};
            window.__performanceProfiler[componentName] = this;
        }
    }
    
    /**
     * Start profiling
     */
    start() {
        this.isProfiling = true;
        this.startUIThreadMonitor();
        this.startPeriodicSave();
        console.log(`🔍 [PROFILER] Started profiling ${this.componentName}`);
    }
    
    /**
     * Periodically save data to localStorage and try to send to backend
     */
    startPeriodicSave() {
        if (this.periodicSaveInterval) return;
        
        this.periodicSaveInterval = setInterval(() => {
            try {
                const summary = this.getSummary();
                if (summary.totalRenders > 0) {
                    // Save to localStorage
                    const autoSaveData = {
                        timestamp: Date.now(),
                        summary: summary,
                        recentRenders: this.renderHistory.slice(-50),
                        functionStats: Object.fromEntries(this.functionCalls),
                        blockingDetections: this.blockingDetections.slice(-10),
                    };
                    localStorage.setItem('__profiler_autosave', JSON.stringify(autoSaveData));
                    localStorage.setItem('__profiler_autosave_time', Date.now().toString());
                }
            } catch (e) {
                // Ignore errors
            }
        }, 5000); // Save every 5 seconds
    }
    
    /**
     * Stop periodic save
     */
    stopPeriodicSave() {
        if (this.periodicSaveInterval) {
            clearInterval(this.periodicSaveInterval);
            this.periodicSaveInterval = null;
        }
    }
    
    /**
     * Stop profiling
     */
    stop() {
        this.isProfiling = false;
        this.stopUIThreadMonitor();
        this.stopPeriodicSave();
        console.log(`⏹️ [PROFILER] Stopped profiling ${this.componentName}`);
    }
    
    /**
     * Track a render cycle
     */
    trackRender(renderId, props = {}) {
        if (!this.isProfiling) return;
        
        const now = performance.now();
        const timeSinceLastRender = this.lastRenderTime ? now - this.lastRenderTime : 0;
        
        const renderInfo = {
            renderId,
            timestamp: now,
            timeSinceLastRender,
            props: JSON.parse(JSON.stringify(props)), // Deep clone
            memoryUsage: this.getMemoryUsage(),
            callCounts: this.getCallCountsSnapshot(),
        };
        
        this.renderHistory.push(renderInfo);
        if (this.renderHistory.length > this.maxHistorySize) {
            this.renderHistory.shift();
        }
        
        // Detect rapid re-renders (potential infinite loop)
        if (timeSinceLastRender < 16 && this.renderHistory.length > 1) {
            this.detectRapidRenders(renderInfo);
        }
        
        // Detect long renders (potential blocking)
        if (this.renderStartTime) {
            const renderDuration = now - this.renderStartTime;
            if (renderDuration > 100) {
                this.blockingDetections.push({
                    timestamp: now,
                    duration: renderDuration,
                    renderId,
                    props,
                });
                console.warn(`⚠️ [PROFILER] Long render detected: ${renderDuration.toFixed(2)}ms`, props);
            }
        }
        
        this.lastRenderTime = now;
        this.renderStartTime = null;
    }
    
    /**
     * Mark the start of a render
     */
    markRenderStart() {
        this.renderStartTime = performance.now();
    }
    
    /**
     * Track a function call
     */
    trackFunctionCall(functionName, duration, metadata = {}) {
        if (!this.isProfiling) return;
        
        if (!this.functionCalls.has(functionName)) {
            this.functionCalls.set(functionName, {
                count: 0,
                totalDuration: 0,
                minDuration: Infinity,
                maxDuration: 0,
                calls: [],
            });
        }
        
        const stats = this.functionCalls.get(functionName);
        stats.count++;
        stats.totalDuration += duration;
        stats.minDuration = Math.min(stats.minDuration, duration);
        stats.maxDuration = Math.max(stats.maxDuration, duration);
        
        // Keep last 100 calls for this function
        stats.calls.push({
            timestamp: performance.now(),
            duration,
            metadata: JSON.parse(JSON.stringify(metadata)),
        });
        if (stats.calls.length > 100) {
            stats.calls.shift();
        }
        
        // Detect excessive calls
        if (stats.count > 1000) {
            console.warn(`⚠️ [PROFILER] Excessive calls to ${functionName}: ${stats.count} calls`);
        }
    }
    
    /**
     * Detect rapid re-renders (potential infinite loop)
     */
    detectRapidRenders(currentRender) {
        const recentRenders = this.renderHistory.slice(-10);
        const rapidRenders = recentRenders.filter(r => r.timeSinceLastRender < 16);
        
        if (rapidRenders.length >= 5) {
            const pattern = {
                type: 'rapid_renders',
                timestamp: performance.now(),
                count: rapidRenders.length,
                avgTimeBetween: rapidRenders.reduce((sum, r) => sum + r.timeSinceLastRender, 0) / rapidRenders.length,
                renders: rapidRenders.map(r => ({
                    renderId: r.renderId,
                    props: r.props,
                })),
            };
            
            this.suspiciousPatterns.push(pattern);
            console.error(`🚨 [PROFILER] INFINITE LOOP DETECTED: ${rapidRenders.length} renders in <16ms`, pattern);
        }
    }
    
    /**
     * Start UI thread monitor
     */
    startUIThreadMonitor() {
        if (this.uiThreadMonitor) return;
        
        this.lastHeartbeat = performance.now();
        
        const checkHeartbeat = () => {
            const now = performance.now();
            const timeSinceHeartbeat = now - this.lastHeartbeat;
            
            // If heartbeat is delayed by >100ms, UI thread is likely blocked
            if (timeSinceHeartbeat > 100) {
                console.error(`🚨 [PROFILER] UI THREAD BLOCKED: ${timeSinceHeartbeat.toFixed(2)}ms delay detected`);
                
                // Capture stack trace
                const stackTrace = new Error().stack;
                const blockingInfo = {
                    timestamp: now,
                    delay: timeSinceHeartbeat,
                    stackTrace,
                    renderHistory: this.renderHistory.slice(-10), // Last 10 renders
                    functionStats: this.getCallCountsSnapshot(),
                };
                this.blockingDetections.push(blockingInfo);
                
                // AUTO-SAVE to localStorage when blocking detected (so we can retrieve it even if console is blocked)
                try {
                    const autoSaveData = {
                        timestamp: now,
                        delay: timeSinceHeartbeat,
                        summary: this.getSummary(),
                        recentRenders: this.renderHistory.slice(-20),
                        functionStats: Object.fromEntries(this.functionCalls),
                    };
                    localStorage.setItem('__profiler_autosave', JSON.stringify(autoSaveData));
                    localStorage.setItem('__profiler_autosave_time', now.toString());
                } catch (e) {
                    // Ignore localStorage errors
                }
                
                // AUTO-SEND to backend when blocking detected (for agent analysis)
                // Use sendBeacon for reliable delivery even if page is unloading
                try {
                    const reportData = this.getDetailedReport();
                    const dataToSend = {
                        ...reportData,
                        blockingInfo: blockingInfo,
                        timestamp: new Date().toISOString(),
                    };
                    
                    // Use sendBeacon for reliable delivery (works even during page unload)
                    const apiUrl = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';
                    const endpoint = `${apiUrl}/debug/profiler-data`;
                    
                    // Log that we're trying to send
                    console.log(`📤 [PROFILER] Attempting to send profiler data to ${endpoint}`);
                    
                    // Try fetch first (more reliable for JSON)
                    // Use keepalive to ensure it completes even if page unloads
                    fetch(endpoint, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(dataToSend),
                        keepalive: true, // Critical: keeps request alive during page unload
                    })
                    .then((response) => {
                        if (response.ok) {
                            console.log('✅ [PROFILER] Data sent successfully to backend');
                        } else {
                            console.error('❌ [PROFILER] Backend returned error:', response.status);
                        }
                    })
                    .catch((err) => {
                        console.error('❌ [PROFILER] Failed to send via fetch:', err);
                        // Fallback to sendBeacon (less reliable but works during unload)
                        if (navigator.sendBeacon) {
                            // sendBeacon doesn't support custom headers, so use FormData
                            const formData = new FormData();
                            formData.append('data', JSON.stringify(dataToSend));
                            const sent = navigator.sendBeacon(endpoint, formData);
                            console.log(`📤 [PROFILER] Fallback sendBeacon result: ${sent}`);
                        }
                    });
                } catch (e) {
                    console.error('📤 [PROFILER] Error sending data:', e);
                    // Data is already in localStorage as backup
                }
            }
            
            this.lastHeartbeat = now;
            
            if (this.isProfiling) {
                requestAnimationFrame(checkHeartbeat);
            }
        };
        
        requestAnimationFrame(checkHeartbeat);
        this.uiThreadMonitor = checkHeartbeat;
    }
    
    /**
     * Stop UI thread monitor
     */
    stopUIThreadMonitor() {
        this.uiThreadMonitor = null;
    }
    
    /**
     * Get memory usage (if available)
     */
    getMemoryUsage() {
        if (performance.memory) {
            return {
                used: performance.memory.usedJSHeapSize,
                total: performance.memory.totalJSHeapSize,
                limit: performance.memory.jsHeapSizeLimit,
            };
        }
        return null;
    }
    
    /**
     * Get call counts snapshot
     */
    getCallCountsSnapshot() {
        const snapshot = {};
        for (const [name, stats] of this.functionCalls.entries()) {
            snapshot[name] = stats.count;
        }
        return snapshot;
    }
    
    /**
     * Get performance summary
     */
    getSummary() {
        const recentRenders = this.renderHistory.slice(-20);
        const avgRenderTime = recentRenders.length > 0
            ? recentRenders.reduce((sum, r) => sum + r.timeSinceLastRender, 0) / recentRenders.length
            : 0;
        
        const functionStats = {};
        for (const [name, stats] of this.functionCalls.entries()) {
            functionStats[name] = {
                count: stats.count,
                avgDuration: stats.totalDuration / stats.count,
                minDuration: stats.minDuration,
                maxDuration: stats.maxDuration,
            };
        }
        
        return {
            componentName: this.componentName,
            totalRenders: this.renderHistory.length,
            avgTimeBetweenRenders: avgRenderTime,
            blockingDetections: this.blockingDetections.length,
            suspiciousPatterns: this.suspiciousPatterns.length,
            functionStats,
            memoryUsage: this.getMemoryUsage(),
            recentRenders: recentRenders.slice(-5),
        };
    }
    
    /**
     * Get detailed report
     */
    getDetailedReport() {
        return {
            componentName: this.componentName,
            renderHistory: this.renderHistory,
            functionCalls: Object.fromEntries(this.functionCalls),
            blockingDetections: this.blockingDetections,
            suspiciousPatterns: this.suspiciousPatterns,
            summary: this.getSummary(),
        };
    }
    
    /**
     * Export data for analysis
     */
    exportData() {
        const data = this.getDetailedReport();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `profiler-${this.componentName}-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
        console.log(`📥 [PROFILER] Exported data for ${this.componentName}`);
    }
    
    /**
     * Clear all data
     */
    clear() {
        this.renderHistory = [];
        this.functionCalls.clear();
        this.blockingDetections = [];
        this.suspiciousPatterns = [];
        console.log(`🗑️ [PROFILER] Cleared all data for ${this.componentName}`);
    }
}

/**
 * React hook for performance profiling
 */
export function usePerformanceProfiler(componentName, enabled = true) {
    const { useRef, useEffect } = require('react');
    const profilerRef = useRef(null);
    
    useEffect(() => {
        if (!enabled) return;
        
        profilerRef.current = new PerformanceProfiler(componentName);
        profilerRef.current.start();
        
        return () => {
            if (profilerRef.current) {
                profilerRef.current.stop();
            }
        };
    }, [componentName, enabled]);
    
    return profilerRef.current;
}

/**
 * Higher-order function to track function calls
 */
export function trackFunction(profiler, functionName) {
    return function(target, propertyKey, descriptor) {
        const originalMethod = descriptor.value;
        
        descriptor.value = function(...args) {
            if (!profiler || !profiler.isProfiling) {
                return originalMethod.apply(this, args);
            }
            
            const start = performance.now();
            const result = originalMethod.apply(this, args);
            const duration = performance.now() - start;
            
            profiler.trackFunctionCall(functionName, duration, {
                args: args.length,
                resultType: typeof result,
            });
            
            return result;
        };
        
        return descriptor;
    };
}

/**
 * Track a function call manually
 */
export function trackCall(profiler, functionName, fn, metadata = {}) {
    if (!profiler || !profiler.isProfiling) {
        return fn();
    }
    
    const start = performance.now();
    const result = fn();
    const duration = performance.now() - start;
    
    profiler.trackFunctionCall(functionName, duration, metadata);
    
    return result;
}

// Global helper function to get or create profiler
export function getOrCreateProfiler(componentName = 'PlayerStats') {
    if (typeof window === 'undefined') return null;
    
    if (!window.__performanceProfiler) {
        window.__performanceProfiler = {};
    }
    
    if (!window.__performanceProfiler[componentName]) {
        window.__performanceProfiler[componentName] = new PerformanceProfiler(componentName);
        window.__performanceProfiler[componentName].start();
        console.log(`🔍 [PROFILER] Created global profiler: ${componentName}`);
    }
    
    return window.__performanceProfiler[componentName];
}

// Initialize global profiler immediately if in browser
// This ensures it's available even before components load
if (typeof window !== 'undefined') {
    // Create PlayerStats profiler immediately
    const profiler = getOrCreateProfiler('PlayerStats');
    
    // Also expose a global helper function for easy access
    window.getProfiler = (name = 'PlayerStats') => {
        return getOrCreateProfiler(name);
    };
    
    // Log that profiler is ready
    console.log('🔍 [PROFILER] Global profiler initialized. Use window.getProfiler() or window.__performanceProfiler.PlayerStats');
}

export default PerformanceProfiler;

