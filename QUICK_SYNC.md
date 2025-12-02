# Quick Sync Reference

## 🚀 Fast Sync Steps

### From Antigravity → Cursor

1. **Copy your code changes** from Antigravity
2. **Open the same file in Cursor**
3. **Paste/merge the changes**
4. **Update WORK_IN_PROGRESS.md** with what you changed
5. **Test**: Run the app to verify it works

### Quick Test Commands

```bash
# Test Backend
cd C:\Users\etrue\Python\nfl-datamans-app
uvicorn api:app --reload

# Test Frontend (new terminal)
cd frontend
npm run dev
```

## 📝 What to Copy from Antigravity

When switching, make sure to copy:

- ✅ **Modified files** (entire file content)
- ✅ **New files** you created
- ✅ **Dependency changes** (requirements.txt, package.json)
- ✅ **Configuration changes** (.env, config files)
- ✅ **Notes** about what you were working on

## 🔍 Quick Status Check

Run these to see what's changed:

```bash
# Python files modified in last 24 hours
Get-ChildItem -Path . -Filter *.py -Recurse | Where-Object {$_.LastWriteTime -gt (Get-Date).AddHours(-24)} | Select-Object Name, LastWriteTime

# Frontend files modified
Get-ChildItem -Path frontend/src -Recurse | Where-Object {$_.LastWriteTime -gt (Get-Date).AddHours(-24)} | Select-Object Name, LastWriteTime
```

## 💡 Pro Tips

1. **Always update WORK_IN_PROGRESS.md** before switching
2. **Test after syncing** - don't assume it works
3. **Keep a backup** of working code before major changes
4. **Use comments** to mark incomplete work: `// TODO: Finish in Cursor`

## 🆘 If Something Breaks

1. Check `WORK_IN_PROGRESS.md` for context
2. Look at file modification times
3. Revert to last known good state
4. Re-apply changes incrementally






