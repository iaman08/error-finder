import { ArrowUpRight, CheckCircle2, Circle, ShieldCheck, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { Evidence } from '@/features/verify/schemas';
import { cn } from '@/lib/utils';
import { formatRelativeTime } from '@/lib/format';

interface EvidenceItemProps {
  evidence: Evidence;
  index: number;
}

const stanceMeta = (stance: Evidence['stance']) => {
  switch (stance) {
    case 'supports':
      return {
        icon: CheckCircle2,
        label: 'Supports',
        className: 'text-emerald-600 dark:text-emerald-400',
      };
    case 'contradicts':
      return {
        icon: XCircle,
        label: 'Contradicts',
        className: 'text-rose-600 dark:text-rose-400',
      };
    case 'neutral':
    default:
      return {
        icon: Circle,
        label: 'Neutral',
        className: 'text-muted-foreground',
      };
  }
};

export const EvidenceItem = ({ evidence, index }: EvidenceItemProps) => {
  const stance = stanceMeta(evidence.stance);
  const StanceIcon = stance.icon;
  return (
    <li className="group rounded-md border bg-background/60 p-3 transition-colors hover:bg-accent/40">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded text-[10px] font-medium text-muted-foreground bg-muted">
          {index + 1}
        </span>
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <a
              href={evidence.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm font-medium text-foreground hover:underline focus-ring rounded-sm"
            >
              <span className="truncate max-w-[36ch]">
                {evidence.title || evidence.source}
              </span>
              <ArrowUpRight className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden />
            </a>
            <span
              className={cn('inline-flex items-center gap-1 text-xs font-medium', stance.className)}
            >
              <StanceIcon className="h-3.5 w-3.5" aria-hidden />
              {stance.label}
            </span>
            {evidence.trusted ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="default" className="cursor-help gap-1">
                    <ShieldCheck className="h-3 w-3" aria-hidden />
                    Trusted
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>Source matches the trusted-domain allowlist for this domain.</TooltipContent>
              </Tooltip>
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">
            {evidence.snippet}
          </p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            <span className="font-mono">{evidence.source}</span>
            {evidence.publishedAt ? <span>Published {evidence.publishedAt}</span> : null}
            <span>Retrieved {formatRelativeTime(evidence.retrievedAt)}</span>
            <span className="tabular-nums">Relevance {Math.round(evidence.relevanceScore * 100)}%</span>
          </div>
        </div>
      </div>
    </li>
  );
};
