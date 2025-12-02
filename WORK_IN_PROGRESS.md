# Work In Progress

**Last Updated**: 2025-01-27 (Agent Sync System Created)

---

## Agent Update - 2025-01-27

### Agent Session: Cursor Agent (Auto)
**Time**: 2025-01-27
**Status**: Completed

### Completed:
- ✅ Created comprehensive agent sync system
- ✅ Built `agent_sync.py` helper script for automated updates
- ✅ Created `AGENT_INSTRUCTIONS.md` with full agent protocol
- ✅ Created `README_AGENTS.md` for quick agent reference
- ✅ Added agent-aware markers to key files (api.py, App.jsx, nflread_adapter.py)
- ✅ Created `.agent_marker` file for agent detection

### Files Created/Modified:
- `AGENT_INSTRUCTIONS.md` - Complete agent protocol and rules
- `agent_sync.py` - Python script for agents to update sync files
- `README_AGENTS.md` - Quick start guide for agents
- `.agent_marker` - Agent detection marker
- `WORK_IN_PROGRESS.md` - This file (updated with agent system)
- `api.py` - Added agent note at top
- `frontend/src/App.jsx` - Added agent note at top
- `nflread_adapter.py` - Added agent note at top

### System Features:
- Automated file tracking (last 24 hours)
- Session start/end tracking
- Quick update commands
- Status checking
- Template generation

### Next Agent:
- Read `AGENT_INSTRUCTIONS.md` first
- Run `python agent_sync.py --status` to see current state
- Use `python agent_sync.py --session-start "Your Name"` to begin
- Use `python agent_sync.py --session-end "Your Name" --summary "What you did"` to finish

---

## Agent Update - 2025-01-27 (Latest)

### Agent Session: Cursor Agent
**Time**: 2025-01-27
**Status**: Completed

### Completed:
- ✅ Added 3 new WR metrics:
  - **ADOT** (Average Depth of Target) = Air Yards / Targets
  - **EPA/Route** = Receiving EPA / Routes
  - **EPA/Game** = Receiving EPA / Games
- ✅ Verified existing metric calculations match definitions:
  - **RACR** = Receiving Yards / Total Air Yards (verified, also added frontend fallback)
  - **WOPR** = 1.5 × Target Share + 0.7 × Air Yards Share (calculated in backend, correct)
  - **YPRR** = Yards Per Route Run (receiving_yards / routes) ✓
  - **TPRR** = Targets Per Route Run (targets / routes) ✓
- ✅ All new metrics formatted with 2 decimals for WRs/TEs
- ✅ Fixed WR stat formatting issues (previous session)
  - Integer columns show NO decimals
  - Rate/percentage stats show 2 decimals for WRs/TEs

### Files Modified:
- `frontend/src/pages/PlayerStats.jsx`
  - Added ADOT, EPA/Route, EPA/Game columns to WR/TE column list
  - Added calculation logic for all three new metrics
  - Added RACR frontend calculation as fallback (backend also calculates it)
  - All new metrics automatically formatted with 2 decimals for WRs

### Metric Definitions Verified:
- **ADOT**: Total Air Yards / Total Targets (Mike Clay metric)
- **RACR**: Receiving Yards / Total Air Yards (Josh Hermsmeyer metric)
- **WOPR**: 1.5 × Target Market Share + 0.7 × Air Yards Market Share (Josh Hermsmeyer metric)
- **YPRR**: Yards Per Route Run
- **TPRR**: Targets Per Route Run

### Next Steps:
- Test new metrics in browser to verify calculations and formatting
- Verify ADOT, EPA/Route, EPA/Game display correctly with 2 decimals

---

## Current Task
NextGen Stats integration exploration - COMPLETED ✅

---

## Agent Update - 2025-01-27 (NextGen Stats Exploration)

### Agent Session: Cursor Agent
**Time**: 2025-01-27
**Status**: Completed

### Completed:
- ✅ Explored NextGen Stats data structure and integration options
- ✅ Created comprehensive integration guide (`NEXTGEN_STATS_GUIDE.md`)
- ✅ Documented available stat types: receiving, rushing, passing
- ✅ Identified key metrics available for WRs:
  - Separation metrics (avg_separation, avg_cushion)
  - Air yards (avg_intended_air_yards, percent_share_of_intended_air_yards)
  - YAC metrics (avg_yac, avg_expected_yac, avg_yac_above_expectation)
  - Catch percentage from NextGen tracking

### Key Findings:
- NextGen Stats requires `stat_type` parameter: "receiving", "rushing", or "passing"
- Data is weekly granularity (season + week)
- Player matching via `player_id` or `gsis_id`
- Available since 2016 season
- Returns Polars DataFrame (converted to pandas by adapter)

### Integration Options Documented:
1. **Separate Endpoint** - `/v1/data/nextgen_stats` (clean separation)
2. **Merge into Player Stats** - Add `include_ngs` parameter (recommended)
3. **Add as Columns** - Include in player_stats aggregation
4. **Dedicated Tab** - New frontend page for NextGen Stats

### Recommended Approach:
- **Option 2**: Merge NextGen Stats into player_stats endpoint
- Add `include_ngs` and `ngs_stat_type` query parameters
- Merge on player_id + season + week
- Left join to keep all player stats (handle missing NGS data gracefully)

### Files Created:
- `NEXTGEN_STATS_GUIDE.md` - Complete integration guide with examples
- `explore_nextgen.py` - Comprehensive exploration script
- `explore_nextgen_comprehensive.py` - Multi-stat-type exploration
- `test_nextgen_simple.py` - Simple test script
- `check_nextgen.py` - File-based output script

### Next Steps:
1. ✅ Test NextGen Stats loading with actual data
2. ✅ Implement merge logic in API endpoint
3. ⏳ Add frontend toggle for NextGen stats
4. ⏳ Display new metrics in WR stats table

---

## Agent Update - 2025-01-27 (NextGen Stats Implementation)

### Agent Session: Cursor Agent
**Time**: 2025-01-27
**Status**: Completed

### Completed:
- ✅ Implemented Option 2: Merging NextGen Stats into player_stats endpoint
- ✅ Added `include_ngs` and `ngs_stat_type` query parameters to API
- ✅ Implemented merge logic on player_id + season + week
- ✅ NextGen columns prefixed with `ngs_` to avoid conflicts
- ✅ NextGen columns aggregated as means (they're already weekly averages)
- ✅ Updated frontend API service to support new parameters
- ✅ Error handling: request continues if NextGen merge fails

### Files Modified:
- `api.py`
  - Added `include_ngs` and `ngs_stat_type` parameters to `get_data()` endpoint
  - Implemented NextGen Stats merge logic after routes calculation
  - Added NextGen columns to aggregation (as means)
  - Column prefixing with `ngs_` to avoid conflicts
- `frontend/src/services/api.js`
  - Updated `getPlayerStats()` to accept `includeNgs` and `ngsStatType` parameters

### Implementation Details:
- **Merge Strategy**: Left join on player_id + season + week
- **Column Prefixing**: All NextGen columns prefixed with `ngs_`
- **Aggregation**: NextGen metrics averaged (since they're weekly averages)
- **Error Handling**: Graceful fallback if NextGen data unavailable
- **Available Stat Types**: receiving, rushing, passing

### Next Steps:
1. ✅ Add frontend toggle/checkbox to enable NextGen Stats in PlayerStats component
2. ✅ Display NextGen metrics in WR stats table (e.g., ngs_avg_separation, ngs_avg_yac_above_expectation)
3. ✅ Add tooltips explaining NextGen metrics
4. ⏳ Test with actual data to verify matching works correctly

---

## Agent Update - 2025-01-27 (NextGen Stats Frontend)

### Agent Session: Cursor Agent
**Time**: 2025-01-27
**Status**: Completed

### Completed:
- ✅ Added `includeNgs` state variable to PlayerStats component
- ✅ Added NextGen Stats toggle checkbox (only visible for WR/TE/ALL positions)
- ✅ Updated `loadData()` to pass `includeNgs` parameter to API
- ✅ Added conditional NextGen Stats columns to WR/TE column list
- ✅ Implemented `hasNextGenStats` check to detect if NextGen data is available
- ✅ Added NextGen columns with tooltips:
  - `ngs_avg_separation` - Avg separation at catch (yards)
  - `ngs_avg_cushion` - Avg starting cushion (yards)
  - `ngs_avg_intended_air_yards` - Avg intended air yards per target
  - `ngs_avg_yac_above_expectation` - YAC above/below expectation (highlighted)
  - `ngs_avg_yac` - Average yards after catch
  - `ngs_percent_share_of_intended_air_yards` - Share of team intended air yards
- ✅ Added formatting for NextGen columns (2 decimals for WRs/TEs)
- ✅ Added visual indicator when NextGen Stats are loaded
- ✅ Added tooltips to column headers

### Files Modified:
- `frontend/src/pages/PlayerStats.jsx`
  - Added `includeNgs` state
  - Added toggle checkbox in UI
  - Updated `loadData()` to include NextGen Stats parameter
  - Added conditional NextGen columns to WR/TE column list
  - Added `hasNextGenStats` useMemo hook
  - Added NextGen column formatting logic
  - Added tooltips to column headers

### UI Features:
- Toggle checkbox only shows for WR/TE/ALL positions
- Green checkmark indicator when NextGen Stats are loaded
- Tooltips on column headers explaining NextGen metrics
- NextGen columns formatted with 2 decimals for WRs/TEs
- NextGen columns appear after WOPR, before Per Game stats

### Next Steps:
1. ⏳ Test with actual data to verify NextGen Stats load and display correctly
2. ⏳ Verify data matching works (player_id + season + week)
3. ⏳ Test edge cases (players without NextGen data, missing columns, etc.)

## Files Modified Recently
- [ ] `api.py` - [What changed]
- [ ] `frontend/src/...` - [What changed]
- [ ] Other files...

## Active Features/Bugs
### Feature: [Name]
- Status: In Progress / Blocked / Testing
- Description: [What it does]
- Files: [Which files are involved]
- Notes: [Any important context]

### Bug: [Description]
- Status: Investigating / Fixed / Needs Testing
- Steps to reproduce: [If known]
- Expected behavior: [What should happen]
- Actual behavior: [What actually happens]

## Next Steps
1. [ ] [Task 1]
2. [ ] [Task 2]
3. [ ] [Task 3]

## Blockers/Issues
- [Issue description]
- [Another issue]

## Environment Notes
- **Antigravity Session**: [Date/Time] - [What was worked on]
- **Cursor Session**: [Date/Time] - [What was worked on]

## Quick Reference
- API runs on: `http://localhost:8000`
- Frontend runs on: `http://localhost:5173`
- Main data endpoint: `/v1/data/player_stats`

