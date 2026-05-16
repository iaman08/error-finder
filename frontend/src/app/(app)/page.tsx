'use client';

import { useState } from 'react';
import { EmptyResult } from '@/components/verify/empty-result';
import { VerifyError } from '@/components/verify/verify-error';
import { VerifyForm } from '@/components/verify/verify-form';
import { VerifyProgress } from '@/components/verify/verify-progress';
import { ResultView } from '@/components/results/result-view';
import type { VerifyExample } from '@/features/verify/examples';
import { useVerifyMutation } from '@/features/verify/hooks';
import type { VerifyRequest } from '@/features/verify/schemas';

interface FormSeed {
  /** Monotonic id used as the form's React key — bumping it re-mounts the form. */
  key: number;
  defaults?: VerifyRequest;
}

export default function VerifyPage() {
  const mutation = useVerifyMutation();
  const [lastInput, setLastInput] = useState<VerifyRequest | null>(null);
  const [seed, setSeed] = useState<FormSeed>({ key: 0 });

  const handleSubmit = (input: VerifyRequest) => {
    setLastInput(input);
    mutation.mutate(input);
  };

  const retry = () => {
    if (lastInput) mutation.mutate(lastInput);
  };

  const handleExample = (example: VerifyExample) => {
    setSeed((prev) => ({ key: prev.key + 1, defaults: example.input }));
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <div className="grid gap-6">
      <VerifyForm
        key={seed.key}
        defaults={seed.defaults}
        onSubmit={handleSubmit}
        isSubmitting={mutation.isPending}
      />
      <VerifyProgress active={mutation.isPending} />
      {mutation.isError ? (
        <VerifyError error={mutation.error} onRetry={retry} />
      ) : mutation.data ? (
        <ResultView result={mutation.data} />
      ) : (
        !mutation.isPending && <EmptyResult onSelectExample={handleExample} />
      )}
    </div>
  );
}
