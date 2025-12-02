/**
 * Performance Logger Utility
 * Tracks and logs performance metrics for debugging
 */

class PerformanceLogger {
    constructor() {
        this.metrics = [];
        this.enabled = process.env.NODE_ENV === 'development' || localStorage.getItem('perfLogging') === 'true';
    }

    start(label) {
        if (!this.enabled) return null;
        const startTime = performance.now();
        return {
            label,
            startTime,
            end: () => {
                const duration = performance.now() - startTime;
                this.record(label, duration);
                return duration;
            }
        };
    }

    record(label, duration, metadata = {}) {
        if (!this.enabled) return;
        
        const entry = {
            label,
            duration: duration.toFixed(2),
            timestamp: new Date().toISOString(),
            ...metadata
        };
        
        this.metrics.push(entry);
        
        // Log to console with color coding
        const color = duration > 1000 ? '🔴' : duration > 500 ? '🟡' : '🟢';
        console.log(`${color} [PERF] ${label}: ${duration.toFixed(2)}ms`, metadata);
        
        // Keep only last 100 entries
        if (this.metrics.length > 100) {
            this.metrics.shift();
        }
    }

    getMetrics() {
        return this.metrics;
    }

    getSummary() {
        const summary = {};
        this.metrics.forEach(metric => {
            if (!summary[metric.label]) {
                summary[metric.label] = {
                    count: 0,
                    total: 0,
                    min: Infinity,
                    max: -Infinity,
                    avg: 0
                };
            }
            const stats = summary[metric.label];
            const duration = parseFloat(metric.duration);
            stats.count++;
            stats.total += duration;
            stats.min = Math.min(stats.min, duration);
            stats.max = Math.max(stats.max, duration);
            stats.avg = stats.total / stats.count;
        });
        return summary;
    }

    printSummary() {
        if (!this.enabled) return;
        const summary = this.getSummary();
        console.group('📊 Performance Summary');
        Object.entries(summary).forEach(([label, stats]) => {
            console.log(`${label}:`, {
                count: stats.count,
                avg: `${stats.avg.toFixed(2)}ms`,
                min: `${stats.min.toFixed(2)}ms`,
                max: `${stats.max.toFixed(2)}ms`,
                total: `${stats.total.toFixed(2)}ms`
            });
        });
        console.groupEnd();
    }

    clear() {
        this.metrics = [];
    }
}

// Singleton instance
export const perfLogger = new PerformanceLogger();

// React hook for component performance
export const usePerformanceTracking = (componentName) => {
    const trackRender = () => {
        if (perfLogger.enabled) {
            const renderStart = performance.now();
            return () => {
                const renderTime = performance.now() - renderStart;
                perfLogger.record(`${componentName} render`, renderTime);
            };
        }
        return () => {};
    };

    return { trackRender };
};

// Helper to measure async operations
export const measureAsync = async (label, fn, metadata = {}) => {
    const timer = perfLogger.start(label);
    try {
        const result = await fn();
        timer.end();
        return result;
    } catch (error) {
        timer.end();
        perfLogger.record(`${label} (error)`, 0, { error: error.message, ...metadata });
        throw error;
    }
};

// Helper to measure sync operations
export const measureSync = (label, fn, metadata = {}) => {
    const timer = perfLogger.start(label);
    try {
        const result = fn();
        const duration = timer.end();
        return result;
    } catch (error) {
        timer.end();
        perfLogger.record(`${label} (error)`, 0, { error: error.message, ...metadata });
        throw error;
    }
};

export default perfLogger;



