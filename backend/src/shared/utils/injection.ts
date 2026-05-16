/**
 * Pattern-based prompt-injection tripwires.
 *
 * This is a defense-in-depth signal, NOT a hard block. We surface the matches
 * to operators (logs/audit) and pass an `injectionSuspected` flag through
 * the pipeline so downstream stages can be more skeptical. The verifier
 * LLM is also asked to set its own injection flag — agreement between the
 * two raises confidence in the detection.
 *
 * Patterns are intentionally narrow to keep false positives low.
 */

const PATTERNS: ReadonlyArray<{ id: string; rx: RegExp }> = [
  { id: 'ignore_previous', rx: /\bignore\s+(?:all\s+)?(?:previous|prior|above)\s+(?:instructions|prompts|messages|rules)\b/i },
  { id: 'system_override', rx: /\b(?:you\s+are\s+now|act\s+as|pretend\s+to\s+be|roleplay\s+as)\b/i },
  { id: 'reveal_prompt', rx: /\b(?:reveal|show|print|expose|leak)\s+(?:the\s+)?(?:system\s+)?(?:prompt|instructions|rules)\b/i },
  { id: 'response_override', rx: /\brespond\s+(?:only\s+)?(?:with|using)\s+["']?[A-Z_]{4,}["']?/i },
  { id: 'fence_escape', rx: /(?:DATA-[a-f0-9]{12}>{3}|CONTENT>{3}|END\s+OF\s+(?:DATA|CONTENT))/i },
  { id: 'jailbreak_dan', rx: /\b(?:DAN|do\s+anything\s+now|developer\s+mode|jailbroken)\b/i },
  { id: 'role_steal', rx: /\b(?:assistant|system)\s*:\s*\S/i },
  { id: 'json_inject', rx: /"\s*injection\w*"\s*:\s*(?:true|"yes")/i },
];

export interface InjectionScanResult {
  detected: boolean;
  matchedIds: string[];
}

export const scanForInjection = (input: string): InjectionScanResult => {
  const matched: string[] = [];
  for (const p of PATTERNS) {
    if (p.rx.test(input)) matched.push(p.id);
  }
  return { detected: matched.length > 0, matchedIds: matched };
};
