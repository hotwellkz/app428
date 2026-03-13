import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

/**
 * Только `vite` (порт 5173): прокси шлёт на :8888. Если Netlify Dev не запущен — 500.
 * Эти функции — лёгкие stub'ы; отдаём их прямо из Vite, чтобы чат/стабилизатор не падали.
 * Полный бэкенд: npm run dev:full
 */
function netlifyLocalStubsPlugin(): Plugin {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
  };
  return {
    name: 'netlify-local-stubs',
    enforce: 'pre',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const pathOnly = (req.url || '').split('?')[0];
        if (req.method === 'OPTIONS' && pathOnly.startsWith('/.netlify/functions/')) {
          Object.entries(cors).forEach(([k, v]) => res.setHeader(k, v));
          res.statusCode = 204;
          res.end();
          return;
        }
        if (req.method === 'GET' && pathOnly.startsWith('/.netlify/functions/health')) {
          res.setHeader('Content-Type', 'application/json');
          Object.entries(cors).forEach(([k, v]) => res.setHeader(k, v));
          res.end(
            JSON.stringify({
              status: 'ok',
              whatsapp: { ready: false, authenticated: false, connected: false, state: 'disconnected' },
            })
          );
          return;
        }
        if (req.method === 'GET' && pathOnly.startsWith('/.netlify/functions/contacts')) {
          res.setHeader('Content-Type', 'application/json');
          Object.entries(cors).forEach(([k, v]) => res.setHeader(k, v));
          res.end(JSON.stringify({ success: true, contacts: {} }));
          return;
        }
        if (req.method === 'GET' && pathOnly.startsWith('/.netlify/functions/whatsapp-status')) {
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.end(JSON.stringify({ status: 'disconnected' }));
          return;
        }
        next();
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [netlifyLocalStubsPlugin(), react()],
  envPrefix: 'VITE_',
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  test: {
    environment: 'node',
    globals: true
  },
  optimizeDeps: {
    exclude: ['whatsapp-web.js'],
    include: [
      'react',
      'react-dom',
      'firebase/firestore',
      'firebase/auth',
      'firebase/storage',
      'lucide-react',
      'date-fns',
      'clsx'
    ]
  },
  build: {
    commonjsOptions: {
      exclude: ['whatsapp-web.js']
    },
    rollupOptions: {
      output: {
        manualChunks: {
          // React и основные библиотеки
          vendor: ['react', 'react-dom'],
          
          // Firebase
          firebase: [
            'firebase/app',
            'firebase/firestore', 
            'firebase/auth',
            'firebase/storage'
          ],
          
          // UI библиотеки
          ui: [
            'lucide-react',
            '@headlessui/react',
            'react-custom-scrollbars-2'
          ],
          
          // Утилиты
          utils: [
            'date-fns',
            'clsx',
            'react-router-dom'
          ],
          
          // Тяжёлые библиотеки
          heavy: [
            '@dnd-kit/core',
            '@dnd-kit/sortable',
            'react-swipeable',
            'framer-motion'
          ],
          
          // Редакторы и формы
          editors: [
            '@tiptap/react',
            '@tiptap/starter-kit',
            'react-quill'
          ]
        }
      }
    },
    
    // Увеличиваем лимит для предупреждений о размере чанков
    chunkSizeWarningLimit: 1000,
    
    // Используем встроенную минификацию esbuild вместо terser
    minify: 'esbuild',
    
    // Sourcemaps для диагностики (временно включены для build)
    sourcemap: true,
  },
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/.netlify/functions': {
        target: 'http://127.0.0.1:8888',
        changeOrigin: true
      },
      '/api': {
        target: 'http://127.0.0.1:8888',
        changeOrigin: true
      }
    }
  }
});
