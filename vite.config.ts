import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In development the API is proxied under the same origin, so the SameSite=Strict
// refresh cookie behaves exactly as it will in production behind Caddy.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: { '/api': { target: process.env.VITE_API_PROXY ?? 'http://localhost:4000', changeOrigin: false, ws: true } },
  },
  build: { sourcemap: false, target: 'es2020' },
});
