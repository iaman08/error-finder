'use client';

import { Check, Copy, Clock, FileCheck2, Layers } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { VerdictBadge } from '@/components/results/verdict-badge';
import type { VerdictStatus, RetrievalMode, Domain, PipelineTimings } from '@/features/verify/schemas';
import { formatMs, stageLabels } from '@/lib/format';

interface ResultSummaryProps {
  correlationId: string;
  overallStatus: VerdictStatus;
  detectedDomain: Domain;
  mode: RetrievalMode;
  claimCount: number;
  verifiedCount: number;
  falseCount: number;
  inconclusiveCount: number;
  timings: PipelineTimings;
}

export const ResultSummary = ({
  correlationId,
  overallStatus,
  detectedDomain,
  mode,
  claimCount,
  verifiedCount,
  falseCount,
  inconclusiveCount,
  timings,
}: ResultSummaryProps) => {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(correlationId);
      setCopied(true);
      toast.success('Correlation ID copied');
      setTimeout(() => setCopied(false), 1_400);
    } catch {
      toast.error('Could not copy to clipboard');
    }
  };

  const stageEntries = Object.entries(timings.perStage).filter(
    (entry): entry is [string, number] => typeof entry[1] === 'number',
  );

  return (
    <Card>
      <CardContent className="space-y-5 p-5 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Overall verdict
            </p>
            <div className="flex items-center gap-3">
              <VerdictBadge status={overallStatus} size="md" />
              <span className="text-sm text-muted-foreground">
                across {claimCount} {claimCount === 1 ? 'claim' : 'claims'}
              </span>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={copy} className="gap-1.5 font-mono text-xs">
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            <span className="truncate max-w-[24ch]">{correlationId}</span>
          </Button>
        </div>

        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Metric label="Domain" value={detectedDomain} icon={Layers} />
          <Metric label="Mode" value={mode} icon={FileCheck2} />
          <Metric label="Total time" value={formatMs(timings.totalMs)} icon={Clock} />
          <Metric
            label="Verified / False / ?"
            value={`${verifiedCount} / ${falseCount} / ${inconclusiveCount}`}
          />
        </dl>

        {stageEntries.length > 0 ? (
          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Stage timings
            </p>
            <ul className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
              {stageEntries.map(([stage, ms]) => (
                <li key={stage} className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground truncate">
                    {stageLabels[stage] ?? stage}
                  </span>
                  <span className="font-mono tabular-nums text-foreground">{formatMs(ms)}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
};

interface MetricProps {
  label: string;
  value: string;
  icon?: React.ComponentType<{ className?: string }>;
}

const Metric = ({ label, value, icon: Icon }: MetricProps) => (
  <div className="rounded-md border bg-card/40 px-3 py-2.5">
    <dt className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">
      {Icon ? <Icon className="h-3 w-3" aria-hidden /> : null}
      {label}
    </dt>
    <dd className="mt-1 text-sm font-medium tabular-nums capitalize">{value}</dd>
  </div>
);
