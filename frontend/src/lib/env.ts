import { z } from 'zod';

const clientEnvSchema = z.object({
  NEXT_PUBLIC_BACKEND_URL: z
    .string()
    .url('NEXT_PUBLIC_BACKEND_URL must be a valid URL')
    .default('http://localhost:4000'),
});

const parsed = clientEnvSchema.safeParse({
  NEXT_PUBLIC_BACKEND_URL: process.env.NEXT_PUBLIC_BACKEND_URL,
});

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((i) => `${i.path.join('.')}: ${i.message}`)
    .join('; ');
  throw new Error(`Invalid client env: ${issues}`);
}

export const env = parsed.data;
