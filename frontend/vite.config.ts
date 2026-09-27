import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The dev server proxies the API to the Python engine (port 8000) so the browser only
// ever talks to one origin — no CORS, no localhost calls from the client, and the same
// code path works when the built UI is served by the engine itself.
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 3000,
    strictPort: false,
    // Sandboxed previews and tunnels give the dev server a random hostname
    // (e.g. `3000-<id>.e2b.app`). Vite's host check is a dev-only DNS-rebinding guard,
    // and rejecting the preview host makes the app unreachable, so it is disabled here.
    allowedHosts: true,
    proxy: {
      '/api': {
        target: process.env.DRIPS_ENGINE_URL ?? 'http://127.0.0.1:8000',
        changeOrigin: true,
        // server-sent events must not be buffered
        configure: (proxy) => {
          proxy.on('proxyRes', (proxyRes) => {
            if (proxyRes.headers['content-type']?.includes('text/event-stream')) {
              delete proxyRes.headers['content-length'];
            }
          });
        },
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 4000,
    rollupOptions: {
      output: {
        manualChunks: {
          monaco: ['monaco-editor'],
          react: ['react', 'react-dom'],
        },
      },
    },
  },
  worker: { format: 'es' },
});
