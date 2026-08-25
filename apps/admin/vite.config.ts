import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Dev server. PORT (when the harness assigns one) wins over the 5174 default,
 * and VITE_PROXY_TARGET points the API proxy at a non-default API port.
 * All API calls go through this proxy in dev, so they are same-origin and the
 * admin is not tied to any particular port.
 */
const apiTarget = process.env.VITE_PROXY_TARGET ?? 'http://localhost:4000';

export default defineConfig({
  plugins: [react()],
  server: {
    port: Number(process.env.PORT) || 5174,
    proxy: {
      '/api': { target: apiTarget, changeOrigin: true },
      '/uploads': { target: apiTarget, changeOrigin: true },
    },
  },
});
