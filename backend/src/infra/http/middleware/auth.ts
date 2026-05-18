import type { NextFunction, Request, Response } from 'express';
import { AppError } from '@/domain/errors.js';
import { verifyAuthToken, type AuthTokenPayload } from '@/modules/auth/auth.service.js';

declare module 'express-serve-static-core' {
  interface Request {
    auth?: AuthTokenPayload;
  }
}

const extractBearer = (header: string | undefined): string | null => {
  if (!header) return null;
  const trimmed = header.trim();
  if (!trimmed.toLowerCase().startsWith('bearer ')) return null;
  const token = trimmed.slice(7).trim();
  return token.length > 0 ? token : null;
};

export const requireAuth = (req: Request, _res: Response, next: NextFunction): void => {
  try {
    const token = extractBearer(req.header('authorization'));
    if (!token) {
      throw new AppError('UNAUTHORIZED', 'Missing or malformed Authorization header');
    }
    req.auth = verifyAuthToken(token);
    next();
  } catch (err) {
    next(err);
  }
};
