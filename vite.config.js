import { defineConfig } from 'vite'
import path from 'path'

const backend = (process.env.VITE_API_BASE || 'http://localhost:3000').replace(/\/$/, '')

export default defineConfig({
  server: {
    proxy: {
      // تمرير REST
      '/api': {
        target: backend,
        changeOrigin: true,
        secure: false,
        ws: true,
      },
      // تمرير SSE (EventSource)
      '/api/v1/events/stream': {
        target: backend,
        changeOrigin: true,
        secure: false,
        ws: true,
        headers: { 'Cache-Control': 'no-cache' },
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
})

