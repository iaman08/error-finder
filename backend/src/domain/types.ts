import type {
  Domain,
  EvidenceStance,
  HallucinationType,
  PipelineStage,
  RetrievalMode,
  VerdictStatus,
} from '@/domain/enums.js';

export interface Evidence {
  source: string;
  url: string;
  title?: string;
  snippet: string;
  relevanceScore: number;
  stance: EvidenceStance;
  publishedAt?: string;
  retrievedAt: string;
  trusted: boolean;
}

export interface AtomicClaim {
  id: string;
  text: string;
  subject?: string;
  predicate?: string;
  object?: string;
  temporalContext?: string;
  isCheckable: boolean;
  rationale?: string;
  /** True when the claim was derived from a reconstructed fragment. */
  reconstructed?: boolean;
}

export interface ClaimVerdict {
  claimId: string;
  status: VerdictStatus;
  confidence: number;
  hallucinationTypes: HallucinationType[];
  reasoning: string;
  correction?: string;
  evidenceUsed: Evidence[];
  iterations: number;
}

export interface ComplianceVerdict {
  safe: boolean;
  flags: string[];
  reasoning: string;
}

export interface PipelineTimings {
  totalMs: number;
  perStage: Partial<Record<PipelineStage, number>>;
}

export interface VerificationInput {
  userInput: string;
  modelOutput: string;
  mode: RetrievalMode;
  domainOverride?: Domain;
}

export interface InjectionSignal {
  /** True if any tripwire (regex or LLM self-report) fired. */
  suspected: boolean;
  /** Pattern ids that matched a pre-scan of user input or model output. */
  preScanMatches: string[];
  /** Number of per-claim verifier calls that self-reported injection in the evidence. */
  llmSelfReports: number;
}

export interface ReconstructionMeta {
  /** True if the model output was reconstructed from a fragment. */
  reconstructed: boolean;
  /** The original raw model output before reconstruction. */
  originalOutput: string;
  /** Qualifiers extracted from the input and preserved during reconstruction. */
  preservedQualifiers: string[];
}

export interface VerificationResult {
  correlationId: string;
  detectedDomain: Domain;
  mode: RetrievalMode;
  claims: AtomicClaim[];
  verdicts: ClaimVerdict[];
  compliance: ComplianceVerdict;
  overallStatus: VerdictStatus;
  correctedOutput?: string;
  timings: PipelineTimings;
  /** Non-fatal operator-visible warnings emitted during the run. */
  warnings: string[];
  /** Aggregated prompt-injection signal across pre-scan and LLM self-reports. */
  injection: InjectionSignal;
  /** Metadata about claim reconstruction from fragmentary output. */
  reconstruction?: ReconstructionMeta;
}
