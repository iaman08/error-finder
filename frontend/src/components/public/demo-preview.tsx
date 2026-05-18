import { AlertTriangle } from 'lucide-react';

export const DemoPreview = () => (
  <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-card/70 p-5 backdrop-blur-md ring-glow md:p-7">
    <div className="grid gap-6 md:grid-cols-[1fr_auto] md:items-start">
      <div className="space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Prompt
          </p>
          <p className="mt-1 text-sm text-foreground/90">
            Summarize the latest research from the 2024 ICML paper on
            retrieval-augmented hallucination detection.
          </p>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Response
          </p>
          <p className="mt-1 text-sm leading-relaxed text-foreground/90">
            The Mopmon State maintains a conserved repetition,{' '}
            <mark className="rounded bg-destructive/30 px-1 text-destructive-foreground">
              hallucination detection horizon
            </mark>{' '}
            relative to the generated sentence&apos;s last sentences. It scores
            preparations real-time, restoring trust in generated content.
          </p>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Confidence
          </p>
          <div className="mt-2 h-20 w-full overflow-hidden rounded-lg border border-border/50 bg-background/60 p-2">
            <svg viewBox="0 0 400 80" className="h-full w-full" preserveAspectRatio="none">
              <defs>
                <linearGradient id="conf-area" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#a78bfa" stopOpacity="0.6" />
                  <stop offset="100%" stopColor="#a78bfa" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path
                d="M0 60 Q40 40 80 45 T160 30 T240 50 T320 25 T400 40 L400 80 L0 80 Z"
                fill="url(#conf-area)"
              />
              <path
                d="M0 60 Q40 40 80 45 T160 30 T240 50 T320 25 T400 40"
                stroke="#a78bfa"
                strokeWidth="2"
                fill="none"
              />
            </svg>
          </div>
        </div>
      </div>

      <div className="flex items-start md:max-w-xs">
        <div className="flex items-center gap-2 rounded-xl border border-destructive/40 bg-destructive/15 px-3 py-2 text-xs font-medium text-destructive-foreground">
          <AlertTriangle className="h-4 w-4" aria-hidden />
          Hallucination Detected — Factual Inaccuracy Flagged.
        </div>
      </div>
    </div>
  </div>
);
