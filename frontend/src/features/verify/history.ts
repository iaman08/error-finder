import { z } from 'zod';
import { VERDICT_STATUSES, RETRIEVAL_MODES, DOMAINS } from '@/features/verify/schemas';

const STORAGE_KEY = 'errorfinder.history.v1';
const MAX_ENTRIES = 50;

const historyEntrySchema = z.object({
  correlationId: z.string(),
  createdAt: z.string(),
  mode: z.enum(RETRIEVAL_MODES),
  detectedDomain: z.enum(DOMAINS).optional(),
  overallStatus: z.enum(VERDICT_STATUSES).optional(),
  userInputPreview: z.string(),
  claimCount: z.number().int().min(0),
  totalMs: z.number().min(0).optional(),
});

const historySchema = z.array(historyEntrySchema);

export type HistoryEntry = z.infer<typeof historyEntrySchema>;

const isBrowser = (): boolean => typeof window !== 'undefined' && typeof localStorage !== 'undefined';

export const loadHistory = (): HistoryEntry[] => {
  if (!isBrowser()) return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = historySchema.safeParse(JSON.parse(raw));
    if (!parsed.success) {
      localStorage.removeItem(STORAGE_KEY);
      return [];
    }
    return parsed.data;
  } catch {
    return [];
  }
};

export const saveHistoryEntry = (entry: HistoryEntry): void => {
  if (!isBrowser()) return;
  const current = loadHistory();
  const without = current.filter((e) => e.correlationId !== entry.correlationId);
  const next = [entry, ...without].slice(0, MAX_ENTRIES);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent('errorfinder:history-change'));
  } catch {
    // Storage quota or disabled — silently ignore.
  }
};

export const removeHistoryEntry = (correlationId: string): void => {
  if (!isBrowser()) return;
  const next = loadHistory().filter((e) => e.correlationId !== correlationId);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent('errorfinder:history-change'));
  } catch {
    // ignore
  }
};

export const clearHistory = (): void => {
  if (!isBrowser()) return;
  localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new CustomEvent('errorfinder:history-change'));
};
