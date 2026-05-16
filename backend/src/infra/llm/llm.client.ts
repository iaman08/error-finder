import { groqProvider } from '@/infra/llm/groq.provider.js';
import type { LLMProvider } from '@/infra/llm/llm.types.js';

/**
 * Single point of LLM access for the rest of the codebase.
 * Today this resolves to Groq; future providers slot in here.
 */
export const llmClient: LLMProvider = groqProvider;
