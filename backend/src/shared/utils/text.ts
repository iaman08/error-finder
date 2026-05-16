import { createHash, randomBytes } from 'node:crypto';

/** Lower-cases, collapses whitespace, strips punctuation — used for stable text comparisons. */
export const normalizeText = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export const sha256Hex = (s: string): string => createHash('sha256').update(s).digest('hex');

/**
 * Returns a 12-char hex nonce used as part of content fences to make
 * fence-escape attacks unpredictable for adversarial inputs.
 */
export const randomNonce = (): string => randomBytes(6).toString('hex');

/**
 * Wraps untrusted content in a nonced fence so the model can robustly
 * distinguish data from instructions even if the adversary embeds the
 * literal string "CONTENT>>>".
 */
export const safeDataBlock = (content: string, nonce: string): string =>
  `<<<DATA-${nonce}\n${content}\nDATA-${nonce}>>>`;
