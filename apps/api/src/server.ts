import { createApp } from './app';
import { env } from './config/env';
import { logger } from './lib/logger';
import { prisma } from './lib/prisma';
import { releaseStalePendingOrders } from './modules/checkout/checkout.service';

const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info(`Chikbo API listening on http://localhost:${env.PORT}`);
});

// Reap unpaid PENDING orders (abandoned checkouts) and restore their stock.
const reaper = setInterval(() => {
  releaseStalePendingOrders().then((n) => {
    if (n > 0) logger.info({ released: n }, 'Released stale pending orders');
  }).catch((err) => logger.error({ err }, 'Stale order reaper failed'));
}, 10 * 60_000);
reaper.unref();

async function shutdown(signal: string) {
  logger.info({ signal }, 'Shutting down');
  clearInterval(reaper);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
