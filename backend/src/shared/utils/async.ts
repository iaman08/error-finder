export interface RetryOptions {
  retries: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  shouldRetry?: (error: unknown, attempt: number) => boolean;
  onRetry?: (error: unknown, attempt: number) => void;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export const withRetry = async <T>(
  fn: () => Promise<T>,
  options: RetryOptions,
): Promise<T> => {
  const { retries, baseDelayMs = 250, maxDelayMs = 4_000, shouldRetry, onRetry } = options;
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const retryable = shouldRetry ? shouldRetry(err, attempt) : true;
      if (!retryable || attempt === retries) break;
      onRetry?.(err, attempt);
      const jitter = Math.random() * baseDelayMs;
      const delay = Math.min(maxDelayMs, baseDelayMs * 2 ** attempt + jitter);
      await sleep(delay);
    }
  }
  throw lastError;
};

export const withTimeout = async <T>(
  promise: Promise<T>,
  ms: number,
  label = 'operation',
): Promise<T> => {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
};

export const mapConcurrent = async <T, R>(
  items: readonly T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> => {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  const runOne = async (): Promise<void> => {
    while (true) {
      const i = nextIndex;
      nextIndex += 1;
      if (i >= items.length) return;
      const item = items[i];
      if (item === undefined) return;
      results[i] = await worker(item, i);
    }
  };

  const lanes = Math.max(1, Math.min(concurrency, items.length));
  await Promise.all(Array.from({ length: lanes }, runOne));
  return results;
};
