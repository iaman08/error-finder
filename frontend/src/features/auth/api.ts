import { env } from '@/lib/env';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
}

export interface AuthResponse {
  token: string;
  user: AuthUser;
}

export interface AuthApiError {
  code: string;
  message: string;
  issues?: ReadonlyArray<{ path: string; message: string }>;
  statusCode: number;
}

const isAuthApiError = (v: unknown): v is AuthApiError =>
  typeof v === 'object' && v !== null && 'code' in v && 'message' in v;

const request = async <T>(path: string, body: unknown): Promise<T> => {
  const res = await fetch(`${env.NEXT_PUBLIC_BACKEND_URL}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  const json: unknown = text ? safeJson(text) : null;
  if (!res.ok) {
    const err =
      typeof json === 'object' &&
      json !== null &&
      'error' in json &&
      typeof (json as { error?: unknown }).error === 'object'
        ? ((json as { error: AuthApiError }).error as AuthApiError)
        : ({ code: 'UNKNOWN_ERROR', message: `Request failed (${res.status})` } as AuthApiError);
    throw { ...err, statusCode: res.status } satisfies AuthApiError;
  }
  return json as T;
};

const safeJson = (raw: string): unknown => {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

export const authApi = {
  register: (input: { email: string; name: string; password: string }): Promise<AuthResponse> =>
    request<AuthResponse>('/v1/auth/register', input),
  login: (input: { email: string; password: string }): Promise<AuthResponse> =>
    request<AuthResponse>('/v1/auth/login', input),
  async me(token: string): Promise<AuthUser> {
    const res = await fetch(`${env.NEXT_PUBLIC_BACKEND_URL}/v1/auth/me`, {
      method: 'GET',
      headers: { authorization: `Bearer ${token}` },
    });
    const text = await res.text();
    const json: unknown = text ? safeJson(text) : null;
    if (!res.ok) {
      const err =
        isAuthApiError(json) ? json : ({ code: 'UNAUTHORIZED', message: 'Not authenticated' } as AuthApiError);
      throw { ...err, statusCode: res.status } satisfies AuthApiError;
    }
    const data = json as { user: AuthUser };
    return data.user;
  },
};
