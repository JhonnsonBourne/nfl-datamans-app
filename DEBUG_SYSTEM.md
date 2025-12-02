# Debug System Guide

This application includes a comprehensive debugging system that captures errors and logs for easy diagnosis.

## How It Works

### Backend Debug System

The backend automatically:
- **Logs all errors** with full tracebacks and context
- **Stores recent logs** (last 500 entries)
- **Stores recent errors** (last 100 entries)
- **Writes to `debug_log.json`** for agent-readable access

### Frontend Error Reporting

The frontend automatically:
- **Catches API errors** and reports them to the backend
- **Reports component errors** with context (component name, action, state)
- **Includes browser context** (user agent, URL, timestamp)

## Debug Endpoints

### Get Recent Errors
```bash
GET http://127.0.0.1:8000/debug/errors?limit=10
```

### Get Recent Logs
```bash
GET http://127.0.0.1:8000/debug/logs?limit=20
```

### Get Debug Status
```bash
GET http://127.0.0.1:8000/debug/status
```

### Report Error (Frontend)
```bash
POST http://127.0.0.1:8000/debug/report-error
Content-Type: application/json

{
  "error": "Error message",
  "traceback": "Stack trace",
  "context": {"component": "PlayerStats", "action": "loadData"}
}
```

## Reading Debug Information

### For Agents/AI Assistants

1. **Read the debug file directly:**
   ```bash
   cat debug_log.json
   # or
   python -c "import json; print(json.dumps(json.load(open('debug_log.json')), indent=2))"
   ```

2. **Query the debug endpoints:**
   ```bash
   curl http://127.0.0.1:8000/debug/status
   curl http://127.0.0.1:8000/debug/errors?limit=5
   ```

3. **Check the file in the workspace:**
   - File: `nfl-datamans-app/debug_log.json`
   - Contains: Last 10 errors, last 20 logs, status info

### Debug File Structure

```json
{
  "last_updated": "2024-01-15T10:30:00",
  "error_count": 5,
  "log_count": 150,
  "recent_errors": [
    {
      "timestamp": "2024-01-15T10:29:45",
      "error_type": "KeyError",
      "error_message": "'player_id'",
      "traceback": "...",
      "context": {"seasons": [2024], "stat_type": "receiving"}
    }
  ],
  "recent_logs": [
    {
      "timestamp": "2024-01-15T10:29:30",
      "level": "INFO",
      "message": "Loading NextGen Stats...",
      "context": {"seasons": [2024]}
    }
  ]
}
```

## Usage Examples

### Check for Recent Errors
```python
import json
with open('debug_log.json') as f:
    debug = json.load(f)
    if debug['error_count'] > 0:
        print(f"Found {debug['error_count']} errors:")
        for error in debug['recent_errors']:
            print(f"  - {error['error_type']}: {error['error_message']}")
```

### Monitor Debug Status
```bash
watch -n 5 'curl -s http://127.0.0.1:8000/debug/status | python -m json.tool'
```

## Best Practices

1. **Check debug file first** when investigating issues
2. **Review recent errors** before making changes
3. **Check logs** to understand what the system was doing
4. **Use context** in error reports to understand the state

## Troubleshooting

### Debug file not updating?
- Check that the backend server is running
- Verify file permissions
- Check backend logs for errors writing the file

### No errors showing?
- Errors are only logged when exceptions occur
- Check that error reporting is working in the frontend
- Verify CORS is configured correctly

### Too many logs?
- The system automatically limits to last 500 logs and 100 errors
- Older entries are automatically removed (FIFO queue)






