import React, { useState, useEffect } from 'react';
import errorLogger from '../utils/errorLogger';

export default function ErrorLogViewer() {
  const [errors, setErrors] = useState([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    loadErrors();
    // Refresh every 5 seconds
    const interval = setInterval(loadErrors, 5000);
    return () => clearInterval(interval);
  }, []);

  const loadErrors = () => {
    const errorList = errorLogger.getAllErrors();
    setErrors(errorList);
  };

  const handleDownload = () => {
    errorLogger.downloadErrorLog();
  };

  const handleClear = () => {
    if (window.confirm('Clear all error logs?')) {
      errorLogger.clearErrors();
      loadErrors();
    }
  };

  const errorCount = errors.length;
  const latestError = errors[errors.length - 1];

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 left-4 bg-red-600 text-white px-4 py-2 rounded-lg shadow-lg hover:bg-red-700 z-50 flex items-center gap-2"
        title="View Error Log"
      >
        <span>⚠️</span>
        {errorCount > 0 && (
          <span className="bg-white text-red-600 rounded-full px-2 py-0.5 text-xs font-bold">
            {errorCount}
          </span>
        )}
        <span>Errors</span>
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 left-4 bg-white border-2 border-red-500 rounded-lg shadow-2xl z-50 w-96 max-h-96 flex flex-col">
      <div className="bg-red-600 text-white p-3 flex items-center justify-between rounded-t-lg">
        <div className="flex items-center gap-2">
          <span>⚠️</span>
          <span className="font-bold">Error Log</span>
          {errorCount > 0 && (
            <span className="bg-white text-red-600 rounded-full px-2 py-0.5 text-xs font-bold">
              {errorCount}
            </span>
          )}
        </div>
        <button
          onClick={() => setIsOpen(false)}
          className="text-white hover:bg-red-700 rounded px-2"
        >
          ✕
        </button>
      </div>

      <div className="p-3 flex gap-2 border-b">
        <button
          onClick={handleDownload}
          className="flex-1 bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700 text-sm"
        >
          📥 Download
        </button>
        <button
          onClick={handleClear}
          className="flex-1 bg-gray-600 text-white px-3 py-1.5 rounded hover:bg-gray-700 text-sm"
        >
          🗑️ Clear
        </button>
        <button
          onClick={loadErrors}
          className="px-3 py-1.5 bg-gray-200 rounded hover:bg-gray-300 text-sm"
        >
          🔄
        </button>
      </div>

      <div className="overflow-y-auto flex-1 p-3">
        {errors.length === 0 ? (
          <div className="text-gray-500 text-center py-4">No errors logged</div>
        ) : (
          <div className="space-y-3">
            {errors.slice().reverse().map((error, idx) => (
              <div
                key={idx}
                className="border border-gray-300 rounded p-2 text-xs bg-gray-50"
              >
                <div className="font-semibold text-red-600 mb-1">
                  {error.message || 'Unknown error'}
                </div>
                <div className="text-gray-600 text-xs mb-1">
                  {new Date(error.timestamp).toLocaleString()}
                </div>
                {error.context?.type && (
                  <div className="text-gray-500 text-xs mb-1">
                    Type: {error.context.type}
                  </div>
                )}
                {error.stack && (
                  <details className="mt-1">
                    <summary className="cursor-pointer text-gray-600 hover:text-gray-800">
                      Stack trace
                    </summary>
                    <pre className="mt-1 text-xs bg-gray-100 p-2 rounded overflow-auto max-h-32">
                      {error.stack}
                    </pre>
                  </details>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}






