'use client';

import { useMutation, useQuery, type UseMutationResult } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ApiError, verifyApi } from '@/features/verify/api';
import {
  loadHistory,
  saveHistoryEntry,
  type HistoryEntry,
} from '@/features/verify/history';
import type { VerifyRequest, VerifyResponse, RunDoc } from '@/features/verify/schemas';

export const verifyQueryKeys = {
  all: ['verify'] as const,
  run: (id: string) => [...verifyQueryKeys.all, 'run', id] as const,
};

export type VerifyMutation = UseMutationResult<VerifyResponse, ApiError, VerifyRequest>;

export const useVerifyMutation = (): VerifyMutation =>
  useMutation<VerifyResponse, ApiError, VerifyRequest>({
    mutationFn: async (input) => verifyApi.submit(input),
    onSuccess: (result, vars) => {
      const entry: HistoryEntry = {
        correlationId: result.correlationId,
        createdAt: new Date().toISOString(),
        mode: result.mode,
        detectedDomain: result.detectedDomain,
        overallStatus: result.overallStatus,
        userInputPreview: vars.userInput.slice(0, 140),
        claimCount: result.claims.length,
        totalMs: result.timings.totalMs,
      };
      saveHistoryEntry(entry);
    },
    onError: (err) => {
      toast.error('Verification failed', {
        description: err.message || 'An unexpected error occurred',
      });
    },
  });

export const useRunQuery = (correlationId: string | undefined) =>
  useQuery<RunDoc, ApiError>({
    queryKey: correlationId ? verifyQueryKeys.run(correlationId) : ['verify', 'run', 'noop'],
    queryFn: async () => {
      if (!correlationId) throw new Error('No correlation id');
      return verifyApi.getRun(correlationId);
    },
    enabled: Boolean(correlationId),
    staleTime: 5 * 60 * 1_000,
    retry: (failureCount, err) => {
      if (err instanceof ApiError && (err.statusCode === 404 || err.statusCode === 400)) {
        return false;
      }
      return failureCount < 2;
    },
  });

export const useHistory = (): HistoryEntry[] => {
  const [items, setItems] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    const refresh = () => setItems(loadHistory());
    refresh();
    const onChange = () => refresh();
    window.addEventListener('errorfinder:history-change', onChange);
    window.addEventListener('storage', onChange);
    return () => {
      window.removeEventListener('errorfinder:history-change', onChange);
      window.removeEventListener('storage', onChange);
    };
  }, []);

  return items;
};
