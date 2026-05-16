import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { logger } from '@/config/logger.js';
import { errorHandler, notFoundHandler } from '@/infra/http/middleware/error-handler.js';
import { requestIdMiddleware } from '@/infra/http/middleware/request-id.js';
import { healthRouter } from '@/infra/http/routes/health.route.js';
import { verifyRouter } from '@/infra/http/routes/verify.route.js';

export const createApp = (): Express => {
  const app = express();

  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({ origin: true, credentials: false }));
  app.use(express.json({ limit: '256kb' }));
  app.use(requestIdMiddleware);
  app.use(
    pinoHttp({
      logger,
      customProps: (req) => ({ correlationId: (req as { correlationId?: string }).correlationId }),
      autoLogging: { ignore: (req) => req.url === '/healthz' || req.url === '/readyz' },
      customLogLevel: (_req, res, err) => {
        if (err || res.statusCode >= 500) return 'error';
        if (res.statusCode >= 400) return 'warn';
        return 'info';
      },
      serializers: {
        req: (req) => ({ method: req.method, url: req.url }),
        res: (res) => ({ statusCode: res.statusCode }),
      },
    }),
  );

  app.use('/', healthRouter);
  app.use('/v1', verifyRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};
