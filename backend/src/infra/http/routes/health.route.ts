import { Router } from 'express';
import mongoose from 'mongoose';

export const healthRouter = Router();

healthRouter.get('/healthz', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

healthRouter.get('/readyz', (_req, res) => {
  const dbReady = mongoose.connection.readyState === 1;
  res.status(dbReady ? 200 : 503).json({
    status: dbReady ? 'ready' : 'not_ready',
    db: dbReady ? 'connected' : 'disconnected',
  });
});
