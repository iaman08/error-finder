import Groq from 'groq-sdk';
import { env } from '@/config/env.js';
import { logger as rootLogger } from '@/config/logger.js';
import { AppError } from '@/domain/errors.js';
import { withRetry, withTimeout } from '@/shared/utils/async.js';
import { GROQ_GLOBAL_SYSTEM_PROMPT } from '@/infra/llm/system-prompt.js';
import type {
  LLMCompletionRequest,
  LLMCompletionResponse,
  LLMMessage,
  LLMModelTier,
  LLMProvider,
} from '@/infra/llm/llm.types.js';

// ---------------------------------------------------------------------------
// Key pool — rotates through API keys on rate-limit / credit-exhaustion errors
// ---------------------------------------------------------------------------

interface KeySlot {
  key: string;
  client: Groq;
  /** ISO timestamp when this key was last rate-limited. Null = healthy. */
  cooldownUntil: number | null;
}

const COOLDOWN_MS = 60_000; // 1 minute cooldown after a key gets rate-limited

const buildKeyPool = (): KeySlot[] => {
  const allKeys = [env.GROQ_API_KEY, ...env.GROQ_FALLBACK_API_KEYS];
  // Deduplicate (in case the primary is also listed in fallbacks)
  const unique = [...new Set(allKeys)];
  return unique.map((key) => ({
    key,
    client: new Groq({ apiKey: key }),
    cooldownUntil: null,
  }));
};

const keyPool = buildKeyPool();

const log = rootLogger.child({ provider: 'groq' });

log.info(
  { keyCount: keyPool.length, hasFallbacks: keyPool.length > 1 },
  'Groq key pool initialized',
);

/**
 * Returns the next available key slot. Prefers keys that are not in cooldown.
 * If all keys are in cooldown, returns the one whose cooldown expires soonest.
 */
const pickKey = (): KeySlot => {
  const now = Date.now();

  // Clear expired cooldowns
  for (const slot of keyPool) {
    if (slot.cooldownUntil !== null && now >= slot.cooldownUntil) {
      slot.cooldownUntil = null;
    }
  }

  // Prefer healthy keys (not in cooldown)
  const healthy = keyPool.filter((s) => s.cooldownUntil === null);
  if (healthy.length > 0) return healthy[0]!;

  // All keys in cooldown — pick the one that expires soonest
  const sorted = [...keyPool].sort(
    (a, b) => (a.cooldownUntil ?? 0) - (b.cooldownUntil ?? 0),
  );
  return sorted[0]!;
};

/**
 * Mark a key as rate-limited so it's skipped on subsequent calls.
 */
const markKeyLimited = (slot: KeySlot): void => {
  slot.cooldownUntil = Date.now() + COOLDOWN_MS;
  const keyMask = `${slot.key.slice(0, 8)}...${slot.key.slice(-4)}`;
  log.warn(
    { key: keyMask, cooldownMs: COOLDOWN_MS, remainingKeys: keyPool.filter((s) => s.cooldownUntil === null).length },
    'Groq key rate-limited; placed in cooldown',
  );
};

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

const modelForTier = (tier: LLMModelTier | undefined): string => {
  switch (tier) {
    case 'fast':
      return env.LLM_MODEL_FAST;
    case 'reasoning':
    case undefined:
    default:
      return env.LLM_MODEL_REASONING;
  }
};

/**
 * Returns true for errors that should trigger a retry on the SAME key
 * (transient server errors, timeouts). Does NOT include 429 — those
 * trigger key rotation instead.
 */
const isRetryable = (err: unknown): boolean => {
  if (err instanceof Error && 'status' in err) {
    const status = (err as { status?: number }).status;
    if (typeof status === 'number') {
      // 429 is handled by key rotation, not retries on the same key
      if (status === 429) return false;
      if (status === 408 || status === 409 || status === 425) return true;
      if (status >= 500 && status < 600) return true;
      return false;
    }
  }
  // Network/timeout errors lack status; allow retry.
  return true;
};

/**
 * Returns true if the error signals that the API key is exhausted or
 * rate-limited, meaning we should try a different key.
 */
const isKeyExhausted = (err: unknown): boolean => {
  if (err instanceof Error && 'status' in err) {
    const status = (err as { status?: number }).status;
    if (status === 429) return true;
    // Some providers return 402 for billing/credit issues
    if (status === 402) return true;
  }
  // Check error message for credit-related keywords
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    if (
      msg.includes('rate limit') ||
      msg.includes('rate_limit') ||
      msg.includes('quota') ||
      msg.includes('credit') ||
      msg.includes('billing') ||
      msg.includes('insufficient')
    ) {
      return true;
    }
  }
  return false;
};

export const groqProvider: LLMProvider = {
  name: 'groq',
  async complete(req: LLMCompletionRequest): Promise<LLMCompletionResponse> {
    const model = req.model ?? modelForTier(req.tier);
    const callLog = (req.logger ?? rootLogger).child({
      provider: 'groq',
      stage: req.stageTag,
      correlationId: req.correlationId,
      model,
    });

    const start = Date.now();

    const messages: LLMMessage[] = req.skipGlobalSystemPrompt
      ? [...req.messages]
      : [{ role: 'system', content: GROQ_GLOBAL_SYSTEM_PROMPT }, ...req.messages];

    // Try up to keyPool.length different keys on rate-limit / credit errors
    let lastError: unknown;
    const triedKeys = new Set<string>();

    for (let keyAttempt = 0; keyAttempt < keyPool.length; keyAttempt += 1) {
      const slot = pickKey();

      // Skip keys we already tried in this call
      if (triedKeys.has(slot.key)) {
        continue;
      }
      triedKeys.add(slot.key);

      const run = () =>
        withTimeout(
          slot.client.chat.completions.create({
            model,
            messages: messages.map((m) => ({ role: m.role, content: m.content })),
            temperature: req.temperature ?? 0,
            max_tokens: req.maxTokens ?? 2048,
            stop: req.stop,
            ...(req.jsonMode ? { response_format: { type: 'json_object' } } : {}),
          }),
          env.LLM_REQUEST_TIMEOUT_MS,
          `groq.complete[${req.stageTag}]`,
        );

      try {
        const completion = await withRetry(run, {
          retries: env.LLM_MAX_RETRIES,
          baseDelayMs: 300,
          shouldRetry: isRetryable,
          onRetry: (err, attempt) => {
            callLog.warn({ err, attempt }, 'Retrying Groq completion (same key)');
          },
        });

        const choice = completion.choices[0];
        const text = choice?.message?.content ?? '';
        if (!text) {
          throw new AppError('LLM_ERROR', 'Empty completion from Groq', {
            details: { model, finishReason: choice?.finish_reason ?? null },
          });
        }

        const latencyMs = Date.now() - start;
        callLog.debug(
          {
            latencyMs,
            finishReason: choice?.finish_reason ?? null,
            usage: completion.usage,
            keyAttempt: keyAttempt + 1,
          },
          'Groq completion ok',
        );

        return {
          text,
          model,
          finishReason: choice?.finish_reason ?? null,
          ...(completion.usage
            ? {
                usage: {
                  promptTokens: completion.usage.prompt_tokens ?? 0,
                  completionTokens: completion.usage.completion_tokens ?? 0,
                  totalTokens: completion.usage.total_tokens ?? 0,
                },
              }
            : {}),
          latencyMs,
        };
      } catch (err) {
        lastError = err;

        // If it's a key-exhaustion error and we have more keys, rotate
        if (isKeyExhausted(err) && keyAttempt < keyPool.length - 1) {
          markKeyLimited(slot);
          callLog.warn(
            { keyAttempt: keyAttempt + 1, remainingKeys: keyPool.length - triedKeys.size },
            'Key exhausted; rotating to fallback key',
          );
          continue;
        }

        // Not a key issue, or no more keys — throw
        if (err instanceof AppError) throw err;
        callLog.error({ err, keyAttempt: keyAttempt + 1 }, 'Groq completion failed');
        throw new AppError('LLM_ERROR', 'Failed to obtain completion from Groq', { cause: err });
      }
    }

    // Should only reach here if all keys were tried and exhausted
    throw new AppError('LLM_ERROR', 'All Groq API keys exhausted (rate-limited or credit depleted)', {
      cause: lastError,
    });
  },
};
