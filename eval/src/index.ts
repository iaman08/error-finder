import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { ALL_CASES } from '@/cases.js';
import { aggregate } from '@/metrics.js';
import { printConsoleReport, writeJsonReport } from '@/report.js';
import { runCases } from '@/runner.js';
import type { EvalCase, FullReport } from '@/types.js';
import { EVAL_CATEGORIES } from '@/types.js';

interface Config {
  backendUrl: string;
  concurrency: number;
  timeoutMs: number;
  filter: string | null;
  outputPath: string;
}

const readConfig = (): Config => {
  const args = parseArgs(process.argv.slice(2));
  const backendUrl = args.backend ?? process.env.BACKEND_URL ?? 'http://localhost:4000';
  const concurrency = Number(args.concurrency ?? process.env.EVAL_CONCURRENCY ?? '2');
  const timeoutMs = Number(args.timeout ?? process.env.EVAL_TIMEOUT_MS ?? '180000');
  const filter = args.filter ?? process.env.EVAL_FILTER ?? null;
  const outputPath = args.output ?? process.env.EVAL_OUTPUT_PATH ?? 'results/latest.json';
  return { backendUrl, concurrency, timeoutMs, filter: filter || null, outputPath };
};

const parseArgs = (argv: string[]): Record<string, string> => {
  const out: Record<string, string> = {};
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (!a || !a.startsWith('--')) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next !== undefined && !next.startsWith('--')) {
      out[key] = next;
      i += 1;
    } else {
      out[key] = 'true';
    }
  }
  return out;
};

const filterCases = (cases: EvalCase[], filter: string | null): EvalCase[] => {
  if (!filter) return cases;
  const filterCategories = filter
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return cases.filter(
    (c) =>
      filterCategories.includes(c.category) ||
      filterCategories.includes(c.id.toLowerCase()),
  );
};

const ensureBackendReachable = async (backendUrl: string): Promise<void> => {
  try {
    const res = await fetch(`${backendUrl}/healthz`);
    if (!res.ok) {
      throw new Error(`Backend health check failed with status ${res.status}`);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`Backend not reachable at ${backendUrl}. ${msg}`);
    console.error('Start the backend with `cd backend && npm run dev` (with .env populated).');
    process.exit(1);
  }
};

const main = async (): Promise<void> => {
  const config = readConfig();

  await ensureBackendReachable(config.backendUrl);

  const cases = filterCases(ALL_CASES, config.filter);
  if (cases.length === 0) {
    console.error(
      `Filter "${config.filter}" matched no cases. Available categories: ${EVAL_CATEGORIES.join(', ')}`,
    );
    process.exit(1);
  }

  const runId = randomUUID();
  const startedAt = new Date();
  console.log(
    `Running ${cases.length} case(s) against ${config.backendUrl} (concurrency=${config.concurrency}, timeout=${config.timeoutMs}ms).`,
  );

  let completed = 0;
  const results = await runCases(cases, {
    backendUrl: config.backendUrl,
    concurrency: config.concurrency,
    timeoutMs: config.timeoutMs,
    onCaseStart: (c) => {
      console.log(`→  [${c.category}] ${c.id} — ${c.description}`);
    },
    onCaseEnd: (r) => {
      completed += 1;
      const sym = r.status === 'pass' ? '✓' : r.status === 'fail' ? '✗' : '!';
      console.log(`${sym}  [${completed}/${cases.length}] ${r.caseId} (${r.status}, ${r.durationMs}ms)`);
    },
  });

  const completedAt = new Date();
  const report: FullReport = {
    runId,
    startedAt: startedAt.toISOString(),
    completedAt: completedAt.toISOString(),
    backendUrl: config.backendUrl,
    filter: config.filter,
    cases: results,
    aggregate: aggregate(results, cases),
  };

  console.log('');
  printConsoleReport(report);

  const path = writeJsonReport(report, config.outputPath);
  console.log(`\nReport written to ${path}`);

  if (report.aggregate.failed > 0 || report.aggregate.errored > 0) {
    process.exit(1);
  }
};

main().catch((err) => {
  console.error('Eval runner crashed:', err);
  process.exit(1);
});
