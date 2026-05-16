import { z } from 'zod';
import { env } from '@/config/env.js';
import { AppError } from '@/domain/errors.js';
import { withRetry, withTimeout } from '@/shared/utils/async.js';

const TAVILY_ENDPOINT = 'https://api.tavily.com/search';

export interface TavilySearchParams {
  query: string;
  searchDepth: 'basic' | 'advanced';
  maxResults: number;
  includeDomains?: string[];
  excludeDomains?: string[];
  includeAnswer?: boolean;
  preferRecent?: boolean;
}

// Tavily returns null (not undefined) for absent fields. Use .nullish() so the
// parser accepts both null and missing keys, then normalize to defaults.
const tavilyResultSchema = z.object({
  title: z.string().nullish().transform((v) => v ?? ''),
  url: z.string(),
  content: z.string().nullish().transform((v) => v ?? ''),
  score: z.number().nullish().transform((v) => v ?? 0),
  published_date: z
    .string()
    .nullish()
    .transform((v): string | undefined => (v == null ? undefined : v)),
});

const tavilyResponseSchema = z.object({
  query: z.string().nullish(),
  answer: z.string().nullish(),
  results: z.array(tavilyResultSchema).nullish().transform((v) => v ?? []),
});

export type TavilyResult = z.infer<typeof tavilyResultSchema>;
export type TavilyResponse = z.infer<typeof tavilyResponseSchema>;

const isRetryableStatus = (status: number): boolean =>
  status === 408 || status === 425 || status === 429 || (status >= 500 && status < 600);

export const searchTavily = async (params: TavilySearchParams): Promise<TavilyResponse> => {
  const body: Record<string, unknown> = {
    api_key: env.TAVILY_API_KEY,
    query: params.query,
    search_depth: params.searchDepth,
    max_results: params.maxResults,
    include_answer: params.includeAnswer ?? false,
    include_images: false,
    include_raw_content: false,
  };

  if (params.includeDomains && params.includeDomains.length > 0) {
    body.include_domains = params.includeDomains;
  }
  if (params.excludeDomains && params.excludeDomains.length > 0) {
    body.exclude_domains = params.excludeDomains;
  }
  if (params.preferRecent) {
    body.topic = 'news';
    body.days = 90;
  }

  const run = async (): Promise<TavilyResponse> => {
    const response = await withTimeout(
      fetch(TAVILY_ENDPOINT, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      }),
      env.TAVILY_REQUEST_TIMEOUT_MS,
      'tavily.search',
    );

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      const error = new AppError(
        'RETRIEVAL_ERROR',
        `Tavily search failed with status ${response.status}`,
        { details: { status: response.status, bodyPreview: text.slice(0, 300) } },
      );
      // Attach status for retry logic
      (error as AppError & { status: number }).status = response.status;
      throw error;
    }

    const json = (await response.json()) as unknown;
    const parsed = tavilyResponseSchema.safeParse(json);
    if (!parsed.success) {
      throw new AppError('RETRIEVAL_ERROR', 'Unexpected Tavily response shape', {
        details: { issues: parsed.error.issues.slice(0, 5) },
      });
    }
    return parsed.data;
  };

  return withRetry(run, {
    retries: 2,
    baseDelayMs: 400,
    shouldRetry: (err) => {
      const status = (err as { status?: number }).status;
      if (typeof status === 'number') return isRetryableStatus(status);
      return true;
    },
  });
};
