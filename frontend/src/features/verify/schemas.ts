import { z } from 'zod';

export const DOMAINS = ['finance', 'medical', 'legal', 'tech', 'news', 'general'] as const;
export const RETRIEVAL_MODES = ['standard', 'professional'] as const;
export const VERDICT_STATUSES = ['VERIFIED', 'FALSE', 'INCONCLUSIVE'] as const;
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
export const EVIDENCE_STANCES = ['supports', 'contradicts', 'neutral'] as const;
export const PIPELINE_STAGES = [
  'domain_detection',
  'retrieval_initial',
  'claim_decomposition',
  'claim_verification',
  'compliance',
] as const;

export type Domain = (typeof DOMAINS)[number];
export type RetrievalMode = (typeof RETRIEVAL_MODES)[number];
export type VerdictStatus = (typeof VERDICT_STATUSES)[number];
export type HallucinationType = (typeof HALLUCINATION_TYPES)[number];
export type EvidenceStance = (typeof EVIDENCE_STANCES)[number];
export type PipelineStage = (typeof PIPELINE_STAGES)[number];

export const evidenceSchema = z.object({
  source: z.string(),
  url: z.string(),
  title: z.string().optional(),
  snippet: z.string(),
  relevanceScore: z.number().min(0).max(1),
  stance: z.enum(EVIDENCE_STANCES),
  publishedAt: z.string().optional(),
  retrievedAt: z.string(),
  trusted: z.boolean(),
});

export const atomicClaimSchema = z.object({
  id: z.string(),
  text: z.string(),
  subject: z.string().optional(),
  predicate: z.string().optional(),
  object: z.string().optional(),
  temporalContext: z.string().optional(),
  isCheckable: z.boolean(),
  rationale: z.string().optional(),
});

export const claimVerdictSchema = z.object({
  claimId: z.string(),
  status: z.enum(VERDICT_STATUSES),
  confidence: z.number().min(0).max(1),
  hallucinationTypes: z.array(z.enum(HALLUCINATION_TYPES)).default([]),
  reasoning: z.string(),
  correction: z.string().optional(),
  evidenceUsed: z.array(evidenceSchema).default([]),
  iterations: z.number().int().min(0),
});

export const complianceSchema = z.object({
  safe: z.boolean(),
  flags: z.array(z.string()).default([]),
  reasoning: z.string(),
});

export const pipelineTimingsSchema = z.object({
  totalMs: z.number().min(0),
  perStage: z.record(z.string(), z.number()).default({}),
});

export const verifyRequestSchema = z.object({
  userInput: z.string().min(1, 'User question is required').max(20_000),
  modelOutput: z.string().min(1, 'Model response is required').max(30_000),
  mode: z.enum(RETRIEVAL_MODES),
  domainOverride: z.enum(DOMAINS).optional(),
});

export const injectionSignalSchema = z.object({
  suspected: z.boolean(),
  preScanMatches: z.array(z.string()).default([]),
  llmSelfReports: z.number().int().min(0).default(0),
});

const DEFAULT_INJECTION = {
  suspected: false,
  preScanMatches: [],
  llmSelfReports: 0,
};

export const verifyResponseSchema = z.object({
  correlationId: z.string(),
  detectedDomain: z.enum(DOMAINS),
  mode: z.enum(RETRIEVAL_MODES),
  claims: z.array(atomicClaimSchema),
  verdicts: z.array(claimVerdictSchema),
  compliance: complianceSchema,
  overallStatus: z.enum(VERDICT_STATUSES),
  correctedOutput: z.string().optional(),
  timings: pipelineTimingsSchema,
  warnings: z.array(z.string()).default([]),
  injection: injectionSignalSchema.default(DEFAULT_INJECTION),
});

export const RUN_STATUSES = ['pending', 'completed', 'failed'] as const;
export type RunStatus = (typeof RUN_STATUSES)[number];

export const submitAcceptedSchema = z.object({
  correlationId: z.string(),
  status: z.enum(RUN_STATUSES),
});
export type SubmitAccepted = z.infer<typeof submitAcceptedSchema>;

export const runDocSchema = z.object({
  correlationId: z.string(),
  status: z.enum(RUN_STATUSES),
  input: z.object({
    userInput: z.string(),
    modelOutput: z.string(),
    mode: z.enum(RETRIEVAL_MODES),
    domainOverride: z.enum(DOMAINS).optional(),
  }),
  detectedDomain: z.enum(DOMAINS).optional(),
  claims: z.array(atomicClaimSchema).default([]),
  verdicts: z.array(claimVerdictSchema).default([]),
  compliance: complianceSchema.optional(),
  overallStatus: z.enum(VERDICT_STATUSES).optional(),
  correctedOutput: z.string().optional(),
  timings: pipelineTimingsSchema.optional(),
  warnings: z.array(z.string()).default([]),
  injection: injectionSignalSchema.default(DEFAULT_INJECTION),
  error: z.string().optional(),
  startedAt: z.union([z.string(), z.date()]).optional(),
  completedAt: z.union([z.string(), z.date()]).optional(),
  createdAt: z.union([z.string(), z.date()]).optional(),
  updatedAt: z.union([z.string(), z.date()]).optional(),
});

export const apiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    correlationId: z.string().optional(),
    issues: z
      .array(z.object({ path: z.string(), message: z.string() }))
      .optional(),
    details: z.unknown().optional(),
  }),
});

export type Evidence = z.infer<typeof evidenceSchema>;
export type AtomicClaim = z.infer<typeof atomicClaimSchema>;
export type ClaimVerdict = z.infer<typeof claimVerdictSchema>;
export type ComplianceVerdict = z.infer<typeof complianceSchema>;
export type InjectionSignal = z.infer<typeof injectionSignalSchema>;
export type PipelineTimings = z.infer<typeof pipelineTimingsSchema>;
export type VerifyRequest = z.infer<typeof verifyRequestSchema>;
export type VerifyResponse = z.infer<typeof verifyResponseSchema>;
export type RunDoc = z.infer<typeof runDocSchema>;
export type ApiErrorPayload = z.infer<typeof apiErrorSchema>;
