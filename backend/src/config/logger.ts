import { pino } from 'pino';
import { env, isDevelopment } from '@/config/env.js';

export const logger = pino({
  level: env.LOG_LEVEL,
  base: { service: 'errorfinder' },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      '*.GROQ_API_KEY',
      '*.TAVILY_API_KEY',
      '*.apiKey',
      '*.api_key',
    ],
    censor: '[REDACTED]',
  },
  ...(isDevelopment
    ? {
        transport: {
          target: 'pino/file',
          options: { destination: 1, sync: false },
        },
      }
    : {}),
});

export type Logger = typeof logger;
