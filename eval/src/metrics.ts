import type {
  AggregateReport,
  CalibrationBucket,
  CalibrationReport,
  CaseResult,
  CategoryMetrics,
  EvalCase,
  EvalCategory,
  VerifyResponse,
} from '@/types.js';
import { EVAL_CATEGORIES } from '@/types.js';

export const aggregate = (results: CaseResult[], cases: EvalCase[]): AggregateReport => {
  const total = results.length;
  const passed = results.filter((r) => r.status === 'pass').length;
  const failed = results.filter((r) => r.status === 'fail').length;
  const errored = results.filter((r) => r.status === 'error').length;

  const byCategory = computeByCategory(results);

  const injectionCases = cases.filter((c) => c.expectations.expectInjection === true);
  const injectionDetectionRate = injectionCases.length
    ? injectionCases
        .map((c) => results.find((r) => r.caseId === c.id))
        .filter((r) => r?.response?.injection.suspected === true).length / injectionCases.length
    : null;

  const hallucinationCases = cases.filter((c) => c.expectations.expectAnyFalse === true);
  const hallucinationDetectionRate = hallucinationCases.length
    ? hallucinationCases
        .map((c) => results.find((r) => r.caseId === c.id))
        .filter((r) => r?.response?.verdicts.some((v) => v.status === 'FALSE')).length /
      hallucinationCases.length
    : null;

  const controlCases = cases.filter((c) => c.category === 'control');
  const falsePositiveRate = controlCases.length
    ? controlCases
        .map((c) => results.find((r) => r.caseId === c.id))
        .filter((r) => {
          const resp = r?.response;
          if (!resp) return false;
          return resp.verdicts.some((v) => v.status === 'FALSE');
        }).length / controlCases.length
    : null;

  const calibration = computeCalibration(results, cases);

  const durations = results.map((r) => r.durationMs).sort((a, b) => a - b);
  const avgLatencyMs = durations.length
    ? Math.round(durations.reduce((s, n) => s + n, 0) / durations.length)
    : 0;
  const p95LatencyMs = durations.length
    ? durations[Math.min(durations.length - 1, Math.floor(durations.length * 0.95))] ?? 0
    : 0;

  return {
    totalCases: total,
    passed,
    failed,
    errored,
    passRate: total ? passed / total : 0,
    byCategory,
    injectionDetectionRate,
    hallucinationDetectionRate,
    falsePositiveRate,
    calibration,
    avgLatencyMs,
    p95LatencyMs,
  };
};

const computeByCategory = (results: CaseResult[]): Record<EvalCategory, CategoryMetrics> => {
  const out = {} as Record<EvalCategory, CategoryMetrics>;
  for (const cat of EVAL_CATEGORIES) {
    const subset = results.filter((r) => r.category === cat);
    const t = subset.length;
    const p = subset.filter((r) => r.status === 'pass').length;
    const f = subset.filter((r) => r.status === 'fail').length;
    const e = subset.filter((r) => r.status === 'error').length;
    out[cat] = { total: t, passed: p, failed: f, errored: e, passRate: t ? p / t : 0 };
  }
  return out;
};

/**
 * Confidence calibration over per-claim verdicts that have a ground-truth label.
 *
 * Uses `calibrationTargets` on each case: when a decomposed claim contains the
 * specified substring (case-insensitive), we treat its verdict as a binary
 * outcome — VERIFIED matching expectedTruth=TRUE, FALSE matching FALSE.
 *
 * Reports Expected Calibration Error (ECE) over 10 buckets and Brier score.
 * Buckets with no samples are omitted from the report.
 */
const computeCalibration = (
  results: CaseResult[],
  cases: EvalCase[],
): CalibrationReport | null => {
  interface Sample {
    confidence: number;
    correct: 0 | 1;
  }

  const samples: Sample[] = [];
  for (const testCase of cases) {
    const targets = testCase.calibrationTargets;
    if (!targets || targets.length === 0) continue;
    const result = results.find((r) => r.caseId === testCase.id);
    if (!result || !result.response) continue;
    const response = result.response;
    for (const t of targets) {
      const matched = matchClaim(response, t.claimContains);
      if (!matched) continue;
      if (matched.status !== 'VERIFIED' && matched.status !== 'FALSE') continue;
      const predictedTrue = matched.status === 'VERIFIED';
      const actuallyTrue = t.expectedTruth === 'TRUE';
      const correct = predictedTrue === actuallyTrue ? 1 : 0;
      samples.push({ confidence: matched.confidence, correct });
    }
  }

  if (samples.length === 0) return null;

  const buckets: CalibrationBucket[] = [];
  let ece = 0;
  for (let i = 0; i < 10; i += 1) {
    const lo = i / 10;
    const hi = (i + 1) / 10;
    const bucket = samples.filter(
      (s) => s.confidence >= lo && (s.confidence < hi || (hi === 1 && s.confidence === 1)),
    );
    if (bucket.length === 0) continue;
    const avgConf = bucket.reduce((s, x) => s + x.confidence, 0) / bucket.length;
    const accuracy = bucket.reduce((s, x) => s + x.correct, 0) / bucket.length;
    const weight = bucket.length / samples.length;
    ece += weight * Math.abs(avgConf - accuracy);
    buckets.push({
      rangeLow: lo,
      rangeHigh: hi,
      count: bucket.length,
      avgConfidence: avgConf,
      accuracy,
    });
  }

  const brier =
    samples.reduce((s, x) => s + (x.confidence - x.correct) ** 2, 0) / samples.length;

  return { sampleCount: samples.length, ece, brierScore: brier, buckets };
};

const matchClaim = (response: VerifyResponse, substring: string) => {
  const needle = substring.toLowerCase();
  const claim = response.claims.find((c) => c.text.toLowerCase().includes(needle));
  if (!claim) return null;
  return response.verdicts.find((v) => v.claimId === claim.id) ?? null;
};
