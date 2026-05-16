'use client';

import { History, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { VerdictBadge } from '@/components/results/verdict-badge';
import { useHistory } from '@/features/verify/hooks';
import { clearHistory, removeHistoryEntry } from '@/features/verify/history';
import { formatMs, formatRelativeTime } from '@/lib/format';

export const RunList = () => {
  const items = useHistory();

  if (items.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center gap-2 py-16 text-center">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-muted text-muted-foreground">
            <History className="h-4 w-4" aria-hidden />
          </div>
          <p className="text-sm font-medium">No verification runs yet</p>
          <p className="max-w-sm text-xs text-muted-foreground">
            Your recent verifications will appear here. History is stored locally in your browser.
          </p>
          <Button asChild variant="outline" size="sm" className="mt-2">
            <Link href="/">Start a verification</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {items.length} recent {items.length === 1 ? 'run' : 'runs'} from this device.
        </p>
        <Button
          variant="ghost"
          size="sm"
          onClick={clearHistory}
          className="gap-1.5 text-muted-foreground hover:text-foreground"
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden />
          Clear history
        </Button>
      </div>
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item.correlationId}>
            <Link
              href={`/runs/${encodeURIComponent(item.correlationId)}`}
              className="block rounded-lg border bg-card p-4 transition-colors hover:bg-accent/40 focus-ring"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    {item.overallStatus ? <VerdictBadge status={item.overallStatus} /> : null}
                    {item.detectedDomain ? (
                      <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                        {item.detectedDomain}
                      </span>
                    ) : null}
                    <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                      {item.mode}
                    </span>
                  </div>
                  <p className="line-clamp-2 text-sm text-foreground">{item.userInputPreview}</p>
                </div>
                <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                  <span>{item.claimCount} claims</span>
                  {typeof item.totalMs === 'number' ? <span>{formatMs(item.totalMs)}</span> : null}
                  <span>{formatRelativeTime(item.createdAt)}</span>
                  <button
                    type="button"
                    aria-label="Remove from history"
                    onClick={(e) => {
                      e.preventDefault();
                      removeHistoryEntry(item.correlationId);
                    }}
                    className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground focus-ring"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
};
