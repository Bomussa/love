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
      jsxRuntime: 'automatic'
    }),
    legacy({
      targets: ['defaults', 'not IE 11'],
      // تقليل polyfills غير الضرورية
      modernPolyfills: true
    })
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
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
        // تحسينات إضافية
        pure_funcs: ['console.log', 'console.info', 'console.debug'],
        passes: 2,
        unsafe: true,
        unsafe_comps: true,
        unsafe_math: true,
        unsafe_methods: true
      },
      mangle: {
        safari10: true
      },
      format: {
        comments: false
      }
    },
    cssCodeSplit: true,
    cssMinify: true,
    sourcemap: false,
    chunkSizeWarningLimit: 1000,
    // تحسين حجم الـ chunks
    reportCompressedSize: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            // Split vendor chunks for better caching
            if (id.includes('react') || id.includes('react-dom')) {
              return 'vendor-react';
            }
            if (id.includes('@supabase')) {
              return 'vendor-supabase';
            }
            if (id.includes('lucide-react')) {
              return 'vendor-icons';
            }
            // تقسيم المكتبات الكبيرة
            if (id.includes('react-router')) {
              return 'vendor-router';
            }
            // Other node_modules go to vendor
            return 'vendor';
          }
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
          constBindings: true
        }
      }
    }
  },
  // تحسينات إضافية
  optimizeDeps: {
    include: ['react', 'react-dom', '@supabase/supabase-js'],
    exclude: []
  },
  esbuild: {
    // تحسين esbuild
    legalComments: 'none',
    minifyIdentifiers: true,
    minifySyntax: true,
    minifyWhitespace: true,
    treeShaking: true
  }
});
