# GitHub Actions Workflows

This directory contains automated CI/CD workflows for the NFL Datamans App.

## Available Workflows

### 1. `test.yml` - Main Test Suite
**Triggers**: Push/PR to `main` or `develop`

**Runs**:
- Frontend unit tests (Vitest)
- Frontend performance tests
- Backend tests (pytest)
- Type checking
- Linting
- Build verification

**Status Badge**: Add to README:
```markdown
![Tests](https://github.com/JhonnsonBourne/nfl-datamans-app/workflows/Tests/badge.svg)
```

### 2. `performance.yml` - Performance Testing
**Triggers**: 
- Push/PR to `main`
- Daily at 2 AM UTC
- Manual trigger

**Runs**:
- Playwright performance tests
- Lighthouse CI audits
- Performance budget checks
- Bundle size validation

**Status Badge**: Add to README:
```markdown
![Performance Tests](https://github.com/JhonnsonBourne/nfl-datamans-app/workflows/Performance%20Tests/badge.svg)
```

### 3. `e2e.yml` - End-to-End Tests
**Triggers**: Push/PR to `main`, Manual trigger

**Runs**:
- Playwright E2E tests
- Full user flow tests

**Status Badge**: Add to README:
```markdown
![E2E Tests](https://github.com/JhonnsonBourne/nfl-datamans-app/workflows/E2E%20Tests/badge.svg)
```

### 4. `code-quality.yml` - Code Quality Checks
**Triggers**: Push/PR to `main` or `develop`

**Runs**:
- ESLint
- TypeScript type checking
- Python linting (flake8)
- Code formatting checks

## Enabling Workflows

These workflows are **automatically enabled** when you push to GitHub. No configuration needed!

### First Time Setup

1. **Push workflows to GitHub**:
   ```bash
   git add .github/workflows/
   git commit -m "Add CI/CD workflows"
   git push origin main
   ```

2. **Check workflow status**:
   - Go to: `https://github.com/JhonnsonBourne/nfl-datamans-app/actions`
   - You'll see workflows running automatically

3. **View test results**:
   - Click on any workflow run
   - See test results, coverage, and artifacts

## Manual Trigger

To manually trigger a workflow:
1. Go to Actions tab
2. Select the workflow
3. Click "Run workflow"
4. Select branch and click "Run workflow"

## Required Setup

### For Performance Tests

Install Playwright browsers locally (for development):
```bash
cd frontend
npx playwright install chromium
```

### For Code Coverage

Optional: Add Codecov integration
1. Sign up at https://codecov.io
2. Connect your GitHub repo
3. Coverage reports will be uploaded automatically

## Workflow Status

Check workflow status in:
- GitHub Actions tab: `https://github.com/JhonnsonBourne/nfl-datamans-app/actions`
- README badges (add badges to see status at a glance)

## Customization

### Adjust Test Thresholds

Edit `frontend/src/tests/performance/PlayerStats.performance.test.js`:
```javascript
const budget = new PerformanceBudget({
    renderTime: 16,        // Adjust as needed
    dataProcessing: 500,   // Adjust as needed
});
```

### Adjust Bundle Size Limits

Edit `.github/workflows/performance.yml`:
```yaml
if [ $(du -sk dist | cut -f1) -gt 5000 ]; then  # Change 5000 to your limit
```

### Add More Tests

1. Add test files to `frontend/src/tests/`
2. Tests run automatically in CI
3. Use `npm run test:ci` locally to match CI behavior

## Troubleshooting

### Tests Fail in CI but Pass Locally

1. Check Node.js version matches (CI uses 18)
2. Run `npm ci` instead of `npm install` locally
3. Check for environment-specific issues

### Performance Tests Flaky

- Performance tests use `continue-on-error: true` to not block PRs
- Check artifacts for detailed results
- Adjust thresholds if needed

### Coverage Not Uploading

- Codecov is optional (uses `continue-on-error: true`)
- Sign up at codecov.io to enable
- Or remove coverage upload step if not needed

