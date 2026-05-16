'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, Repeat2 } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ConfidenceMeter } from '@/components/results/confidence-meter';
import { EvidenceGroup } from '@/components/results/evidence-group';
import { HallucinationBadge } from '@/components/results/hallucination-badge';
import { VerdictBadge } from '@/components/results/verdict-badge';
import type { AtomicClaim, ClaimVerdict } from '@/features/verify/schemas';
import { cn } from '@/lib/utils';

interface ClaimCardProps {
  claim: AtomicClaim;
  verdict: ClaimVerdict;
  index: number;
  defaultOpen?: boolean;
}

export const ClaimCard = ({ claim, verdict, index, defaultOpen = false }: ClaimCardProps) => {
  const [open, setOpen] = useState(defaultOpen);
  const hasEvidence = verdict.evidenceUsed.length > 0;
  const hasCorrection = Boolean(verdict.correction);

  return (
    <article
      className={cn(
        'overflow-hidden rounded-lg border bg-card text-card-foreground shadow-sm',
        'transition-shadow hover:shadow-md',
      )}
    >
      <header className="flex flex-col gap-3 p-4 md:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-medium text-muted-foreground">
              {index + 1}
            </span>
            <div className="min-w-0 space-y-1">
              <p className="text-sm font-medium leading-snug text-foreground break-words">
                {claim.text}
              </p>
              {claim.temporalContext ? (
                <p className="text-xs text-muted-foreground">
                  Temporal scope: <span className="font-mono">{claim.temporalContext}</span>
                </p>
              ) : null}
            </div>
          </div>
          <VerdictBadge status={verdict.status} />
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <ConfidenceMeter value={verdict.confidence} status={verdict.status} />
          {verdict.iterations > 0 ? (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Repeat2 className="h-3.5 w-3.5" aria-hidden />
              {verdict.iterations} retrieval {verdict.iterations === 1 ? 'pass' : 'passes'}
            </span>
          ) : null}
          {verdict.hallucinationTypes.length > 0 ? (
            <div className="flex flex-wrap items-center gap-1">
              {verdict.hallucinationTypes.map((t) => (
                <HallucinationBadge key={t} type={t} />
              ))}
            </div>
          ) : null}
          {!claim.isCheckable ? (
            <Badge variant="muted" className="ml-auto">
              Non-checkable
            </Badge>
          ) : null}
        </div>

        {hasCorrection ? (
          <div className="rounded-md border border-amber-200/70 bg-amber-50/60 p-3 text-sm dark:border-amber-900/60 dark:bg-amber-950/30">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">
              Suggested correction
            </p>
            <p className="mt-1 text-sm text-amber-900 dark:text-amber-100 leading-relaxed">
              {verdict.correction}
            </p>
          </div>
        ) : null}
      </header>

      <Separator />

      <div className="px-4 md:px-5">
        <Button
          variant="ghost"
          size="sm"
          className="h-9 w-full justify-between px-1 text-xs text-muted-foreground hover:text-foreground"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls={`claim-${claim.id}-details`}
        >
          <span>
            {open ? 'Hide reasoning & evidence' : 'Show reasoning & evidence'}
            {hasEvidence ? ` (${verdict.evidenceUsed.length})` : ''}
          </span>
          <ChevronDown
            className={cn('h-4 w-4 transition-transform', open && 'rotate-180')}
            aria-hidden
          />
        </Button>
      </div>

      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            id={`claim-${claim.id}-details`}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <div className="space-y-4 px-4 pb-5 pt-2 md:px-5">
              <section>
                <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Reasoning
                </h4>
                <p className="mt-1.5 text-sm leading-relaxed text-foreground whitespace-pre-wrap">
                  {verdict.reasoning}
                </p>
              </section>

              <section>
                <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Evidence
                </h4>
                <EvidenceGroup evidence={verdict.evidenceUsed} />
              </section>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </article>
  );
};
