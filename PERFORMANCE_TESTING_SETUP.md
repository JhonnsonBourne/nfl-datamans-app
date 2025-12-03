# Performance Testing Setup

This document outlines the testing and profiling tools to help identify performance issues.

## Tools to Install

### 1. React DevTools Profiler (Built-in)
- **Already available** in React DevTools browser extension
- **Usage**: Open DevTools → Profiler tab → Record → Interact with app → Stop
- **Shows**: Component render times, re-renders, commit phases

### 2. Web Vitals
```bash
npm install web-vitals
```
- **Purpose**: Measure Core Web Vitals (LCP, FID, CLS, etc.)
- **Usage**: Already integrated in `performanceTesting.js`

### 3. Why Did You Render
```bash
npm install @welldone-software/why-did-you-render --save-dev
```
- **Purpose**: Identify unnecessary re-renders
- **Usage**: Add `whyDidYouRender = true` to components

### 4. Lighthouse CI (for automated testing)
```bash
npm install -g @lhci/cli
```
- **Purpose**: Automated performance audits
- **Usage**: Run `lhci autorun` in CI/CD

### 5. Playwright with Performance Monitoring
```bash
npm install -D @playwright/test
```
- **Purpose**: E2E tests with performance monitoring
- **Usage**: See `playwright.performance.test.js` below

## Performance Budgets

Define performance budgets in `performanceTesting.js`:

```javascript
const budget = new PerformanceBudget({
    renderTime: 16,        // 60fps = 16ms per frame
    asyncOperation: 1000,  // 1 second max
    dataProcessing: 500,   // 500ms max
    filterOperation: 100,  // 100ms max
    sortOperation: 200,    // 200ms max
});
```

## Running Performance Tests

### Unit Tests (Vitest)
```bash
npm run test -- PlayerStats.performance
```

### E2E Tests (Playwright)
```bash
npx playwright test performance
```

### Lighthouse CI
```bash
lhci autorun
```

## Manual Testing Checklist

1. **Open React DevTools Profiler**
   - Record interaction
   - Select position filter
   - Check for renders >16ms

2. **Check Console Logs**
   - Look for `🚨 [PERF_BUDGET]` violations
   - Check `⏱️ [PERF_TEST]` timings

3. **Monitor Network**
   - Check API response sizes
   - Verify limits are reasonable (<2000 players)

4. **Use Performance API**
   ```javascript
   // In browser console
   performance.getEntriesByType('measure')
   ```

## Automated Performance Monitoring

Add to CI/CD pipeline:

```yaml
# .github/workflows/performance.yml
- name: Run Lighthouse CI
  run: lhci autorun
  
- name: Run Performance Tests
  run: npm run test -- --testNamePattern="Performance"
```

## Best Practices

1. **Set performance budgets** for all critical operations
2. **Test with realistic data sizes** (not just small datasets)
3. **Monitor in production** using Web Vitals
4. **Alert on regressions** - fail CI if budgets exceeded
5. **Profile regularly** - not just when issues occur

## Current Performance Issues Found

1. ✅ **Fixed**: Fetching 10,000 players (reduced to 200-2000 based on position)
2. ⚠️ **Monitoring**: Sort operations with calculated fields
3. ⚠️ **Monitoring**: Column range calculations
4. ⚠️ **Monitoring**: Filter operations on large datasets

