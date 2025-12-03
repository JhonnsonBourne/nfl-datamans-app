# Testing Libraries for Performance Debugging

## Overview

I've set up several testing and profiling tools to help identify performance issues. Here's what's available:

## 1. ✅ Already Installed & Working

### React DevTools Profiler (Built-in)
- **No installation needed** - comes with React DevTools browser extension
- **Usage**: 
  1. Open browser DevTools → Profiler tab
  2. Click "Record" 
  3. Interact with the app (select position filter)
  4. Click "Stop"
  5. Analyze which components took longest to render

### Vitest (Already installed)
- **Location**: `frontend/package.json`
- **Run**: `npm run test`
- **Usage**: Write performance tests (see `tests/performance/PlayerStats.performance.test.js`)

### Performance Profiler (Custom - Already Working)
- **Location**: `frontend/src/utils/performanceProfiler.js`
- **Usage**: Automatically tracks UI thread blocks, renders, function calls
- **Access**: `window.__performanceProfiler.PlayerStats`

## 2. 📦 To Install (Optional but Recommended)

### Web Vitals
```bash
cd frontend && npm install web-vitals
```
- **Purpose**: Measure Core Web Vitals (LCP, FID, CLS, INP)
- **Status**: Already added to `package.json`, just needs install
- **Usage**: Automatically logs to console in development

### Why Did You Render
```bash
cd frontend && npm install --save-dev @welldone-software/why-did-you-render
```
- **Purpose**: Identify unnecessary re-renders
- **Usage**: 
  1. Install the package
  2. Add `PlayerStats.whyDidYouRender = true` to component (already done)
  3. Check console for re-render reasons

### Playwright (E2E Testing)
```bash
cd frontend && npm install -D @playwright/test
```
- **Purpose**: E2E tests with performance monitoring
- **Usage**: `npx playwright test --config=playwright.performance.config.js`

## 3. 🔧 Tools Created

### Performance Testing Utilities
**File**: `frontend/src/utils/performanceTesting.js`

**Features**:
- `measureComponentRender()` - Measure render times
- `measureAsyncOperation()` - Measure async operations
- `createRenderTracker()` - Track re-renders
- `PerformanceBudget` - Set performance budgets and detect violations
- `initWebVitals()` - Monitor Core Web Vitals

**Usage**:
```javascript
import { PerformanceBudget, measureAsyncOperation } from '../utils/performanceTesting';

const budget = new PerformanceBudget({
    renderTime: 16,
    dataProcessing: 500
});

const { duration } = await measureAsyncOperation('Filter players', async () => {
    return filterPlayers(data);
});

budget.check('Filter operation', duration, 'dataProcessing');
```

### Performance Test Suite
**File**: `frontend/src/tests/performance/PlayerStats.performance.test.js`

**Tests**:
- Render performance
- Filter operation performance
- Sort operation performance
- Data limit validation

**Run**: `npm run test -- PlayerStats.performance`

## 4. 🎯 Recommended Workflow

### During Development

1. **Use React DevTools Profiler**
   - Record interactions
   - Identify slow components
   - Check for unnecessary re-renders

2. **Check Console Logs**
   - Look for `🚨 [PERF_BUDGET]` violations
   - Check `⏱️ [PERF_TEST]` timings
   - Monitor `📊 [WEB_VITALS]` scores

3. **Use Performance Profiler**
   ```javascript
   // In browser console
   window.__performanceProfiler.PlayerStats.getSummary()
   ```

### Before Committing

1. **Run Performance Tests**
   ```bash
   npm run test -- PlayerStats.performance
   ```

2. **Check for Budget Violations**
   ```javascript
   const violations = budget.getViolations();
   if (violations.length > 0) {
       console.error('Performance budget violations:', violations);
   }
   ```

### In CI/CD

1. **Add Lighthouse CI**
   ```bash
   npm install -g @lhci/cli
   lhci autorun
   ```

2. **Run E2E Performance Tests**
   ```bash
   npx playwright test performance
   ```

## 5. 📊 What Each Tool Catches

| Tool | Catches | When to Use |
|------|---------|-------------|
| **React DevTools Profiler** | Slow renders, re-renders | During development, manual testing |
| **Performance Profiler** | UI thread blocks, function calls | Automatic, always running |
| **Web Vitals** | Core Web Vitals (LCP, FID, CLS) | Production monitoring |
| **Why Did You Render** | Unnecessary re-renders | Debugging specific components |
| **Vitest Performance Tests** | Performance regressions | CI/CD, before commits |
| **Playwright E2E** | End-to-end performance | CI/CD, regression testing |

## 6. 🚀 Quick Start

1. **Install optional tools**:
   ```bash
   cd frontend
   npm install web-vitals
   npm install --save-dev @welldone-software/why-did-you-render
   ```

2. **Run existing profiler**:
   - Already running automatically
   - Check `window.__performanceProfiler.PlayerStats` in console

3. **Use React DevTools**:
   - Install React DevTools browser extension
   - Open Profiler tab → Record → Interact → Stop

4. **Run performance tests**:
   ```bash
   npm run test -- PlayerStats.performance
   ```

## 7. 📝 Current Performance Budgets

Defined in `performanceTesting.js`:
- **Render time**: 16ms (60fps)
- **Async operations**: 1000ms (1 second)
- **Data processing**: 500ms
- **Filter operations**: 100ms
- **Sort operations**: 200ms

These budgets will warn in console when exceeded.

## 8. 🔍 What We Found

Using these tools, we identified:
1. ✅ **Fixed**: Fetching 10,000 players (reduced to 200-2000)
2. ⚠️ **Monitoring**: Sort operations with calculated fields
3. ⚠️ **Monitoring**: Column range calculations

The profiler detected the 1.8-second UI thread block, which led us to the root cause!

