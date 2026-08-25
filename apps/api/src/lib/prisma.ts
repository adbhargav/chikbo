import { Prisma, PrismaClient } from '@prisma/client';
import { isProd } from '../config/env';

export const prisma = new PrismaClient({
  log: isProd ? ['warn', 'error'] : ['warn', 'error'],
});

/** Client usable both directly and inside prisma.$transaction callbacks. */
export type Tx = Prisma.TransactionClient;
