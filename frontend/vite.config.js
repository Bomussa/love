// Build timestamp: 2026-03-03 - Performance Optimized v2
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import legacy from '@vitejs/plugin-legacy';
import path from 'path';

export default defineConfig({
  plugins: [
    react({
      // تحسين React Refresh
      fastRefresh: true,
      // تقليل حجم runtime
      jsxRuntime: 'automatic',
    }),
    legacy({
      targets: ['defaults', 'not IE 11'],
      modernPolyfills: false,
      renderLegacyChunks: false,
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
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.info', 'console.debug', 'console.warn'],
        passes: 3,
        unsafe: true,
        unsafe_comps: true,
        unsafe_math: true,
        unsafe_methods: true,
        dead_code: true,
        collapse_vars: true,
        reduce_vars: true,
        sequences: true,
      },
      mangle: {
        safari10: true,
      },
      format: {
        comments: false,
      },
    },
    cssCodeSplit: true,
    cssMinify: true,
    sourcemap: false,
    chunkSizeWarningLimit: 500,
    target: ['es2020', 'chrome80', 'firefox78', 'safari14'],
    // تحسين حجم الـ chunks
    reportCompressedSize: false,
    rollupOptions: {
      treeshake: {
        moduleSideEffects: false,
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
          // تقسيم AdminDashboard لتحميله منفصلاً
          if (id.includes('AdminDashboardV2')) return 'admin-dashboard';
          if (id.includes('AdvancedNotificationsManager') || id.includes('NotificationsManagementV2') || id.includes('OperationalNotificationsManager')) return 'admin-notifications';
          if (id.includes('APIMonitor') || id.includes('AdminQueueMonitor') || id.includes('AdminPINMonitor') || id.includes('LiveStatisticsPanel')) return 'admin-monitoring';
        },
        assetFileNames: (assetInfo) => {
          let extType = assetInfo.name.split('.').at(1);
          if (/png|jpe?g|svg|gif|tiff|bmp|ico/i.test(extType)) {
            extType = 'img';
          }
          return `assets/${extType}/[name]-[hash][extname]`;
        },
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
        // تحسين compact output
        compact: true,
        // تقليل whitespace
        generatedCode: {
          constBindings: true,
        },
      },
    },
  },
  // تحسينات إضافية
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
    drop: ['console', 'debugger'],
  },
});
