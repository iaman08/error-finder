import type { NextFunction, Request, Response } from 'express';
import { newCorrelationId } from '@/shared/utils/correlation.js';

const HEADER = 'x-correlation-id';

declare module 'express-serve-static-core' {
  interface Request {
    correlationId: string;
  }
}

export const requestIdMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const inbound = req.header(HEADER);
  const id = inbound && inbound.length > 0 && inbound.length <= 100 ? inbound : newCorrelationId();
  req.correlationId = id;
  res.setHeader(HEADER, id);
  next();
};
