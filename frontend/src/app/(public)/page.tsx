import type { Metadata } from 'next';
import Link from 'next/link';
import { LineChart, ScanSearch, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { HeroIllustration } from '@/components/public/hero-illustration';
import { DemoPreview } from '@/components/public/demo-preview';

export const metadata: Metadata = {
  title: 'Shien Ai — See Clearly in the Age of AI',
};

const FEATURES = [
  {
    icon: ScanSearch,
    title: 'Deep Source Verification',
    body: 'Atomic-claim decomposition, then evidence retrieval against trusted sources for each statement.',
  },
  {
    icon: ShieldCheck,
    title: 'Semantic Factual Check',
    body: 'Stance-aware reasoning over retrieved evidence to surface fabrications, contradictions, and stale facts.',
  },
  {
    icon: LineChart,
    title: 'Real-Time Confidence Scoring',
    body: 'Per-claim confidence, compliance signals, and corrected output ready to ship to production.',
  },
];

export default function LandingPage() {
  return (
    <div className="relative">
      <section className="relative mx-auto max-w-6xl px-4 pb-16 pt-10 text-center md:px-6 md:pt-16">
        <HeroIllustration className="mx-auto w-full max-w-md md:max-w-lg" />

        <h1 className="mt-2 text-4xl font-semibold leading-[1.1] tracking-tight text-gradient-purple sm:text-5xl md:text-6xl">
          See Clearly in the Age of AI
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-base text-muted-foreground md:text-lg">
          Unmasking hallucinations for reliable, factual AI. Shien Ai&apos;s advanced models detect
          and flag hallucinations in real-time, restoring trust in generated content.
        </p>

        <div className="mt-8 flex items-center justify-center">
          <Button
            asChild
            size="lg"
            className="rounded-full bg-foreground px-6 text-background hover:bg-foreground/90"
          >
            <Link href="/register">Get Started for Free</Link>
          </Button>
        </div>
      </section>

      <section id="platform" className="mx-auto grid max-w-5xl gap-6 px-4 pb-16 md:grid-cols-3 md:px-6">
        {FEATURES.map(({ icon: Icon, title, body }) => (
          <div
            key={title}
            className="rounded-2xl border border-border/60 bg-card/60 p-6 text-center backdrop-blur-sm ring-glow"
          >
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <Icon className="h-6 w-6" aria-hidden />
            </div>
            <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{body}</p>
          </div>
        ))}
      </section>

      <section id="solutions" className="mx-auto max-w-5xl px-4 pb-20 md:px-6">
        <DemoPreview />
      </section>
    </div>
  );
}
