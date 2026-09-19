/**
 * PM2 process file for the Chikbo API (which also serves the storefront and
 * admin on a single-server setup).
 *
 *   pm2 start deploy/ecosystem.config.cjs
 *   pm2 save && pm2 startup        # restart automatically after a reboot
 *
 * Environment comes from apps/api/.env (see deploy/env.production.example).
 */
module.exports = {
  apps: [
    {
      name: 'chikbo',
      cwd: '/var/www/chikbo/apps/api',
      script: 'dist/server.js',
      instances: 1, // the stale-order reaper runs in-process; keep a single instance
      exec_mode: 'fork',
      env: { NODE_ENV: 'production' },
      max_memory_restart: '600M',
      time: true,
    },
  ],
};
