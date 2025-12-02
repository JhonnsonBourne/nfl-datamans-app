# NextGen Stats Integration Guide

## Overview

NextGen Stats provides advanced player-level metrics from the NFL's player tracking system. The data is available via `nflreadpy.load_nextgen_stats()` and requires a `stat_type` parameter.

## Available Stat Types

1. **`receiving`** - Wide receivers, tight ends, running backs (receiving stats)
2. **`rushing`** - Running backs, quarterbacks (rushing stats)  
3. **`passing`** - Quarterbacks (passing stats)

## Data Structure

### Receiving Stats (Most Relevant for WRs)

**Key Metrics Available:**
- `avg_cushion` - Average cushion (yards between receiver and defender at snap)
- `avg_separation` - Average separation (yards between receiver and defender at catch)
- `avg_intended_air_yards` - Average intended air yards per target
- `percent_share_of_intended_air_yards` - Share of team's intended air yards
- `receptions` - Number of receptions
- `targets` - Number of targets
- `catch_percentage` - Catch percentage
- `yards` - Total receiving yards
- `rec_touchdowns` - Receiving touchdowns
- `avg_yac` - Average yards after catch
- `avg_expected_yac` - Average expected yards after catch
- `avg_yac_above_expectation` - YAC above/below expectation

**Player Identifiers:**
- `player_display_name` - Player name
- `player_id` or `gsis_id` - Player identifier (for matching)
- `player_position` - Position
- `team_abbr` - Team abbreviation

**Temporal:**
- `season` - Season year
- `week` - Week number

### Rushing Stats

**Key Metrics:**
- `avg_time_to_los` - Average time to line of scrimmage
- `efficiency` - Rushing efficiency metric
- `percent_attempts_gte_eight_defenders` - % of attempts vs 8+ defenders
- `avg_yards` - Average yards per carry
- `expected_yards` - Expected yards
- `yards_above_expectation` - Yards above/below expectation

### Passing Stats

**Key Metrics:**
- `avg_time_to_throw` - Average time to throw
- `avg_air_yards` - Average air yards per attempt
- `aggressiveness` - Aggressiveness percentage
- `completion_percentage` - Completion percentage
- `expected_completion_percentage` - Expected completion percentage
- `completion_percentage_above_expectation` - CPOE

## Integration Options

### Option 1: Add NextGen Stats as Separate Endpoint

Create a new endpoint: `/v1/data/nextgen_stats`

**Pros:**
- Clean separation of concerns
- Can query NextGen stats independently
- Easy to filter by stat_type

**Cons:**
- Requires separate API call from frontend
- Need to merge data on frontend

**Example:**
```javascript
// Frontend
const ngsData = await api.get('/v1/data/nextgen_stats?stat_type=receiving&seasons=2024');
// Merge with player_stats data
```

### Option 2: Merge NextGen Stats into Player Stats Endpoint

Enhance `/v1/data/player_stats` to optionally include NextGen metrics.

**Pros:**
- Single API call
- Automatic merging on backend
- Simpler frontend integration

**Cons:**
- More complex backend logic
- Larger response payload
- Need to handle missing data (not all players have NGS data)

**Implementation:**
```python
# In api.py get_data() function
if dataset == "player_stats":
    # Load player stats as normal
    # Then optionally merge NextGen stats
    if include_ngs:
        ngs_df = load_nextgen_stats(seasons=years, stat_type="receiving")
        df = merge_ngs_data(df, ngs_df)
```

### Option 3: Add NextGen Stats Columns to Existing Player Stats

Add NextGen metrics as calculated columns in the player stats aggregation.

**Pros:**
- Seamless integration
- No frontend changes needed
- Metrics appear alongside regular stats

**Cons:**
- Only works for players with NGS data
- Need to handle missing values gracefully
- More complex aggregation logic

### Option 4: Create Dedicated NextGen Stats Tab/View

Add a new page in the frontend specifically for NextGen Stats.

**Pros:**
- Showcases advanced metrics
- Can display all stat types (receiving, rushing, passing)
- Clean UI for advanced users

**Cons:**
- More frontend work
- Need separate data fetching logic

## Recommended Approach

**For WR Stats Tab (Current Focus):**

I recommend **Option 2** - Merge NextGen Stats into Player Stats endpoint with an optional parameter:

```python
@app.get("/v1/data/{dataset}")
def get_data(
    dataset: str,
    include_ngs: bool = Query(False, description="Include NextGen Stats"),
    ngs_stat_type: str = Query("receiving", description="NextGen stat type: receiving, rushing, passing"),
    ...
):
    # Load main dataset
    # If include_ngs=True, merge NextGen stats
```

**Benefits:**
- Can toggle NextGen stats on/off
- Automatic merging by player_id and season/week
- Frontend can request: `/v1/data/player_stats?include_ngs=true&ngs_stat_type=receiving`

## Key Metrics to Add for WRs

Based on the available NextGen Stats, these would be valuable additions:

1. **Separation Metrics:**
   - `avg_separation` - How much space receiver creates
   - `avg_cushion` - Starting separation

2. **Air Yards:**
   - `avg_intended_air_yards` - Average depth of target (similar to ADOT)
   - `percent_share_of_intended_air_yards` - Air yards share

3. **YAC Metrics:**
   - `avg_yac` - Actual YAC
   - `avg_expected_yac` - Expected YAC
   - `avg_yac_above_expectation` - YAC efficiency

4. **Catch Rate:**
   - `catch_percentage` - From NextGen (may differ from calculated)

## Data Matching Strategy

NextGen Stats uses:
- `player_id` or `gsis_id` for player matching
- `season` and `week` for temporal matching
- `team_abbr` for team matching (optional verification)

**Matching Logic:**
```python
def merge_ngs_data(player_stats_df, ngs_df):
    # Match on player_id + season + week
    merged = pd.merge(
        player_stats_df,
        ngs_df,
        on=['player_id', 'season', 'week'],
        how='left',  # Left join - keep all player stats
        suffixes=('', '_ngs')
    )
    return merged
```

## Next Steps

1. **Test NextGen Stats Loading:**
   ```python
   python -c "from nflread_adapter import *; mod = import_library(); df, fn = call_dataset(mod, 'nextgen_stats', seasons=[2024], stat_type='receiving'); print(df.columns.tolist())"
   ```

2. **Update API Endpoint:**
   - Add `include_ngs` and `ngs_stat_type` parameters
   - Implement merge logic in `get_data()`

3. **Update Frontend:**
   - Add toggle for NextGen stats
   - Display new metrics in WR stats table
   - Add tooltips explaining metrics

4. **Test Integration:**
   - Verify data matching works correctly
   - Handle missing NextGen data gracefully
   - Test with different stat_types

## Example API Call

```bash
# Get player stats with NextGen receiving stats
GET /v1/data/player_stats?seasons=2024&include_ngs=true&ngs_stat_type=receiving

# Response includes both regular stats and NextGen metrics
{
  "data": [
    {
      "player_name": "Tyreek Hill",
      "targets": 150,
      "receptions": 120,
      "receiving_yards": 1800,
      "avg_separation": 3.2,  // From NextGen
      "avg_yac_above_expectation": 1.5,  // From NextGen
      ...
    }
  ]
}
```






