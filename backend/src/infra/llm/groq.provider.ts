import Groq from 'groq-sdk';
import { env } from '@/config/env.js';
import { logger as rootLogger } from '@/config/logger.js';
import { AppError } from '@/domain/errors.js';
import { withRetry, withTimeout } from '@/shared/utils/async.js';
import type {
  LLMCompletionRequest,
  LLMCompletionResponse,
  LLMModelTier,
  LLMProvider,
} from '@/infra/llm/llm.types.js';

const client = new Groq({ apiKey: env.GROQ_API_KEY });

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

const isRetryable = (err: unknown): boolean => {
  if (err instanceof Error && 'status' in err) {
    const status = (err as { status?: number }).status;
    if (typeof status === 'number') {
      if (status === 408 || status === 409 || status === 425 || status === 429) return true;
      if (status >= 500 && status < 600) return true;
      return false;
    }
  }
  // Network/timeout errors lack status; allow retry.
  return true;
};

export const groqProvider: LLMProvider = {
  name: 'groq',
  async complete(req: LLMCompletionRequest): Promise<LLMCompletionResponse> {
    const model = req.model ?? modelForTier(req.tier);
    const log = (req.logger ?? rootLogger).child({
      provider: 'groq',
      stage: req.stageTag,
      correlationId: req.correlationId,
      model,
    });

    const start = Date.now();

    const run = () =>
      withTimeout(
        client.chat.completions.create({
          model,
          messages: req.messages.map((m) => ({ role: m.role, content: m.content })),
          temperature: req.temperature ?? 0.1,
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
          log.warn({ err, attempt }, 'Retrying Groq completion');
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
      log.debug(
        {
          latencyMs,
          finishReason: choice?.finish_reason ?? null,
          usage: completion.usage,
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
      if (err instanceof AppError) throw err;
      log.error({ err }, 'Groq completion failed');
      throw new AppError('LLM_ERROR', 'Failed to obtain completion from Groq', { cause: err });
    }
  },
};
