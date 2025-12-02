# Antigravity ↔ Cursor Sync Guide

This guide helps you maintain continuity between your Antigravity (Gemini/Claude) sessions and Cursor development.

## Quick Sync Checklist

Before switching between Antigravity and Cursor, use this checklist:

### ✅ Before Leaving Antigravity
- [ ] **Copy all code changes** you made in Antigravity
- [ ] **Note what features/fixes** you were working on
- [ ] **Document any errors or issues** you encountered
- [ ] **Save any test results or outputs** that inform your next steps
- [ ] **List any dependencies** you added or plan to add

### ✅ When Starting in Cursor
- [ ] **Review recent file changes** (check git status if using version control)
- [ ] **Read this sync guide** to understand current state
- [ ] **Check WORK_IN_PROGRESS.md** for active tasks
- [ ] **Verify dependencies** match between environments
- [ ] **Test the application** to ensure it runs

## Current Project State

### Architecture
- **Backend**: FastAPI (`api.py`) - REST API for NFL data
- **Frontend**: React + Vite + Tailwind (`frontend/`)
- **Streamlit**: Alternative UI (`app.py` + `pages/`)
- **Data Source**: nflverse via `nflreadpy`

### Key Files
- `api.py` - Main FastAPI backend with routes calculation logic
- `nflread_adapter.py` - Adapter for nflreadpy/nflreadr libraries
- `utils.py` - Streamlit utilities and helper functions
- `frontend/src/` - React frontend components and pages
- `requirements.txt` - Python dependencies

### Recent Features (Based on Code Analysis)
- ✅ Routes calculation from PBP + Participation data (2016-2024)
- ✅ Routes estimation for seasons without participation (using Snaps × Pass Rate)
- ✅ Player stats aggregation by season
- ✅ Advanced metrics (WOPR, RACR, PACR, etc.)
- ✅ FastAPI endpoints for datasets and player stats
- ✅ React frontend with routing

## Sync Workflow

### Method 1: Manual Copy-Paste (Quick)
1. In Antigravity, copy the entire file content you modified
2. In Cursor, open the same file
3. Replace the content (or use search-replace for specific sections)
4. Save and test

### Method 2: Git Version Control (Recommended)
If you have git initialized:

```bash
# In Antigravity terminal (if available)
git add .
git commit -m "Work from Antigravity: [describe changes]"
git push  # if using remote

# In Cursor terminal
git pull  # to get latest changes
```

### Method 3: File Comparison
1. Copy files from Antigravity to a temporary location
2. Use Cursor's diff view to compare
3. Merge changes manually

## What to Document

When switching environments, document:

### In WORK_IN_PROGRESS.md
- Current task/feature being worked on
- Files you modified
- Any blockers or issues
- Next steps planned

### Code Comments
Add comments like:
```python
# TODO: [Brief description] - Started in Antigravity [date]
# FIXME: [Issue description] - Needs attention
```

## Common Sync Points

### Backend Changes (`api.py`, `nflread_adapter.py`, `utils.py`)
- Check for new endpoints
- Verify route calculation logic
- Test data loading functions

### Frontend Changes (`frontend/src/`)
- New components or pages
- API integration updates
- UI/UX improvements

### Dependencies (`requirements.txt`, `frontend/package.json`)
- New Python packages
- New npm packages
- Version updates

## Testing After Sync

Always test after syncing:

```bash
# Backend
cd C:\Users\etrue\Python\nfl-datamans-app
uvicorn api:app --reload

# Frontend (in another terminal)
cd frontend
npm run dev
```

## Tips for Seamless Switching

1. **Use consistent naming** for branches/commits
2. **Keep WORK_IN_PROGRESS.md updated** with current tasks
3. **Document API changes** in code comments
4. **Test incrementally** - don't wait until the end
5. **Use feature flags** for incomplete features

## Emergency Recovery

If something breaks after syncing:

1. Check `WORK_IN_PROGRESS.md` for context
2. Review recent git commits (if using git)
3. Check file modification times
4. Revert to last known good state
5. Re-apply changes incrementally






