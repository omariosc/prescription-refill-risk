import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import os from 'os';

// Detect the first non-loopback IPv4 address so the QR code points to the LAN IP
function getLanIp() {
  const nets = os.networkInterfaces();
  for (const iface of Object.values(nets)) {
    for (const alias of iface) {
      if (alias.family === 'IPv4' && !alias.internal) return alias.address;
    }
  }
  return null;
}

const lanIp = getLanIp();

export default defineConfig({
  plugins: [react()],
  root: '.',
  define: {
    // Injected at dev/build time so the QR code can show the LAN URL instead of localhost
    __LAN_IP__: JSON.stringify(lanIp),
  },
  build: {
    outDir: '../public',
    emptyOutDir: false,
  },
  server: {
    port: 5173,
    host: true,      // expose on local network (access from mobile on same WiFi)
    open: true,      // auto-open browser on start
    proxy: {
      // Forward all non-React routes to the Cloudflare Worker (wrangler dev on 8787)
      '/api':  { target: 'http://localhost:8787', changeOrigin: true },
      '/docs': { target: 'http://localhost:8787', changeOrigin: true },
    },
  },
});
