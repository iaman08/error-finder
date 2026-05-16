'use client';

import { AlertCircle, ArrowLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { ClaimCard } from '@/components/results/claim-card';
import { CompliancePanel } from '@/components/results/compliance-panel';
import { CorrectedOutput } from '@/components/results/corrected-output';
import { InjectionAlert } from '@/components/results/injection-alert';
import { ResultSummary } from '@/components/results/result-summary';
import { WarningsBanner } from '@/components/results/warnings-banner';
import { useRunQuery } from '@/features/verify/hooks';
import type { RunDoc } from '@/features/verify/schemas';

interface RunDetailProps {
  correlationId: string;
}

export const RunDetail = ({ correlationId }: RunDetailProps) => {
  const { data, isLoading, isError, error } = useRunQuery(correlationId);

  if (isLoading) return <RunDetailSkeleton />;

  if (isError) {
    return (
      <Card className="border-destructive/30">
        <CardContent className="flex items-start gap-3 p-5">
          <div className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-md bg-destructive/10 text-destructive">
            <AlertCircle className="h-4 w-4" aria-hidden />
          </div>
          <div className="flex-1 space-y-2">
            <p className="text-sm font-medium">Could not load this run</p>
            <p className="text-sm text-muted-foreground">{error?.message ?? 'Unknown error'}</p>
            <Button asChild variant="outline" size="sm">
              <Link href="/runs">Back to history</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  return <RunDetailContent run={data} />;
};

const RunDetailContent = ({ run }: { run: RunDoc }) => {
  const verifiedCount = run.verdicts.filter((v) => v.status === 'VERIFIED').length;
  const falseCount = run.verdicts.filter((v) => v.status === 'FALSE').length;
  const inconclusiveCount = run.verdicts.filter((v) => v.status === 'INCONCLUSIVE').length;
  const verdictsByClaimId = new Map(run.verdicts.map((v) => [v.claimId, v]));

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild className="gap-1.5 text-muted-foreground">
          <Link href="/runs">
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
            All runs
          </Link>
        </Button>
      </div>

      {run.status === 'failed' ? (
        <Card className="border-destructive/30">
          <CardContent className="p-5">
            <p className="text-sm font-medium text-destructive">This run failed</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {run.error ?? 'Unknown error from the verification pipeline.'}
            </p>
          </CardContent>
        </Card>
      ) : null}

      {run.injection.suspected ? <InjectionAlert injection={run.injection} /> : null}
      {run.warnings.length > 0 ? <WarningsBanner warnings={run.warnings} /> : null}

      {run.detectedDomain && run.overallStatus && run.timings ? (
        <ResultSummary
          correlationId={run.correlationId}
          overallStatus={run.overallStatus}
          detectedDomain={run.detectedDomain}
          mode={run.input.mode}
          claimCount={run.claims.length}
          verifiedCount={verifiedCount}
          falseCount={falseCount}
          inconclusiveCount={inconclusiveCount}
          timings={run.timings}
        />
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Original input</CardTitle>
          <CardDescription>The user&apos;s question and the AI&apos;s response.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Badge variant="muted">User question</Badge>
            <p className="text-sm whitespace-pre-wrap text-foreground">{run.input.userInput}</p>
          </div>
          <Separator />
          <div className="space-y-1.5">
            <Badge variant="muted">Model response</Badge>
            <pre className="whitespace-pre-wrap rounded-md border bg-muted/40 p-3 font-mono text-[13px] leading-relaxed scrollbar-thin">
              {run.input.modelOutput}
            </pre>
          </div>
        </CardContent>
      </Card>

      {run.claims.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold tracking-tight">
            Atomic claims ({run.claims.length})
          </h2>
          <ul className="space-y-3">
            {run.claims.map((claim, i) => {
              const verdict = verdictsByClaimId.get(claim.id);
              if (!verdict) return null;
              return (
                <li key={claim.id}>
                  <ClaimCard claim={claim} verdict={verdict} index={i} />
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {run.compliance ? <CompliancePanel compliance={run.compliance} /> : null}
      {run.correctedOutput ? <CorrectedOutput text={run.correctedOutput} /> : null}
    </div>
  );
};

const RunDetailSkeleton = () => (
  <div className="space-y-5">
    <Skeleton className="h-8 w-32" />
    <Card>
      <CardContent className="space-y-3 p-5">
        <Skeleton className="h-5 w-40" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-14" />
          ))}
        </div>
      </CardContent>
    </Card>
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} className="h-32" />
      ))}
    </div>
    <p className="flex items-center gap-2 text-xs text-muted-foreground">
      <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
      Loading verification run…
    </p>
  </div>
);
