'use client';

import { Sparkles } from 'lucide-react';
import { useEffect, useState, type FormEvent, type KeyboardEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ModeToggle } from '@/components/verify/mode-toggle';
import {
  DOMAINS,
  verifyRequestSchema,
  type Domain,
  type RetrievalMode,
  type VerifyRequest,
} from '@/features/verify/schemas';

interface VerifyFormProps {
  onSubmit: (input: VerifyRequest) => void;
  isSubmitting: boolean;
  /** Optional initial form values. When changed, re-mount the form with a `key`. */
  defaults?: VerifyRequest;
}

interface FormState {
  userInput: string;
  modelOutput: string;
  mode: RetrievalMode;
  domainOverride: 'auto' | Domain;
}

const EMPTY_STATE: FormState = {
  userInput: '',
  modelOutput: '',
  mode: 'standard',
  domainOverride: 'auto',
};

const toFormState = (defaults: VerifyRequest | undefined): FormState =>
  defaults
    ? {
        userInput: defaults.userInput,
        modelOutput: defaults.modelOutput,
        mode: defaults.mode,
        domainOverride: defaults.domainOverride ?? 'auto',
      }
    : EMPTY_STATE;

export const VerifyForm = ({ onSubmit, isSubmitting, defaults }: VerifyFormProps) => {
  const [form, setForm] = useState<FormState>(() => toFormState(defaults));
  const [errors, setErrors] = useState<Partial<Record<keyof VerifyRequest, string>>>({});

  useEffect(() => {
    setErrors({});
  }, [form.userInput, form.modelOutput]);

  const handleSubmit = (e?: FormEvent) => {
    e?.preventDefault();
    const candidate: Partial<VerifyRequest> = {
      userInput: form.userInput.trim(),
      modelOutput: form.modelOutput.trim(),
      mode: form.mode,
    };
    if (form.domainOverride !== 'auto') {
      candidate.domainOverride = form.domainOverride;
    }
    const parsed = verifyRequestSchema.safeParse(candidate);
    if (!parsed.success) {
      const next: Partial<Record<keyof VerifyRequest, string>> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof VerifyRequest | undefined;
        if (key) next[key] = issue.message;
      }
      setErrors(next);
      return;
    }
    setErrors({});
    onSubmit(parsed.data);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>New verification</CardTitle>
        <CardDescription>
          Paste the original user question and the AI&apos;s response. We&apos;ll decompose it into
          atomic claims and verify each against authoritative sources.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-5" onSubmit={handleSubmit} noValidate>
          <div className="space-y-2">
            <div className="flex items-baseline justify-between">
              <Label htmlFor="userInput">User question</Label>
              <span className="text-[11px] text-muted-foreground tabular-nums">
                {form.userInput.length} / 20,000
              </span>
            </div>
            <Textarea
              id="userInput"
              placeholder="What did the user ask the AI?"
              rows={3}
              value={form.userInput}
              onChange={(e) => setForm((s) => ({ ...s, userInput: e.target.value }))}
              onKeyDown={handleKeyDown}
              disabled={isSubmitting}
              aria-invalid={Boolean(errors.userInput) || undefined}
              aria-describedby={errors.userInput ? 'userInput-error' : undefined}
            />
            {errors.userInput ? (
              <p id="userInput-error" className="text-xs text-destructive">
                {errors.userInput}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <div className="flex items-baseline justify-between">
              <Label htmlFor="modelOutput">Model response</Label>
              <span className="text-[11px] text-muted-foreground tabular-nums">
                {form.modelOutput.length} / 30,000
              </span>
            </div>
            <Textarea
              id="modelOutput"
              placeholder="Paste the AI's response to verify..."
              rows={8}
              value={form.modelOutput}
              onChange={(e) => setForm((s) => ({ ...s, modelOutput: e.target.value }))}
              onKeyDown={handleKeyDown}
              disabled={isSubmitting}
              aria-invalid={Boolean(errors.modelOutput) || undefined}
              aria-describedby={errors.modelOutput ? 'modelOutput-error' : undefined}
              className="font-mono text-[13px] leading-relaxed"
            />
            {errors.modelOutput ? (
              <p id="modelOutput-error" className="text-xs text-destructive">
                {errors.modelOutput}
              </p>
            ) : null}
          </div>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="space-y-2">
              <Label className="block">Retrieval mode</Label>
              <ModeToggle
                value={form.mode}
                onChange={(mode) => setForm((s) => ({ ...s, mode }))}
                disabled={isSubmitting}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="domain">Domain</Label>
              <select
                id="domain"
                value={form.domainOverride}
                onChange={(e) =>
                  setForm((s) => ({ ...s, domainOverride: e.target.value as 'auto' | Domain }))
                }
                disabled={isSubmitting}
                className="flex h-9 w-full min-w-40 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-ring disabled:opacity-50"
              >
                <option value="auto">Auto-detect</option>
                {DOMAINS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center justify-between border-t pt-4">
            <p className="text-[11px] text-muted-foreground">
              Press <kbd className="rounded border bg-muted px-1 py-0.5 font-mono text-[10px]">⌘ Enter</kbd> to submit.
            </p>
            <Button type="submit" disabled={isSubmitting} className="gap-1.5">
              <Sparkles className="h-4 w-4" aria-hidden />
              {isSubmitting ? 'Verifying…' : 'Verify response'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};
