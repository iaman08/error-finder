import { connectDatabase, disconnectDatabase } from '@/config/db.js';
import { env } from '@/config/env.js';
import { logger } from '@/config/logger.js';
import { createApp } from '@/infra/http/server.js';

const start = async (): Promise<void> => {
  await connectDatabase();
  const app = createApp();

  const server = app.listen(env.PORT, () => {
    logger.info({ port: env.PORT, env: env.NODE_ENV }, 'Server listening');
  });

  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ signal }, 'Received shutdown signal');
    server.close((err) => {
      if (err) logger.error({ err }, 'Error closing HTTP server');
    });
    try {
      await disconnectDatabase();
    } catch (err) {
      logger.error({ err }, 'Error disconnecting DB');
    }
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('uncaughtException', (err) => {
    logger.fatal({ err }, 'Uncaught exception');
    process.exit(1);
  });
  process.on('unhandledRejection', (reason) => {
    logger.fatal({ reason }, 'Unhandled rejection');
    process.exit(1);
  });
};

start().catch((err) => {
  logger.fatal({ err }, 'Failed to start server');
  process.exit(1);
});
