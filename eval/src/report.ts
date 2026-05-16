import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import type { FullReport, CaseResult, AggregateReport } from '@/types.js';

const pct = (n: number | null): string => (n === null ? 'n/a' : `${(n * 100).toFixed(1)}%`);
const ms = (n: number): string => (n < 1_000 ? `${n}ms` : `${(n / 1_000).toFixed(1)}s`);

export const printConsoleReport = (report: FullReport): void => {
  const out = (s: string) => process.stdout.write(`${s}\n`);
  const div = (ch = '─') => out(ch.repeat(72));

  div('═');
  out(`  Errorfinder eval — run ${report.runId}`);
  out(`  ${report.startedAt} → ${report.completedAt}`);
  out(`  backend=${report.backendUrl}${report.filter ? `   filter=${report.filter}` : ''}`);
  div('═');

  for (const r of report.cases) {
    printCase(r);
  }

  div('═');
  printAggregate(report.aggregate);
  div('═');
};

const printCase = (r: CaseResult): void => {
  const out = (s: string) => process.stdout.write(`${s}\n`);
  const symbol = r.status === 'pass' ? '✓' : r.status === 'fail' ? '✗' : '!';
  out(`${symbol}  [${r.category}] ${r.caseId}  (${ms(r.durationMs)})`);
  out(`    ${r.description}`);
  if (r.status === 'error') {
    out(`    error: ${r.error}`);
    return;
  }
  for (const c of r.checks) {
    const cs = c.passed ? '✓' : '✗';
    out(`    ${cs} ${c.name}: expected ${c.expected}; actual ${c.actual}`);
  }
};

const printAggregate = (a: AggregateReport): void => {
  const out = (s: string) => process.stdout.write(`${s}\n`);
  out(`Summary: ${a.passed}/${a.totalCases} passed (${pct(a.passRate)}), ${a.failed} failed, ${a.errored} errored.`);
  out(`Hallucination detection rate: ${pct(a.hallucinationDetectionRate)}`);
  out(`Injection detection rate: ${pct(a.injectionDetectionRate)}`);
  out(`False-positive rate (control flagged false): ${pct(a.falsePositiveRate)}`);
  out(`Latency avg ${ms(a.avgLatencyMs)} | p95 ${ms(a.p95LatencyMs)}`);
  out('');
  out('By category:');
  for (const [cat, m] of Object.entries(a.byCategory)) {
    if (m.total === 0) continue;
    out(`  ${cat.padEnd(14)} ${m.passed}/${m.total}  (${pct(m.passRate)})`);
  }
  if (a.calibration) {
    out('');
    out(`Calibration over ${a.calibration.sampleCount} labelled claim(s):`);
    out(`  ECE: ${a.calibration.ece.toFixed(4)}`);
    out(`  Brier: ${a.calibration.brierScore.toFixed(4)}`);
    for (const b of a.calibration.buckets) {
      const bar = `[${b.rangeLow.toFixed(1)}–${b.rangeHigh.toFixed(1)}]`;
      out(
        `  ${bar.padEnd(14)} n=${String(b.count).padStart(3)}  avg-conf=${b.avgConfidence.toFixed(2)}  acc=${b.accuracy.toFixed(2)}`,
      );
    }
  }
};

export const writeJsonReport = (report: FullReport, path: string): string => {
  const absolute = resolve(process.cwd(), path);
  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(absolute, JSON.stringify(report, null, 2), 'utf8');
  return absolute;
};
