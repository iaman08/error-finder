import { env } from '@/lib/env';
import {
  apiErrorSchema,
  runDocSchema,
  verifyResponseSchema,
  type RunDoc,
  type VerifyRequest,
  type VerifyResponse,
} from '@/features/verify/schemas';

const DEFAULT_TIMEOUT_MS = 120_000;

export class ApiError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly correlationId?: string;
  public readonly issues?: ReadonlyArray<{ path: string; message: string }>;

  constructor(params: {
    code: string;
    message: string;
    statusCode: number;
    correlationId?: string;
    issues?: ReadonlyArray<{ path: string; message: string }>;
  }) {
    super(params.message);
    this.name = 'ApiError';
    this.code = params.code;
    this.statusCode = params.statusCode;
    if (params.correlationId !== undefined) this.correlationId = params.correlationId;
    if (params.issues !== undefined) this.issues = params.issues;
  }
}

interface RequestOptions {
  method: 'GET' | 'POST';
  path: string;
  body?: unknown;
  signal?: AbortSignal;
  timeoutMs?: number;
}

const request = async <T>(opts: RequestOptions): Promise<T> => {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(new Error('Request timed out')), timeoutMs);

  if (opts.signal) {
    if (opts.signal.aborted) controller.abort(opts.signal.reason);
    else opts.signal.addEventListener('abort', () => controller.abort(opts.signal?.reason));
  }

  try {
    const response = await fetch(`${env.NEXT_PUBLIC_BACKEND_URL}${opts.path}`, {
      method: opts.method,
      headers: {
        'content-type': 'application/json',
        accept: 'application/json',
      },
      ...(opts.body !== undefined ? { body: JSON.stringify(opts.body) } : {}),
      signal: controller.signal,
    });

    const text = await response.text();
    const parsedJson: unknown = text.length > 0 ? safeJsonParse(text) : null;

    if (!response.ok) {
      const err = apiErrorSchema.safeParse(parsedJson);
      if (err.success) {
        throw new ApiError({
          code: err.data.error.code,
          message: err.data.error.message,
          statusCode: response.status,
          ...(err.data.error.correlationId !== undefined
            ? { correlationId: err.data.error.correlationId }
            : {}),
          ...(err.data.error.issues !== undefined ? { issues: err.data.error.issues } : {}),
        });
      }
      throw new ApiError({
        code: 'UNKNOWN_ERROR',
        message: `Request failed with status ${response.status}`,
        statusCode: response.status,
      });
    }

    return parsedJson as T;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new ApiError({
        code: 'TIMEOUT',
        message: 'Request was aborted or timed out',
        statusCode: 0,
      });
    }
    throw new ApiError({
      code: 'NETWORK_ERROR',
      message: err instanceof Error ? err.message : 'Network error',
      statusCode: 0,
    });
  } finally {
    clearTimeout(timeoutId);
  }
};

const safeJsonParse = (raw: string): unknown => {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

export const verifyApi = {
  async submit(input: VerifyRequest, signal?: AbortSignal): Promise<VerifyResponse> {
    const raw = await request<unknown>({
      method: 'POST',
      path: '/v1/verify',
      body: input,
      ...(signal ? { signal } : {}),
    });
    const parsed = verifyResponseSchema.safeParse(raw);
    if (!parsed.success) {
      throw new ApiError({
        code: 'INVALID_RESPONSE',
        message: 'Backend returned an unexpected response shape',
        statusCode: 502,
      });
    }
    return parsed.data;
  },

  async getRun(correlationId: string, signal?: AbortSignal): Promise<RunDoc> {
    const raw = await request<unknown>({
      method: 'GET',
      path: `/v1/verify/${encodeURIComponent(correlationId)}`,
      ...(signal ? { signal } : {}),
    });
    const parsed = runDocSchema.safeParse(raw);
    if (!parsed.success) {
      throw new ApiError({
        code: 'INVALID_RESPONSE',
        message: 'Backend returned an unexpected run shape',
        statusCode: 502,
      });
    }
    return parsed.data;
  },
};
