import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  optimizeDeps: {
    include: [
      '@mantine/core',
      '@mantine/hooks',
      '@mantine/notifications',
      '@tanstack/react-table',
      '@tiptap/react',
      '@tiptap/starter-kit',
    ],
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    css: true,
    // Exclude Playwright E2E tests - they should only run with Playwright
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/tests/e2e/**',  // Exclude Playwright E2E tests
      '**/*.e2e.spec.{js,ts,jsx,tsx}',  // Exclude any E2E test files
      '**/*.e2e.{js,ts,jsx,tsx}',  // Exclude any E2E files
    ],
    include: [
      'src/**/*.{test,spec}.{js,ts,jsx,tsx}',
      'src/tests/**/*.{test,spec}.{js,ts,jsx,tsx}',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/test/',
        'tests/e2e/',  // Exclude E2E tests from coverage
        '**/*.d.ts',
        '**/*.config.*',
        '**/mockData',
      ],
    },
  },
})
