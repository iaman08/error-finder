import { ShieldAlert } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { INJECTION_PATTERN_LABEL } from '@/lib/format';
import type { InjectionSignal } from '@/features/verify/schemas';

interface InjectionAlertProps {
  injection: InjectionSignal;
}

/**
 * Security-grade banner for prompt-injection signals. Renders only when
 * either regex pre-scan or LLM self-report flagged something. The visual
 * weight is intentionally heavy — users need to know the verification
 * may have been influenced by adversarial content in the input.
 */
export const InjectionAlert = ({ injection }: InjectionAlertProps) => {
  if (!injection.suspected) return null;

  return (
    <div
      role="alert"
      className="rounded-lg border border-rose-300/80 bg-rose-50 dark:border-rose-900/70 dark:bg-rose-950/40"
    >
      <div className="flex items-start gap-3 p-4">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-rose-100 text-rose-700 dark:bg-rose-950/70 dark:text-rose-300">
          <ShieldAlert className="h-4 w-4" aria-hidden />
        </div>
        <div className="flex-1 min-w-0 space-y-2">
          <div>
            <p className="text-sm font-semibold text-rose-900 dark:text-rose-100">
              Prompt-injection signal detected
            </p>
            <p className="text-xs leading-relaxed text-rose-900/80 dark:text-rose-100/80">
              Adversarial directives were found inside the user input or model response. The
              verifier was instructed to ignore embedded instructions, but treat these verdicts
              with extra scrutiny.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {injection.preScanMatches.length > 0 ? (
              <div className="rounded-md border border-rose-200/70 bg-white/60 px-3 py-2 dark:border-rose-900/60 dark:bg-rose-950/30">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-rose-800/80 dark:text-rose-300/80">
                  Pre-scan tripwires
                </p>
                <ul className="mt-1.5 flex flex-wrap gap-1">
                  {injection.preScanMatches.map((id) => (
                    <Tooltip key={id}>
                      <TooltipTrigger asChild>
                        <Badge
                          variant="destructive"
                          className="cursor-help bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-200"
                        >
                          {id.replaceAll('_', ' ')}
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent>
                        {INJECTION_PATTERN_LABEL[id] ?? 'Adversarial pattern matched'}
                      </TooltipContent>
                    </Tooltip>
                  ))}
                </ul>
              </div>
            ) : null}

            {injection.llmSelfReports > 0 ? (
              <div className="rounded-md border border-rose-200/70 bg-white/60 px-3 py-2 dark:border-rose-900/60 dark:bg-rose-950/30">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-rose-800/80 dark:text-rose-300/80">
                  LLM self-reports
                </p>
                <p className="mt-1 text-sm font-medium text-rose-900 dark:text-rose-100">
                  {injection.llmSelfReports} claim
                  {injection.llmSelfReports === 1 ? '' : 's'} flagged injection inside retrieved
                  evidence.
                </p>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};
