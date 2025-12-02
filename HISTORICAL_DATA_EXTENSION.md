# Historical Data Extension

## Overview
Extended data availability back to **1999** (27 seasons total: 1999-2025) for comprehensive similarity analysis and historical comparisons.

## Data Availability

### Core Datasets (1999-2025)
- ✅ **player_stats**: Available for all 27 seasons
- ✅ **pbp** (play-by-play): Available for all 27 seasons  
- ✅ **schedules**: Available for all 27 seasons

### Data Quality
- **EPA Metrics**: Available for all seasons (passing_epa, rushing_epa, receiving_epa)
- **Advanced Metrics**: Full support including air yards, fantasy points, etc.
- **Column Consistency**: 114 columns maintained across all seasons
- **Player Coverage**: Consistent player counts (~1,600-2,000 players per season)

### Limited Datasets
- **participation**: Only available 2016-2024 (used for routes calculation)
- **nextgen_stats**: Only available 2016-2024 (NextGen Stats)
- **snap_counts**: Only available 2016-2024

## Implementation

### Constants Added
```python
HISTORICAL_SEASONS_START = 1999
CURRENT_SEASON = 2025
ALL_HISTORICAL_SEASONS = list(range(1999, 2026))  # 27 seasons
```

### Updated Endpoints

#### `/v1/player/{player_id}/similar` (Career Similarity)
- **Before**: Used 10 seasons (2016-2025)
- **After**: Uses all 27 seasons (1999-2025)
- **Impact**: Much more comprehensive career comparisons, better similarity matches for historical players

### Performance Considerations
- Loading 27 seasons of player_stats can be memory-intensive (~500K+ rows)
- Similarity calculations may take longer but provide significantly better results
- Consider caching career similarity results if performance becomes an issue

## Benefits

1. **Better Similarity Analysis**: 
   - More historical context for player comparisons
   - Better matches for players with long careers
   - More accurate career trajectory comparisons

2. **Historical Context**:
   - Compare current players to all-time greats
   - Better understanding of career arcs
   - More comprehensive player profiles

3. **Data Quality Maintained**:
   - EPA metrics available throughout
   - Consistent column structure
   - No data gaps in core metrics

## Future Enhancements

- Consider adding caching for career similarity calculations
- Add endpoint parameter to limit historical range if needed
- Consider batch loading optimizations for very large queries
- Add data quality checks for older seasons in production



