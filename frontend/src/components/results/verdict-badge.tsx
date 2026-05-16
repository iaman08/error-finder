import { cn } from '@/lib/utils';
import { verdictStyle } from '@/lib/format';
import type { VerdictStatus } from '@/features/verify/schemas';

interface VerdictBadgeProps {
  status: VerdictStatus;
  size?: 'sm' | 'md';
  className?: string;
}

export const VerdictBadge = ({ status, size = 'sm', className }: VerdictBadgeProps) => {
  const style = verdictStyle(status);
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border font-medium',
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm',
        style.badgeClass,
        className,
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', style.dotClass)} aria-hidden />
      {style.label}
    </span>
  );
};
