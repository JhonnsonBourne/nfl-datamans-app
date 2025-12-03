# Performance Analysis Guide

This guide explains how to use the automated performance analysis system to identify and debug performance issues.

## Overview

The performance analysis system consists of:

1. **Detailed E2E Performance Tests** - Capture detailed metrics during position filtering
2. **Performance Analysis Script** - Analyzes collected data and identifies issues
3. **Automated Workflow** - Runs analysis automatically and creates reports
4. **Trend Tracking** - Tracks performance over time

## How It Works

### 1. E2E Tests Capture Metrics

The detailed performance tests (`player-stats-performance-detailed.spec.js`) capture:

- **Filter Duration**: Time to complete position filter
- **API Call Duration**: Time for API requests
- **UI Block Duration**: Detected UI thread blocks
- **Memory Usage**: JavaScript heap size changes
- **Errors**: Console errors during filtering
- **Render Count**: Number of component renders
- **Profiler Data**: Data from PerformanceProfiler

### 2. Analysis Script Processes Data

The analysis script (`scripts/analyze_workflow_performance.py`):

- Loads all performance JSON files from workflow artifacts
- Calculates statistics (min, max, avg, median) for each position
- Detects issues based on thresholds:
  - Slow filter (>3s average)
  - UI blocks (>500ms)
  - Errors detected
  - Slow API calls (>2s)
- Generates a markdown report

### 3. Automated Workflow

The `performance-analysis.yml` workflow:

- Runs after E2E/Performance tests complete
- Downloads artifacts containing performance data
- Runs the analysis script
- Uploads analysis results
- Creates GitHub issues for critical problems
- Comments on PRs with analysis results

## Using the Analysis

### View Analysis Results

1. **In GitHub Actions**:
   - Go to: `https://github.com/JhonnsonBourne/nfl-datamans-app/actions`
   - Find "Performance Analysis" workflow run
   - Download "performance-analysis" artifact
   - Open `performance_report.md` for human-readable report
   - Open `performance_analysis.json` for detailed data

2. **Run Locally**:
   ```bash
   # Download artifacts from GitHub Actions
   # Extract to workflow-artifacts/ directory
   
   # Run analysis
   python3 scripts/analyze_workflow_performance.py workflow-artifacts
   
   # View results
   cat workflow-artifacts/performance_report.md
   ```

### Understanding the Report

The report includes:

#### Summary Section
- Total samples tested
- Positions tested
- Problematic positions
- Overall statistics
- Issue counts

#### Issues Detected
- **Type**: slow_filter, ui_block, errors, slow_api
- **Severity**: high, medium
- **Position**: Which position has the issue
- **Message**: Description of the issue
- **Value**: Measured value (duration, count, etc.)

#### Position Details
- Statistics for each position
- Filter duration metrics
- UI block duration metrics
- API call duration metrics
- Error counts
- Specific issues for that position

### Interpreting Results

#### Good Performance
- Filter duration < 1s
- No UI blocks > 100ms
- No errors
- API calls < 500ms

#### Warning Signs
- Filter duration 1-3s
- UI blocks 100-500ms
- Occasional errors
- API calls 500ms-2s

#### Critical Issues
- Filter duration > 3s
- UI blocks > 500ms
- Frequent errors
- API calls > 2s

## Debugging Workflow

### Step 1: Run Tests
```bash
# Locally
cd frontend
npx playwright test tests/e2e/player-stats-performance-detailed.spec.js
```

### Step 2: Check Results
- Look at console output for immediate issues
- Check generated JSON files for detailed metrics
- Review profiler data if available

### Step 3: Analyze
```bash
python3 scripts/analyze_workflow_performance.py workflow-artifacts
```

### Step 4: Investigate Issues

For each issue found:

1. **Check the position**: Which position has the problem?
2. **Review metrics**: What are the specific values?
3. **Check profiler data**: Look at `profilerSummary` in JSON
4. **Review errors**: Check `errors` array for specific error messages
5. **Compare positions**: Is one position worse than others?

### Step 5: Fix and Verify

1. Make fixes based on analysis
2. Re-run tests
3. Compare new results with previous
4. Verify issues are resolved

## Example Workflow

```bash
# 1. Run performance tests
cd frontend
npx playwright test tests/e2e/player-stats-performance-detailed.spec.js

# 2. Collect artifacts (if running locally)
mkdir -p workflow-artifacts
# Copy generated JSON files to workflow-artifacts/

# 3. Run analysis
cd ..
python3 scripts/analyze_workflow_performance.py workflow-artifacts

# 4. Review report
cat workflow-artifacts/performance_report.md

# 5. Check specific position data
cat workflow-artifacts/qb-performance-*.json | jq '.'
```

## Automated Analysis

The GitHub Actions workflow automatically:

1. ✅ Runs after E2E/Performance tests
2. ✅ Downloads performance artifacts
3. ✅ Runs analysis script
4. ✅ Uploads analysis results
5. ✅ Creates GitHub issues for critical problems
6. ✅ Comments on PRs with results

## Troubleshooting

### No Performance Data Found

**Issue**: Analysis script reports "No performance data files found"

**Solutions**:
- Ensure E2E tests are generating JSON files
- Check that artifacts are being uploaded correctly
- Verify file naming matches pattern `*performance*.json`

### Analysis Script Errors

**Issue**: Python script fails with errors

**Solutions**:
- Ensure Python 3.11+ is installed
- Check that JSON files are valid
- Verify file paths are correct

### Missing Metrics

**Issue**: Some metrics are missing from results

**Solutions**:
- Check that browser performance APIs are available
- Verify profiler is initialized in tests
- Check console for errors during test execution

## Next Steps

1. **Run initial analysis** to establish baseline
2. **Set up alerts** for performance regressions
3. **Track trends** over time
4. **Use insights** to guide optimization efforts

## Related Files

- `frontend/tests/e2e/player-stats-performance-detailed.spec.js` - Detailed tests
- `scripts/analyze_workflow_performance.py` - Analysis script
- `.github/workflows/performance-analysis.yml` - Automated workflow
- `.github/workflows/e2e.yml` - E2E test workflow

