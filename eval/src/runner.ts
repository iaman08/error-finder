import type { EvalCase, CaseResult, RunDoc } from '@/types.js';
import { runDocSchema, submitAcceptedSchema, verifyResponseSchema } from '@/types.js';
import { scoreCase } from '@/scorer.js';

const POLL_INTERVAL_MS = 2_500;

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
    const submitResponse = await fetch(`${options.backendUrl}/v1/verify`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify(testCase.input),
      signal: controller.signal,
    });
    const submitText = await submitResponse.text();
    if (!submitResponse.ok) {
      return {
        caseId: testCase.id,
        category: testCase.category,
        description: testCase.description,
        status: 'error',
        checks: [],
        error: `HTTP ${submitResponse.status}: ${submitText.slice(0, 400)}`,
        durationMs: Date.now() - start,
      };
    }
    const submitParsed = submitAcceptedSchema.safeParse(
      submitText.length > 0 ? safeJsonParse(submitText) : null,
    );
    if (!submitParsed.success) {
      return {
        caseId: testCase.id,
        category: testCase.category,
        description: testCase.description,
        status: 'error',
        checks: [],
        error: `Accept-response schema mismatch: ${submitParsed.error.issues
          .slice(0, 3)
          .map((i) => `${i.path.join('.')}:${i.message}`)
          .join('; ')}`,
        durationMs: Date.now() - start,
      };
    }
    const { correlationId } = submitParsed.data;

    const doc = await pollForRun(options.backendUrl, correlationId, controller.signal);

    if (doc.status === 'failed') {
      return {
        caseId: testCase.id,
        category: testCase.category,
        description: testCase.description,
        status: 'error',
        checks: [],
        error: `Pipeline failed: ${doc.error ?? 'unknown error'}`,
        durationMs: Date.now() - start,
      };
    }

    const parsed = verifyResponseSchema.safeParse({
      correlationId: doc.correlationId,
      detectedDomain: doc.detectedDomain,
      mode: doc.input.mode,
      claims: doc.claims,
      verdicts: doc.verdicts,
      compliance: doc.compliance,
      overallStatus: doc.overallStatus,
      correctedOutput: doc.correctedOutput,
      timings: doc.timings,
      warnings: doc.warnings,
      injection: doc.injection,
    });
    if (!parsed.success) {
      return {
        caseId: testCase.id,
        category: testCase.category,
        description: testCase.description,
        status: 'error',
        checks: [],
        error: `Completed-run schema mismatch: ${parsed.error.issues
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

const pollForRun = async (
  backendUrl: string,
  correlationId: string,
  signal: AbortSignal,
): Promise<RunDoc> => {
  while (true) {
    if (signal.aborted) throw new Error('case timed out while polling');

    const res = await fetch(`${backendUrl}/v1/verify/${encodeURIComponent(correlationId)}`, {
      method: 'GET',
      headers: { accept: 'application/json' },
      signal,
    });
    const text = await res.text();
    if (!res.ok) {
      throw new Error(`Poll HTTP ${res.status}: ${text.slice(0, 200)}`);
    }
    const parsed = runDocSchema.safeParse(text.length > 0 ? safeJsonParse(text) : null);
    if (!parsed.success) {
      throw new Error(
        `Run schema mismatch: ${parsed.error.issues
          .slice(0, 3)
          .map((i) => `${i.path.join('.')}:${i.message}`)
          .join('; ')}`,
      );
    }
    if (parsed.data.status !== 'pending') return parsed.data;

    await sleep(POLL_INTERVAL_MS, signal);
  }
};

const sleep = (ms: number, signal: AbortSignal): Promise<void> =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new Error('case timed out while polling'));
    };
    if (signal.aborted) onAbort();
    else signal.addEventListener('abort', onAbort, { once: true });
  });
