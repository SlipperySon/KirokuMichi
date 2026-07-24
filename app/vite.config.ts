import { configDefaults, defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    // Never emit source maps into production dist (avoids shipping original sources).
    sourcemap: false,
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/node_modules/react') || id.includes('/node_modules/react-dom') || id.includes('/node_modules/react-router-dom')) {
            return 'vendor-react'
          }
          // Keep sql.js in its own chunk; do not force /src/srs or /src/db here —
          // that pulled route-only Anki/JSZip code into the initial storage graph.
          if (id.includes('/node_modules/sql.js')) {
            return 'vendor-storage'
          }
          if (id.includes('/node_modules/pdfjs-dist') || id.includes('/node_modules/pdf-parse')) {
            return 'vendor-pdf'
          }
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
    exclude: [...configDefaults.exclude, 'tests/**', 'src/study/routeSmoke.test.tsx'],
  },
  optimizeDeps: {
    include: ['sql.js'],
  },
  server: {
    proxy: {
      '/api': 'http://localhost:3001',
      '/data': 'http://localhost:3001',
    },
  },
  // Serve data folder as static files for curriculum/lesson data
  publicDir: 'public',
})
