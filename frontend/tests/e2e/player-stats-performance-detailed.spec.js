/**
 * Detailed Performance Tests for Player Stats Page
 * 
 * These tests capture detailed performance metrics to help identify bottlenecks
 * when filtering by position (QB, RB, WR, TE)
 */

import { test, expect } from '@playwright/test';

test.describe('Player Stats Performance Analysis', () => {
  test.beforeEach(async ({ page }) => {
    // Enable performance monitoring
    await page.goto('/player-stats');
    await page.waitForLoadState('networkidle');
    
    // Enable console logging
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log(`[BROWSER ERROR] ${msg.text()}`);
      }
    });
  });

  test('Analyze QB filter performance', async ({ page }) => {
    const metrics = {
      filterStart: null,
      filterEnd: null,
      renderStart: null,
      renderEnd: null,
      apiCallDuration: null,
      uiBlockDuration: null,
      memoryUsage: null,
      errors: []
    };

    // Start performance monitoring
    await page.addInitScript(() => {
      window.__performanceMetrics = {
        filterStart: null,
        filterEnd: null,
        renderTimes: [],
        apiCalls: [],
        errors: []
      };
    });

    // Monitor API calls
    page.on('response', async (response) => {
      if (response.url().includes('/v1/data/player_stats')) {
        const timing = response.timing();
        const duration = timing.responseEnd - timing.requestStart;
        await page.evaluate(({ url, duration, status }) => {
          window.__performanceMetrics.apiCalls.push({
            url,
            duration,
            status,
            timestamp: Date.now()
          });
        }, { url: response.url(), duration, status: response.status() });
      }
    });

    // Monitor console errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        page.evaluate((error) => {
          window.__performanceMetrics.errors.push({
            message: error,
            timestamp: Date.now()
        });
        }, msg.text());
      }
    });

    // Get initial memory
    const initialMemory = await page.evaluate(() => {
      return performance.memory ? {
        usedJSHeapSize: performance.memory.usedJSHeapSize,
        totalJSHeapSize: performance.memory.totalJSHeapSize,
        jsHeapSizeLimit: performance.memory.jsHeapSizeLimit
      } : null;
    });

    // Record filter start
    metrics.filterStart = Date.now();
    await page.evaluate(() => {
      window.__performanceMetrics.filterStart = Date.now();
    });

    // Select QB position
    await page.selectOption('select[aria-label*="Position"], select[name*="position"], select', 'QB');
    
    // Wait for table to update
    await page.waitForSelector('table tbody tr', { timeout: 10000 });
    
    // Wait a bit for any async operations
    await page.waitForTimeout(2000);

    // Record filter end
    metrics.filterEnd = Date.now();
    await page.evaluate(() => {
      window.__performanceMetrics.filterEnd = Date.now();
    });

    // Get final metrics
    const finalMetrics = await page.evaluate(() => {
      return {
        ...window.__performanceMetrics,
        profilerData: window.__performanceProfiler?.PlayerStats?.getSummary() || null,
        renderCount: window.__playerStatsDebug?.getState?.()?.renderCount || null
      };
    });

    // Get final memory
    const finalMemory = await page.evaluate(() => {
      return performance.memory ? {
        usedJSHeapSize: performance.memory.usedJSHeapSize,
        totalJSHeapSize: performance.memory.totalJSHeapSize,
        jsHeapSizeLimit: performance.memory.jsHeapSizeLimit
      } : null;
    });

    // Calculate durations
    const filterDuration = metrics.filterEnd - metrics.filterStart;
    const apiCallDuration = finalMetrics.apiCalls.length > 0 
      ? Math.max(...finalMetrics.apiCalls.map(c => c.duration))
      : null;
    
    // Check for UI blocks (detected by profiler)
    const uiBlocks = finalMetrics.profilerData?.blockingDetections || [];
    const maxBlockDuration = uiBlocks.length > 0
      ? Math.max(...uiBlocks.map(b => b.delay || 0))
      : 0;

    // Compile results
    const results = {
      position: 'QB',
      filterDuration,
      apiCallDuration,
      maxUIBlockDuration: maxBlockDuration,
      renderCount: finalMetrics.renderCount,
      apiCalls: finalMetrics.apiCalls,
      errors: finalMetrics.errors,
      memoryDelta: initialMemory && finalMemory ? {
        usedJSHeapSize: finalMemory.usedJSHeapSize - initialMemory.usedJSHeapSize,
        totalJSHeapSize: finalMemory.totalJSHeapSize - initialMemory.totalJSHeapSize
      } : null,
      profilerSummary: finalMetrics.profilerData,
      timestamp: new Date().toISOString()
    };

    // Log results
    console.log('📊 QB Filter Performance Results:', JSON.stringify(results, null, 2));

    // Save to file for analysis
    await page.evaluate((data) => {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `qb-performance-${Date.now()}.json`;
      a.click();
    }, results);

    // Assertions
    expect(filterDuration).toBeLessThan(5000); // Should complete in <5 seconds
    expect(finalMetrics.errors.length).toBe(0); // No errors
    expect(maxBlockDuration).toBeLessThan(2000); // No UI blocks >2 seconds
  });

  test('Analyze RB filter performance', async ({ page }) => {
    // Similar to QB test but for RB
    const metrics = await analyzePositionFilter(page, 'RB');
    
    console.log('📊 RB Filter Performance Results:', JSON.stringify(metrics, null, 2));
    
    expect(metrics.filterDuration).toBeLessThan(5000);
    expect(metrics.errors.length).toBe(0);
    expect(metrics.maxUIBlockDuration).toBeLessThan(2000);
  });

  test('Analyze WR filter performance', async ({ page }) => {
    // Similar to QB test but for WR
    const metrics = await analyzePositionFilter(page, 'WR');
    
    console.log('📊 WR Filter Performance Results:', JSON.stringify(metrics, null, 2));
    
    expect(metrics.filterDuration).toBeLessThan(5000);
    expect(metrics.errors.length).toBe(0);
    expect(metrics.maxUIBlockDuration).toBeLessThan(2000);
  });

  test('Compare all positions performance', async ({ page }) => {
    const positions = ['QB', 'RB', 'WR', 'TE'];
    const results = {};

    for (const position of positions) {
      await page.goto('/player-stats');
      await page.waitForLoadState('networkidle');
      
      const metrics = await analyzePositionFilter(page, position);
      results[position] = metrics;
      
      // Wait between tests
      await page.waitForTimeout(1000);
    }

    // Generate comparison report
    const comparison = {
      timestamp: new Date().toISOString(),
      positions: results,
      summary: {
        slowestPosition: Object.entries(results).reduce((a, b) => 
          results[a[0]].filterDuration > results[b[0]].filterDuration ? a : b
        )[0],
        fastestPosition: Object.entries(results).reduce((a, b) => 
          results[a[0]].filterDuration < results[b[0]].filterDuration ? a : b
        )[0],
        averageFilterDuration: Object.values(results).reduce((sum, r) => sum + r.filterDuration, 0) / positions.length,
        positionsWithErrors: Object.entries(results).filter(([_, r]) => r.errors.length > 0).map(([p]) => p),
        positionsWithUIBlocks: Object.entries(results).filter(([_, r]) => r.maxUIBlockDuration > 500).map(([p]) => p)
      }
    };

    console.log('📊 Performance Comparison:', JSON.stringify(comparison, null, 2));

    // Save comparison report
    await page.evaluate((data) => {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `performance-comparison-${Date.now()}.json`;
      a.click();
    }, comparison);

    // Assertions
    expect(comparison.summary.positionsWithErrors.length).toBe(0);
  });
});

/**
 * Helper function to analyze position filter performance
 */
async function analyzePositionFilter(page, position) {
  // Setup monitoring (same as QB test)
  await page.addInitScript(() => {
    window.__performanceMetrics = {
      filterStart: null,
      filterEnd: null,
      renderTimes: [],
      apiCalls: [],
      errors: []
    };
  });

  // Monitor API calls and errors
  page.on('response', async (response) => {
    if (response.url().includes('/v1/data/player_stats')) {
      const timing = response.timing();
      const duration = timing.responseEnd - timing.requestStart;
      await page.evaluate(({ url, duration, status }) => {
        window.__performanceMetrics.apiCalls.push({
          url,
          duration,
          status,
          timestamp: Date.now()
        });
      }, { url: response.url(), duration, status: response.status() });
    }
  });

  page.on('console', msg => {
    if (msg.type() === 'error') {
      page.evaluate((error) => {
        window.__performanceMetrics.errors.push({
          message: error,
          timestamp: Date.now()
        });
      }, msg.text());
    }
  });

  const initialMemory = await page.evaluate(() => {
    return performance.memory ? {
      usedJSHeapSize: performance.memory.usedJSHeapSize,
      totalJSHeapSize: performance.memory.totalJSHeapSize
    } : null;
  });

  const filterStart = Date.now();
  await page.evaluate(() => {
    window.__performanceMetrics.filterStart = Date.now();
  });

  await page.selectOption('select[aria-label*="Position"], select[name*="position"], select', position);
  await page.waitForSelector('table tbody tr', { timeout: 10000 });
  await page.waitForTimeout(2000);

  const filterEnd = Date.now();
  await page.evaluate(() => {
    window.__performanceMetrics.filterEnd = Date.now();
  });

  const finalMetrics = await page.evaluate(() => {
    return {
      ...window.__performanceMetrics,
      profilerData: window.__performanceProfiler?.PlayerStats?.getSummary() || null,
      renderCount: window.__playerStatsDebug?.getState?.()?.renderCount || null
    };
  });

  const finalMemory = await page.evaluate(() => {
    return performance.memory ? {
      usedJSHeapSize: performance.memory.usedJSHeapSize,
      totalJSHeapSize: performance.memory.totalJSHeapSize
    } : null;
  });

  const filterDuration = filterEnd - filterStart;
  const apiCallDuration = finalMetrics.apiCalls.length > 0 
    ? Math.max(...finalMetrics.apiCalls.map(c => c.duration))
    : null;
  
  const uiBlocks = finalMetrics.profilerData?.blockingDetections || [];
  const maxBlockDuration = uiBlocks.length > 0
    ? Math.max(...uiBlocks.map(b => b.delay || 0))
    : 0;

  return {
    position,
    filterDuration,
    apiCallDuration,
    maxUIBlockDuration: maxBlockDuration,
    renderCount: finalMetrics.renderCount,
    apiCalls: finalMetrics.apiCalls,
    errors: finalMetrics.errors,
    memoryDelta: initialMemory && finalMemory ? {
      usedJSHeapSize: finalMemory.usedJSHeapSize - initialMemory.usedJSHeapSize,
      totalJSHeapSize: finalMemory.totalJSHeapSize - initialMemory.totalJSHeapSize
    } : null,
    profilerSummary: finalMetrics.profilerData,
    timestamp: new Date().toISOString()
  };
}

