import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import apiMiddleware from './api-middleware.js';

const apiPath = path.resolve(__dirname, '../api/index.js');

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'api-middleware',
      configureServer(server) {
        server.middlewares.use((req, res, next) => apiMiddleware(req, res, next, apiPath));
      },
    },
  ],
  base: './',
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 3000,
    host: '0.0.0.0',
    strictPort: false,
    allowedHosts: 'all'
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    rollupOptions: {
      output: {
        manualChunks: undefined
      }
    }
  }
});
