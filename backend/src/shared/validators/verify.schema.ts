import { z } from 'zod';
import { DOMAINS, RETRIEVAL_MODES } from '@/domain/enums.js';

export const verifyRequestSchema = z.object({
  userInput: z.string().min(1, 'userInput is required').max(20_000),
  modelOutput: z.string().min(1, 'modelOutput is required').max(30_000),
  mode: z.enum(RETRIEVAL_MODES).default('standard'),
  domainOverride: z.enum(DOMAINS).optional(),
});

export type VerifyRequestDto = z.infer<typeof verifyRequestSchema>;
