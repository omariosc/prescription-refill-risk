import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  root: '.',
  build: {
    outDir: '../public',
    emptyOutDir: false,
  },
  server: {
    port: 5173,
    open: true,      // auto-open browser on start
    proxy: {
      // Forward all non-React routes to the Cloudflare Worker (wrangler dev on 8787)
      '/api':  { target: 'http://localhost:8787', changeOrigin: true },
      '/docs': { target: 'http://localhost:8787', changeOrigin: true },
    },
  },
});
