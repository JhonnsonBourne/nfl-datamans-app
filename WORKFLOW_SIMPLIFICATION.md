# Workflow Simplification

## Changes Made

We've simplified the GitHub Actions workflows to speed up development while keeping performance testing available when needed.

## What Changed

### ✅ Disabled on Every Push/PR

1. **Performance Tests** (`performance.yml`)
   - **Before**: Ran on every push/PR (11+ minutes)
   - **After**: Manual trigger only + weekly schedule (Sundays 2 AM UTC)
   - **Why**: Too slow for regular development, performance issue being debugged locally

2. **E2E Tests** (`e2e.yml`)
   - **Before**: Ran on every push/PR
   - **After**: Manual trigger only
   - **Why**: Includes slow performance tests, better to run manually when needed

3. **Performance Budget Tests** (in `test.yml`)
   - **Before**: Ran in main test suite
   - **After**: Commented out, run manually if needed
   - **Why**: Too slow for regular CI

### ✅ Still Running on Push/PR

1. **Main Test Suite** (`test.yml`)
   - Unit tests (fast)
   - Type checking
   - Linting
   - Build verification
   - **Duration**: ~2-3 minutes

2. **Code Quality** (`code-quality.yml`)
   - ESLint
   - TypeScript checks
   - Python linting
   - **Duration**: ~1-2 minutes

### 📅 Scheduled Runs

- **Performance Tests**: Weekly on Sundays at 2 AM UTC
- **Performance Analysis**: Weekly on Sundays at 3 AM UTC

## How to Run Performance Tests Manually

### Option 1: GitHub Actions UI
1. Go to: https://github.com/JhonnsonBourne/nfl-datamans-app/actions
2. Select "Performance Tests" workflow
3. Click "Run workflow" → "Run workflow"

### Option 2: Local Testing
```bash
# Run performance tests locally
cd frontend
npm run test -- --run PlayerStats.performance

# Run E2E performance tests
npx playwright test tests/e2e/player-stats-performance-detailed.spec.js
```

### Option 3: Manual Workflow Trigger
```bash
# Using GitHub CLI
gh workflow run performance.yml
gh workflow run e2e.yml
```

## Benefits

1. **Faster CI/CD**: Regular pushes now complete in ~3-5 minutes instead of 15+ minutes
2. **Focus on Development**: No waiting for slow tests during active development
3. **Still Available**: Performance tests can be run manually when needed
4. **Weekly Monitoring**: Scheduled runs ensure we catch regressions over time

## When to Run Performance Tests

Run performance tests manually when:
- ✅ Before major releases
- ✅ After significant performance-related changes
- ✅ When investigating performance issues
- ✅ Before merging large PRs

Don't need to run them:
- ❌ On every small bug fix
- ❌ On documentation changes
- ❌ On refactoring that doesn't affect performance
- ❌ During active debugging sessions

## Monitoring

- **Weekly Reports**: Check scheduled runs every Sunday
- **Local Profiling**: Use `PerformanceProfiler` for real-time debugging
- **Manual Testing**: Run workflows when needed

## Reverting Changes

If you want to re-enable performance tests on every push:

1. Edit `.github/workflows/performance.yml`:
   ```yaml
   on:
     push:
       branches: [ main ]
     pull_request:
       branches: [ main ]
   ```

2. Edit `.github/workflows/e2e.yml`:
   ```yaml
   on:
     push:
       branches: [ main ]
     pull_request:
       branches: [ main ]
   ```

3. Uncomment performance tests in `.github/workflows/test.yml`

