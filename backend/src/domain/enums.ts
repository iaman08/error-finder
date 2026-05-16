export const DOMAINS = ['finance', 'medical', 'legal', 'tech', 'news', 'general'] as const;
export type Domain = (typeof DOMAINS)[number];

export const RETRIEVAL_MODES = ['standard', 'professional'] as const;
export type RetrievalMode = (typeof RETRIEVAL_MODES)[number];

export const VERDICT_STATUSES = ['VERIFIED', 'FALSE', 'INCONCLUSIVE'] as const;
export type VerdictStatus = (typeof VERDICT_STATUSES)[number];

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

export const EVIDENCE_STANCES = ['supports', 'contradicts', 'neutral'] as const;
export type EvidenceStance = (typeof EVIDENCE_STANCES)[number];

export const PIPELINE_STAGES = [
  'domain_detection',
  'retrieval_initial',
  'claim_decomposition',
  'claim_verification',
  'compliance',
] as const;
export type PipelineStage = (typeof PIPELINE_STAGES)[number];
