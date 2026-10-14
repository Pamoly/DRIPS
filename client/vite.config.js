import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// The app is served by Vite in development (with an API proxy) and by the
// Express server in production (`npm run build && npm start`).
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: '0.0.0.0',
    port: Number(process.env.PORT_WEB || 5173),
    allowedHosts: true,
    strictPort: false,
    proxy: {
      '/api': {
        target: process.env.API_URL || 'http://127.0.0.1:8787',
        changeOrigin: true,
      },
    },
  },
  preview: { host: '0.0.0.0', port: 4173, allowedHosts: true },
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        // Vite 8 runs on Rolldown, which expects manualChunks as a function.
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('jspdf')) return 'pdf';
          if (id.includes('xlsx')) return 'sheets';
          if (id.includes('recharts') || id.includes('d3-') || id.includes('victory-vendor')) return 'charts';
          if (id.includes('lucide-react')) return 'icons';
          if (id.includes('react') || id.includes('scheduler')) return 'vendor';
          return 'deps';
        },
      },
    },
  },
});
