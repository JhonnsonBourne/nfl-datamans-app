# Error Logging System

## Overview
This system automatically captures and logs all errors to a file that can be reviewed. This makes debugging much easier, especially when terminal output isn't visible.

## How It Works

1. **Automatic Error Capture**: All errors are automatically logged:
   - Global JavaScript errors
   - Unhandled promise rejections
   - React Error Boundary errors
   - Component errors (Button, utils, etc.)

2. **Storage**: Errors are stored in browser localStorage and can be downloaded as JSON

3. **Visual Error Viewer**: A floating button in the bottom-left corner shows error count and allows viewing/downloading errors

## How to Use

### View Errors in Browser
1. Look for the red "⚠️ Errors" button in the bottom-left corner of the page
2. Click it to open the error log viewer
3. You'll see:
   - Error count badge
   - List of all errors with timestamps
   - Stack traces (click to expand)
   - Download button to save errors as JSON
   - Clear button to remove all errors

### Download Error Log
1. Click the "⚠️ Errors" button
2. Click "📥 Download" button
3. A JSON file will be downloaded with all errors

### Using Browser Console
You can also use these commands in the browser console:
```javascript
// Download error log
window.downloadErrorLog()

// View error count
window.getErrorCount()

// Clear all errors
window.clearErrorLog()

// Access the logger directly
window.errorLogger.getAllErrors()
```

## Error Log Format

Each error entry contains:
- `timestamp`: When the error occurred
- `message`: Error message
- `stack`: Stack trace (if available)
- `context`: Additional context (error type, component info, etc.)
- `url`: Page URL where error occurred
- `userAgent`: Browser information

## Integration Points

Errors are automatically logged from:
- `main.jsx`: Global error handlers
- `ErrorBoundary.jsx`: React component errors
- `utils.js`: Utility function errors
- `button.jsx`: Component errors
- Any component using `errorLogger.logError()`

## Backend Integration

Errors are also automatically sent to the backend debug endpoint (`/debug/report-error`) if the backend is available. This allows errors to be logged server-side as well.

## Example Error Entry

```json
{
  "timestamp": "2024-01-15T10:30:45.123Z",
  "message": "Cannot find module 'clsx'",
  "stack": "Error: Cannot find module 'clsx'\n    at ...",
  "context": {
    "type": "cnUtility",
    "inputs": ["bg-primary-600"]
  },
  "url": "http://localhost:5173/",
  "userAgent": "Mozilla/5.0..."
}
```

## Troubleshooting

If errors aren't showing:
1. Check browser console for "Error Logger initialized" message
2. Make sure localStorage is enabled in your browser
3. Check if errors are being caught (some errors might occur before the logger loads)

## Next Steps

To review errors:
1. Open the app in browser
2. Click the error button (bottom-left)
3. Review errors or download the JSON file
4. Share the error log file for debugging






