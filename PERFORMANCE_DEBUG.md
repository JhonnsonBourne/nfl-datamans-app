# Performance Debugging Guide

## Quick Diagnosis

### 1. Check Performance Metrics
```bash
curl http://localhost:8000/debug/performance
```

### 2. Check Slow Operations
```bash
curl http://localhost:8000/debug/slow-operations
```

### 3. Check Endpoint Stats
```bash
curl http://localhost:8000/debug/endpoint-stats
```

## Common Performance Issues

### Issue 1: Slow Dataset Loading
**Symptom**: Endpoints taking 5-30 seconds  
**Cause**: Loading entire datasets from nflreadpy synchronously  
**Solution**: Use PostgreSQL instead, or add caching

### Issue 2: Large DataFrame Operations
**Symptom**: High memory usage, slow `to_dict()` calls  
**Cause**: Converting large DataFrames to dicts  
**Solution**: Limit data before conversion, use streaming

### Issue 3: Multiple Sequential Dataset Loads
**Symptom**: `/v1/player/{player_id}` very slow  
**Cause**: Loading players, rosters, stats, schedules sequentially  
**Solution**: Parallel loading or use database

### Issue 4: Complex Data Processing
**Symptom**: Routes calculation taking forever  
**Cause**: Merging PBP + Participation data  
**Solution**: Pre-calculate in dbt, cache results

## Performance Targets

- **Fast endpoints** (< 200ms): Health checks, simple queries
- **Acceptable** (200-1000ms): Filtered queries, single dataset loads
- **Slow** (1-5s): Complex queries, multiple datasets
- **Very Slow** (> 5s): Needs optimization

## Monitoring

Performance metrics are automatically logged. Check logs for:
- `⏱️  SLOW OPERATION` - Operations > 1 second
- `🐌 SLOW ENDPOINT` - Endpoints > 2 seconds
- `❌ ENDPOINT ERROR` - Failed endpoints with timing

