import 'dotenv/config';
import { z } from 'zod';

const intString = (defaultValue: number) =>
  z
    .string()
    .optional()
    .transform((v) => (v === undefined || v === '' ? defaultValue : Number(v)))
    .pipe(z.number().int().positive());

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: intString(4000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),

  GROQ_API_KEY: z.string().min(1, 'GROQ_API_KEY is required'),
  LLM_MODEL_REASONING: z.string().default('llama-3.3-70b-versatile'),
  LLM_MODEL_FAST: z.string().default('llama-3.1-8b-instant'),
  LLM_REQUEST_TIMEOUT_MS: intString(45_000),
  LLM_MAX_RETRIES: intString(2),

  TAVILY_API_KEY: z.string().min(1, 'TAVILY_API_KEY is required'),
  TAVILY_REQUEST_TIMEOUT_MS: intString(20_000),

  MAX_VERIFICATION_ITERATIONS: intString(2),
  MAX_CLAIMS_PER_RUN: intString(30),
  MAX_EVIDENCE_PER_VERIFICATION: intString(12),
  RETRIEVAL_RESULTS_STANDARD: intString(8),
  RETRIEVAL_RESULTS_PROFESSIONAL: intString(10),
  CLAIM_CONCURRENCY: intString(4),

  /** ISO date (YYYY-MM-DD). Empty/missing falls back to the system clock at run time. */
  TODAY_DATE_OVERRIDE: z
    .string()
    .optional()
    .transform((v) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null))
    .pipe(z.union([z.string(), z.null()])),
});

export type AppEnv = z.infer<typeof envSchema>;

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
    .join('\n');
  // eslint-disable-next-line no-console
  console.error(`Invalid environment configuration:\n${issues}`);
  process.exit(1);
}

export const env: AppEnv = parsed.data;

export const isProduction = env.NODE_ENV === 'production';
export const isDevelopment = env.NODE_ENV === 'development';
export const isTest = env.NODE_ENV === 'test';
