/**
 * Performance Testing Utilities
 * 
 * These utilities help identify performance bottlenecks in React components
 * and can be used in tests or during development.
 */

/**
 * Measure render performance of a React component
 */
export function measureComponentRender(componentName, renderFn) {
    const start = performance.now();
    const result = renderFn();
    const duration = performance.now() - start;
    
    if (duration > 16) { // More than one frame (60fps = 16ms per frame)
        console.warn(`⚠️ [PERF_TEST] ${componentName} render took ${duration.toFixed(2)}ms (>16ms threshold)`);
    }
    
    return { result, duration };
}

/**
 * Measure async operation performance
 */
export async function measureAsyncOperation(operationName, asyncFn) {
    const start = performance.now();
    const result = await asyncFn();
    const duration = performance.now() - start;
    
    console.log(`⏱️ [PERF_TEST] ${operationName}: ${duration.toFixed(2)}ms`);
    
    return { result, duration };
}

/**
 * Detect excessive re-renders
 */
export function createRenderTracker(componentName, maxRenders = 10) {
    let renderCount = 0;
    const renderTimes = [];
    let lastRenderTime = performance.now();
    
    return {
        trackRender: () => {
            renderCount++;
            const now = performance.now();
            const timeSinceLastRender = now - lastRenderTime;
            lastRenderTime = now;
            
            renderTimes.push(timeSinceLastRender);
            if (renderTimes.length > maxRenders) {
                renderTimes.shift();
            }
            
            // Detect rapid re-renders (potential infinite loop)
            if (renderTimes.length >= 5) {
                const avgTime = renderTimes.reduce((a, b) => a + b, 0) / renderTimes.length;
                if (avgTime < 16) {
                    console.error(`🚨 [PERF_TEST] ${componentName} rapid re-renders detected! Avg: ${avgTime.toFixed(2)}ms`);
                }
            }
            
            return { renderCount, timeSinceLastRender };
        },
        getStats: () => ({
            renderCount,
            avgTimeBetweenRenders: renderTimes.length > 0 
                ? renderTimes.reduce((a, b) => a + b, 0) / renderTimes.length 
                : 0,
            recentRenderTimes: renderTimes
        })
    };
}

/**
 * Measure useMemo/useCallback performance
 */
export function measureMemoPerformance(memoName, computeFn, deps) {
    const start = performance.now();
    const result = computeFn();
    const duration = performance.now() - start;
    
    if (duration > 100) {
        console.warn(`⚠️ [PERF_TEST] ${memoName} computation took ${duration.toFixed(2)}ms (>100ms threshold)`);
    }
    
    return { result, duration };
}

/**
 * Web Vitals monitoring
 */
export function initWebVitals() {
    if (typeof window === 'undefined') return;
    
    // Import web-vitals dynamically (only if available)
    // Note: This will fail silently if web-vitals is not installed
    try {
        import('web-vitals').then(({ onCLS, onFID, onFCP, onLCP, onTTFB, onINP }) => {
        onCLS((metric) => {
            console.log('📊 [WEB_VITALS] CLS:', metric);
            if (metric.value > 0.1) {
                console.warn('⚠️ [WEB_VITALS] Poor CLS score:', metric.value);
            }
        });
        onFID((metric) => {
            console.log('📊 [WEB_VITALS] FID:', metric);
            if (metric.value > 100) {
                console.warn('⚠️ [WEB_VITALS] Poor FID score:', metric.value);
            }
        });
        onFCP((metric) => {
            console.log('📊 [WEB_VITALS] FCP:', metric);
            if (metric.value > 1800) {
                console.warn('⚠️ [WEB_VITALS] Poor FCP score:', metric.value);
            }
        });
        onLCP((metric) => {
            console.log('📊 [WEB_VITALS] LCP:', metric);
            if (metric.value > 2500) {
                console.warn('⚠️ [WEB_VITALS] Poor LCP score:', metric.value);
            }
        });
        onTTFB((metric) => {
            console.log('📊 [WEB_VITALS] TTFB:', metric);
            if (metric.value > 800) {
                console.warn('⚠️ [WEB_VITALS] Poor TTFB score:', metric.value);
            }
        });
        onINP((metric) => {
            console.log('📊 [WEB_VITALS] INP:', metric);
            if (metric.value > 200) {
                console.warn('⚠️ [WEB_VITALS] Poor INP score:', metric.value);
            }
        });
        console.log('✅ Web Vitals monitoring initialized');
    }).catch(() => {
        console.warn('ℹ️ web-vitals not available (install: npm install web-vitals)');
    });
}

/**
 * Performance budget checker
 */
export class PerformanceBudget {
    constructor(budgets = {}) {
        this.budgets = {
            renderTime: 16, // 60fps = 16ms per frame
            asyncOperation: 1000, // 1 second
            dataProcessing: 500, // 500ms
            ...budgets
        };
        this.violations = [];
    }
    
    check(operationName, duration, category = 'renderTime') {
        const budget = this.budgets[category];
        if (duration > budget) {
            const violation = {
                operation: operationName,
                duration,
                budget,
                category,
                timestamp: Date.now()
            };
            this.violations.push(violation);
            console.error(`🚨 [PERF_BUDGET] Violation: ${operationName} took ${duration.toFixed(2)}ms (budget: ${budget}ms)`);
            return violation;
        }
        return null;
    }
    
    getViolations() {
        return this.violations;
    }
    
    clear() {
        this.violations = [];
    }
}

/**
 * React component performance wrapper
 * Note: This is a HOC (Higher Order Component) pattern
 * Usage: const TrackedComponent = withPerformanceTracking(MyComponent, 'MyComponent');
 * 
 * Note: This function requires React to be imported in the file that uses it
 */
export function withPerformanceTracking(Component, componentName) {
    // This is a placeholder - actual implementation would require React
    // For now, just return the component as-is
    // In practice, wrap with React.memo or use React DevTools Profiler instead
    return Component;
}

