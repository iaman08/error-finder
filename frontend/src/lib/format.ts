import type { VerdictStatus, HallucinationType } from '@/features/verify/schemas';

export interface VerdictStyle {
  label: string;
  description: string;
  badgeClass: string;
  dotClass: string;
  ringClass: string;
}

export const verdictStyle = (status: VerdictStatus): VerdictStyle => {
  switch (status) {
    case 'VERIFIED':
      return {
        label: 'Verified',
        description: 'Supported by evidence',
        badgeClass:
          'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200/70 dark:border-emerald-900/60',
        dotClass: 'bg-emerald-500',
        ringClass: 'ring-emerald-500/30',
      };
    case 'FALSE':
      return {
        label: 'False',
        description: 'Contradicted by evidence',
        badgeClass:
          'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200/70 dark:border-rose-900/60',
        dotClass: 'bg-rose-500',
        ringClass: 'ring-rose-500/30',
      };
    case 'INCONCLUSIVE':
      return {
        label: 'Inconclusive',
        description: 'Insufficient or conflicting evidence',
        badgeClass:
          'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200/70 dark:border-amber-900/60',
        dotClass: 'bg-amber-500',
        ringClass: 'ring-amber-500/30',
      };
  }
};

export const HALLUCINATION_LABEL: Record<HallucinationType, { label: string; description: string }> =
  {
    numerical: {
      label: 'Numerical',
      description: 'Wrong number, magnitude, unit, or percentage.',
    },
    citation: {
      label: 'Citation',
      description: 'Fabricated or misattributed source, quote, or study.',
    },
    temporal: { label: 'Temporal', description: 'Wrong date, ordering, or time scope.' },
    logical: {
      label: 'Logical',
      description: 'Internally contradictory or invalid inference.',
    },
    contextual: {
      label: 'Contextual',
      description: 'Ignores or distorts surrounding context.',
    },
    scope_exaggeration: {
      label: 'Scope',
      description: 'Overgeneralises a narrow finding.',
    },
    entity_conflation: {
      label: 'Entity',
      description: 'Confuses two distinct entities.',
    },
    confidence: {
      label: 'Confidence',
      description: 'Presents speculation as certainty.',
    },
  };

export const formatPercent = (value: number): string => `${Math.round(value * 100)}%`;

export const formatMs = (ms: number): string => {
  if (ms < 1_000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1_000).toFixed(1)}s`;
  const m = Math.floor(ms / 60_000);
  const s = Math.round((ms % 60_000) / 1_000);
  return `${m}m ${s}s`;
};

export const formatRelativeTime = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const diff = Date.now() - d.getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

export const stageLabels: Record<string, string> = {
  domain_detection: 'Detecting domain',
  retrieval_initial: 'Retrieving evidence',
  claim_decomposition: 'Decomposing claims',
  claim_verification: 'Verifying claims',
  compliance: 'Safety review',
};

export interface StanceStyle {
  label: string;
  description: string;
  className: string;
  badgeClass: string;
}

export const STANCE_STYLE = {
  supports: {
    label: 'Supports',
    description: 'Evidence directly aligns with the claim.',
    className: 'text-emerald-600 dark:text-emerald-400',
    badgeClass:
      'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200/70 dark:border-emerald-900/60',
  },
  contradicts: {
    label: 'Contradicts',
    description: 'Evidence directly conflicts with the claim.',
    className: 'text-rose-600 dark:text-rose-400',
    badgeClass:
      'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border-rose-200/70 dark:border-rose-900/60',
  },
  neutral: {
    label: 'Neutral',
    description: 'Related but neither supports nor contradicts.',
    className: 'text-muted-foreground',
    badgeClass:
      'bg-muted text-muted-foreground border-border',
  },
} as const satisfies Record<'supports' | 'contradicts' | 'neutral', StanceStyle>;

/**
 * Human labels for the regex-tripwire ids in InjectionSignal.preScanMatches.
 * Keep in sync with backend/src/shared/utils/injection.ts.
 */
export const INJECTION_PATTERN_LABEL: Record<string, string> = {
  ignore_previous: 'Ignore-previous-instructions pattern',
  system_override: 'System / role override',
  reveal_prompt: 'Prompt-disclosure attempt',
  response_override: 'Forced response template',
  fence_escape: 'Data-fence escape attempt',
  jailbreak_dan: 'DAN-style jailbreak',
  role_steal: 'Role-impersonation header',
  json_inject: 'Embedded JSON directive',
};
