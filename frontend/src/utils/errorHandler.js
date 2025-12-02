/**
 * Global Error Handler Utility
 * Provides centralized error handling and logging
 */

export const errorHandler = {
  logError: (error, context = {}) => {
    const errorInfo = {
      message: error?.message || 'Unknown error',
      stack: error?.stack,
      context,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href
    };
    
    console.error('Error logged:', errorInfo);
    
    // Send to backend if available
    if (window.fetch) {
      fetch('/api/debug/report-error', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(errorInfo)
      }).catch(err => console.warn('Failed to report error to backend:', err));
    }
    
    return errorInfo;
  },
  
  handleAsyncError: (error, context) => {
    return errorHandler.logError(error, { ...context, type: 'async' });
  },
  
  handleRenderError: (error, componentName) => {
    return errorHandler.logError(error, { type: 'render', component: componentName });
  }
};

// Global error listeners
if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    errorHandler.logError(event.error, { type: 'global', filename: event.filename, lineno: event.lineno });
  });
  
  window.addEventListener('unhandledrejection', (event) => {
    errorHandler.logError(event.reason, { type: 'unhandledPromise' });
  });
}






