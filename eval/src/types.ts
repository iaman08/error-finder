import { z } from 'zod';

export const VERDICT_STATUSES = ['VERIFIED', 'FALSE', 'INCONCLUSIVE'] as const;
export type VerdictStatus = (typeof VERDICT_STATUSES)[number];

export const RETRIEVAL_MODES = ['standard', 'professional'] as const;
export type RetrievalMode = (typeof RETRIEVAL_MODES)[number];

export const HALLUCINATION_TYPES = [
  'numerical',
  'citation',
  'temporal',
  'logical',
  'contextual',
  'scope_exaggeration',
  'entity_conflation',
  'confidence',
] as const;
export type HallucinationType = (typeof HALLUCINATION_TYPES)[number];

export const EVAL_CATEGORIES = [
  'control',
  'numerical',
  'citation',
  'temporal',
  'entity',
  'scope',
  'logical',
  'contextual',
  'mixed',
  'inconclusive',
  'injection',
  'compliance',
] as const;
export type EvalCategory = (typeof EVAL_CATEGORIES)[number];

export interface VerifyInput {
  userInput: string;
  modelOutput: string;
  mode: RetrievalMode;
}

export interface EvalExpectations {
  /** Expected top-level overall status. "any-conclusive" matches VERIFIED or FALSE. */
  overallStatus?: VerdictStatus | 'any-conclusive';
  /** At least one verdict should have status FALSE. */
  expectAnyFalse?: boolean;
  /** Prompt-injection signal should be raised. */
  expectInjection?: boolean;
  /** Compliance verdict.safe should be false. */
  expectComplianceFlag?: boolean;
  /** At least one verdict's hallucinationTypes should include one of these. */
  expectHallucinationTypes?: HallucinationType[];
  /** Soft sanity bounds on the number of atomic claims produced. */
  minClaimCount?: number;
  maxClaimCount?: number;
}

export interface EvalCase {
  id: string;
  category: EvalCategory;
  description: string;
  input: VerifyInput;
  expectations: EvalExpectations;
  /** Ground-truth label for confidence calibration: VERIFIED vs FALSE per claim text fragment. */
  calibrationTargets?: Array<{
    /** Substring or token expected in a decomposed claim. */
    claimContains: string;
    expectedTruth: 'TRUE' | 'FALSE';
  }>;
}

// ----- Backend response schemas (mirrored locally to keep harness decoupled) -----

const evidenceSchema = z.object({
  source: z.string(),
  url: z.string(),
  title: z.string().optional(),
  snippet: z.string(),
  relevanceScore: z.number(),
  stance: z.enum(['supports', 'contradicts', 'neutral']),
  publishedAt: z.string().optional(),
  retrievedAt: z.string(),
  trusted: z.boolean(),
});

const claimSchema = z.object({
  id: z.string(),
  text: z.string(),
  subject: z.string().optional(),
  predicate: z.string().optional(),
  object: z.string().optional(),
  temporalContext: z.string().optional(),
  isCheckable: z.boolean(),
  rationale: z.string().optional(),
});

const claimVerdictSchema = z.object({
  claimId: z.string(),
  status: z.enum(VERDICT_STATUSES),
  confidence: z.number(),
  hallucinationTypes: z.array(z.enum(HALLUCINATION_TYPES)).default([]),
  reasoning: z.string(),
  correction: z.string().optional(),
  evidenceUsed: z.array(evidenceSchema).default([]),
  iterations: z.number().int().min(0),
});

const complianceSchema = z.object({
  safe: z.boolean(),
  flags: z.array(z.string()).default([]),
  reasoning: z.string(),
});

const injectionSchema = z.object({
  suspected: z.boolean(),
  preScanMatches: z.array(z.string()).default([]),
  llmSelfReports: z.number().int().min(0).default(0),
});

export const verifyResponseSchema = z.object({
  correlationId: z.string(),
  detectedDomain: z.string(),
  mode: z.enum(RETRIEVAL_MODES),
  claims: z.array(claimSchema),
  verdicts: z.array(claimVerdictSchema),
  compliance: complianceSchema,
  overallStatus: z.enum(VERDICT_STATUSES),
  correctedOutput: z.string().optional(),
  timings: z.object({
    totalMs: z.number(),
    perStage: z.record(z.string(), z.number()).default({}),
  }),
  warnings: z.array(z.string()).default([]),
  injection: injectionSchema.default({ suspected: false, preScanMatches: [], llmSelfReports: 0 }),
});

export type VerifyResponse = z.infer<typeof verifyResponseSchema>;
export type ClaimVerdict = z.infer<typeof claimVerdictSchema>;

// ----- Scoring result types -----

export interface CheckResult {
  name: string;
  passed: boolean;
  expected: string;
  actual: string;
}

export interface CaseResult {
  caseId: string;
  category: EvalCategory;
  description: string;
  status: 'pass' | 'fail' | 'error';
  checks: CheckResult[];
  response?: VerifyResponse;
  error?: string;
  durationMs: number;
}

export interface CategoryMetrics {
  total: number;
  passed: number;
  failed: number;
  errored: number;
  passRate: number;
}

export interface CalibrationBucket {
  rangeLow: number;
  rangeHigh: number;
  count: number;
  avgConfidence: number;
  accuracy: number;
}

export interface CalibrationReport {
  sampleCount: number;
  ece: number;
  brierScore: number;
  buckets: CalibrationBucket[];
}

export interface AggregateReport {
  totalCases: number;
  passed: number;
  failed: number;
  errored: number;
  passRate: number;
  byCategory: Record<EvalCategory, CategoryMetrics>;
  injectionDetectionRate: number | null;
  hallucinationDetectionRate: number | null;
  falsePositiveRate: number | null;
  calibration: CalibrationReport | null;
  avgLatencyMs: number;
  p95LatencyMs: number;
}

export interface FullReport {
  runId: string;
  startedAt: string;
  completedAt: string;
  backendUrl: string;
  filter: string | null;
  cases: CaseResult[];
  aggregate: AggregateReport;
}
