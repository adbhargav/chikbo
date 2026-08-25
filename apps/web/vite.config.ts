import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    // 5173 by default; PORT lets a launcher place it elsewhere when taken.
    port: Number(process.env.PORT) || 5173,
    proxy: {
      '/api': { target: process.env.VITE_PROXY_TARGET ?? 'http://localhost:4000', changeOrigin: true },
      '/uploads': { target: process.env.VITE_PROXY_TARGET ?? 'http://localhost:4000', changeOrigin: true },
    },
  },
});
