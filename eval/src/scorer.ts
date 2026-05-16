import type { CheckResult, EvalCase, VerifyResponse } from '@/types.js';

export const scoreCase = (testCase: EvalCase, response: VerifyResponse): CheckResult[] => {
  const checks: CheckResult[] = [];
  const exp = testCase.expectations;

  if (exp.overallStatus !== undefined) {
    checks.push(checkOverallStatus(exp.overallStatus, response.overallStatus));
  }

  if (exp.expectAnyFalse !== undefined) {
    const hasFalse = response.verdicts.some((v) => v.status === 'FALSE');
    checks.push({
      name: 'expectAnyFalse',
      passed: hasFalse === exp.expectAnyFalse,
      expected: exp.expectAnyFalse ? 'at least one FALSE verdict' : 'no FALSE verdicts',
      actual: `falseCount=${response.verdicts.filter((v) => v.status === 'FALSE').length}`,
    });
  }

  if (exp.expectInjection !== undefined) {
    checks.push({
      name: 'expectInjection',
      passed: response.injection.suspected === exp.expectInjection,
      expected: exp.expectInjection ? 'injection.suspected=true' : 'injection.suspected=false',
      actual: `suspected=${response.injection.suspected} (preScan=[${response.injection.preScanMatches.join(',')}], llmSelfReports=${response.injection.llmSelfReports})`,
    });
  }

  if (exp.expectComplianceFlag !== undefined) {
    const flagged = !response.compliance.safe || response.compliance.flags.length > 0;
    checks.push({
      name: 'expectComplianceFlag',
      passed: flagged === exp.expectComplianceFlag,
      expected: exp.expectComplianceFlag ? 'compliance flagged' : 'compliance clean',
      actual: `safe=${response.compliance.safe}, flags=[${response.compliance.flags.join(',')}]`,
    });
  }

  if (exp.expectHallucinationTypes && exp.expectHallucinationTypes.length > 0) {
    const seen = new Set(response.verdicts.flatMap((v) => v.hallucinationTypes));
    const matched = exp.expectHallucinationTypes.some((t) => seen.has(t));
    checks.push({
      name: 'expectHallucinationTypes',
      passed: matched,
      expected: `any of [${exp.expectHallucinationTypes.join(',')}]`,
      actual: `seen=[${Array.from(seen).join(',')}]`,
    });
  }

  if (exp.minClaimCount !== undefined) {
    checks.push({
      name: 'minClaimCount',
      passed: response.claims.length >= exp.minClaimCount,
      expected: `>= ${exp.minClaimCount}`,
      actual: String(response.claims.length),
    });
  }

  if (exp.maxClaimCount !== undefined) {
    checks.push({
      name: 'maxClaimCount',
      passed: response.claims.length <= exp.maxClaimCount,
      expected: `<= ${exp.maxClaimCount}`,
      actual: String(response.claims.length),
    });
  }

  return checks;
};

const CONCLUSIVE: ReadonlySet<string> = new Set(['VERIFIED', 'FALSE']);

const checkOverallStatus = (
  expected: NonNullable<EvalCase['expectations']['overallStatus']>,
  actual: string,
): CheckResult => {
  const passed = expected === 'any-conclusive' ? CONCLUSIVE.has(actual) : expected === actual;
  return {
    name: 'overallStatus',
    passed,
    expected: String(expected),
    actual,
  };
};
