'use client';

import { AlertTriangle, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface WarningsBannerProps {
  warnings: string[];
}

/**
 * Operator-visible warnings emitted by the pipeline (claim dedup, truncation,
 * stance-vs-verdict downgrades, injection pre-scan matches). Intentionally
 * subdued — these aren't user-facing errors, they're audit trail.
 */
export const WarningsBanner = ({ warnings }: WarningsBannerProps) => {
  const [expanded, setExpanded] = useState(warnings.length <= 3);

  if (warnings.length === 0) return null;

  return (
    <aside
      role="status"
      aria-live="polite"
      className="rounded-lg border border-amber-200/70 bg-amber-50/60 dark:border-amber-900/60 dark:bg-amber-950/30"
    >
      <div className="flex items-start gap-2.5 p-4">
        <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300">
          <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
              {warnings.length === 1
                ? 'Pipeline emitted 1 warning'
                : `Pipeline emitted ${warnings.length} warnings`}
            </p>
            {warnings.length > 3 ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setExpanded((v) => !v)}
                className="h-7 gap-1 px-2 text-xs text-amber-700 hover:bg-amber-100/60 dark:text-amber-300 dark:hover:bg-amber-950/40"
                aria-expanded={expanded}
              >
                {expanded ? 'Hide' : 'Show all'}
                <ChevronDown className={cn('h-3 w-3 transition-transform', expanded && 'rotate-180')} aria-hidden />
              </Button>
            ) : null}
          </div>
          {expanded ? (
            <ul className="mt-2 space-y-1 text-xs text-amber-900/90 dark:text-amber-100/90 leading-relaxed">
              {warnings.map((w, i) => (
                <li key={i} className="flex gap-2">
                  <span aria-hidden className="select-none text-amber-700/70 dark:text-amber-400/70">•</span>
                  <span>{w}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-xs text-amber-900/80 dark:text-amber-100/80">
              {warnings[0]}
            </p>
          )}
        </div>
      </div>
    </aside>
  );
};
