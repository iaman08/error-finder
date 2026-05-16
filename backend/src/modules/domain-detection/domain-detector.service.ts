import { z } from 'zod';
import { logger as rootLogger } from '@/config/logger.js';
import { DOMAINS, type Domain } from '@/domain/enums.js';
import { AppError } from '@/domain/errors.js';
import { llmClient } from '@/infra/llm/llm.client.js';
import { parseJsonFromLLM } from '@/shared/utils/json.js';

const responseSchema = z.object({
  domain: z.enum(DOMAINS),
  confidence: z.number().min(0).max(1),
  // LLM JSON mode emits null for absent optional fields; accept and normalize.
  rationale: z
    .string()
    .max(500)
    .nullish()
    .transform((v): string | undefined => (v == null || v === '' ? undefined : v)),
});

const SYSTEM_PROMPT = `You are a domain classifier for a fact-verification system.
Choose exactly one domain that best fits the user's question and the model's response.

Allowed domains:
- finance: markets, banking, monetary policy, accounting, taxes, investments
- medical: health, biology, pharmacology, clinical advice, public health
- legal: laws, statutes, court rulings, regulations, compliance
- tech: software, hardware, security, standards, computer science
- news: current events with strong time sensitivity (within ~30 days)
- general: anything else (history, education, sports, lifestyle, geography, ...)

Reply ONLY with a JSON object: {"domain": "...", "confidence": 0.0-1.0, "rationale": "..."}.
No prose outside JSON.`;

export interface DomainDetectionResult {
  domain: Domain;
  confidence: number;
  rationale?: string;
}

export interface DomainDetectionInput {
  userInput: string;
  modelOutput: string;
  correlationId: string;
  override?: Domain;
}

export const detectDomain = async (input: DomainDetectionInput): Promise<DomainDetectionResult> => {
  if (input.override) {
    return { domain: input.override, confidence: 1, rationale: 'manual override' };
  }

  const log = rootLogger.child({ module: 'domain-detection', correlationId: input.correlationId });

  const completion = await llmClient.complete({
    stageTag: 'domain_detection',
    correlationId: input.correlationId,
    tier: 'fast',
    temperature: 0,
    maxTokens: 200,
    jsonMode: true,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: buildUserPrompt(input.userInput, input.modelOutput),
      },
    ],
  });

  const json = parseJsonFromLLM(completion.text);
  const parsed = responseSchema.safeParse(json);
  if (!parsed.success) {
    log.warn({ issues: parsed.error.issues }, 'Domain detector returned invalid schema');
    throw new AppError('LLM_RESPONSE_INVALID', 'Domain detector returned invalid schema', {
      details: { issues: parsed.error.issues },
    });
  }

  log.debug({ ...parsed.data, latencyMs: completion.latencyMs }, 'Detected domain');

  const result: DomainDetectionResult = {
    domain: parsed.data.domain,
    confidence: parsed.data.confidence,
  };
  if (parsed.data.rationale !== undefined) {
    result.rationale = parsed.data.rationale;
  }
  return result;
};

const buildUserPrompt = (userInput: string, modelOutput: string): string =>
  [
    'User question:',
    safeBlock(userInput),
    '',
    'Model response:',
    safeBlock(modelOutput),
    '',
    'Classify the domain. Return JSON only.',
  ].join('\n');

/**
 * Wraps external content in fences so the classifier reads it as data, not instructions —
 * a minimal mitigation against prompt-injection embedded in user/model text.
 */
const safeBlock = (text: string): string => `<<<CONTENT\n${text}\nCONTENT>>>`;
