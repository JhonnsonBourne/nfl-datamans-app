# NextGen Stats Implementation - Option 2

## Implementation Summary

Successfully implemented Option 2: Merging NextGen Stats into the player_stats endpoint.

## API Changes

### New Query Parameters

1. **`include_ngs`** (boolean, default: `false`)
   - When `true`, merges NextGen Stats into player_stats response
   - Example: `?include_ngs=true`

2. **`ngs_stat_type`** (string, default: `"receiving"`)
   - Valid values: `"receiving"`, `"rushing"`, `"passing"`
   - Specifies which NextGen Stats type to load
   - Example: `?ngs_stat_type=receiving`

### Example API Calls

```bash
# Get player stats with NextGen receiving stats
GET /v1/data/player_stats?seasons=2024&include_ngs=true&ngs_stat_type=receiving

# Get player stats with NextGen rushing stats
GET /v1/data/player_stats?seasons=2024&include_ngs=true&ngs_stat_type=rushing

# Get player stats without NextGen (default)
GET /v1/data/player_stats?seasons=2024
```

## Implementation Details

### Merge Logic

1. **Loading**: NextGen Stats are loaded using `call_dataset()` with the specified `stat_type`
2. **Matching**: Merge on `player_id + season + week` (left join to keep all player stats)
3. **Column Prefixing**: All NextGen columns are prefixed with `ngs_` to avoid conflicts
   - Example: `avg_separation` → `ngs_avg_separation`
4. **Aggregation**: NextGen columns are averaged (since they're already weekly averages)
5. **Error Handling**: If NextGen merge fails, the request continues without NextGen data

### Column Handling

- **Excluded from merge**: Common stats that might conflict (receptions, targets, yards, etc.)
- **Included**: NextGen-specific metrics (separation, cushion, YAC metrics, etc.)
- **Temporal columns**: Season and week are used for matching
- **Player ID**: Automatically detects `player_id`, `gsis_id`, or `gsis_player_id`

### Available NextGen Metrics (for receiving stat_type)

When `include_ngs=true` and `ngs_stat_type=receiving`, the following columns are added:

- `ngs_avg_cushion` - Average cushion (yards)
- `ngs_avg_separation` - Average separation at catch (yards)
- `ngs_avg_intended_air_yards` - Average intended air yards
- `ngs_percent_share_of_intended_air_yards` - Share of team's intended air yards
- `ngs_avg_yac` - Average yards after catch
- `ngs_avg_expected_yac` - Expected YAC
- `ngs_avg_yac_above_expectation` - YAC above/below expectation
- `ngs_catch_percentage` - Catch percentage from NextGen tracking

(Plus any other NextGen-specific columns available in the dataset)

## Frontend Changes

### API Service Update

Updated `frontend/src/services/api.js`:

```javascript
export const getPlayerStats = async (
    seasons = [2024], 
    limit = 100, 
    includeNgs = false, 
    ngsStatType = 'receiving'
) => {
    // ... includes include_ngs and ngs_stat_type parameters
};
```

### Usage Example

```javascript
// Load player stats with NextGen receiving stats
const data = await getPlayerStats([2024], 10000, true, 'receiving');

// Access NextGen metrics
data.data.forEach(player => {
    console.log(player.ngs_avg_separation);
    console.log(player.ngs_avg_yac_above_expectation);
});
```

## Next Steps

1. **Add Frontend Toggle**: Add UI toggle in PlayerStats component to enable/disable NextGen Stats
2. **Display NextGen Columns**: Add NextGen metrics to the WR stats table
3. **Add Tooltips**: Explain what each NextGen metric means
4. **Test Integration**: Verify data matching and handle edge cases

## Testing

To test the implementation:

```bash
# Start the API server
uvicorn api:app --reload

# Test with NextGen Stats
curl "http://localhost:8000/v1/data/player_stats?seasons=2024&include_ngs=true&ngs_stat_type=receiving&limit=10"

# Test without NextGen Stats (should work as before)
curl "http://localhost:8000/v1/data/player_stats?seasons=2024&limit=10"
```

## Notes

- NextGen Stats are only available for players who have tracking data
- Missing NextGen data is handled gracefully (left join)
- NextGen columns are aggregated as means (since they're already weekly averages)
- All NextGen columns are prefixed with `ngs_` to avoid naming conflicts






