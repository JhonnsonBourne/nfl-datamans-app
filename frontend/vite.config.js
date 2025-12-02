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
  }
})
