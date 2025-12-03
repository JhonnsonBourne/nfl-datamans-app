import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MantineProvider } from '@mantine/core'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import '@mantine/core/styles.css'
import './index.css'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import errorLogger from './utils/errorLogger.js'
// Initialize performance profiler globally - ensures it's always available
import './utils/performanceProfiler'
// Initialize performance testing utilities
// Note: initWebVitals() requires web-vitals package - install with: npm install web-vitals
// import { initWebVitals } from './utils/performanceTesting'
// if (import.meta.env.DEV) {
//     initWebVitals();
// }

// Setup React Query with caching
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes - data is fresh for 5 min
      gcTime: 30 * 60 * 1000, // 30 minutes - cache time (formerly cacheTime)
      retry: 2, // Retry failed requests twice
      refetchOnWindowFocus: false, // Don't refetch on window focus
      refetchOnReconnect: true, // Refetch on reconnect
    },
  },
})

// Global error handler - log to file
window.addEventListener('error', (event) => {
  errorLogger.logError(event.error, {
    type: 'global',
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
  });
});

window.addEventListener('unhandledrejection', (event) => {
  errorLogger.logError(event.reason, {
    type: 'unhandledPromise',
  });
});

try {
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <MantineProvider>
          <ErrorBoundary>
            <App />
          </ErrorBoundary>
        </MantineProvider>
      </QueryClientProvider>
    </StrictMode>,
  )
} catch (error) {
  console.error('Failed to render app:', error);
  document.getElementById('root').innerHTML = `
    <div style="padding: 20px; text-align: center;">
      <h1>Failed to load application</h1>
      <p>Error: ${error.message}</p>
      <button onclick="window.location.reload()">Reload</button>
    </div>
  `;
}
