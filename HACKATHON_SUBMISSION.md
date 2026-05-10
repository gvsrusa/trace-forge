# TraceForge — Hackathon Submission

**Google Cloud Rapid Agent Hackathon · Arize Track**
**Team:** Venkata Subbarao Gorantla
**Submission Date:** June 11, 2026

---

## What is TraceForge?

TraceForge is a **self-improving AI code review agent** that gets measurably better at reviewing code with every single review it performs — without any human intervention, retraining, or manual rule updates.

Submit a React component. The agent reviews it across four dimensions (performance, accessibility, best practices, security), scores its own output quality, queries its own past traces via Arize Phoenix to find blind spots, and writes learned improvements to a persistent strategy store. The next review is better than the last.

After 50+ reviews in the demo environment, the strategy has evolved from v1 (default checklist) to v58+ (agent-discovered checks for icon-only button labels, memoization chains, inline style thrashing, and dozens more).

**Live demo:** deployed on Cloud Run
**Observability:** every tool call, LLM invocation, and strategy update is visible in Arize Phoenix

---

## The Core Innovation: A Self-Improving Feedback Loop

```
┌─────────────────────────────────────────────────────────────────┐
│                    SELF-IMPROVEMENT LOOP                        │
│                                                                 │
│  1. REVIEW          2. EVALUATE         3. REFLECT              │
│  ─────────────      ────────────        ──────────              │
│  Analyze code  →    LLM scores its  →   Agent queries its own  │
│  across 4 dims      own output          past traces via         │
│  using current      (completeness,      Phoenix GraphQL API     │
│  strategy v58       accuracy,           to find blind spots     │
│                     actionability,                              │
│                     calibration)                                │
│                                                                 │
│  4. UPDATE          ← ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘ │
│  ─────────                                                      │
│  Write new strategy adjustments to Firestore.                   │
│  Next review loads v59. Loop repeats.                           │
└─────────────────────────────────────────────────────────────────┘
```

**Why this is novel:** The agent uses Arize Phoenix not just for passive observability but as an active data source for self-reflection. The agent reads its own past execution traces, identifies patterns in what it missed, and writes structured improvements to a living strategy document. No human touches the review logic between runs.

---

## Architecture

```
┌────────────────────────────────────────────────────────────────────┐
│  BROWSER                                                           │
│  Next.js 15 App (Cloud Run)                                        │
│  /review · /history · /strategy · /improvement · /traces · /pr    │
└──────────────────────────┬─────────────────────────────────────────┘
                           │ REST + Server-Sent Events (SSE)
┌──────────────────────────▼─────────────────────────────────────────┐
│  AGENT BACKEND (Cloud Run)                                         │
│  FastAPI + Google ADK + Gemini 3 Flash Preview (Vertex AI)         │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │ Tool Suite                                                  │  │
│  │  analyze_code · web_search · run_evaluation                 │  │
│  │  generate_report · update_strategy                          │  │
│  │  phoenix_query_traces · phoenix_query_evaluations           │  │
│  └─────────────────────────────────────────────────────────────┘  │
└────────────┬──────────────────────────────┬────────────────────────┘
             │ OTEL traces                  │ Reads/Writes
┌────────────▼────────────┐    ┌────────────▼────────────────────────┐
│  Arize Phoenix Cloud    │    │  Cloud Firestore                    │
│  Full span tree per     │    │  reviews · pr_reviews               │
│  trace, queryable via   │    │  agent_strategy · eval_history      │
│  GraphQL API            │    │  blind_spots                        │
└─────────────────────────┘    └─────────────────────────────────────┘
```

**Google Cloud services used:**
| Service | Purpose |
|---------|---------|
| **Vertex AI** (Gemini 3 Flash Preview) | Primary LLM for review and LLM-as-Judge evaluation |
| **Cloud Run** | Serverless containers for agent backend + Next.js frontend |
| **Cloud Firestore** | Persistent strategy versions, reviews, eval scores, blind spots |
| **Cloud Secret Manager** | API keys (Phoenix, Google Search) |
| **Artifact Registry** | Docker image storage |
| **GitHub Actions** | CI/CD pipeline → Cloud Run deployment |

---

## Features

### Code Review (`/review`)
- Paste any React/TSX component
- Live streaming of tool calls and findings via SSE
- Reports findings with dimension, severity (error/warning/info), line numbers, and specific fix suggestions

### PR Review (`/pr-reviews`)
- Paste any public GitHub PR URL
- Agent fetches changed files, reviews top-priority files (code before config/docs)
- Streams per-file, per-hunk progress
- Posts findings aligned to diff positions (ready for GitHub inline comments)

### Review History (`/history`)
- Full history of all reviews with strategy version tag
- Expand any review to see the complete report

### Agent Strategy (`/strategy`)
- Timeline of every strategy version from v1 → current
- Each version shows: dimension, action (ADD_CHECK/CALIBRATE/DEPRIORITIZE), detail, rationale, priority

### Self-Improvement Dashboard (`/improvement`)
- Line charts for all four eval dimensions over time
- Identified blind spots (dimensions consistently scoring below 0.80)
- **Before/After Comparison**: pick any component reviewed at v1 and v58 — see side by side what the agent learned to catch

### Trace Explorer (`/traces`)
- Paginated view of every trace from Arize Phoenix
- Expandable spans with attributes (LLM inputs/outputs, tool parameters)
- Direct link to each trace in the Arize portal

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Agent runtime | Google ADK (`google-adk>=1.32.0`) |
| LLM | Gemini 3 Flash Preview via Vertex AI |
| Tracing | Arize Phoenix OTEL (`arize-phoenix-otel`) + `openinference-instrumentation-google-adk` |
| Observability data source | Phoenix GraphQL HTTP API (httpx — no Node.js needed on Cloud Run) |
| Web backend | FastAPI + Uvicorn (SSE, CORS) |
| Frontend | Next.js 15 App Router, React 19, TypeScript, Tailwind CSS v4 |
| Charts | Recharts |
| Persistence | Cloud Firestore |
| Deployment | Cloud Run + GitHub Actions + Artifact Registry |

---

## The Arize Integration

TraceForge integrates Arize Phoenix at two levels:

**Level 1 — Passive observability (standard)**
Every agent run is automatically instrumented via `openinference-instrumentation-google-adk`. Every tool call, LLM invocation, and token count is traced to Phoenix Cloud.

**Level 2 — Active self-reflection (novel)**
The agent uses a custom Phoenix GraphQL client (`tools/phoenix_query.py`) to query its own past traces during the reflection phase. It reads:
- Root span names and statuses → identifies which review phases had errors
- Span names per trace → detects patterns in tool call sequences
- Error spans → surfaces recurring failure modes

This data feeds directly into the `update_strategy` step. The agent is not just observed by Phoenix — it *reads* Phoenix to improve itself.

---

## Self-Improvement Evidence

The `agent_strategy` Firestore collection shows the evolution:

**v1 (initial):** "Use the default review checklist."

**v58 (after 50+ reviews — agent-discovered):**
- `[accessibility] ADD_CHECK: Verify icon-only buttons have aria-label`
- `[performance] ADD_CHECK: Flag useCallback missing from event handlers passed to memoized children`
- `[security] CALIBRATE: Downgrade severity for dangerouslySetInnerHTML when content is server-controlled`
- `[best_practices] ADD_CHECK: Flag array index used as key in lists with add/remove operations`
- `[performance] ADD_CHECK: Check for inline object/array literals in JSX props (breaks referential equality)`
- ...and 50+ more learned checks

None of these were written by a human. Every adjustment was discovered by the agent analyzing its own past performance.

---

## Evaluation Methodology (LLM-as-Judge)

After every review, the agent evaluates its own output across four dimensions:

| Dimension | What it measures |
|-----------|-----------------|
| **Completeness** | Did all 4 review dimensions get coverage? Were patterns missed? |
| **Accuracy** | Are the findings real issues? Are suggestions technically correct? |
| **Actionability** | Are suggestions specific enough to implement without guessing? |
| **Calibration** | Are severity levels appropriate? (No false errors, no missed warnings) |

Scores are stored in `eval_history` and displayed as trend lines in `/improvement`. A sustained dip below 0.80 in any dimension triggers a strategy update in the next reflection cycle.

---

## Running Locally

```bash
# 1. Clone
git clone https://github.com/gvsrusa/trace-forge.git
cd trace-forge

# 2. Configure agent
cd agent
cp .env.example .env
# Edit .env:
#   GOOGLE_CLOUD_PROJECT=your-gcp-project
#   GOOGLE_CLOUD_LOCATION=global
#   GEMINI_MODEL=gemini-3-flash-preview
#   PHOENIX_API_KEY=your-phoenix-key
#   PHOENIX_COLLECTOR_ENDPOINT=https://app.phoenix.arize.com/s/your-space
#   PHOENIX_PROJECT_NAME=traceforge

uv sync
uv run uvicorn main:app --reload --port 8080

# 3. Configure and run frontend (new terminal)
cd web
npm install
cp .env.example .env.local
# Edit .env.local:
#   NEXT_PUBLIC_AGENT_URL=http://localhost:8080

npm run dev

# 4. Open http://localhost:3000
```

---

## Deployment (Cloud Run via GitHub Actions)

Every push to `master` triggers `.github/workflows/deploy.yml`:
1. Build agent Docker image → Artifact Registry
2. Build web Docker image → Artifact Registry
3. Deploy agent to Cloud Run (2–4Gi memory, 300s timeout)
4. Deploy web to Cloud Run (512Mi, `AGENT_BACKEND_URL` injected from agent Cloud Run URL)

Required GitHub Secrets:
- `GCP_SA_KEY` — Service account JSON with Cloud Run, Artifact Registry, Secret Manager roles
- `GCP_PROJECT_ID` — Google Cloud project ID

---

## Repository Structure

```
trace-forge/
├── agent/                          # Python ADK backend
│   ├── main.py                     # FastAPI app, all API endpoints
│   ├── agent.py                    # LlmAgent definition, run_review/run_pr_file_review
│   ├── instrumentation.py          # Phoenix OTEL setup
│   ├── tools/
│   │   ├── analyze_code.py         # React component parser
│   │   ├── phoenix_query.py        # Phoenix GraphQL client (traces + evals)
│   │   ├── run_evaluation.py       # LLM-as-Judge scoring
│   │   ├── generate_report.py      # Findings compiler
│   │   ├── update_strategy.py      # Firestore strategy writer
│   │   ├── fetch_repo.py           # GitHub repo component extractor
│   │   └── web_search.py           # Google Custom Search wrapper
│   ├── prompts/
│   │   ├── review_system.py        # Main review + reflection system prompt
│   │   ├── pr_review_system.py     # PR diff review system prompt
│   │   └── reflection_system.py   # Standalone reflection prompt
│   ├── db/
│   │   └── firestore.py            # All Firestore read/write functions
│   └── github/
│       ├── public_client.py        # GitHub API client (public repos)
│       └── pr_handler.py           # PR diff fetcher + hunk splitter
├── web/                            # Next.js 15 frontend
│   ├── app/
│   │   ├── review/page.tsx         # Code review UI
│   │   ├── history/page.tsx        # Review history
│   │   ├── strategy/page.tsx       # Strategy timeline
│   │   ├── improvement/page.tsx    # Eval trends + blind spots
│   │   ├── traces/page.tsx         # Trace explorer
│   │   └── pr-reviews/page.tsx     # PR review UI
│   └── components/
│       ├── TraceList.tsx           # Paginated trace viewer
│       ├── Sidebar.tsx             # Desktop nav + mobile bottom nav
│       └── ...
├── demo/test-components/           # Flawed React components for demo
├── infra/                          # Cloud Build YAML
├── .github/workflows/deploy.yml   # GitHub Actions CI/CD
├── HACKATHON_SUBMISSION.md         # This file
└── VIDEO_GUIDE.md                  # Video recording script
```

---

## Why TraceForge Wins the Arize Track

1. **Arize is not optional infrastructure — it is the feedback mechanism.** The agent reads its own Phoenix traces as part of every review cycle. Remove Phoenix and the self-improvement loop breaks.

2. **Measurable improvement curve.** Eval scores and strategy versions are timestamped in Firestore. The improvement from v1 to v58 is quantifiable, not anecdotal.

3. **Full production deployment.** Both services run on Cloud Run with automated CI/CD, real environment secrets, and error handling for Cloud Run's 32MB response limit and Gemini's 1M token context limit.

4. **Multi-modal agent capability.** Code review + PR diff analysis + repo scanning + web search + eval + self-reflection — all wired in a single ADK agent with real tool orchestration.

5. **Novel use of Vertex AI.** Uses Gemini 3 Flash Preview (global endpoint) as both the primary reviewer and the LLM-as-Judge evaluator — two distinct roles in the same agent loop.
