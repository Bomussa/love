import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
<<<<<<< HEAD:vite.config.js
  base: './',
=======
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
>>>>>>> cc9033d5cf9190f8972ab2ccebe5b926add6f68b:frontend/vite.config.js
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
