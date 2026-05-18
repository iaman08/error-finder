'use client';

import { Building2, Globe } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { RetrievalMode } from '@/features/verify/schemas';

interface ModeToggleProps {
  value: RetrievalMode;
  onChange: (value: RetrievalMode) => void;
  disabled?: boolean;
}

const OPTIONS: Array<{
  value: RetrievalMode;
  label: string;
  icon: typeof Globe;
  hint: string;
}> = [
  {
    value: 'standard',
    label: 'Standard',
    icon: Globe,
    hint: 'Broad web search with untrusted-host filtering.',
  },
  {
    value: 'professional',
    label: 'Professional',
    icon: Building2,
    hint: 'Authoritative sources only — PubMed, SEC, RBI, gov sites, peer-reviewed journals.',
  },
];

export const ModeToggle = ({ value, onChange, disabled }: ModeToggleProps) => (
  <div
    role="radiogroup"
    aria-label="Retrieval mode"
    className="inline-flex h-9 w-full max-w-xs items-center rounded-md border bg-muted p-1 text-muted-foreground"
  >
    {OPTIONS.map((opt) => {
      const Icon = opt.icon;
      const selected = value === opt.value;
      return (
        <button
          key={opt.value}
          type="button"
          role="radio"
          aria-checked={selected}
          title={opt.hint}
          disabled={disabled}
          onClick={() => onChange(opt.value)}
          className={cn(
            'flex flex-1 items-center justify-center gap-1.5 rounded-sm px-3 py-1 text-sm font-medium transition-colors focus-ring',
            'disabled:cursor-not-allowed disabled:opacity-50',
            selected
              ? 'bg-background text-foreground shadow-sm'
              : 'hover:bg-background/40 hover:text-foreground',
          )}
        >
          <Icon className="h-3.5 w-3.5" aria-hidden />
          {opt.label}
        </button>
      );
    })}
  </div>
);
