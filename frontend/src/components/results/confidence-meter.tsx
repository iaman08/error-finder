import { cn } from '@/lib/utils';
import { verdictStyle, formatPercent } from '@/lib/format';
import type { VerdictStatus } from '@/features/verify/schemas';

interface ConfidenceMeterProps {
  value: number;
  status: VerdictStatus;
  showLabel?: boolean;
  className?: string;
}

export const ConfidenceMeter = ({
  value,
  status,
  showLabel = true,
  className,
}: ConfidenceMeterProps) => {
  const pct = Math.max(0, Math.min(1, value));
  const style = verdictStyle(status);
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div
        className="h-1.5 w-24 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={Math.round(pct * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Confidence ${formatPercent(pct)}`}
      >
        <div
          className={cn('h-full transition-[width] duration-500', style.dotClass)}
          style={{ width: `${pct * 100}%` }}
        />
      </div>
      {showLabel ? (
        <span className="text-xs text-muted-foreground tabular-nums">{formatPercent(pct)}</span>
      ) : null}
    </div>
  );
};
