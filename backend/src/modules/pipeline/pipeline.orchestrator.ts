import { env } from '@/config/env.js';
import { logger as rootLogger } from '@/config/logger.js';
import type { PipelineStage, VerdictStatus } from '@/domain/enums.js';
import { AppError } from '@/domain/errors.js';
import type {
  AtomicClaim,
  ClaimVerdict,
  InjectionSignal,
  PipelineTimings,
  VerificationInput,
  VerificationResult,
} from '@/domain/types.js';
import { runCompliance } from '@/modules/compliance/compliance.service.js';
import { decomposeClaims } from '@/modules/claim-decomposition/decomposer.service.js';
import { detectDomain } from '@/modules/domain-detection/domain-detector.service.js';
import { verifyClaim, type VerifyClaimOutput } from '@/modules/verification/verifier.service.js';
import { mapConcurrent } from '@/shared/utils/async.js';
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

  // Per-claim verification with bounded concurrency. Each claim performs its own
  // retrieval (and recursive refinement) inside the verifier service.
  const claimOutputs = await stageTimer('claim_verification', async () =>
    mapConcurrent<AtomicClaim, VerifyClaimOutput>(claims, env.CLAIM_CONCURRENCY, async (claim) => {
      try {
        return await verifyClaim({
          claim,
          domain: detection.domain,
          mode: input.mode,
          correlationId,
        });
      } catch (err) {
        log.warn({ err, claimId: claim.id }, 'Per-claim verification failed; marking INCONCLUSIVE');
        return {
          verdict: {
            claimId: claim.id,
            status: 'INCONCLUSIVE',
            confidence: 0,
            hallucinationTypes: [],
            reasoning: `Verification failed: ${asMessage(err)}`,
            evidenceUsed: [],
            iterations: 0,
          },
          injectionFlagged: false,
          tagMissing: false,
        };
      }
    }),
  );

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
 * If a claim is marked VERIFIED but evidence stance is majority-contradicts
 * (or FALSE but majority-supports), the verifier has internally contradicted itself.
 * Downgrade to INCONCLUSIVE with a low confidence and surface the inconsistency.
 */
const applyStanceSanityCheck = (verdict: ClaimVerdict, warnings: string[]): ClaimVerdict => {
  if (verdict.status !== 'VERIFIED' && verdict.status !== 'FALSE') return verdict;
  if (verdict.evidenceUsed.length === 0) return verdict;

  const supports = verdict.evidenceUsed.filter((e) => e.stance === 'supports').length;
  const contradicts = verdict.evidenceUsed.filter((e) => e.stance === 'contradicts').length;

  const contradicting =
    (verdict.status === 'VERIFIED' && contradicts > supports && contradicts >= 2) ||
    (verdict.status === 'FALSE' && supports > contradicts && supports >= 2);

  if (!contradicting) return verdict;

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
