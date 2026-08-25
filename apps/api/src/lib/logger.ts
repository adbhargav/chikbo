import pino from 'pino';
import { env, isProd } from '../config/env';

export const logger = pino({
  level: env.NODE_ENV === 'test' ? 'silent' : isProd ? 'info' : 'debug',
  transport: isProd ? undefined : { target: 'pino-pretty', options: { colorize: true } },
  redact: {
    paths: ['req.headers.authorization', 'req.headers.cookie', '*.password', '*.passwordHash', '*.token'],
    censor: '[redacted]',
  },
});
