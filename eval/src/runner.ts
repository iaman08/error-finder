import type { EvalCase, CaseResult } from '@/types.js';
import { verifyResponseSchema } from '@/types.js';
import { scoreCase } from '@/scorer.js';

export interface RunnerOptions {
  backendUrl: string;
  concurrency: number;
  timeoutMs: number;
  onCaseStart?: (testCase: EvalCase) => void;
  onCaseEnd?: (result: CaseResult) => void;
}

export const runCases = async (
  cases: EvalCase[],
  options: RunnerOptions,
): Promise<CaseResult[]> => {
  const results: CaseResult[] = new Array(cases.length);
  let cursor = 0;

  const runOne = async (): Promise<void> => {
    while (true) {
      const idx = cursor;
      cursor += 1;
      if (idx >= cases.length) return;
      const testCase = cases[idx];
      if (!testCase) return;
      options.onCaseStart?.(testCase);
      const result = await executeCase(testCase, options);
      results[idx] = result;
      options.onCaseEnd?.(result);
    }
  };

  const lanes = Math.max(1, Math.min(options.concurrency, cases.length));
  await Promise.all(Array.from({ length: lanes }, runOne));

  return results;
};

const executeCase = async (
  testCase: EvalCase,
  options: RunnerOptions,
): Promise<CaseResult> => {
  const start = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(new Error('case timed out')),
    options.timeoutMs,
  );

  try {
    const response = await fetch(`${options.backendUrl}/v1/verify`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify(testCase.input),
      signal: controller.signal,
    });

    const text = await response.text();
    if (!response.ok) {
      return {
        caseId: testCase.id,
        category: testCase.category,
        description: testCase.description,
        status: 'error',
        checks: [],
        error: `HTTP ${response.status}: ${text.slice(0, 400)}`,
        durationMs: Date.now() - start,
      };
    }

    const raw: unknown = text.length > 0 ? safeJsonParse(text) : null;
    const parsed = verifyResponseSchema.safeParse(raw);
    if (!parsed.success) {
      return {
        caseId: testCase.id,
        category: testCase.category,
        description: testCase.description,
        status: 'error',
        checks: [],
        error: `Response schema mismatch: ${parsed.error.issues
          .slice(0, 3)
          .map((i) => `${i.path.join('.')}:${i.message}`)
          .join('; ')}`,
        durationMs: Date.now() - start,
      };
    }

    const checks = scoreCase(testCase, parsed.data);
    const allPassed = checks.length > 0 && checks.every((c) => c.passed);
    const result: CaseResult = {
      caseId: testCase.id,
      category: testCase.category,
      description: testCase.description,
      status: allPassed ? 'pass' : 'fail',
      checks,
      response: parsed.data,
      durationMs: Date.now() - start,
    };
    return result;
  } catch (err) {
    return {
      caseId: testCase.id,
      category: testCase.category,
      description: testCase.description,
      status: 'error',
      checks: [],
      error: err instanceof Error ? err.message : String(err),
      durationMs: Date.now() - start,
    };
  } finally {
    clearTimeout(timeout);
  }
};

const safeJsonParse = (raw: string): unknown => {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};
