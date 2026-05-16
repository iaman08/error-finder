import { Schema, model, type InferSchemaType, type Model } from 'mongoose';
import {
  DOMAINS,
  EVIDENCE_STANCES,
  HALLUCINATION_TYPES,
  PIPELINE_STAGES,
  RETRIEVAL_MODES,
  VERDICT_STATUSES,
} from '@/domain/enums.js';

const evidenceSchema = new Schema(
  {
    source: { type: String, required: true },
    url: { type: String, required: true },
    title: String,
    snippet: { type: String, required: true },
    relevanceScore: { type: Number, required: true, min: 0, max: 1 },
    stance: { type: String, enum: EVIDENCE_STANCES, required: true },
    publishedAt: String,
    retrievedAt: { type: String, required: true },
    trusted: { type: Boolean, required: true },
  },
  { _id: false },
);

const atomicClaimSchema = new Schema(
  {
    id: { type: String, required: true },
    text: { type: String, required: true },
    subject: String,
    predicate: String,
    object: String,
    temporalContext: String,
    isCheckable: { type: Boolean, required: true },
    rationale: String,
  },
  { _id: false },
);

const claimVerdictSchema = new Schema(
  {
    claimId: { type: String, required: true },
    status: { type: String, enum: VERDICT_STATUSES, required: true },
    confidence: { type: Number, required: true, min: 0, max: 1 },
    hallucinationTypes: { type: [String], enum: HALLUCINATION_TYPES, default: [] },
    reasoning: { type: String, required: true },
    correction: String,
    evidenceUsed: { type: [evidenceSchema], default: [] },
    iterations: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const complianceSchema = new Schema(
  {
    safe: { type: Boolean, required: true },
    flags: { type: [String], default: [] },
    reasoning: { type: String, required: true },
  },
  { _id: false },
);

const timingsSchema = new Schema(
  {
    totalMs: { type: Number, required: true, min: 0 },
    perStage: {
      type: Map,
      of: Number,
      default: {},
      validate: {
        validator: (m: Map<string, number>) =>
          [...m.keys()].every((k) => (PIPELINE_STAGES as readonly string[]).includes(k)),
        message: 'Invalid pipeline stage key',
      },
    },
  },
  { _id: false },
);

const injectionSchema = new Schema(
  {
    suspected: { type: Boolean, required: true, default: false },
    preScanMatches: { type: [String], default: [] },
    llmSelfReports: { type: Number, required: true, default: 0, min: 0 },
  },
  { _id: false },
);

export const VERIFICATION_RUN_STATUS = ['pending', 'completed', 'failed'] as const;
export type VerificationRunStatus = (typeof VERIFICATION_RUN_STATUS)[number];

const verificationRunSchema = new Schema(
  {
    correlationId: { type: String, required: true, unique: true, index: true },
    status: { type: String, enum: VERIFICATION_RUN_STATUS, required: true, index: true },
    input: {
      userInput: { type: String, required: true },
      modelOutput: { type: String, required: true },
      mode: { type: String, enum: RETRIEVAL_MODES, required: true },
      domainOverride: { type: String, enum: DOMAINS },
    },
    detectedDomain: { type: String, enum: DOMAINS },
    claims: { type: [atomicClaimSchema], default: [] },
    verdicts: { type: [claimVerdictSchema], default: [] },
    compliance: complianceSchema,
    overallStatus: { type: String, enum: VERDICT_STATUSES },
    correctedOutput: String,
    timings: timingsSchema,
    warnings: { type: [String], default: [] },
    injection: injectionSchema,
    error: String,
    startedAt: { type: Date, required: true, default: Date.now },
    completedAt: Date,
  },
  { timestamps: true, collection: 'verification_runs' },
);

verificationRunSchema.index({ 'injection.suspected': 1, createdAt: -1 });

verificationRunSchema.index({ createdAt: -1 });
verificationRunSchema.index({ 'input.mode': 1, detectedDomain: 1, createdAt: -1 });

export type VerificationRunDoc = InferSchemaType<typeof verificationRunSchema>;

export const VerificationRunModel: Model<VerificationRunDoc> = model<VerificationRunDoc>(
  'VerificationRun',
  verificationRunSchema,
);
