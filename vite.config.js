import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

const r = (p) => path.resolve(import.meta.dirname, p);

export default defineConfig({
  plugins: [react()],
  // Absolute base: the app uses real paths (/jobs, /insights …), so assets
  // must resolve from the site root, not relative to the current URL.
  base: '/',
  resolve: {
    alias: {
      '@': r('src'),
      '@components': r('src/components'),
      '@modules': r('src/modules'),
      '@utils': r('src/utils'),
      '@hooks': r('src/hooks'),
      '@api': r('src/api'),
      '@redux': r('src/redux'),
      '@styles': r('src/styles'),
      '@assets': r('src/assets'),
    },
  },
  server: {
    port: 3007,
    strictPort: true,
    host: true,
    // API server (npm run dev:api) — same-origin /api in dev, like production.
    // If the API is briefly down (restarting), answer 503 JSON instead of a
    // proxy error page so the client can retry quietly.
    proxy: {
      '/api': {
        target: process.env.VITE_API_PROXY || 'http://localhost:4000',
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('error', (_err, _req, res) => {
            if (res.headersSent || typeof res.writeHead !== 'function') return;
            res.writeHead(503, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'API is restarting — retrying…' }));
          });
        },
      },
    },
  },
});
