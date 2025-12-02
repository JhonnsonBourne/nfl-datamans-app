/**
 * Error Logger - Writes errors to a file for review
 * This helps debug issues when terminal output isn't visible
 */

const ERROR_LOG_FILE = 'error-log.json';

class ErrorLogger {
  constructor() {
    this.errors = [];
    this.maxErrors = 100; // Keep last 100 errors
  }

  logError(error, context = {}) {
    const errorEntry = {
      timestamp: new Date().toISOString(),
      message: error?.message || String(error),
      stack: error?.stack,
      context,
      url: typeof window !== 'undefined' ? window.location.href : 'server',
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
    };

    this.errors.push(errorEntry);

    // Keep only last maxErrors
    if (this.errors.length > this.maxErrors) {
      this.errors = this.errors.slice(-this.maxErrors);
    }

    // Try to write to file (browser) or console (server)
    this.writeToFile(errorEntry);

    // Also log to console
    console.error('Error logged:', errorEntry);

    return errorEntry;
  }

  writeToFile(errorEntry) {
    try {
      // In browser, we can't directly write to file system
      // So we'll use localStorage and provide a download mechanism
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem('errorLog') || '[]';
        const errors = JSON.parse(stored);
        errors.push(errorEntry);
        
        // Keep last 100
        const trimmed = errors.slice(-100);
        localStorage.setItem('errorLog', JSON.stringify(trimmed));
        localStorage.setItem('errorLogTimestamp', new Date().toISOString());
        
        // Also try to send to backend if available
        this.sendToBackend(errorEntry);
      }
    } catch (e) {
      console.error('Failed to write error to storage:', e);
    }
  }

  async sendToBackend(errorEntry) {
    try {
      // Send to backend debug endpoint if available
      const response = await fetch('http://localhost:8000/debug/report-error', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(errorEntry),
      });
      return response.ok;
    } catch (e) {
      // Backend might not be available, that's okay
      return false;
    }
  }

  getAllErrors() {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('errorLog');
      return stored ? JSON.parse(stored) : [];
    }
    return this.errors;
  }

  downloadErrorLog() {
    if (typeof window === 'undefined') return;

    const errors = this.getAllErrors();
    const dataStr = JSON.stringify(errors, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `error-log-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  clearErrors() {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('errorLog');
      localStorage.removeItem('errorLogTimestamp');
    }
    this.errors = [];
  }

  getErrorCount() {
    return this.getAllErrors().length;
  }
}

// Create singleton instance
const errorLogger = new ErrorLogger();

// Export for use in components
export default errorLogger;

// Also add to window for easy access in console
if (typeof window !== 'undefined') {
  window.errorLogger = errorLogger;
  window.downloadErrorLog = () => errorLogger.downloadErrorLog();
  window.clearErrorLog = () => errorLogger.clearErrorLog();
  window.getErrorCount = () => errorLogger.getErrorCount();
  
  console.log('Error Logger initialized. Use window.downloadErrorLog() to download errors.');
}






