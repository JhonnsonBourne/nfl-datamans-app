# 🤖 Quick Start for AI Agents

**If you're an AI agent working on this project, start here!**

## ⚡ 30-Second Setup

```bash
# 1. Check current state
python agent_sync.py --status

# 2. Start your session
python agent_sync.py --session-start "Your Agent Name"

# 3. Work on the project...

# 4. Before finishing, update progress
python agent_sync.py --session-end "Your Agent Name" --summary "What you accomplished"
```

## 📚 Essential Reading (in order)

1. **`AGENT_INSTRUCTIONS.md`** - Complete agent protocol (READ THIS!)
2. **`WORK_IN_PROGRESS.md`** - Current state and active tasks
3. **`ANTIGRAVITY_SYNC_GUIDE.md`** - Project overview and architecture

## 🛠️ Available Commands

```bash
# Check current status
python agent_sync.py --status

# Quick update while working
python agent_sync.py --update "Working on feature X"

# List recently modified files
python agent_sync.py --files

# Start session
python agent_sync.py --session-start "Claude Sonnet 4.5"

# End session with summary
python agent_sync.py --session-end "Claude Sonnet 4.5" --summary "Completed route calculation"

# Create template entry
python agent_sync.py --template
```

## 🎯 Key Principles

1. **Always read `WORK_IN_PROGRESS.md` first** - See what the last agent did
2. **Update `WORK_IN_PROGRESS.md` as you work** - Don't wait until the end
3. **Document file changes** - List every file you modify
4. **Note incomplete work** - Use TODO comments in code
5. **Test before finishing** - Don't leave broken code

## 📁 Project Structure

```
nfl-datamans-app/
├── api.py                 # FastAPI backend (MAIN)
├── nflread_adapter.py     # Data adapter
├── utils.py              # Utility functions
├── frontend/src/         # React frontend
├── AGENT_INSTRUCTIONS.md  # Full agent protocol
├── WORK_IN_PROGRESS.md    # Current state (UPDATE THIS!)
└── agent_sync.py         # Helper script
```

## ⚠️ Critical Rules

- **NEVER delete `WORK_IN_PROGRESS.md`** - Always append/update
- **ALWAYS document changes** - Even small ones
- **ALWAYS test after changes** - Verify the app works
- **ALWAYS update sync files** - This maintains continuity

## 🔗 Quick Links

- Full Instructions: `AGENT_INSTRUCTIONS.md`
- Current State: `WORK_IN_PROGRESS.md`
- Sync Guide: `ANTIGRAVITY_SYNC_GUIDE.md`
- Helper Script: `agent_sync.py`

---

**Remember**: The next agent depends on YOU documenting your work! 📝






