import { z } from 'zod';

export const registerRequestSchema = z.object({
  email: z.string().email('A valid email is required').max(254),
  name: z.string().trim().min(1, 'Name is required').max(80),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(200, 'Password is too long'),
});

export const loginRequestSchema = z.object({
  email: z.string().email('A valid email is required').max(254),
  password: z.string().min(1, 'Password is required').max(200),
});

export type RegisterRequest = z.infer<typeof registerRequestSchema>;
export type LoginRequest = z.infer<typeof loginRequestSchema>;
