import bcrypt from 'bcryptjs';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from '@/config/env.js';
import { AppError } from '@/domain/errors.js';
import { UserModel, type UserDoc } from '@/persistence/models/user.model.js';

const BCRYPT_ROUNDS = 10;

export interface AuthTokenPayload {
  sub: string;
  email: string;
  name: string;
}

export interface AuthResult {
  token: string;
  user: { id: string; email: string; name: string };
}

const toAuthUser = (doc: UserDoc): AuthResult['user'] => ({
  id: String(doc._id),
  email: doc.email,
  name: doc.name,
});

const signToken = (user: UserDoc): string => {
  const payload: AuthTokenPayload = {
    sub: String(user._id),
    email: user.email,
    name: user.name,
  };
  const options: SignOptions = { expiresIn: env.JWT_EXPIRES_IN as SignOptions['expiresIn'] };
  return jwt.sign(payload, env.JWT_SECRET, options);
};

export const registerUser = async (input: {
  email: string;
  name: string;
  password: string;
}): Promise<AuthResult> => {
  const email = input.email.trim().toLowerCase();
  const existing = await UserModel.findOne({ email }).lean();
  if (existing) {
    throw new AppError('CONFLICT', 'An account with this email already exists');
  }
  const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
  const created = await UserModel.create({ email, name: input.name.trim(), passwordHash });
  return { token: signToken(created), user: toAuthUser(created) };
};

export const loginUser = async (input: {
  email: string;
  password: string;
}): Promise<AuthResult> => {
  const email = input.email.trim().toLowerCase();
  const user = await UserModel.findOne({ email });
  if (!user) {
    throw new AppError('UNAUTHORIZED', 'Invalid email or password');
  }
  const ok = await bcrypt.compare(input.password, user.passwordHash);
  if (!ok) {
    throw new AppError('UNAUTHORIZED', 'Invalid email or password');
  }
  return { token: signToken(user), user: toAuthUser(user) };
};

export const verifyAuthToken = (token: string): AuthTokenPayload => {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET);
    if (
      typeof decoded === 'object' &&
      decoded !== null &&
      typeof (decoded as AuthTokenPayload).sub === 'string' &&
      typeof (decoded as AuthTokenPayload).email === 'string' &&
      typeof (decoded as AuthTokenPayload).name === 'string'
    ) {
      const d = decoded as AuthTokenPayload;
      return { sub: d.sub, email: d.email, name: d.name };
    }
    throw new AppError('UNAUTHORIZED', 'Malformed token');
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError('UNAUTHORIZED', 'Invalid or expired token');
  }
};

export const findUserById = async (id: string): Promise<AuthResult['user'] | null> => {
  const user = await UserModel.findById(id).lean();
  return user ? { id: String(user._id), email: user.email, name: user.name } : null;
};
