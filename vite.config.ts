import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ command }) => {
  return {
    plugins: [
      react(), 
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: [
          'favicon.ico',
          'favicon.png',
          'apple-touch-icon.png',
          'pwa-192x192.png',
          'pwa-512x512.png',
          'pwa-maskable-192x192.png',
          'pwa-maskable-512x512.png',
          'icon.svg'
        ],
        manifest: {
          id: '/',
          name: 'DISHA 20-20 — दिशा 20-20',
          short_name: 'DISHA 20-20',
          description: 'DISHA 20-20 (दिशा 20-20) — Premium Indian competitive-exam preparation platform for RAS, REET, Patwar, and RPSC exams.',
          theme_color: '#FFFFFF',
          background_color: '#FFFFFF',
          display: 'standalone',
          start_url: '/',
          scope: '/',
          icons: [
            {
              src: '/pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-maskable-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'maskable',
            },
            {
              src: '/pwa-maskable-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
            {
              src: '/icon.svg',
              sizes: 'any',
              type: 'image/svg+xml',
              purpose: 'any',
            },
            {
              src: '/apple-touch-icon.png',
              sizes: '180x180',
              type: 'image/png',
              purpose: 'any',
            },
          ],
        },
        workbox: {
          importScripts: ['/sw-push-handler.js'],
          mode: command === 'build' ? 'production' : 'development',
          cleanupOutdatedCaches: true,
          skipWaiting: true,
          clientsClaim: true,
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
          navigateFallback: '/index.html',
          navigateFallbackDenylist: [/^\/api\//, /^\/src\//, /^\/@vite\//, /^\/node_modules\//],
          runtimeCaching: [
            {
              urlPattern: /\/api\/(?:quiz-assets\/(?:curriculum|bundle\/[^/?]+|pyq-papers|live-tests)|live-tests\/[^/?]+)\?.*v=/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'static-quiz-data-cache',
                expiration: {
                  maxEntries: 500,
                  maxAgeSeconds: 60 * 60 * 24 * 90, // 90 days (version-keyed immutable quiz assets)
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: /\/api\/quiz-assets\/version/i,
              handler: 'NetworkFirst',
              options: {
                cacheName: 'quiz-version-cache',
                networkTimeoutSeconds: 2,
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 7,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'gstatic-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: /^https:\/\/(?:storage\.googleapis\.com|[^/]+\.supabase\.co\/storage\/v1\/object\/public)\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'static-quiz-media-cache',
                expiration: {
                  maxEntries: 250,
                  maxAgeSeconds: 60 * 60 * 24 * 90,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: /\/api\/pronounce-en-gb/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'static-quiz-media-cache',
                expiration: {
                  maxEntries: 200,
                  maxAgeSeconds: 60 * 60 * 24 * 90,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: ({ url }) => {
                if (url.pathname.startsWith('/src/') || url.pathname.startsWith('/@vite/') || url.pathname.startsWith('/node_modules/')) {
                  return false;
                }
                return (
                  url.pathname.startsWith('/assets/') ||
                  /\.(?:png|jpg|jpeg|gif|svg|ico|webp|woff|woff2|ttf|eot)$/i.test(url.pathname)
                );
              },
              handler: 'CacheFirst',
              options: {
                cacheName: 'static-quiz-media-cache',
                expiration: {
                  maxEntries: 200,
                  maxAgeSeconds: 60 * 60 * 24 * 90,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: ({ request }) => request.mode === 'navigate',
              handler: 'NetworkFirst',
              options: {
                cacheName: 'pages-cache',
                expiration: {
                  maxEntries: 50,
                  maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
                },
              },
            },
            {
              urlPattern: /\/(topics|profile|study|analytics|dashboard|tests|live|vault|news|settings|admin|about|privacy|terms|disclaimer)/i,
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'core-routes-cache',
                expiration: {
                  maxEntries: 100,
                  maxAgeSeconds: 60 * 60 * 24 * 30,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: /\/api\/.*/i,
              handler: 'NetworkFirst',
              options: {
                cacheName: 'api-content-cache',
                networkTimeoutSeconds: 3,
                expiration: {
                  maxEntries: 150,
                  maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days offline cache
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
          ],
        },
        devOptions: {
          enabled: true,
          type: 'module',
          navigateFallback: 'index.html',
        },
      }),
    ],
    resolve: {
      dedupe: ['react', 'react-dom', 'lucide-react', 'motion'],
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
        'workbox-window': path.resolve(import.meta.dirname, 'node_modules/.pnpm/workbox-window@7.4.1/node_modules/workbox-window'),
      },
    },
    optimizeDeps: {
      holdUntilCrawlEnd: true,
      include: [
        'react/jsx-runtime', 
        'react/jsx-dev-runtime', 
        'react-dom/client', 
        'motion/react',
        'motion',
        'lucide-react', 
        'canvas-confetti',
        'd3',
        'dompurify',
        'katex',
        'jspdf',
        'html2canvas',
        'mammoth',
        'react-markdown',
        'remark-gfm',
        'react-window'
      ],
    },
    build: {
      target: 'es2020',
      cssMinify: true,
      chunkSizeWarningLimit: 1200,
      rollupOptions: command === 'build' ? {
        output: {
          manualChunks: (id) => {
            if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/')) {
              return 'vendor-react';
            }
            if (id.includes('node_modules/lucide-react/')) {
              return 'vendor-icons';
            }
            if (id.includes('node_modules/motion/') || id.includes('node_modules/framer-motion/')) {
              return 'vendor-motion';
            }
            if (id.includes('node_modules/katex/')) {
              return 'vendor-katex';
            }
            if (id.includes('node_modules/jspdf/') || id.includes('node_modules/html2canvas/')) {
              return 'vendor-pdf';
            }
          },
        },
      } : {},
    },
    server: {
      hmr: true,
    },
    test: {
      include: ['src/**/*.{test,spec}.{ts,tsx}', 'tests/**/*.{test,spec}.{ts,tsx}', 'scripts/**/*.{test,spec}.{ts,tsx}'],
      exclude: ['node_modules/**', 'dist/**', 'opencode-antigravity-auth/**'],
    },
  };
});
