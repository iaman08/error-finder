import { env } from '@/lib/env';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatResponse {
  response: string;
  model: string;
  latencyMs: number;
}

export const sendChat = async (
  params: { history: ChatMessage[]; message: string },
  token: string,
): Promise<ChatResponse> => {
  const res = await fetch(`${env.NEXT_PUBLIC_BACKEND_URL}/v1/chat`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(params),
  });
  const text = await res.text();
  const parsed: unknown = text ? safeJson(text) : null;
  if (!res.ok) {
    const err =
      typeof parsed === 'object' &&
      parsed !== null &&
      'error' in parsed &&
      typeof (parsed as { error?: unknown }).error === 'object'
        ? ((parsed as { error: { message?: string } }).error.message ?? 'Chat request failed')
        : 'Chat request failed';
    throw new Error(err);
  }
  return parsed as ChatResponse;
};

const safeJson = (raw: string): unknown => {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};
