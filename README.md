# TraceForge

**A self-improving React code review agent — powered by Google ADK, Gemini 3, and Arize Phoenix.**

Built for the [Google Cloud Rapid Agent Hackathon](https://rapid-agent.devpost.com/) — Arize Track.

🔗 **Live demo:** https://traceforge-web-934052914225.us-central1.run.app

---

## What it does

TraceForge reviews React components across 4 dimensions — performance, accessibility, best practices, and security — then **evaluates its own output** and **updates its review strategy** after every run. Each review is traced end-to-end in Arize Phoenix Cloud so you can inspect every LLM call, tool invocation, and token count.

### The self-improvement loop

```
1. Review    → agent analyzes component across 4 dimensions
2. Evaluate  → LLM-as-Judge scores completeness, accuracy, actionability, calibration
3. Reflect   → agent queries its own past traces via Phoenix MCP
4. Update    → agent writes strategy adjustments to Firestore (v1 → v2 → v3 ...)
5. Repeat    → next review loads latest strategy → improved coverage
```

After 50+ reviews the agent has updated its strategy to v58, adding specific checks for icon-only button labels, memoization chain verification, inline style detection, and dozens more — none of which were in the original prompt.

---

## Screenshots

| Review (live streaming) | Self-Improvement chart | Before/After Comparison |
|---|---|---|
| Agent streams tool calls + report in real time | Eval scores across 50+ runs | v1 vs v58 — what the agent learned |

---

## Tech stack

| Layer | Technology |
|---|---|
| Agent runtime | [Google ADK](https://google.github.io/adk-docs/) (Python) |
| LLM | Gemini 3 Flash Preview via Vertex AI (`location=global`) |
| Tracing | `openinference-instrumentation-google-adk` → Arize Phoenix Cloud |
| Self-introspection | `@arizeai/phoenix-mcp` — agent queries its own past traces |
| Web framework | FastAPI + Server-Sent Events |
| Frontend | Next.js 15 App Router + Tailwind CSS v4 + Recharts |
| Persistence | Cloud Firestore (reviews, strategy versions, eval history) |
| Hosting | Cloud Run (2 services) |

---

## Quickstart (local)

### Prerequisites
- Python 3.12+, `uv`, Node 20+, `npm`
- GCP project with Vertex AI + Firestore enabled
- [Arize Phoenix Cloud](https://app.phoenix.arize.com) account + API key
- `gcloud auth application-default login` with quota project set

### 1. Clone and configure

```bash
git clone <repo-url>
cd trace-forge
```

Copy and fill in the agent env:

```bash
cp agent/.env.example agent/.env
```

```env
GOOGLE_GENAI_USE_VERTEXAI=1
GOOGLE_CLOUD_PROJECT=your-gcp-project-id
GOOGLE_CLOUD_LOCATION=global
GEMINI_MODEL=gemini-3-flash-preview

PHOENIX_API_KEY=your-phoenix-api-key
PHOENIX_COLLECTOR_ENDPOINT=https://app.phoenix.arize.com/s/your-space
PHOENIX_PROJECT_NAME=traceforge

FIRESTORE_DATABASE=(default)
```

Copy the web env:

```bash
cp web/.env.example web/.env.local
# Set NEXT_PUBLIC_AGENT_URL=http://localhost:8080
```

### 2. Run the agent backend

```bash
cd agent
uv sync
uv run uvicorn main:app --reload --port 8080
```

### 3. Run the frontend

```bash
cd web
npm install
npm run dev
```

Open **http://localhost:3000** → paste any React component → click **▶ Review**.

---

## Project structure

```
trace-forge/
├── agent/                  ← Python ADK agent (Cloud Run service 1)
│   ├── main.py             ← FastAPI app + SSE endpoint
│   ├── agent.py            ← Root ADK LlmAgent definition
│   ├── instrumentation.py  ← Phoenix OTEL registration
│   ├── tools/
│   │   ├── analyze_code.py      ← React component parser
│   │   ├── run_evaluation.py    ← LLM-as-Judge eval (Gemini)
│   │   ├── phoenix_query.py     ← Phoenix MCP wrapper
│   │   ├── update_strategy.py   ← Firestore strategy writer
│   │   └── generate_report.py  ← Report compiler
│   └── db/firestore.py     ← Firestore CRUD helpers
│
├── web/                    ← Next.js 15 frontend (Cloud Run service 2)
│   └── app/
│       ├── review/         ← Code input + live SSE streaming
│       ├── history/        ← Past reviews from Firestore
│       ├── traces/         ← Phoenix Cloud trace list
│       ├── strategy/       ← Agent strategy versions
│       ├── improvement/    ← Eval score trend charts
│       └── architecture/   ← System diagram
│
├── demo/test-components/   ← Pre-built flawed React components
│   ├── ProductCard.tsx     ← XSS, missing alt, no memo
│   ├── SearchModal.tsx     ← No debounce, missing aria, XSS
│   └── DataTable.tsx       ← Prop mutation, no aria-sort, index keys
│
└── infra/
    ├── cloudbuild.yaml     ← CI/CD pipeline
    └── setup.sh            ← GCP project bootstrap
```

---

## Cloud Run deployment

```bash
cd trace-forge

# Store secrets
echo -n "your-phoenix-key" | gcloud secrets create phoenix-api-key --data-file=-

# Deploy agent
gcloud run deploy traceforge-agent \
  --source ./agent \
  --region=us-central1 \
  --allow-unauthenticated \
  --memory=2Gi \
  --set-env-vars="GOOGLE_GENAI_USE_VERTEXAI=1,GOOGLE_CLOUD_PROJECT=YOUR_PROJECT,GOOGLE_CLOUD_LOCATION=global,GEMINI_MODEL=gemini-3-flash-preview,PHOENIX_COLLECTOR_ENDPOINT=https://app.phoenix.arize.com/s/YOUR_SPACE,PHOENIX_PROJECT_NAME=traceforge,FIRESTORE_DATABASE=(default)" \
  --set-secrets="PHOENIX_API_KEY=phoenix-api-key:latest"

# Deploy web (replace AGENT_URL with the URL from above)
gcloud run deploy traceforge-web \
  --source ./web \
  --region=us-central1 \
  --allow-unauthenticated \
  --set-env-vars="AGENT_BACKEND_URL=AGENT_URL" \
  --set-secrets="PHOENIX_API_KEY=phoenix-api-key:latest"
```

---

## Key design decisions

**Why `location=global` for Gemini?**  
Gemini 3 models are only available via `location=global` on Vertex AI — standard regional endpoints (e.g., `us-central1`) return 404.

**Why Server-Sent Events instead of WebSockets?**  
SSE is unidirectional, stateless, and works through Cloud Run's HTTP/2 without extra infrastructure. The review is a one-shot async stream — SSE is the right fit.

**Why sync Firestore in an async app?**  
Firebase Admin SDK is synchronous only. FastAPI endpoints use `run_in_executor` to call Firestore without blocking the event loop. ADK tool functions call Firestore directly (sync context).

**Why LLM-as-Judge instead of a rules engine?**  
Rule-based evals can't assess *actionability* or *calibration* — subjective qualities that require semantic understanding. Using Gemini to score Gemini's output provides a self-contained improvement signal that improves as the model improves.

---

## License

Apache 2.0 — see [LICENSE](LICENSE).

Built by Venkata Subbarao Gorantla for the Google Cloud Rapid Agent Hackathon 2026.
