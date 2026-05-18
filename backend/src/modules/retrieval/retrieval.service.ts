import { env } from '@/config/env.js';
import { logger as rootLogger } from '@/config/logger.js';
import type { Domain, EvidenceStance, RetrievalMode } from '@/domain/enums.js';
import type { Evidence } from '@/domain/types.js';
import { buildSourcePolicy, isTrustedHost } from '@/modules/retrieval/source-policy.js';
import { searchTavily } from '@/modules/retrieval/tavily.client.js';

export interface RetrievalRequest {
  query: string;
  mode: RetrievalMode;
  domain: Domain;
  correlationId: string;
  maxResultsOverride?: number;
}

export interface RetrievalOutcome {
  evidence: Evidence[];
  queryUsed: string;
  rawCount: number;
  trustedCount: number;
}

/**
 * Tracks Tavily call usage across a single /verify run. The orchestrator
 * constructs one budget per run and routes every retrieval through it so
 * the total external-search cost cannot exceed the configured cap.
 */
export class RetrievalBudget {
  private used = 0;
  constructor(public readonly max: number) {}
  get remaining(): number {
    return Math.max(0, this.max - this.used);
  }
  get callsUsed(): number {
    return this.used;
  }
  /** Returns null when the budget is exhausted; callers must treat that as "no evidence". */
  async retrieve(req: RetrievalRequest): Promise<RetrievalOutcome | null> {
    if (this.remaining <= 0) return null;
    this.used += 1;
    return retrieveEvidence(req);
  }
}

/**
 * Performs a single Tavily search and shapes the response into Evidence[].
 * Most callers should go through RetrievalBudget — direct use bypasses the cap.
 */
export const retrieveEvidence = async (req: RetrievalRequest): Promise<RetrievalOutcome> => {
  const log = rootLogger.child({
    module: 'retrieval',
    correlationId: req.correlationId,
    mode: req.mode,
    domain: req.domain,
  });

  const policy = buildSourcePolicy(req.mode, req.domain, {
    standard: env.RETRIEVAL_RESULTS_STANDARD,
    professional: env.RETRIEVAL_RESULTS_PROFESSIONAL,
  });

  const maxResults = req.maxResultsOverride ?? policy.maxResults;

  const response = await searchTavily({
    query: req.query,
    searchDepth: req.mode === 'professional' ? 'advanced' : 'basic',
    maxResults,
    ...(policy.includeDomains.length > 0 ? { includeDomains: policy.includeDomains } : {}),
    ...(policy.excludeDomains.length > 0 ? { excludeDomains: policy.excludeDomains } : {}),
    preferRecent: policy.preferRecent,
  });

  const retrievedAt = new Date().toISOString();

  const neutralStance: EvidenceStance = 'neutral';
  const evidence: Evidence[] = response.results
    .filter((r) => r.url && r.content)
    .map((r): Evidence => ({
      source: hostOf(r.url),
      url: r.url,
      title: r.title || undefined,
      snippet: truncate(r.content, 1_200),
      relevanceScore: clamp01(r.score),
      stance: neutralStance,
      publishedAt: r.published_date,
      retrievedAt,
      trusted: isTrustedHost(r.url, policy),
    }))
    // Professional mode: hard-drop untrusted hosts. Standard: just deprioritise via trust flag.
    .filter((e) => (req.mode === 'professional' ? e.trusted : true))
    .sort((a, b) => (b.trusted === a.trusted ? b.relevanceScore - a.relevanceScore : Number(b.trusted) - Number(a.trusted)));

  log.debug(
    { rawCount: response.results.length, kept: evidence.length, query: req.query },
    'Retrieval complete',
  );

  return {
    evidence,
    queryUsed: req.query,
    rawCount: response.results.length,
    trustedCount: evidence.filter((e) => e.trusted).length,
  };
};

export const dedupeEvidenceByUrl = (items: Evidence[]): Evidence[] => {
  const seen = new Set<string>();
  const out: Evidence[] = [];
  for (const e of items) {
    if (seen.has(e.url)) continue;
    seen.add(e.url);
    out.push(e);
  }
  return out;
};

const hostOf = (url: string): string => {
  try {
    return new URL(url).hostname;
  } catch {
    return 'unknown';
  }
};

const truncate = (s: string, n: number): string => (s.length <= n ? s : `${s.slice(0, n)}…`);

const clamp01 = (n: number): number => Math.max(0, Math.min(1, n));
