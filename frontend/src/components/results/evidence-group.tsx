import { CheckCircle2, Circle, XCircle } from 'lucide-react';
import { EvidenceItem } from '@/components/results/evidence-item';
import { STANCE_STYLE } from '@/lib/format';
import type { Evidence, EvidenceStance } from '@/features/verify/schemas';

interface EvidenceGroupProps {
  evidence: Evidence[];
}

const STANCE_ORDER: EvidenceStance[] = ['contradicts', 'supports', 'neutral'];

const STANCE_ICON: Record<EvidenceStance, React.ComponentType<{ className?: string }>> = {
  supports: CheckCircle2,
  contradicts: XCircle,
  neutral: Circle,
};

/**
 * Renders evidence grouped by stance. Contradicting evidence appears first by
 * design — when a claim is verified, surfacing dissenting sources prominently
 * is what builds trust. Within a group, ordering preserves the verifier's
 * original ranking (trusted-first, then relevance) from the API.
 */
export const EvidenceGroup = ({ evidence }: EvidenceGroupProps) => {
  if (evidence.length === 0) {
    return <p className="text-xs text-muted-foreground">No supporting evidence retrieved.</p>;
  }

  const byStance: Record<EvidenceStance, Evidence[]> = {
    supports: [],
    contradicts: [],
    neutral: [],
  };
  for (const e of evidence) byStance[e.stance].push(e);

  const trustedCount = evidence.filter((e) => e.trusted).length;
  const uniqueSources = new Set(evidence.map((e) => e.source)).size;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
        <span>
          <strong className="font-semibold text-foreground tabular-nums">{evidence.length}</strong>{' '}
          piece{evidence.length === 1 ? '' : 's'}
        </span>
        <span>
          <strong className="font-semibold text-foreground tabular-nums">{uniqueSources}</strong>{' '}
          unique source{uniqueSources === 1 ? '' : 's'}
        </span>
        <span>
          <strong className="font-semibold text-foreground tabular-nums">{trustedCount}</strong>{' '}
          trusted
        </span>
      </div>

      {STANCE_ORDER.map((stance) => {
        const items = byStance[stance];
        if (items.length === 0) return null;
        const style = STANCE_STYLE[stance];
        const Icon = STANCE_ICON[stance];
        return (
          <section key={stance} aria-label={`${style.label} evidence`}>
            <header className={`mb-1.5 flex items-center gap-1.5 text-xs font-semibold ${style.className}`}>
              <Icon className="h-3.5 w-3.5" aria-hidden />
              <span>{style.label}</span>
              <span className="text-muted-foreground font-normal tabular-nums">({items.length})</span>
            </header>
            <ul className="space-y-2">
              {items.map((e, i) => (
                <EvidenceItem key={`${e.url}-${i}`} evidence={e} index={i} />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
};
