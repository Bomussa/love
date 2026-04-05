// Build timestamp: 2026-04-05 - Fixed for Vite 8
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [
    react({
      fastRefresh: true,
      jsxRuntime: 'automatic',
    }),
  ],
  base: '/',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    host: '0.0.0.0',
    strictPort: false,
    cors: true,
    allowedHosts: true,
    hmr: {
      clientPort: 443,
      protocol: 'wss',
    },
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    minify: 'esbuild',
    cssCodeSplit: true,
    cssMinify: true,
    sourcemap: false,
    chunkSizeWarningLimit: 500,
    target: 'esnext',
    reportCompressedSize: false,
    rollupOptions: {
      treeshake: {
        moduleSideEffects: (id) => {
          if (id.includes('supabase-client')) return true;
          return false;
        },
        propertyReadSideEffects: false,
      },
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react-dom')) return 'vendor-react-dom';
            if (id.includes('react')) return 'vendor-react';
            if (id.includes('@supabase/realtime')) return 'vendor-supabase-rt';
            if (id.includes('@supabase')) return 'vendor-supabase';
            if (id.includes('lucide-react')) return 'vendor-icons';
            if (id.includes('react-router')) return 'vendor-router';
            return 'vendor';
          }
          // Admin Dashboard chunks
          if (id.includes('AdminDashboardV2')) return 'admin-dashboard';
          if (id.includes('AdvancedNotificationsManager') || id.includes('NotificationsManagementV2') || id.includes('OperationalNotificationsManager')) return 'admin-notifications';
          if (id.includes('APIMonitor') || id.includes('AdminQueueMonitor') || id.includes('LiveStatisticsPanel')) return 'admin-monitoring';
        },
        assetFileNames: (assetInfo) => {
          const name = assetInfo.name || '';
          let extType = name.split('.').at(1);
          if (/png|jpe?g|svg|gif|tiff|bmp|ico/i.test(extType)) {
            extType = 'img';
            return `assets/${extType}/optimized/[name]-[hash][extname]`;
          }
          return `assets/${extType}/[name]-[hash][extname]`;
        },
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
      },
    },
  },
  optimizeDeps: {
    include: ['react', 'react-dom', '@supabase/supabase-js'],
    exclude: [],
  },
  esbuild: {
    legalComments: 'none',
    minifyIdentifiers: true,
    minifySyntax: true,
    minifyWhitespace: true,
    treeShaking: true,
    target: 'es2020',
  },
});
