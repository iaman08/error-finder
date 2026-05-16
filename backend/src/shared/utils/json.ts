import { AppError } from '@/domain/errors.js';

/**
 * Extracts the first balanced JSON object or array from a string.
 * LLMs sometimes wrap JSON in prose or fenced blocks despite instructions —
 * this parser tolerates that while still rejecting structurally invalid output.
 */
export const parseJsonFromLLM = <T = unknown>(raw: string): T => {
  const cleaned = stripCodeFences(raw).trim();

  const candidate = extractBalanced(cleaned);
  if (!candidate) {
    throw new AppError('LLM_RESPONSE_INVALID', 'No JSON object or array found in LLM response', {
      details: { rawLength: raw.length },
    });
  }

  try {
    return JSON.parse(candidate) as T;
  } catch (err) {
    throw new AppError('LLM_RESPONSE_INVALID', 'LLM response is not valid JSON', {
      cause: err,
      details: { candidatePreview: candidate.slice(0, 200) },
    });
  }
};

const stripCodeFences = (input: string): string =>
  input.replace(/^```(?:json)?\s*/i, '').replace(/```$/i, '');

const extractBalanced = (input: string): string | null => {
  const firstObj = input.indexOf('{');
  const firstArr = input.indexOf('[');
  const candidates = [firstObj, firstArr].filter((i) => i >= 0);
  if (candidates.length === 0) return null;
  const start = Math.min(...candidates);
  const opener = input[start];
  const closer = opener === '{' ? '}' : ']';

  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = start; i < input.length; i += 1) {
    const ch = input[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (ch === '\\') {
      escape = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === opener) depth += 1;
    else if (ch === closer) {
      depth -= 1;
      if (depth === 0) return input.slice(start, i + 1);
    }
  }
  return null;
};
