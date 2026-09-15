import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * The admin console lives under its own URL prefix, /admin, so it never
 * collides with storefront routes (the storefront has /login; the admin's
 * sign-in is /admin/login) and can sit behind the storefront domain via a
 * rewrite or on its own host — either way the paths are the same.
 *
 * Dev server: PORT (when the harness assigns one) wins over the 5174 default,
 * and VITE_PROXY_TARGET points the API proxy at a non-default API port.
 * All API calls go through this proxy in dev, so they are same-origin and the
 * admin is not tied to any particular port.
 */
export const ADMIN_BASE = '/admin/';

const apiTarget = process.env.VITE_PROXY_TARGET ?? 'http://localhost:4000';

/** In dev, send the bare origin to /admin/ instead of Vite's "did you mean" page. */
const redirectRootToAdmin = (): Plugin => ({
  name: 'chikbo-redirect-root-to-admin',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      if (req.url === '/' || req.url === '/admin') {
        res.statusCode = 302;
        res.setHeader('Location', ADMIN_BASE);
        res.end();
        return;
      }
      next();
    });
  },
});

export default defineConfig({
  base: ADMIN_BASE,
  plugins: [react(), redirectRootToAdmin()],
  build: {
    // Emit into dist/admin so the built files are served at /admin/... as-is.
    outDir: 'dist/admin',
    emptyOutDir: true,
  },
  server: {
    port: Number(process.env.PORT) || 5174,
    proxy: {
      '/api': { target: apiTarget, changeOrigin: true },
      '/uploads': { target: apiTarget, changeOrigin: true },
    },
  },
});
