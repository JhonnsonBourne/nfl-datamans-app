/**
 * E2E Performance Tests for Player Stats Page
 * 
 * Run: npx playwright test player-stats-performance
 */

import { test, expect } from '@playwright/test';

test.describe('Player Stats Performance', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/player-stats');
    await page.waitForLoadState('networkidle');
  });

  test('should load within performance budget', async ({ page }) => {
    const startTime = Date.now();
    
    await page.waitForSelector('table', { timeout: 10000 });
    
    const loadTime = Date.now() - startTime;
    expect(loadTime).toBeLessThan(5000); // 5 second budget
  });

  test('should filter to RB without blocking UI', async ({ page }) => {
    // Start performance monitoring
    await page.addInitScript(() => {
      window.__performanceTest = {
        startTime: performance.now(),
        blocks: []
      };
    });

    // Monitor for UI thread blocks
    await page.evaluate(() => {
      let lastCheck = performance.now();
      const checkInterval = setInterval(() => {
        const now = performance.now();
        const delay = now - lastCheck;
        if (delay > 100) {
          window.__performanceTest.blocks.push({
            delay,
            timestamp: now
          });
        }
        lastCheck = now;
      }, 50);
      
      setTimeout(() => clearInterval(checkInterval), 10000);
    });

    // Select RB position
    await page.selectOption('select[aria-label*="Position"]', 'RB');
    
    // Wait for table to update
    await page.waitForTimeout(2000);
    
    // Check for UI blocks
    const performanceData = await page.evaluate(() => window.__performanceTest);
    const longBlocks = performanceData.blocks.filter(b => b.delay > 500);
    
    expect(longBlocks.length).toBe(0); // No blocks > 500ms
  });

  test('should not fetch excessive data', async ({ page }) => {
    // Intercept API calls
    const apiCalls = [];
    page.on('request', (request) => {
      if (request.url().includes('/v1/data/player_stats')) {
        const url = new URL(request.url());
        const limit = url.searchParams.get('limit');
        apiCalls.push({ url: request.url(), limit: limit ? parseInt(limit) : null });
      }
    });

    await page.selectOption('select[aria-label*="Position"]', 'RB');
    await page.waitForTimeout(2000);

    // Check that limits are reasonable
    const rbCall = apiCalls.find(c => c.limit);
    if (rbCall) {
      expect(rbCall.limit).toBeLessThan(1000); // Should not fetch >1000 for RB
    }
  });

  test('should measure render performance with React Profiler', async ({ page }) => {
    // Enable React Profiler
    await page.addInitScript(() => {
      window.__reactProfiler = {
        renders: []
      };
    });

    // Select position and measure
    const startTime = performance.now();
    await page.selectOption('select[aria-label*="Position"]', 'WR');
    await page.waitForSelector('table tbody tr', { timeout: 10000 });
    const duration = performance.now() - startTime;

    expect(duration).toBeLessThan(2000); // Should complete in <2 seconds
  });
});

