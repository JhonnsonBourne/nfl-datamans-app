# 🤖 Agent Instructions - READ THIS FIRST

**IMPORTANT**: If you are an AI agent (Claude, Gemini, GPT, etc.) working on this codebase, you MUST follow these instructions to maintain continuity between sessions.

## 🚨 Mandatory Agent Protocol

### Before Making ANY Changes:
1. **Read `WORK_IN_PROGRESS.md`** to understand current state
2. **Read `ANTIGRAVITY_SYNC_GUIDE.md`** for project context
3. **Check recent file modifications** to see what was last worked on

### When Starting Work:
1. **Update `WORK_IN_PROGRESS.md`** with:
   - Your agent name/model (e.g., "Claude Sonnet 4.5", "Gemini 2.0")
   - Session start time
   - What you plan to work on
   - Files you're about to modify

### While Working:
- **Document changes as you make them** - don't wait until the end
- **Add TODO comments** in code for incomplete work: `# TODO: [Agent Name] - [Description]`
- **Note any blockers** immediately in WORK_IN_PROGRESS.md

### Before Finishing/Exiting:
1. **MUST update `WORK_IN_PROGRESS.md`** with:
   - ✅ All files you modified (list them)
   - ✅ What you completed
   - ✅ What's still in progress
   - ✅ Next steps for the next agent
   - ✅ Any errors or issues encountered
   - ✅ Dependencies added/changed
   - ✅ Session end time

2. **Run the update script** (if available):
   ```bash
   python agent_sync.py --update
   ```

3. **Verify the app still works**:
   ```bash
   # Quick test
   python -c "from api import app; print('API OK')"
   ```

## 📋 Standard Update Format

When updating `WORK_IN_PROGRESS.md`, use this format:

```markdown
## Agent Session: [Your Name/Model]
**Time**: [Start] - [End]
**Status**: Completed / In Progress / Blocked

### Files Modified:
- `api.py` - Added route calculation for 2025 season
- `frontend/src/pages/PlayerStats.jsx` - Fixed sorting bug

### Completed:
- ✅ Feature X implemented
- ✅ Bug Y fixed

### In Progress:
- 🔄 Feature Z partially done (needs testing)

### Next Steps:
1. Test route calculation with 2025 data
2. Add error handling for missing participation data

### Blockers:
- None / [Describe blocker]

### Notes:
- [Any important context for next agent]
```

## 🔍 How to Check Current State

```bash
# See what files were modified recently
Get-ChildItem -Path . -Recurse -File | Where-Object {$_.LastWriteTime -gt (Get-Date).AddHours(-24)} | Select-Object FullName, LastWriteTime | Format-Table

# Check git status (if using git)
git status

# Read work in progress
cat WORK_IN_PROGRESS.md
```

## ⚠️ Critical Rules

1. **NEVER delete or overwrite `WORK_IN_PROGRESS.md`** - always append/update
2. **ALWAYS document file changes** - even small ones
3. **ALWAYS note incomplete work** - use TODO comments
4. **ALWAYS test after changes** - don't leave broken code
5. **ALWAYS update sync files** - this is how continuity is maintained

## 🎯 Agent-Specific Notes

### For Antigravity Agents:
- You're working in Antigravity environment
- Document everything in `WORK_IN_PROGRESS.md` before session ends
- Copy code changes to share with Cursor agents

### For Cursor Agents:
- You're working in Cursor environment  
- Read `WORK_IN_PROGRESS.md` first to see Antigravity work
- Update `WORK_IN_PROGRESS.md` with your changes
- Test everything before finishing

## 📝 Quick Reference

**Key Files to Check:**
- `WORK_IN_PROGRESS.md` - Current state
- `ANTIGRAVITY_SYNC_GUIDE.md` - Project overview
- `api.py` - Main backend
- `frontend/src/` - Frontend code

**Key Commands:**
- Test backend: `uvicorn api:app --reload`
- Test frontend: `cd frontend && npm run dev`
- Update sync: `python agent_sync.py --update`

## 🔗 Related Files

- `WORK_IN_PROGRESS.md` - Active task tracker (UPDATE THIS!)
- `ANTIGRAVITY_SYNC_GUIDE.md` - Full sync guide
- `QUICK_SYNC.md` - Quick reference
- `agent_sync.py` - Helper script for agents






