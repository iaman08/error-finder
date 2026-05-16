import { AlertCircle, RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ApiError } from '@/features/verify/api';

interface VerifyErrorProps {
  error: ApiError | Error;
  onRetry: () => void;
}

export const VerifyError = ({ error, onRetry }: VerifyErrorProps) => {
  const isApi = error instanceof ApiError;
  return (
    <Card className="border-destructive/30">
      <CardContent className="flex items-start gap-3 p-5">
        <div className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-md bg-destructive/10 text-destructive">
          <AlertCircle className="h-4 w-4" aria-hidden />
        </div>
        <div className="flex-1 space-y-2">
          <div>
            <p className="text-sm font-medium">Verification failed</p>
            <p className="text-sm text-muted-foreground">{error.message}</p>
          </div>
          {isApi && error.code ? (
            <p className="font-mono text-[11px] text-muted-foreground">
              {error.code}
              {error.correlationId ? ` · ${error.correlationId}` : ''}
            </p>
          ) : null}
          <Button variant="outline" size="sm" onClick={onRetry} className="gap-1.5">
            <RotateCw className="h-3.5 w-3.5" aria-hidden />
            Try again
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
