import { randomUUID } from 'node:crypto';

export const newCorrelationId = (): string => randomUUID();

export const newClaimId = (index: number): string => `claim_${String(index).padStart(3, '0')}`;
