# GitHub Actions Workflow Timing Guide

## Expected Workflow Durations

### Normal Duration Ranges

| Workflow | Expected Duration | Notes |
|----------|------------------|-------|
| **Tests** (`test.yml`) | 2-5 minutes | Fast unit tests, linting, type checking |
| **Code Quality** (`code-quality.yml`) | 1-3 minutes | Quick linting and type checks |
| **E2E Tests** (`e2e.yml`) | 5-10 minutes | Playwright browser install + tests |
| **Performance Tests** (`performance.yml`) | 8-15 minutes | **Longest workflow** - see breakdown below |
| **Performance Analysis** (`performance-analysis.yml`) | 2-4 minutes | Quick analysis script |

### Performance & Lighthouse Workflow Breakdown

The "Performance & Lighthouse" job typically takes **8-15 minutes**:

1. **Checkout code**: ~10 seconds
2. **Setup Node.js**: ~10 seconds
3. **Install dependencies** (`npm ci`): **1-3 minutes**
   - Can be slower if cache misses
4. **Build frontend**: **30 seconds - 2 minutes**
   - TypeScript compilation + Vite build
5. **Install Playwright browsers**: **3-5 minutes** ⚠️ **SLOWEST STEP**
   - Downloads Chromium (~200MB) + system dependencies
   - Can hang if network is slow
6. **Run Playwright tests**: **1-3 minutes**
   - Depends on test complexity
7. **Install Lighthouse CI**: **30 seconds - 1 minute**
   - Global npm install
8. **Start preview server**: **10-30 seconds**
   - Server startup + health check
9. **Run Lighthouse CI** (3 runs): **2-5 minutes** ⚠️ **SLOW STEP**
   - Each run takes ~1-2 minutes
   - 3 runs = 3-6 minutes total
10. **Upload artifacts**: ~10 seconds

**Total: 8-15 minutes** (can be longer if network is slow)

## When to Worry

### ⚠️ Warning Signs (>15 minutes)
- Workflow running >15 minutes = likely stuck
- Check which step is hanging
- Common culprits:
  - Playwright browser installation (network issues)
  - Lighthouse CI waiting for server
  - Preview server not starting

### ✅ Normal (<15 minutes)
- 6-12 minutes = Normal for Performance workflow
- 2-5 minutes = Normal for other workflows

## Troubleshooting Slow Workflows

### If Workflow is Stuck (>15 minutes)

1. **Check which step is running**:
   - Click on the workflow run
   - See which step is currently executing
   - Check the step's logs

2. **Common Issues**:

   **Playwright Installation Hanging**:
   - Network timeout downloading Chromium
   - Solution: Added `timeout-minutes: 10` to prevent infinite hang

   **Preview Server Not Starting**:
   - Server might not be ready when Lighthouse runs
   - Solution: Added health check with timeout

   **Lighthouse CI Hanging**:
   - Waiting for server that never started
   - Solution: Added `timeout-minutes: 10` and better server health check

3. **Check Logs**:
   - Look for error messages
   - Check network timeouts
   - Verify server started successfully

## Optimizations Applied

### Timeouts Added
- All steps now have explicit timeouts
- Prevents infinite hangs
- Fails fast if something is wrong

### Server Health Check
- Waits for server to actually be ready
- Uses `curl` to verify server responds
- 30-second timeout before continuing

### Error Handling
- `continue-on-error: true` on optional steps
- Workflow continues even if some steps fail
- Artifacts still uploaded for analysis

## Monitoring Workflow Health

### Check Workflow Status
1. Go to: `https://github.com/JhonnsonBourne/nfl-datamans-app/actions`
2. Click on the workflow run
3. Check:
   - Which step is currently running
   - How long each step took
   - Any error messages

### Expected Step Durations

| Step | Normal Duration | If > This, Check |
|------|----------------|------------------|
| Install dependencies | 1-3 min | 5 min |
| Build frontend | 30s-2 min | 5 min |
| Install Playwright | 3-5 min | 10 min |
| Run Playwright tests | 1-3 min | 5 min |
| Install Lighthouse CI | 30s-1 min | 3 min |
| Start preview server | 10-30s | 2 min |
| Run Lighthouse CI | 2-5 min | 10 min |

## Quick Fixes

If workflow is stuck:

1. **Cancel and retry**:
   - Click "Cancel workflow" button
   - Push a new commit to retry

2. **Check for known issues**:
   - Network problems (GitHub Actions status)
   - Dependency conflicts (check package.json)
   - Configuration errors (check workflow file)

3. **Simplify workflow**:
   - Temporarily disable slow steps
   - Run Lighthouse with fewer runs (`--collect.numberOfRuns=1`)
   - Skip Playwright browser install if not needed

## Current Status

✅ **Timeouts added** to prevent infinite hangs
✅ **Server health check** added to verify server starts
✅ **Error handling** improved for graceful failures
✅ **Expected durations** documented

The workflow should now:
- Complete in 8-15 minutes (normal)
- Fail fast if something is wrong (timeouts)
- Continue even if optional steps fail
- Provide better error messages

