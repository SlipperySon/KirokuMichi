import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
  },
  optimizeDeps: {
    include: ['sql.js'],
  },
  server: {
    proxy: {
      '/api': 'http://localhost:3001',
    },
    middlewareMode: false,
  },
  // Serve data folder as static files for curriculum/lesson data
  publicDir: 'public',
})
