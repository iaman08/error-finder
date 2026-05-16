import type { ErrorRequestHandler, NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { logger } from '@/config/logger.js';
import { AppError, isAppError } from '@/domain/errors.js';
import { isProduction } from '@/config/env.js';

export const notFoundHandler = (req: Request, res: Response, _next: NextFunction): void => {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.originalUrl} not found`,
      correlationId: req.correlationId,
    },
  });
};

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  const correlationId = req.correlationId;

  if (err instanceof ZodError) {
    logger.warn({ err, correlationId }, 'Validation error');
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request payload',
        issues: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
        correlationId,
      },
    });
    return;
  }

  if (isAppError(err)) {
    const level = err.statusCode >= 500 ? 'error' : 'warn';
    logger[level](
      { err, code: err.code, details: err.details, correlationId },
      'Request failed with AppError',
    );
    res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        ...(err.details && !isProduction ? { details: err.details } : {}),
        correlationId,
      },
    });
    return;
  }

  // Unknown error: log full, return generic.
  logger.error({ err, correlationId }, 'Unhandled error');
  const fallback = new AppError('INTERNAL_ERROR', 'Internal server error');
  res.status(fallback.statusCode).json({
    error: {
      code: fallback.code,
      message: fallback.message,
      correlationId,
    },
  });
};
