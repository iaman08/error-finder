'use client';

import { Building2, Globe } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { RetrievalMode } from '@/features/verify/schemas';

interface ModeToggleProps {
  value: RetrievalMode;
  onChange: (value: RetrievalMode) => void;
  disabled?: boolean;
}

export const ModeToggle = ({ value, onChange, disabled }: ModeToggleProps) => (
  <Tabs
    value={value}
    onValueChange={(v) => onChange(v as RetrievalMode)}
    aria-label="Retrieval mode"
  >
    <TabsList className="grid w-full max-w-xs grid-cols-2">
      <Tooltip>
        <TooltipTrigger asChild>
          <TabsTrigger value="standard" disabled={disabled} className="gap-1.5">
            <Globe className="h-3.5 w-3.5" aria-hidden />
            Standard
          </TabsTrigger>
        </TooltipTrigger>
        <TooltipContent>Broad web search with untrusted-host filtering.</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <TabsTrigger value="professional" disabled={disabled} className="gap-1.5">
            <Building2 className="h-3.5 w-3.5" aria-hidden />
            Professional
          </TabsTrigger>
        </TooltipTrigger>
        <TooltipContent>
          Authoritative sources only — PubMed, SEC, RBI, gov sites, peer-reviewed journals.
        </TooltipContent>
      </Tooltip>
    </TabsList>
  </Tabs>
);
