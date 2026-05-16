import { AlertTriangle, ShieldCheck } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { ComplianceVerdict } from '@/features/verify/schemas';

interface CompliancePanelProps {
  compliance: ComplianceVerdict;
}

export const CompliancePanel = ({ compliance }: CompliancePanelProps) => {
  const Icon = compliance.safe ? ShieldCheck : AlertTriangle;
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start gap-2.5">
          <div
            className={
              compliance.safe
                ? 'mt-0.5 flex h-7 w-7 items-center justify-center rounded-md bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                : 'mt-0.5 flex h-7 w-7 items-center justify-center rounded-md bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
            }
          >
            <Icon className="h-4 w-4" aria-hidden />
          </div>
          <div className="flex-1">
            <CardTitle>{compliance.safe ? 'Safety review: passed' : 'Safety review: flagged'}</CardTitle>
            <CardDescription>
              Compliance analysis runs independently of factual verification.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {compliance.flags.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {compliance.flags.map((flag) => (
              <Badge key={flag} variant="destructive">
                {flag.replaceAll('_', ' ')}
              </Badge>
            ))}
          </div>
        ) : null}
        <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">
          {compliance.reasoning}
        </p>
      </CardContent>
    </Card>
  );
};
