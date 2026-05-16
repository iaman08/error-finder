export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'LLM_ERROR'
  | 'LLM_RESPONSE_INVALID'
  | 'RETRIEVAL_ERROR'
  | 'PIPELINE_ERROR'
  | 'DB_ERROR'
  | 'NOT_FOUND'
  | 'INTERNAL_ERROR';

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public override readonly cause?: unknown;
  public readonly details?: Record<string, unknown>;

  constructor(
    code: ErrorCode,
    message: string,
    options: { statusCode?: number; cause?: unknown; details?: Record<string, unknown> } = {},
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = options.statusCode ?? defaultStatusForCode(code);
    this.cause = options.cause;
    this.details = options.details;
  }
}

const defaultStatusForCode = (code: ErrorCode): number => {
  switch (code) {
    case 'VALIDATION_ERROR':
      return 400;
    case 'NOT_FOUND':
      return 404;
    case 'LLM_ERROR':
    case 'RETRIEVAL_ERROR':
      return 502;
    case 'LLM_RESPONSE_INVALID':
    case 'PIPELINE_ERROR':
    case 'DB_ERROR':
    case 'INTERNAL_ERROR':
    default:
      return 500;
  }
};

export const isAppError = (err: unknown): err is AppError => err instanceof AppError;
