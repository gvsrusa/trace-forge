# Spec: TraceForge — Self-Improving React Code Review Agent

**Hackathon:** Google Cloud Rapid Agent Hackathon (deadline Jun 11, 2026 @ 2:00 PM PDT)  
**Track:** Arize  
**Spec version:** 1.0 — May 7, 2026

---

## Objective

Build a two-service web application:

1. **`agent/`** — A Python Google ADK agent that reviews React components across 4 dimensions (performance, accessibility, best practices, security), traces every step to Arize Phoenix Cloud via OpenInference, self-evaluates with LLM-as-Judge, queries its own past traces via the Phoenix MCP server, and autonomously updates its review strategy after each run.

2. **`web/`** — A Next.js 15 operator dashboard that submits code for review, streams the agent's live progress, displays annotated findings, shows Phoenix trace timelines, and visualizes the agent's self-improvement metrics over time.

**Success looks like:** A judge pastes a React component, watches the agent review it in real-time, switches to the Trace Explorer to see every span, then watches the agent enter Reflection Mode, identify a blind spot, and update its strategy — all visible in the dashboard. On a second review, the blind spot is caught and the improvement score ticks up.

**User:** A single demo user (no auth). Frontend tech leads and solo developers who want a self-improving AI reviewer.

---

## Tech Stack

| Layer | Technology | Version |
|---|---|---|
| Agent runtime | Google ADK (Python) | latest |
| LLM | Gemini via Vertex AI | `gemini-2.0-flash` (placeholder — confirm hackathon model string) |
| Tracing | `openinference-instrumentation-google-adk` | pinned |
| Observability | Arize Phoenix Cloud | free tier at app.phoenix.arize.com |
| Self-introspection | `@arizeai/phoenix-mcp@latest` (npx, stdio) | latest |
| Agent web framework | FastAPI | ≥0.115 |
| Frontend | Next.js 15 App Router | 15.x |
| Styling | Tailwind CSS v4 | 4.x |
| Charts | Recharts | 2.x |
| Animations | Framer Motion | 11.x |
| State persistence | Cloud Firestore | Firebase Admin SDK 6.x |
| Secrets | Google Secret Manager | via `google-cloud-secret-manager` |
| Python package manager | uv | latest |
| Node package manager | pnpm | 9.x |
| Hosting | Cloud Run (2 services) | — |
| CI/CD | Cloud Build | — |
| License | Apache 2.0 | — |

**Starter reference:** https://github.com/Arize-ai/gemini-hackathon (use for Phoenix tracing bootstrap and MCP config pattern)

---

## Commands

### Agent backend (`agent/`)

```bash
# Install deps
uv sync

# Run locally (dev)
uv run uvicorn main:app --reload --port 8080

# Run tests
uv run pytest tests/ -v --tb=short

# Lint
uv run ruff check . && uv run ruff format --check .

# Format
uv run ruff format .

# Build Docker image
docker build -t traceforge-agent .

# Run with Docker
docker run -p 8080:8080 --env-file .env traceforge-agent
```

### Frontend (`web/`)

```bash
# Install deps
pnpm install

# Dev server
pnpm dev

# Build
pnpm build

# Type check
pnpm tsc --noEmit

# Lint
pnpm lint

# Start production server
pnpm start
```

### Infrastructure (`infra/`)

```bash
# Deploy agent to Cloud Run
gcloud run deploy traceforge-agent \
  --source ./agent \
  --region us-central1 \
  --allow-unauthenticated \
  --set-secrets PHOENIX_API_KEY=phoenix-api-key:latest

# Deploy web to Cloud Run
gcloud run deploy traceforge-web \
  --source ./web \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars AGENT_BACKEND_URL=<agent-url>
```

---

## Project Structure

```
trace-forge/
├── SPEC.md                        ← this file
├── TraceForge_PRD.md
├── README.md                      ← quickstart + architecture diagram + demo link
├── LICENSE                        ← Apache 2.0
├── .gitignore
│
├── agent/                         ← Python ADK agent (Cloud Run service 1)
│   ├── pyproject.toml
│   ├── uv.lock
│   ├── Dockerfile
│   ├── .env.example
│   ├── main.py                    ← FastAPI app + SSE endpoint
│   ├── instrumentation.py         ← Phoenix OTEL registration (from starter)
│   ├── agent.py                   ← Root ADK agent definition
│   ├── tools/
│   │   ├── analyze_code.py        ← AST parsing tool
│   │   ├── web_search.py          ← Google Search tool
│   │   ├── phoenix_query.py       ← Phoenix MCP wrapper (traces + evals)
│   │   ├── run_evaluation.py      ← LLM-as-Judge eval runner
│   │   ├── update_strategy.py     ← Firestore strategy writer
│   │   └── generate_report.py     ← Final report compiler
│   ├── prompts/
│   │   ├── review_system.py       ← Base review system prompt
│   │   └── reflection_system.py   ← Reflection mode prompt
│   ├── db/
│   │   └── firestore.py           ← Firestore client + CRUD helpers
│   └── tests/
│       ├── test_tools.py
│       ├── test_agent.py
│       └── fixtures/
│           ├── ProductCard.tsx    ← Flawed component 1
│           ├── SearchModal.tsx    ← Flawed component 2
│           └── DataTable.tsx      ← Flawed component 3
│
├── web/                           ← Next.js 15 frontend (Cloud Run service 2)
│   ├── package.json
│   ├── pnpm-lock.yaml
│   ├── Dockerfile
│   ├── next.config.ts
│   ├── tsconfig.json
│   ├── tailwind.config.ts
│   ├── .env.example
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx               ← / Review Workspace
│   │   ├── traces/page.tsx        ← /traces Trace Explorer
│   │   ├── improvement/page.tsx   ← /improvement Self-Improvement Dashboard
│   │   ├── history/page.tsx       ← /history Review History
│   │   ├── architecture/page.tsx  ← /architecture System Diagram
│   │   └── api/
│   │       ├── review/route.ts    ← POST /api/review (SSE proxy)
│   │       ├── reviews/route.ts   ← GET /api/reviews
│   │       ├── strategy/route.ts  ← GET /api/strategy
│   │       └── improvement/route.ts
│   ├── components/
│   │   ├── AgentProgressFeed.tsx
│   │   ├── CodeAnnotationView.tsx
│   │   ├── ImprovementChart.tsx
│   │   ├── BlindSpotTracker.tsx
│   │   ├── SelfAssessmentPanel.tsx
│   │   ├── TraceTimeline.tsx
│   │   └── ui/                    ← Generic primitives (Button, Badge, Card, etc.)
│   └── lib/
│       ├── api.ts                 ← Typed API client
│       └── types.ts               ← Shared TypeScript types
│
├── infra/
│   ├── cloudbuild.yaml            ← CI/CD pipeline
│   └── setup.sh                  ← One-time GCP project bootstrap script
│
└── demo/
    └── test-components/           ← Pre-built flawed React components for demo
        ├── ProductCard.tsx
        ├── SearchModal.tsx
        └── DataTable.tsx
```

---

## Code Style

### Python (agent/)

```python
# tools/analyze_code.py — representative style
from google.adk.tools import tool
from dataclasses import dataclass

@dataclass
class CodeAnalysis:
    ast_summary: str
    component_tree: str
    hook_usage: list[str]
    imports: list[str]

@tool
def analyze_code(code: str, language: str, filename: str = "") -> CodeAnalysis:
    """Parse and extract structural information from React component code."""
    ...
```

- Ruff for formatting and linting (replaces black + flake8 + isort)
- Type hints on all function signatures
- Dataclasses or Pydantic models for structured data (no bare dicts across boundaries)
- No docstrings on obvious functions; single-line comment only when WHY is non-obvious
- Tool functions decorated with `@tool` from `google.adk.tools`

### TypeScript (web/)

```tsx
// components/AgentProgressFeed.tsx — representative style
type StepStatus = "pending" | "running" | "complete" | "failed"

interface ReviewStep {
  id: string
  name: string
  dimension: "performance" | "accessibility" | "best_practices" | "security" | "reflection"
  status: StepStatus
  detail?: string
}

export function AgentProgressFeed({ steps }: { steps: ReviewStep[] }) {
  return (
    <div className="flex flex-col gap-2">
      {steps.map((step) => <StepCard key={step.id} step={step} />)}
    </div>
  )
}
```

- Strict TypeScript (`"strict": true`)
- Named exports only (no default exports except Next.js pages)
- Props typed inline for simple components, `interface` for anything reused
- Tailwind for all styling — no CSS modules, no inline styles
- `app/` directory follows Next.js App Router conventions

---

## Testing Strategy

### Agent (Python)

- **Framework:** pytest
- **Location:** `agent/tests/`
- **Scope for hackathon:** Unit tests for all 7 tools (mock LLM calls, test input/output contracts). One integration smoke test per agent phase (review → eval → reflection) using recorded fixtures.
- **Run:** `uv run pytest tests/ -v`
- **Coverage target:** 70% on `tools/` — enough to catch regressions, not enough to slow Week 1.

### Frontend (TypeScript)

- **Framework:** Vitest + React Testing Library
- **Location:** `web/` alongside components (`AgentProgressFeed.test.tsx`)
- **Scope for hackathon:** Render tests for the 5 key components. No e2e Playwright suite (timeline risk).
- **Run:** `pnpm test`

---

## Boundaries

**Always:**
- Run `uv run pytest` and `pnpm tsc --noEmit` before committing
- Pin exact versions for `openinference-instrumentation-google-adk` and `@arizeai/phoenix-mcp` — these are integration-critical and can break on minor updates
- Use Google Secret Manager for all credentials in Cloud Run; `.env` files for local only
- Keep all 4 review dimensions hard-capped — no new dimensions after Week 3

**Ask first:**
- Adding new Python or npm dependencies
- Changing the Firestore data model (schema changes affect all 3 collections)
- Changing the SSE streaming protocol between `web/` and `agent/`
- Switching the Gemini model string (affects tracing metadata)
- Any Cloud Run resource limit changes (cost impact)

**Never:**
- Commit `.env` files or any file containing `PHOENIX_API_KEY` or GCP credentials
- Skip OpenInference instrumentation on any new ADK tool — every tool call must produce a span
- Implement auto-fix / code generation (review only per PRD §16)
- Add GitHub PR integration, mobile responsive UI, or custom eval criteria editor (all deferred per PRD §16)

---

## Success Criteria

These are the specific, testable conditions for hackathon submission:

| # | Criterion | How to verify |
|---|---|---|
| 1 | Agent reviews `ProductCard.tsx` and returns findings in all 4 dimensions | Manual review of output; check `dimensions_reviewed` in Firestore |
| 2 | Every review produces a trace visible in Phoenix Cloud with ≥4 spans (one per dimension) | Open Phoenix Cloud UI after a review |
| 3 | Reflection Mode runs after every review and writes a strategy update to Firestore | Check `agent_strategy` collection after review |
| 4 | LLM-as-Judge eval scores are computed and stored for every review | Check `eval_history` collection; verify 4 scores per review |
| 5 | Dashboard streams agent steps in real-time via SSE (no page refresh required) | Watch AgentProgressFeed during a live review |
| 6 | Completeness score increases ≥15% over 8+ reviews | ImprovementChart shows upward trajectory |
| 7 | At least 3 blind spots move from "Detected" → "Verified Fixed" in BlindSpotTracker | Check BlindSpotTracker on /improvement page |
| 8 | Average review latency < 60 seconds | Phoenix trace durations |
| 9 | App is accessible at a Cloud Run public URL | Load the URL in browser |
| 10 | GitHub repo is public with Apache 2.0 LICENSE file | GitHub repo check |

---

## Open Questions

1. **Gemini model string:** PRD says "Gemini 3" — need to confirm exact Vertex AI model ID. Will use `gemini-2.0-flash` as placeholder and update once confirmed on the hackathon resources page or GCP console.

2. **Phoenix MCP + Python ADK bridge:** The Phoenix MCP server runs as a Node.js process (`npx @arizeai/phoenix-mcp`). The ADK agent is Python. The stdio transport should work as a subprocess — needs a spike on Day 1 of Week 1 to confirm. If it doesn't work, fallback is to call the Phoenix REST API directly.

3. **Phoenix Cloud free tier trace volume:** Confirm the free tier at app.phoenix.arize.com supports 50+ traces (8+ reviews × multiple spans each) without hitting caps before submission.

4. **Vertex AI vs. Google AI Studio API key:** Starter repo supports both. For hackathon, we'll use Vertex AI (required by hackathon for ADK + Cloud Run). Confirm GCP Vertex AI API is enabled in the project.

---

## Day 1 Setup Tasks (Before Any Code)

These must be completed before Week 1 development starts:

1. Create Phoenix Cloud account at https://app.phoenix.arize.com → get API key
2. Create GCP project → enable APIs: Vertex AI, Cloud Run, Firestore, Secret Manager, Cloud Build
3. Store `PHOENIX_API_KEY` in Secret Manager
4. Clone Arize starter repo (https://github.com/Arize-ai/gemini-hackathon) and confirm tracing works locally
5. Spike: confirm `@arizeai/phoenix-mcp` runs as stdio subprocess inside a Python process

---

*Spec is a living document. Update when decisions change, scope changes, or open questions are resolved.*
