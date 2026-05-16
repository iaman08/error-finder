import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { HALLUCINATION_LABEL } from '@/lib/format';
import type { HallucinationType } from '@/features/verify/schemas';

interface HallucinationBadgeProps {
  type: HallucinationType;
}

export const HallucinationBadge = ({ type }: HallucinationBadgeProps) => {
  const meta = HALLUCINATION_LABEL[type];
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge variant="destructive" className="cursor-help">
          {meta.label}
        </Badge>
      </TooltipTrigger>
      <TooltipContent>
        <span className="text-xs">{meta.description}</span>
      </TooltipContent>
    </Tooltip>
  );
};
