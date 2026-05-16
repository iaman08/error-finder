import type { Logger } from 'pino';

export type LLMMessageRole = 'system' | 'user' | 'assistant';

export interface LLMMessage {
  role: LLMMessageRole;
  content: string;
}

export type LLMModelTier = 'reasoning' | 'fast';

export interface LLMCompletionRequest {
  messages: LLMMessage[];
  tier?: LLMModelTier;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
  stop?: string[];
  /** Pipeline stage tag used purely for logs/metrics. */
  stageTag: string;
  /** Correlation id propagated through logs for traceability. */
  correlationId: string;
  /** Optional per-call logger; falls back to provider's logger. */
  logger?: Logger;
}

export interface LLMUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface LLMCompletionResponse {
  text: string;
  model: string;
  finishReason: string | null;
  usage?: LLMUsage;
  latencyMs: number;
}

export interface LLMProvider {
  readonly name: string;
  complete(req: LLMCompletionRequest): Promise<LLMCompletionResponse>;
}
