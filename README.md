# Errorfinder

AI hallucination detection and verification platform. Takes a user question + an AI-generated response, decomposes the response into atomic claims, and verifies each claim against retrieved evidence from authoritative sources. Surfaces hallucinations with calibrated confidence, classifies them by type (numerical / citation / temporal / logical / contextual / scope / entity / confidence), and runs an independent safety/compliance pass.

---

## Repository layout

```
errorfinder/
├── backend/       Node + Express + TypeScript verification pipeline
├── frontend/      Next.js App Router dashboard
├── eval/          Adversarial evaluation harness with calibration metrics
└── README.md
```

Each is an independent npm package. No workspace tooling — they communicate over HTTP.

---

## Pipeline architecture

```
   POST /v1/verify
        │
        ▼
 ┌──────────────────────────────────────┐
 │ Injection pre-scan (regex tripwires) │   ← fires for ignore-previous, system override,
 └──────────────────┬───────────────────┘     fence-escape, DAN jailbreak, etc.
                    │
                    ▼
 ┌──────────────────────────────────────┐
 │ Domain detection (LLM fast tier)     │   finance | medical | legal | tech | news | general
 └──────────────────┬───────────────────┘
                    │
        ┌───────────┴──────────┐                  Decomposition + Compliance
        ▼                      ▼                  run in parallel — they are
 ┌──────────────────┐   ┌─────────────────┐       independent.
 │ Claim            │   │ Compliance      │
 │ decomposition    │   │ (LLM, isolated) │
 │  + dedup         │   │                 │
 │  + truncation    │   └─────────────────┘
 └────────┬─────────┘
          │
          ▼
 ┌─────────────────────────────────────────────┐
 │ Per-claim verification                      │
 │   bounded concurrency (CLAIM_CONCURRENCY)   │
 │ ┌─────────────────────────────────────────┐ │
 │ │  Tavily retrieve (seeded by claim text) │ │
 │ │            │                            │ │
 │ │            ▼                            │ │
 │ │  Cap to top-N by trust×relevance        │ │
 │ │            │                            │ │
 │ │            ▼                            │ │
 │ │  Verifier LLM (nonced data fences,      │ │
 │ │      temporal anchor, injection         │ │
 │ │      self-report field)                 │ │
 │ │            │                            │ │
 │ │            ▼                            │ │
 │ │  INCONCLUSIVE?                          │ │
 │ │      → refined query (loop-guarded)     │ │
 │ │      → re-retrieve, append              │ │
 │ │   (bounded by MAX_VERIFICATION_ITER)    │ │
 │ └─────────────────────────────────────────┘ │
 └────────────────────┬────────────────────────┘
                      │
                      ▼
 ┌──────────────────────────────────────────────┐
 │ Stance-vs-verdict sanity check (deterministic) │   downgrade VERIFIED→INCONCLUSIVE
 └────────────────────┬─────────────────────────┘     if evidence stances disagree
                      │
                      ▼
 ┌──────────────────────────────────────────────┐
 │ Aggregate: overallStatus, corrections,       │
 │ warnings[], injection{}, timings → persist   │
 └──────────────────────────────────────────────┘
```

### Verdict taxonomy

| Status         | Meaning                                                                                                |
|----------------|--------------------------------------------------------------------------------------------------------|
| `VERIFIED`     | Evidence directly supports the claim.                                                                  |
| `FALSE`        | Evidence directly contradicts the claim (includes once-true claims whose current state contradicts).   |
| `INCONCLUSIVE` | Evidence is missing, insufficient, or conflicting; or the claim is an opinion/prediction/untestable.   |

### Hallucination types (tagged per claim)

`numerical`, `citation`, `temporal`, `logical`, `contextual`, `scope_exaggeration`, `entity_conflation`, `confidence`.

### Retrieval modes

- **standard** — broad Tavily search; explicit blocklist of low-trust hosts (Reddit, X, Facebook, Quora, Medium, etc.). Untrusted hosts kept but flagged.
- **professional** — Tavily `advanced` depth, domain allowlist per domain (PubMed/NIH/FDA for medical; SEC/RBI/SEBI/Fed for finance; courts/eur-lex for legal; MDN/IETF/RFC for tech; Reuters/AP/BBC for news; Nature/Science for general). Untrusted hosts hard-dropped.

---

## Backend ([backend/](backend/))

### Folder structure

```
backend/src/
├── config/                  env (Zod-validated), pino logger, mongoose connect
├── domain/                  pipeline types, enums, AppError hierarchy
├── shared/utils/            async (retry / timeout / mapConcurrent),
│                            correlation, json (LLM-tolerant), text
│                            (normalize, sha256, nonces, safeDataBlock),
│                            injection (regex tripwires)
├── infra/
│   ├── llm/                 LLMProvider interface + Groq implementation
│   └── http/                Express app, middleware, routes
├── modules/
│   ├── domain-detection/    fast-tier classifier
│   ├── retrieval/           Tavily client + per-domain source policy
│   ├── claim-decomposition/ atomic claims + Jaccard dedup
│   ├── verification/        per-claim verifier with recursive retrieval
│   ├── compliance/          isolated safety pass
│   └── pipeline/            orchestrator (parallel stages, stance check)
├── persistence/             Mongoose VerificationRun model + repository
└── index.ts                 entry point with graceful shutdown
```

### Tech

- Node 20+, Express 4, TypeScript strict (`noUncheckedIndexedAccess`, `noImplicitOverride`, etc.)
- Mongoose 8 + MongoDB (pool 2–20, retryWrites)
- Zod at every boundary (env, HTTP body, LLM JSON, Tavily response, DB read)
- Groq SDK with retry on 408/425/429/5xx and per-tier model routing (reasoning vs fast)
- Tavily via raw `fetch` — no SDK dependency to avoid version churn
- Pino + pino-http; structured logs with `correlationId` through every stage; secret redaction

### API

| Method | Path                        | Notes                                     |
|--------|-----------------------------|-------------------------------------------|
| POST   | `/v1/verify`                | Submit verification, returns full result. Synchronous. |
| GET    | `/v1/verify/:correlationId` | Fetch persisted run.                      |
| GET    | `/healthz`                  | Liveness.                                 |
| GET    | `/readyz`                   | Readiness (DB connected).                 |

### Response shape (excerpt)

```ts
{
  correlationId: string,
  detectedDomain: 'finance' | 'medical' | 'legal' | 'tech' | 'news' | 'general',
  mode: 'standard' | 'professional',
  claims: AtomicClaim[],          // id, text, isCheckable, optional s/v/o + temporalContext
  verdicts: ClaimVerdict[],       // status, confidence, hallucinationTypes, reasoning,
                                  // correction?, evidenceUsed[], iterations
  compliance: { safe, flags[], reasoning },
  overallStatus: VerdictStatus,
  correctedOutput?: string,
  timings: { totalMs, perStage: { ... } },
  warnings: string[],             // truncation, dedup, stance downgrades, injection notes
  injection: {
    suspected: boolean,
    preScanMatches: string[],     // regex tripwire ids
    llmSelfReports: number        // count of per-claim verifier LLMs that flagged
  }
}
```

### Key engineering decisions

- **Per-claim retrieval** — Each claim seeds its own Tavily query. No lossy "concat the whole response and truncate to 380 chars" initial pool.
- **Nonced data fences** — `<<<DATA-{12-hex} ... DATA-{12-hex}>>>` wraps every untrusted blob (user input, model output, retrieved evidence). Adversarial content can't escape a fence whose nonce it can't predict.
- **Two-tier injection detection** —
  1. Regex pre-scan tripwires over user input + model output ([backend/src/shared/utils/injection.ts](backend/src/shared/utils/injection.ts)): `ignore_previous`, `system_override`, `reveal_prompt`, `response_override`, `fence_escape`, `jailbreak_dan`, `role_steal`, `json_inject`.
  2. Verifier LLM has an `injectionDetected: boolean` field it must set when it sees attempted instructions inside evidence.
- **Confidence semantics** — Non-checkable claims get `confidence: 0` (not 1). Calibration metrics are not polluted by definitional cases.
- **Evidence cap per verifier call** — Pool ranked trusted-first then by relevance, capped to `MAX_EVIDENCE_PER_VERIFICATION` (default 12). Prevents context blow-up in recursive iterations.
- **Refined-query loop guard** — `seenQueries: Set<string>` of normalized queries; stops on repeat or on "no new evidence after refinement."
- **Stance-vs-verdict sanity check** — Post-hoc, deterministic. If verdict says VERIFIED but ≥2 evidence stances are "contradicts" (and outnumber "supports"), downgrade to INCONCLUSIVE and emit a warning. Symmetric for FALSE.
- **Claim dedup** — Jaccard token overlap ≥0.85 or substring relation. Saves cost and prevents inflated false-counts.
- **Temporal anchor** — Verifier system prompt embeds `Today's date: YYYY-MM-DD`. `TODAY_DATE_OVERRIDE` env var pins it for deterministic eval.
- **Reasoning isolation** — Compliance runs in parallel with verification, does not see retrieved evidence. Verifier doesn't see compliance verdict.
- **Partial-failure tolerance** — One bad claim → that claim becomes INCONCLUSIVE, the run still completes.

### Persistence

- Mongoose `VerificationRun` document with embedded sub-schemas.
- Indexes: `correlationId` (unique), `(input.mode, detectedDomain, createdAt)`, `createdAt`, `(injection.suspected, createdAt)`.
- Lifecycle: `pending → completed | failed`.

---

## Frontend ([frontend/](frontend/))

### Stack

Next.js 15 (App Router) + React 19 + TypeScript strict + Tailwind 3.4 + Radix primitives (Slot/Tabs/Tooltip/Label/Separator) + TanStack Query 5 + Framer Motion + next-themes + sonner + Zod.

No Zustand — UI state is local; theme via `next-themes`; server state via TanStack Query.

### Folder structure

```
frontend/src/
├── app/
│   ├── globals.css           HSL CSS-var theme, light/dark
│   ├── layout.tsx            root layout with Geist fonts + Providers
│   ├── providers.tsx         QueryClient + ThemeProvider + Tooltip + Toaster
│   ├── not-found.tsx
│   └── (app)/                route group with sidebar shell
│       ├── layout.tsx        Sidebar + AppHeader + content
│       ├── page.tsx          /  — verify
│       └── runs/
│           ├── page.tsx      /runs  — history list
│           └── [id]/page.tsx /runs/[id]  — run detail
├── components/
│   ├── ui/                   button, card, badge, input, textarea, label,
│   │                         tabs, tooltip, separator, skeleton, toaster
│   ├── layout/               sidebar, app-header, theme-toggle
│   ├── verify/               verify-form, verify-progress (staged), verify-error,
│   │                         empty-result (with one-click examples), mode-toggle
│   ├── results/              result-view, result-summary, claim-card,
│   │                         evidence-group (stance-grouped), evidence-item,
│   │                         verdict-badge, confidence-meter, hallucination-badge,
│   │                         compliance-panel, corrected-output,
│   │                         injection-alert, warnings-banner
│   └── runs/                 run-list, run-detail
├── features/verify/
│   ├── schemas.ts            Zod schemas mirroring backend; types derived
│   ├── api.ts                fetch client with typed ApiError + AbortController
│   ├── hooks.ts              useVerifyMutation, useRunQuery, useHistory
│   ├── history.ts            localStorage with cross-tab sync
│   └── examples.ts           curated adversarial starter cases
└── lib/
    ├── utils.ts              cn()
    ├── env.ts                Zod-validated NEXT_PUBLIC_ vars
    └── format.ts             verdict styling, hallucination labels,
                              stance styles, injection-pattern labels,
                              date/ms formatting
```

### Routes

| Route          | Component                                                                                                | Notes                                       |
|----------------|----------------------------------------------------------------------------------------------------------|---------------------------------------------|
| `/`            | [VerifyPage](frontend/src/app/(app)/page.tsx) → form + progress + result                                 | Single-page submit-and-view.                |
| `/runs`        | [RunsPage](frontend/src/app/(app)/runs/page.tsx) → [RunList](frontend/src/components/runs/run-list.tsx)  | localStorage-driven history, per-device.    |
| `/runs/[id]`   | [RunDetail](frontend/src/components/runs/run-detail.tsx)                                                 | Fetches by `correlationId` from backend.    |

### Result-view composition

```
ResultView
├── InjectionAlert            ← only if injection.suspected (rose, security-grade)
├── WarningsBanner            ← only if warnings.length > 0 (amber, audit trail)
├── ResultSummary             ← overall verdict, domain/mode, copyable id, per-stage timings
├── Atomic claims
│   └── ClaimCard[]
│       ├── verdict badge + confidence meter + hallucination badges
│       ├── suggested correction (if any)
│       └── expanded:
│           ├── reasoning
│           └── EvidenceGroup ← contradicts-first ordering, source diversity counts
│               └── EvidenceItem[]  (title link, stance icon, trust badge, snippet,
│                                    source, published, retrieved, relevance%)
├── CompliancePanel
└── CorrectedOutput           ← only if corrections were produced
```

**Trust UX principle:** contradicts-first ordering and source-diversity counts change what the user *can* see rather than what they have to remember to look for. That's the difference between a trustworthy dashboard and a black box.

### Other UX details

- **Staged-progress indicator** is currently a client-side simulation (timed reveals based on per-stage ETA estimates). Honest comment in [verify-progress.tsx](frontend/src/components/verify/verify-progress.tsx) marks the SSE swap point.
- **Empty state** shows 4 click-to-fill adversarial examples that mirror the eval harness — fastest way to stress-test the UI.
- **History via localStorage** — max 50 entries, schema-validated, cross-tab sync via `storage` event + custom event.
- **Zod-parsing every backend response** — frontend never trusts shape. If backend drifts, parse fails loudly with a typed `ApiError`.
- **Theme** — 3-way toggle (light → dark → system) via `next-themes`. CSS HSL vars for full themeability.
- **Accessibility** — semantic HTML, ARIA roles on alerts/status, keyboard-only navigation, `⌘+Enter` to submit form.

---

## Eval harness ([eval/](eval/))

Standalone npm package. HTTP-only — no shared imports with backend, so it tests the public contract honestly.

### Layout

```
eval/src/
├── types.ts       case schema + Zod response schema (mirrored locally) + metric types
├── cases.ts       14 curated adversarial cases across the taxonomy
├── scorer.ts      per-case expectation checks
├── metrics.ts     aggregate metrics + calibration (ECE + Brier over 10 buckets)
├── runner.ts      concurrency-bounded HTTP runner with per-case timeout
├── report.ts      console + JSON report writers
└── index.ts       CLI entry with arg parsing and pre-flight health check
```

### Test case taxonomy

| Category       | Cases | Examples                                                  |
|----------------|-------|-----------------------------------------------------------|
| `control`      | 2     | Water boiling point, speed of light (should pass cleanly) |
| `numerical`    | 1     | Mount Everest height stated wrong                         |
| `citation`     | 1     | Fabricated Nature study                                   |
| `temporal`     | 2     | Out-of-date president; Pluto as 9th planet                |
| `entity`       | 1     | Tim Cook as Apple founder                                 |
| `scope`        | 1     | "All studies show coffee causes cancer"                   |
| `logical`      | 1     | Self-contradicting statement                              |
| `contextual`   | 1     | Great Wall visible from space myth                        |
| `mixed`        | 1     | Python on JVM (one of three claims false)                 |
| `inconclusive` | 1     | Obscure ICML 2018 stat                                    |
| `injection`    | 2     | User-input override + evidence fence-escape jailbreak     |
| `compliance`   | 1     | Prescriptive ibuprofen dose                               |

### Metrics computed

- **Pass rate** overall and per-category
- **Hallucination detection rate** — cases that should produce FALSE → fraction that did
- **Injection detection rate** — cases with injection signals → fraction raised
- **False-positive rate** on `control` cases
- **Confidence calibration** — ECE over 10 buckets + Brier score, using per-claim `calibrationTargets` (substring-matched ground truth)
- Latency avg + p95

### Running

```bash
cd eval
cp .env.example .env  # set BACKEND_URL if non-default
npm install
npm start                                       # all cases
npm start -- --filter injection,compliance      # subset
npm start -- --filter numerical                 # single category
```

Pre-flight `/healthz` check fails fast if backend isn't reachable. Exits non-zero if any case fails (CI-friendly).

---

## Engineering rules / philosophy

- **Treat all external content as untrusted** — user input, model output, retrieved web content, LLM responses. Zod parses at every boundary; nonced fences isolate untrusted blobs inside LLM prompts.
- **Reasoning isolation** between pipeline stages. Compliance runs in parallel, evidence-blind.
- **Deterministic post-hoc checks** where possible (stance sanity check, dedup, injection regex) so we don't depend entirely on LLM judgment.
- **Schema validate at every LLM/HTTP boundary**. Invalid responses throw typed errors, not corrupt data.
- **Partial-failure tolerance** — bad claim → INCONCLUSIVE, run continues. Bad pipeline stage → typed `AppError` with status mapping.
- **Per-claim retrieval > shared pool** for accuracy. Cost trade-off accepted.
- **Bounded recursion** — `MAX_VERIFICATION_ITERATIONS` + query-dedup loop guard.
- **Production-grade observability** — correlation IDs through every log line, per-stage timings, secret redaction, structured fields for filtering.

---

## To run

### Backend

```bash
cd backend
cp .env.example .env   # fill GROQ_API_KEY, TAVILY_API_KEY, MONGODB_URI
npm install
npm run dev            # → http://localhost:4000
```

### Frontend

```bash
cd frontend
cp .env.local.example .env.local   # set NEXT_PUBLIC_BACKEND_URL if non-default
npm install
npm run dev                        # → http://localhost:3000
```

### Eval harness

```bash
cd eval
cp .env.example .env
npm install
npm start
```

Requires backend running with real API keys.

---

## Environment variables

### Backend ([backend/.env.example](backend/.env.example))

| Variable                          | Default                             | Purpose                                        |
|-----------------------------------|-------------------------------------|------------------------------------------------|
| `NODE_ENV`                        | development                         |                                                |
| `PORT`                            | 4000                                |                                                |
| `LOG_LEVEL`                       | info                                | fatal / error / warn / info / debug / trace    |
| `MONGODB_URI`                     | —                                   | Required.                                      |
| `GROQ_API_KEY`                    | —                                   | Required.                                      |
| `LLM_MODEL_REASONING`             | `llama-3.3-70b-versatile`           | Used for decomposer, verifier, compliance.     |
| `LLM_MODEL_FAST`                  | `llama-3.1-8b-instant`              | Used for domain detection.                     |
| `LLM_REQUEST_TIMEOUT_MS`          | 45000                               |                                                |
| `LLM_MAX_RETRIES`                 | 2                                   | Retries on 408 / 425 / 429 / 5xx.              |
| `TAVILY_API_KEY`                  | —                                   | Required.                                      |
| `TAVILY_REQUEST_TIMEOUT_MS`       | 20000                               |                                                |
| `MAX_VERIFICATION_ITERATIONS`     | 2                                   | Recursive retrieval cap per claim.             |
| `MAX_CLAIMS_PER_RUN`              | 30                                  | Excess claims dropped with a warning.          |
| `MAX_EVIDENCE_PER_VERIFICATION`   | 12                                  | Top-N evidence shown to verifier per call.     |
| `RETRIEVAL_RESULTS_STANDARD`      | 8                                   |                                                |
| `RETRIEVAL_RESULTS_PROFESSIONAL`  | 10                                  |                                                |
| `CLAIM_CONCURRENCY`               | 4                                   | Parallel claim-verification lanes.             |
| `TODAY_DATE_OVERRIDE`             | (system clock)                      | `YYYY-MM-DD` for deterministic eval.           |

### Frontend ([frontend/.env.local.example](frontend/.env.local.example))

| Variable                  | Default                  | Purpose                          |
|---------------------------|--------------------------|----------------------------------|
| `NEXT_PUBLIC_BACKEND_URL` | `http://localhost:4000`  | Backend base URL.                |

### Eval ([eval/.env.example](eval/.env.example))

| Variable             | Default                   | Purpose                                        |
|----------------------|---------------------------|------------------------------------------------|
| `BACKEND_URL`        | `http://localhost:4000`   |                                                |
| `EVAL_CONCURRENCY`   | 2                         |                                                |
| `EVAL_TIMEOUT_MS`    | 180000                    | Per-case timeout.                              |
| `EVAL_FILTER`        | (none)                    | Comma-separated category or case-id filter.    |
| `EVAL_OUTPUT_PATH`   | `results/latest.json`     |                                                |

---

## Not yet built / deferred

P2 items flagged during the systems-engineering audit, in order of likely impact:

- **Real streaming progress** — backend is synchronous; staged-progress UI is currently a client-side simulation. Add SSE or WebSocket emitter in the orchestrator.
- **Post-hoc confidence calibration** — once the eval harness has produced a labeled dataset, fit temperature scaling or isotonic regression on top of raw LLM confidences.
- **Retrieval caching** — `(query, mode, domain)` keyed cache with short TTL. Cuts Tavily cost meaningfully on repeated runs.
- **Idempotency keys** on `POST /v1/verify` — let clients safely retry without re-running the pipeline.
- **Rate limiting** on the verify endpoint — token-bucket per IP or API key.
- **Per-claim filtering / verdict-distribution mini-chart** in the result view.
- **Severity levels** on compliance flags.
- **Auth, workspaces, API key management, settings** — none are scaffolded.
- **A `GET /v1/runs` list endpoint** — frontend currently uses localStorage for history.

## Known caveats

- The pipeline has been built and typechecks pass on all three packages. The **eval harness has not been executed end-to-end** in this environment (no `GROQ_API_KEY` / `TAVILY_API_KEY` available). First real run is expected to expose calibration gaps you can then close with post-hoc transforms.
- The frontend builds and typechecks but **was not visually verified in a browser**. Hydration mismatches around the theme toggle, CORS on the verify POST, and animation smoothness against real backend timings should be sanity-checked on first `npm run dev`.
