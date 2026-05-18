import { env } from '@/config/env.js';
import { logger as rootLogger } from '@/config/logger.js';
import type { Domain, PipelineStage, VerdictStatus } from '@/domain/enums.js';
import { AppError } from '@/domain/errors.js';
import type {
  AtomicClaim,
  ClaimVerdict,
  Evidence,
  InjectionSignal,
  PipelineTimings,
  VerificationInput,
  VerificationResult,
} from '@/domain/types.js';
import { runCompliance } from '@/modules/compliance/compliance.service.js';
import { decomposeClaims } from '@/modules/claim-decomposition/decomposer.service.js';
import { detectDomain } from '@/modules/domain-detection/domain-detector.service.js';
import {
  RetrievalBudget,
  dedupeEvidenceByUrl,
} from '@/modules/retrieval/retrieval.service.js';
import { verifyClaim, type VerifyClaimOutput } from '@/modules/verification/verifier.service.js';
import { mapConcurrent } from '@/shared/utils/async.js';
import { newCorrelationId } from '@/shared/utils/correlation.js';
import { scanForInjection } from '@/shared/utils/injection.js';
import { normalizeText } from '@/shared/utils/text.js';

export interface RunPipelineOptions {
  correlationId?: string;
}

export const runVerificationPipeline = async (
  input: VerificationInput,
  options: RunPipelineOptions = {},
): Promise<VerificationResult> => {
  const correlationId = options.correlationId ?? newCorrelationId();
  const log = rootLogger.child({ module: 'pipeline', correlationId });
  const timings: PipelineTimings = { totalMs: 0, perStage: {} };
  const stageTimer = makeStageTimer(timings);
  const startedAt = Date.now();
  const warnings: string[] = [];

  log.info({ mode: input.mode, hasOverride: Boolean(input.domainOverride) }, 'Pipeline start');

  // Defensive pre-scan: regex tripwires across both inputs. Cheap, deterministic.
  const userScan = scanForInjection(input.userInput);
  const outputScan = scanForInjection(input.modelOutput);
  const preScanMatches = Array.from(new Set([...userScan.matchedIds, ...outputScan.matchedIds]));
  if (preScanMatches.length > 0) {
    warnings.push(
      `Prompt-injection tripwires fired in input: [${preScanMatches.join(', ')}]. Verifier instructed to ignore embedded directives.`,
    );
    log.warn({ preScanMatches }, 'Prompt-injection pre-scan flagged content');
  }

  const detection = await stageTimer('domain_detection', () =>
    detectDomain({
      userInput: input.userInput,
      modelOutput: input.modelOutput,
      correlationId,
      ...(input.domainOverride ? { override: input.domainOverride } : {}),
    }),
  );

  // Decomposition and compliance run in parallel — they're independent.
  // No "initial pool" retrieval: per-claim retrieval inside the verifier is far more targeted.
  const [decomposeResult, compliance] = await Promise.all([
    stageTimer('claim_decomposition', () =>
      decomposeClaims({
        userInput: input.userInput,
        modelOutput: input.modelOutput,
        correlationId,
      }),
    ),
    stageTimer('compliance', () =>
      runCompliance({
        userInput: input.userInput,
        modelOutput: input.modelOutput,
        correlationId,
      }),
    ),
  ]);

  const { claims } = decomposeResult;
  warnings.push(...decomposeResult.warnings);

  if (claims.length === 0) {
    log.warn('No claims produced; returning empty verdict set');
    timings.totalMs = Date.now() - startedAt;
    return {
      correlationId,
      detectedDomain: detection.domain,
      mode: input.mode,
      claims: [],
      verdicts: [],
      compliance,
      overallStatus: 'INCONCLUSIVE',
      timings,
      warnings,
      injection: {
        suspected: preScanMatches.length > 0,
        preScanMatches,
        llmSelfReports: 0,
      },
    };
  }

  // Shared retrieval pool: at most RETRIEVAL_MAX_CALLS_PER_RUN Tavily calls across
  // the entire run. Initial round seeds the pool from claim text; refinement only
  // fires for claims that came back INCONCLUSIVE and only while budget remains.
  const budget = new RetrievalBudget(env.RETRIEVAL_MAX_CALLS_PER_RUN);
  const checkableClaims = claims.filter((c) => c.isCheckable);

  let evidencePool: Evidence[] = [];
  if (checkableClaims.length > 0) {
    const seedQuery = buildSeedQuery(checkableClaims);
    const seedOutcome = await budget.retrieve({
      query: seedQuery,
      mode: input.mode,
      domain: detection.domain,
      correlationId,
    });
    evidencePool = seedOutcome?.evidence ?? [];
    log.info(
      {
        seedQuery,
        evidenceCount: evidencePool.length,
        budgetUsed: budget.callsUsed,
        budgetRemaining: budget.remaining,
      },
      'Initial retrieval complete',
    );
  }

  const round1Outputs = await stageTimer('claim_verification', async () =>
    runRound(claims, evidencePool, 1, detection.domain, correlationId),
  );

  // Round 2: only fires if some claims are INCONCLUSIVE and the budget still has room.
  // The verifier's refinedQuery suggestions are pooled, deduplicated, and the most
  // distinct ones are issued until the budget is exhausted.
  let finalOutputs = round1Outputs;
  const inconclusive = round1Outputs.filter(
    (o) => o.verdict.status === 'INCONCLUSIVE' && o.refinedQuery,
  );

  if (inconclusive.length > 0 && budget.remaining > 0) {
    const refinedQueries = pickRefinedQueries(
      inconclusive.map((o) => o.refinedQuery as string),
      budget.remaining,
    );

    for (const q of refinedQueries) {
      const more = await budget.retrieve({
        query: q,
        mode: input.mode,
        domain: detection.domain,
        correlationId,
      });
      if (more) evidencePool = dedupeEvidenceByUrl([...evidencePool, ...more.evidence]);
    }

    log.info(
      {
        refinedQueries,
        poolSize: evidencePool.length,
        budgetUsed: budget.callsUsed,
        budgetRemaining: budget.remaining,
      },
      'Refinement retrieval complete',
    );

    const claimsToRerun = inconclusive
      .map((o) => claims.find((c) => c.id === o.verdict.claimId))
      .filter((c): c is AtomicClaim => c !== undefined);

    const round2Outputs = await stageTimer('claim_verification', async () =>
      runRound(claimsToRerun, evidencePool, 2, detection.domain, correlationId),
    );

    const round2ById = new Map(round2Outputs.map((o) => [o.verdict.claimId, o]));
    finalOutputs = round1Outputs.map((o) => round2ById.get(o.verdict.claimId) ?? o);
  } else if (inconclusive.length > 0) {
    log.info(
      { inconclusive: inconclusive.length },
      'INCONCLUSIVE claims present but retrieval budget exhausted; skipping refinement',
    );
  }

  if (budget.callsUsed >= budget.max) {
    warnings.push(
      `Retrieval budget exhausted (${budget.callsUsed}/${budget.max} Tavily calls used).`,
    );
  }

  const claimOutputs = finalOutputs;

  const llmSelfReports = claimOutputs.filter((o) => o.injectionFlagged).length;
  const tagMissingCount = claimOutputs.filter((o) => o.tagMissing).length;
  if (tagMissingCount > 0) {
    warnings.push(
      `${tagMissingCount} claim(s) produced a FALSE verdict without hallucinationTypes despite explicit prompt requirement.`,
    );
  }
  const rawVerdicts = claimOutputs.map((o) => o.verdict);

  // Deterministic post-hoc consistency check: if a verdict claims VERIFIED/FALSE
  // but the evidence stance distribution disagrees, downgrade to INCONCLUSIVE.
  const verdicts = rawVerdicts.map((v) => applyStanceSanityCheck(v, warnings));

  const overallStatus = computeOverallStatus(verdicts);
  const correctedOutput = buildCorrectedOutput(claims, verdicts, input.modelOutput);

  timings.totalMs = Date.now() - startedAt;
  log.info(
    {
      overallStatus,
      claimCount: claims.length,
      verifiedCount: verdicts.filter((v) => v.status === 'VERIFIED').length,
      falseCount: verdicts.filter((v) => v.status === 'FALSE').length,
      inconclusiveCount: verdicts.filter((v) => v.status === 'INCONCLUSIVE').length,
      injectionSuspected: preScanMatches.length > 0 || llmSelfReports > 0,
      warningCount: warnings.length,
      totalMs: timings.totalMs,
    },
    'Pipeline complete',
  );

  const injection: InjectionSignal = {
    suspected: preScanMatches.length > 0 || llmSelfReports > 0,
    preScanMatches,
    llmSelfReports,
  };

  return {
    correlationId,
    detectedDomain: detection.domain,
    mode: input.mode,
    claims,
    verdicts,
    compliance,
    overallStatus,
    ...(correctedOutput ? { correctedOutput } : {}),
    timings,
    warnings,
    injection,
  };
};

/**
 * Builds the seed Tavily query for round 1. Joins the most-distinctive
 * claim texts (longest first, capped) so a single search covers the
 * topics the model actually asserted, even when the user input is on a
 * different topic (e.g. prompt-injection or off-topic responses).
 */
const buildSeedQuery = (claims: AtomicClaim[]): string => {
  const MAX_LEN = 380;
  const ranked = [...claims]
    .sort((a, b) => b.text.length - a.text.length)
    .map((c) => c.text.trim())
    .filter((t) => t.length > 0);

  const parts: string[] = [];
  let used = 0;
  for (const t of ranked) {
    if (used + t.length + 1 > MAX_LEN) break;
    parts.push(t);
    used += t.length + 1;
  }
  if (parts.length === 0 && ranked.length > 0) {
    const first = ranked[0] ?? '';
    return first.slice(0, MAX_LEN);
  }
  return parts.join(' | ');
};

/**
 * Deduplicates the verifier-suggested refinement queries and picks up to `max`
 * distinct ones. Distinctness uses normalized-token Jaccard so near-identical
 * suggestions don't burn separate Tavily calls.
 */
const pickRefinedQueries = (queries: string[], max: number): string[] => {
  const picked: Array<{ raw: string; tokens: Set<string> }> = [];
  for (const q of queries) {
    if (picked.length >= max) break;
    const normalized = normalizeText(q);
    if (normalized.length < 4) continue;
    const tokens = new Set(normalized.split(' '));
    const duplicate = picked.some((p) => jaccard(p.tokens, tokens) >= 0.7);
    if (duplicate) continue;
    picked.push({ raw: q, tokens });
  }
  return picked.map((p) => p.raw);
};

const jaccard = (a: Set<string>, b: Set<string>): number => {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const t of a) if (b.has(t)) intersection += 1;
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
};

const runRound = async (
  claims: AtomicClaim[],
  evidencePool: Evidence[],
  iteration: number,
  domain: Domain,
  correlationId: string,
): Promise<VerifyClaimOutput[]> => {
  const log = rootLogger.child({ module: 'pipeline', correlationId, iteration });
  return mapConcurrent<AtomicClaim, VerifyClaimOutput>(
    claims,
    env.CLAIM_CONCURRENCY,
    async (claim) => {
      try {
        return await verifyClaim({
          claim,
          domain,
          evidencePool,
          iteration,
          correlationId,
        });
      } catch (err) {
        log.warn(
          { err, claimId: claim.id, iteration },
          'Per-claim verification failed; marking INCONCLUSIVE',
        );
        return {
          verdict: {
            claimId: claim.id,
            status: 'INCONCLUSIVE',
            confidence: 0,
            hallucinationTypes: [],
            reasoning: `Verification failed: ${asMessage(err)}`,
            evidenceUsed: [],
            iterations: iteration,
          },
          injectionFlagged: false,
          tagMissing: false,
        };
      }
    },
  );
};

/**
 * Reconciles the verifier's verdict against its own per-evidence stance annotations:
 * - VERIFIED but stance is majority-contradicts → downgrade to INCONCLUSIVE.
 * - FALSE but stance is majority-supports → downgrade to INCONCLUSIVE.
 * - INCONCLUSIVE but stance shows ≥2 contradicts and zero supports → promote to FALSE.
 *   (The LLM saw the contradiction and tagged it; refusing to call FALSE was excess hedging.)
 */
const applyStanceSanityCheck = (verdict: ClaimVerdict, warnings: string[]): ClaimVerdict => {
  if (verdict.evidenceUsed.length === 0) return verdict;

  const supports = verdict.evidenceUsed.filter((e) => e.stance === 'supports').length;
  const contradicts = verdict.evidenceUsed.filter((e) => e.stance === 'contradicts').length;

  if (verdict.status === 'INCONCLUSIVE' && contradicts >= 2 && supports === 0) {
    warnings.push(
      `Claim ${verdict.claimId}: verdict was INCONCLUSIVE but ${contradicts} evidence entries were tagged contradicts (0 supports). Promoted to FALSE.`,
    );
    return {
      ...verdict,
      status: 'FALSE',
      confidence: Math.max(verdict.confidence, 0.6),
      hallucinationTypes:
        verdict.hallucinationTypes.length > 0 ? verdict.hallucinationTypes : ['confidence'],
      reasoning: `${verdict.reasoning}\n\n[Stance-consistency check: original verdict INCONCLUSIVE was inconsistent with ${contradicts} contradicting evidence entries and 0 supporting; promoted to FALSE.]`,
    };
  }

  const verdictDisagreesWithStance =
    (verdict.status === 'VERIFIED' && contradicts > supports && contradicts >= 2) ||
    (verdict.status === 'FALSE' && supports > contradicts && supports >= 2);

  if (!verdictDisagreesWithStance) return verdict;

  warnings.push(
    `Claim ${verdict.claimId}: verdict was ${verdict.status} but evidence stance disagrees (supports=${supports}, contradicts=${contradicts}). Downgraded to INCONCLUSIVE.`,
  );

  return {
    ...verdict,
    status: 'INCONCLUSIVE',
    confidence: Math.min(verdict.confidence, 0.3),
    reasoning: `${verdict.reasoning}\n\n[Stance-consistency check: original verdict ${verdict.status} contradicted the evidence stance distribution and was downgraded.]`,
  };
};

/**
 * Overall status priority: any FALSE → FALSE (one falsehood ruins the response);
 * else any INCONCLUSIVE → INCONCLUSIVE (incomplete signal); else VERIFIED.
 * If we somehow get an empty verdict list, INCONCLUSIVE is the safe default.
 */
const computeOverallStatus = (verdicts: ClaimVerdict[]): VerdictStatus => {
  if (verdicts.length === 0) return 'INCONCLUSIVE';
  if (verdicts.some((v) => v.status === 'FALSE')) return 'FALSE';
  if (verdicts.some((v) => v.status === 'INCONCLUSIVE')) return 'INCONCLUSIVE';
  return 'VERIFIED';
};

const buildCorrectedOutput = (
  claims: AtomicClaim[],
  verdicts: ClaimVerdict[],
  original: string,
): string | undefined => {
  const corrections = verdicts.filter(
    (v): v is ClaimVerdict & { correction: string } =>
      typeof v.correction === 'string' && v.correction.trim().length > 0,
  );
  if (corrections.length === 0) return undefined;

  const lines = [
    'Original response (review the corrections below):',
    original.trim(),
    '',
    'Corrections:',
  ];
  const claimMap = new Map(claims.map((c) => [c.id, c]));
  for (const v of corrections) {
    const claim = claimMap.get(v.claimId);
    if (!claim) continue;
    lines.push(`- [${v.status}] "${claim.text}" → ${v.correction}`);
  }
  return lines.join('\n');
};

const asMessage = (err: unknown): string => {
  if (err instanceof AppError) return `${err.code}: ${err.message}`;
  if (err instanceof Error) return err.message;
  return String(err);
};

interface StageTimer {
  <T>(stage: PipelineStage, fn: () => Promise<T>): Promise<T>;
}

const makeStageTimer = (timings: PipelineTimings): StageTimer => async (stage, fn) => {
  const start = Date.now();
  try {
    return await fn();
  } finally {
    timings.perStage[stage] = (timings.perStage[stage] ?? 0) + (Date.now() - start);
  }
};
