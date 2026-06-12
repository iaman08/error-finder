import { env } from '@/config/env.js';
import { logger as rootLogger } from '@/config/logger.js';
import type { Domain, PipelineStage, VerdictStatus } from '@/domain/enums.js';
import type {
  AtomicClaim,
  ClaimVerdict,
  Evidence,
  InjectionSignal,
  PipelineTimings,
  VerificationInput,
  VerificationResult,
} from '@/domain/types.js';
import {
  runUnifiedAnalysis,
} from '@/modules/unified-analysis/unified-analysis.service.js';
import {
  runUnifiedVerification,
} from '@/modules/unified-verification/unified-verification.service.js';
import {
  RetrievalBudget,
} from '@/modules/retrieval/retrieval.service.js';
import { newCorrelationId } from '@/shared/utils/correlation.js';
import { scanForInjection } from '@/shared/utils/injection.js';

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

  // ── Pre-scan: injection tripwires (deterministic, no LLM) ─────────────
  const userScan = scanForInjection(input.userInput);
  const outputScan = scanForInjection(input.modelOutput);
  const preScanMatches = Array.from(new Set([...userScan.matchedIds, ...outputScan.matchedIds]));
  if (preScanMatches.length > 0) {
    warnings.push(
      `Prompt-injection tripwires fired in input: [${preScanMatches.join(', ')}]. Verifier instructed to ignore embedded directives.`,
    );
    log.warn({ preScanMatches }, 'Prompt-injection pre-scan flagged content');
  }

  // ── LLM Call 1: Unified Analysis ─────────────────────────────────────
  // Domain detection + Claim reconstruction + Claim decomposition
  const analysis = await stageTimer('analysis', () =>
    runUnifiedAnalysis({
      userInput: input.userInput,
      modelOutput: input.modelOutput,
      correlationId,
      ...(input.domainOverride ? { domainOverride: input.domainOverride } : {}),
    }),
  );

  const { claims, domain } = analysis;
  warnings.push(...analysis.warnings);

  if (claims.length === 0) {
    log.warn('No claims produced; returning empty verdict set');
    timings.totalMs = Date.now() - startedAt;
    return {
      correlationId,
      detectedDomain: domain,
      mode: input.mode,
      claims: [],
      verdicts: [],
      compliance: { safe: true, flags: [], reasoning: 'No claims to verify.' },
      overallStatus: 'INCONCLUSIVE',
      timings,
      warnings,
      injection: {
        suspected: preScanMatches.length > 0,
        preScanMatches,
        llmSelfReports: 0,
      },
      ...(analysis.reconstructionMeta ? { reconstruction: analysis.reconstructionMeta } : {}),
    };
  }

  // ── Tavily Retrieval (no LLM) ────────────────────────────────────────
  const budget = new RetrievalBudget(1); // exactly 1 Tavily call
  let evidencePool: Evidence[] = [];

  const seedQuery = buildSeedQuery(claims);
  const seedOutcome = await stageTimer('retrieval', async () => {
    const result = await budget.retrieve({
      query: seedQuery,
      mode: input.mode,
      domain,
      correlationId,
    });
    return result;
  });
  evidencePool = seedOutcome?.evidence ?? [];

  log.info(
    { seedQuery, evidenceCount: evidencePool.length },
    'Retrieval complete',
  );

  // ── LLM Call 2: Unified Verification + Compliance ────────────────────
  const verification = await stageTimer('verification', () =>
    runUnifiedVerification({
      claims,
      evidencePool,
      userInput: input.userInput,
      modelOutput: input.modelOutput,
      domain,
      correlationId,
    }),
  );

  warnings.push(...verification.warnings);

  // ── Post-processing ──────────────────────────────────────────────────
  // Apply stance sanity checks
  const verdicts = verification.verdicts.map((v) => applyStanceSanityCheck(v, warnings));

  const overallStatus = computeOverallStatus(verdicts);
  const correctedOutput = buildCorrectedOutput(claims, verdicts, input.modelOutput);

  const llmSelfReports = verification.llmSelfReports;

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
    detectedDomain: domain,
    mode: input.mode,
    claims,
    verdicts,
    compliance: verification.compliance,
    overallStatus,
    ...(correctedOutput ? { correctedOutput } : {}),
    timings,
    warnings,
    injection,
    ...(analysis.reconstructionMeta ? { reconstruction: analysis.reconstructionMeta } : {}),
  };
};

// ---------------------------------------------------------------------------
// Helpers (kept from the original orchestrator)
// ---------------------------------------------------------------------------

/**
 * Builds the seed Tavily query. Joins the most-distinctive claim texts
 * (longest first, capped) so a single search covers the topics the model
 * actually asserted.
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
 * Reconciles the verifier's verdict against its own per-evidence stance annotations.
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
 * Overall status priority: any FALSE → FALSE; else any INCONCLUSIVE → INCONCLUSIVE; else VERIFIED.
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

// ---------------------------------------------------------------------------
// Stage timer
// ---------------------------------------------------------------------------

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
