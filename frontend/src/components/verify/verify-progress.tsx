'use client';

import { Check, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

const STAGES: ReadonlyArray<{ id: string; label: string; etaMs: number }> = [
  { id: 'domain_detection', label: 'Detecting domain', etaMs: 1_500 },
  { id: 'retrieval_initial', label: 'Retrieving evidence', etaMs: 6_000 },
  { id: 'claim_decomposition', label: 'Decomposing claims', etaMs: 5_000 },
  { id: 'claim_verification', label: 'Verifying claims', etaMs: 18_000 },
  { id: 'compliance', label: 'Safety review', etaMs: 4_000 },
];

interface VerifyProgressProps {
  active: boolean;
}

/**
 * Client-side staged progress indicator. Times are an approximation —
 * the real pipeline runs in parallel and stage timings vary. When the
 * backend supports server-sent events, swap this for a real subscription.
 */
export const VerifyProgress = ({ active }: VerifyProgressProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    if (!active) {
      setCurrentIndex(0);
      setElapsedMs(0);
      return;
    }
    let cumulative = 0;
    const timeline = STAGES.map((s) => ({ ...s, ends: (cumulative += s.etaMs) }));
    const start = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - start;
      setElapsedMs(elapsed);
      const idx = timeline.findIndex((s) => elapsed < s.ends);
      setCurrentIndex(idx === -1 ? STAGES.length - 1 : idx);
    }, 300);
    return () => clearInterval(interval);
  }, [active]);

  if (!active) return null;

  return (
    <div className="rounded-lg border bg-card/40 p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">Running verification pipeline</p>
          <p className="text-xs text-muted-foreground">
            Decomposing the response and checking each claim against retrieved evidence.
          </p>
        </div>
        <span className="font-mono text-xs tabular-nums text-muted-foreground">
          {(elapsedMs / 1_000).toFixed(1)}s
        </span>
      </div>
      <ol className="mt-4 space-y-1.5">
        {STAGES.map((stage, i) => {
          const status: 'done' | 'active' | 'pending' =
            i < currentIndex ? 'done' : i === currentIndex ? 'active' : 'pending';
          return (
            <li
              key={stage.id}
              className={cn(
                'flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm',
                status === 'active' && 'bg-accent/50',
              )}
              aria-current={status === 'active' ? 'step' : undefined}
            >
              <StageIcon status={status} />
              <span
                className={cn(
                  'flex-1',
                  status === 'pending' && 'text-muted-foreground',
                  status === 'done' && 'text-muted-foreground line-through decoration-1',
                )}
              >
                {stage.label}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
};

const StageIcon = ({ status }: { status: 'done' | 'active' | 'pending' }) => {
  if (status === 'done') {
    return (
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
        <Check className="h-3 w-3" aria-hidden />
      </span>
    );
  }
  if (status === 'active') {
    return (
      <motion.span
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"
        initial={{ scale: 0.9 }}
        animate={{ scale: 1 }}
      >
        <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
      </motion.span>
    );
  }
  return <span className="h-5 w-5 shrink-0 rounded-full border border-dashed border-muted-foreground/40" />;
};
