import { Router, type NextFunction, type Request, type Response } from 'express';
import { AppError } from '@/domain/errors.js';
import { requireAuth } from '@/infra/http/middleware/auth.js';
import { findUserById, loginUser, registerUser } from '@/modules/auth/auth.service.js';
import {
  loginRequestSchema,
  registerRequestSchema,
} from '@/shared/validators/auth.schema.js';

export const authRouter = Router();

authRouter.post('/register', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const dto = registerRequestSchema.parse(req.body);
    const result = await registerUser(dto);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

authRouter.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const dto = loginRequestSchema.parse(req.body);
    const result = await loginUser(dto);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

authRouter.get('/me', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.auth) throw new AppError('UNAUTHORIZED', 'Not authenticated');
    const user = await findUserById(req.auth.sub);
    if (!user) throw new AppError('UNAUTHORIZED', 'User no longer exists');
    res.status(200).json({ user });
  } catch (err) {
    next(err);
  }
});
