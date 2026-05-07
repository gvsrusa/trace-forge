# TraceForge — Product Requirements Document

**Project:** TraceForge — A Self-Improving React Code Review Agent  
**Hackathon:** Google Cloud Rapid Agent Hackathon (May 5 – Jun 11, 2026)  
**Track:** Arize  
**Author:** Venkata  
**Last Updated:** May 6, 2026  
**Deadline:** June 11, 2026 @ 2:00 PM PDT

---

## 1. Executive Summary

TraceForge is an AI-powered agent that reviews React components for performance, accessibility, and best practices — then uses Arize Phoenix to analyze its own review quality and autonomously improves with each run. Unlike traditional linters or one-shot AI code reviewers, TraceForge maintains a persistent self-improvement loop: every review is traced, evaluated, and fed back into the agent's strategy, producing measurably better reviews over time.

**Target hackathon track:** Arize ($5K / $3K / $2K prizes)

**Core thesis:** Most Arize track entries will bolt Phoenix tracing onto a generic agent as an afterthought. TraceForge makes self-improvement *the hero feature* — the Phoenix MCP server isn't just monitoring, it's the agent's brain.

---

## 2. Problem Statement

Frontend code reviews are inconsistent, time-consuming, and dependent on reviewer expertise. Senior developers spend 5–10 hours per week reviewing PRs, and quality varies based on fatigue, familiarity with the codebase, and individual blind spots. Static linters catch syntax issues but miss architectural problems, performance anti-patterns, and accessibility gaps.

Existing AI code review tools generate one-shot feedback but never learn from their mistakes. They repeat the same blind spots on every review, have no memory of what they missed before, and offer no visibility into *why* they produce the feedback they do.

**TraceForge solves this by building a review agent that:**

1. Performs deep, multi-dimensional React component reviews
2. Makes every reasoning step transparent via Phoenix tracing
3. Self-evaluates its own review quality using LLM-as-Judge
4. Queries its own past traces via Phoenix MCP to identify systematic blind spots
5. Autonomously adjusts its review strategy based on what it learns
6. Provides a visual dashboard showing improvement metrics over time

---

## 3. Hackathon Alignment

### 3.1 Hackathon Requirements Checklist

| Requirement | How TraceForge Satisfies It |
|---|---|
| Functional agent solving a real-world challenge | Code review is a daily pain point for every dev team |
| Powered by Gemini 3 | Gemini 3 via Google ADK on Vertex AI |
| Built with Google Cloud Agent Builder / ADK | Google ADK (Python) as agent runtime |
| Integrates partner MCP server meaningfully | Phoenix MCP server is the core self-improvement mechanism |
| Move beyond chat — use tools to accomplish tasks | Agent uses 6+ tools: code analyzer, web search, Phoenix MCP queries, eval runner, strategy updater, report generator |
| Multi-step mission with planning | Agent plans sub-tasks (perf audit, a11y check, best practices, security), executes them, then enters reflection mode |
| Human-in-the-loop oversight | Operator dashboard with approve/reject/modify cards for each review action |
| Hosted URL | Deployed on Cloud Run with custom domain |
| Public open-source repo with OSS license | GitHub repo with Apache 2.0 license |
| ~3 minute demo video | Scripted demo showing two reviews with measurable self-improvement between them |

### 3.2 Arize Track-Specific Requirements

| Arize Requirement | Implementation |
|---|---|
| Code-owned agent runtime (NOT visual Agent Builder alone) | Google ADK (Python) deployed on Cloud Run |
| Instrument with OpenInference | `openinference-instrumentation-google-adk` auto-instrumentor |
| Send traces to Phoenix Cloud or self-hosted | Phoenix Cloud (free tier) via API key |
| Configure Phoenix MCP server for runtime introspection | `@arizeai/phoenix-mcp` in agent's MCP client config |
| Run evaluations with LLM-as-Judge or code evals | Phoenix LLM-as-Judge evals on review quality, completeness, and accuracy |
| Bonus: agent uses own observability data to improve | Core feature — agent queries past traces, identifies blind spots, updates strategy |

### 3.3 Judging Criteria Mapping

| Criterion (25% each) | TraceForge's Competitive Edge |
|---|---|
| **Technological Implementation** | Full OpenInference tracing, Phoenix MCP introspection, LLM-as-Judge evals, Google ADK, Cloud Run, Firestore — hits every Arize checkbox |
| **Design** | Professional Next.js operator console with trace timeline, code annotation view, improvement charts, self-assessment panel. Built by a 10-year React/frontend specialist. |
| **Potential Impact** | Every dev team needs code review. Self-improving agent adapts to team patterns. Scales from solo dev to enterprise. |
| **Quality of the Idea** | "Agent that debugs itself" is Arize's own product vision materialized. Makes Phoenix MCP the core feature, not an add-on. |

---

## 4. Target Users

**Primary persona:** Frontend tech leads and senior developers who review React code daily and want a tireless, improving reviewer that catches what they miss.

**Secondary persona:** Solo developers or small teams without dedicated reviewers who need expert-level feedback on their React components.

**Hackathon demo persona:** A frontend developer (the builder themselves) using TraceForge on their own portfolio project code.

---

## 5. Core Features

### 5.1 Multi-Dimensional Code Review Agent

The agent performs a structured, multi-step review of React components across four dimensions:

**5.1.1 Performance Audit**
- Unnecessary re-renders detection (missing `React.memo`, `useMemo`, `useCallback`)
- Bundle impact analysis (heavy imports, tree-shaking opportunities)
- Render-blocking patterns (synchronous operations in render path)
- State management anti-patterns (prop drilling, excessive context re-renders)
- Image and asset optimization suggestions

**5.1.2 Accessibility Check**
- ARIA role validation and semantic HTML usage
- Keyboard navigation completeness (focus management, tab order)
- Screen reader compatibility (alt text, live regions, announcements)
- Color contrast and visual accessibility
- Focus trap handling in modals/dialogs

**5.1.3 Best Practices Analysis**
- React Hook rules compliance
- Component composition patterns (SRP, reusability)
- Error boundary coverage
- TypeScript type safety (if applicable)
- Testing coverage suggestions
- Naming conventions and code organization

**5.1.4 Security Scan**
- XSS vulnerability detection (`dangerouslySetInnerHTML`, unescaped user input)
- Dependency risk flagging
- Sensitive data exposure in client-side code
- Authentication/authorization pattern review

### 5.2 Phoenix Tracing Integration (OpenInference)

Every agent action is traced end-to-end:

- **Span-level tracing** for each review sub-task (perf, a11y, best practices, security)
- **Tool call traces** showing input/output for every tool invocation
- **LLM call traces** with prompt, completion, token counts, and latency
- **Metadata annotations** for review severity, dimension, and confidence score
- **Trace export** to Phoenix Cloud via OpenInference auto-instrumentor

### 5.3 Self-Improvement Loop (Phoenix MCP — Core Feature)

This is the differentiating feature. After each review, the agent enters **Reflection Mode**:

**Step 1 — Self-Evaluate:** Agent runs LLM-as-Judge evaluations on its own review output, scoring for completeness (did it cover all four dimensions?), accuracy (are the findings real issues?), actionability (are suggestions specific enough to implement?), and severity calibration (are critical issues marked as critical?).

**Step 2 — Trace Introspection:** Agent queries Phoenix MCP server to pull its own traces from the current and past N runs. It analyzes: which sub-tasks took the longest (latency bottlenecks), which tool calls returned low-quality results, which review dimensions consistently score lowest, and what patterns of code it tends to miss.

**Step 3 — Pattern Recognition:** Agent identifies systematic blind spots across multiple runs. Example outputs: "I miss `useCallback` optimization opportunities in event handler props 70% of the time," "My accessibility reviews don't check for focus traps in modal components," or "I over-flag `dangerouslySetInnerHTML` in SSR-hydrated content where it's actually safe."

**Step 4 — Strategy Update:** Agent generates an updated review strategy — a structured document of priority adjustments, new checks to add, checks to calibrate, and patterns to watch for. This is persisted in Firestore and loaded at the start of the next review.

**Step 5 — Verification:** On the next review, agent cross-references its strategy updates against actual findings. Did the adjustments lead to catching previously missed issues? Did calibration reduce false positives? Results feed back into the eval pipeline.

### 5.4 Operator Dashboard (Next.js)

The frontend is the design-score differentiator. Built in Next.js 15 with Tailwind CSS:

**5.4.1 Review Workspace**
- Code input panel (paste code or provide GitHub URL)
- Live agent progress feed showing each reasoning step as it happens
- Final review output with inline code annotations (diff-style severity highlighting)
- Approve/reject/modify cards for each finding (human-in-the-loop)

**5.4.2 Trace Explorer**
- Phoenix trace timeline visualization for the current review
- Span-level drill-down showing tool calls, LLM prompts, and outputs
- Latency heatmap across review dimensions
- Token usage breakdown per sub-task

**5.4.3 Self-Improvement Dashboard**
- Improvement trend charts (eval scores over time by dimension)
- Agent self-assessment panel showing the latest reflection notes
- Blind spot tracker — a running list of identified weaknesses and their status (detected → addressed → verified)
- Before/after comparison: side-by-side view of how the agent's review quality changed for similar components

**5.4.4 Eval Results Panel**
- LLM-as-Judge scores per review (completeness, accuracy, actionability, calibration)
- Score distribution histograms across all past reviews
- Failing eval cases highlighted with the agent's self-diagnosis

---

## 6. System Architecture

### 6.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER / BROWSER                           │
│                   Next.js 15 Operator Console                   │
└──────────────────────────┬──────────────────────────────────────┘
                           │ HTTPS
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                     CLOUD RUN (Frontend)                        │
│                   Next.js SSR + API Routes                      │
└──────────────────────────┬──────────────────────────────────────┘
                           │ REST / WebSocket
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                   CLOUD RUN (Agent Backend)                     │
│              Google ADK Agent (Python)                          │
│                                                                 │
│  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌─────────────┐  │
│  │ Code      │  │ Web       │  │ Phoenix   │  │ Strategy    │  │
│  │ Analyzer  │  │ Search    │  │ MCP Client│  │ Manager     │  │
│  │ Tool      │  │ Tool      │  │ Tool      │  │ Tool        │  │
│  └───────────┘  └───────────┘  └───────────┘  └─────────────┘  │
│                                                                 │
│  ┌───────────┐  ┌───────────┐                                   │
│  │ Eval      │  │ Report    │                                   │
│  │ Runner    │  │ Generator │                                   │
│  │ Tool      │  │ Tool      │                                   │
│  └───────────┘  └───────────┘                                   │
│                                                                 │
│           OpenInference Auto-Instrumentor                       │
└──────┬────────────────┬─────────────────────────────────────────┘
       │                │
       ▼                ▼
┌──────────────┐  ┌───────────────┐    ┌─────────────────────────┐
│ Phoenix Cloud│  │ Firestore     │    │ Secret Manager          │
│ (Arize)      │  │               │    │                         │
│              │  │ - Review      │    │ - Phoenix API Key       │
│ - Traces     │  │   History     │    │ - GCP Credentials       │
│ - Evals      │  │ - Agent       │    │                         │
│ - Datasets   │  │   Strategy    │    └─────────────────────────┘
│ - MCP Server │  │ - Eval        │
│              │  │   Results     │
└──────────────┘  │ - Improvement │
                  │   Logs        │
                  └───────────────┘
```

### 6.2 Tech Stack

| Layer | Technology | Justification |
|---|---|---|
| Agent Runtime | Google ADK (Python) | Arize requires code-owned runtime; ADK has first-party OpenInference instrumentor |
| LLM | Gemini 3 via Vertex AI | Hackathon requirement |
| Tracing | OpenInference → Phoenix Cloud | Arize requirement; `openinference-instrumentation-google-adk` |
| Self-Introspection | `@arizeai/phoenix-mcp` | Arize requirement; enables runtime trace queries |
| Evals | Phoenix LLM-as-Judge | Arize bonus criterion; scores review quality |
| Frontend | Next.js 15 + Tailwind CSS | SSR for performance, Tailwind for rapid UI iteration |
| State/Persistence | Cloud Firestore | Agent strategy, review history, eval results |
| Backend Hosting | Cloud Run (2 services) | One for agent backend, one for Next.js frontend |
| Secrets | Google Secret Manager | Phoenix API key, other credentials |
| CI/CD | Cloud Build | Auto-deploy on push to main |
| License | Apache 2.0 | Required by hackathon; detectable on GitHub |

### 6.3 Agent Tool Schema

```
Tool 1: analyze_code
  Input:  { code: string, language: "tsx" | "jsx" | "ts" | "js", filename?: string }
  Output: { ast_summary: string, component_tree: string, hook_usage: array, imports: array }
  Purpose: Parse and extract structural information from the submitted code

Tool 2: web_search
  Input:  { query: string, num_results?: number }
  Output: { results: array<{ title, url, snippet }> }
  Purpose: Look up latest React docs, best practice guides, CVE databases

Tool 3: phoenix_query_traces
  Input:  { query: string, time_range?: string, limit?: number }
  Output: { traces: array<{ trace_id, spans, latency, token_count, metadata }> }
  Purpose: Query agent's own past traces via Phoenix MCP server
  Note:   This is the self-introspection tool — the heart of the self-improvement loop

Tool 4: phoenix_query_evaluations
  Input:  { dataset_id?: string, eval_name?: string, time_range?: string }
  Output: { evaluations: array<{ eval_id, scores, annotations, trace_id }> }
  Purpose: Query past evaluation results to identify score trends and regressions

Tool 5: run_evaluation
  Input:  { review_output: string, original_code: string, eval_criteria: array<string> }
  Output: { scores: object<criterion, score>, reasoning: string, suggestions: string }
  Purpose: Run LLM-as-Judge evaluation on the agent's own review output

Tool 6: update_strategy
  Input:  { adjustments: array<{ dimension, action, rationale, priority }> }
  Output: { strategy_version: number, changes_applied: array }
  Purpose: Persist strategy updates to Firestore for future reviews

Tool 7: generate_report
  Input:  { findings: array, code: string, eval_scores: object, strategy_notes: string }
  Output: { report: string, annotations: array<{ line, severity, message, dimension }> }
  Purpose: Compile final review report with inline code annotations
```

---

## 7. Agent Workflow — Detailed Step-by-Step

### Phase 1: Review Execution

```
1. User submits React code via dashboard
2. Agent loads current strategy from Firestore (or uses defaults if first run)
3. Agent plans sub-tasks:
   a. Parse component structure (analyze_code tool)
   b. Performance audit (Gemini reasoning + strategy-informed checks)
   c. Accessibility audit (Gemini reasoning + web_search for latest WCAG)
   d. Best practices analysis (Gemini reasoning + strategy-informed checks)
   e. Security scan (Gemini reasoning + web_search for known CVEs)
4. Agent executes each sub-task sequentially
5. Each step is traced in Phoenix via OpenInference auto-instrumentor
6. Agent synthesizes findings into a structured review (generate_report tool)
7. Review is displayed in the dashboard with inline code annotations
```

### Phase 2: Self-Evaluation

```
8. Agent runs LLM-as-Judge eval on its own review output (run_evaluation tool)
   - Completeness: Did it cover all four dimensions?
   - Accuracy: Are findings real issues? (checked against known patterns)
   - Actionability: Are suggestions specific enough to implement?
   - Calibration: Are severity levels appropriate?
9. Eval scores are persisted to Firestore and displayed in the dashboard
```

### Phase 3: Self-Improvement (Reflection Mode)

```
10. Agent queries Phoenix MCP for its traces from this run + last N runs
    (phoenix_query_traces tool)
11. Agent queries past evaluations (phoenix_query_evaluations tool)
12. Gemini reasons over the combined data to identify:
    - Systematic blind spots (patterns missed across multiple reviews)
    - Latency bottlenecks (which sub-tasks are slowest)
    - Low-quality tool calls (which web searches returned irrelevant results)
    - Score trends (which dimensions are improving vs. declining)
13. Agent generates strategy adjustments (update_strategy tool)
    Example adjustments:
    - { dimension: "performance", action: "ADD_CHECK", rationale: "Missed useCallback
      in event handler props in 3 of last 5 reviews", priority: "high" }
    - { dimension: "accessibility", action: "CALIBRATE", rationale: "Over-flagging
      aria-label on decorative icons — reduce severity from 'error' to 'warning'",
      priority: "medium" }
14. Strategy is versioned and persisted to Firestore
15. Dashboard updates with new self-assessment notes and improvement metrics
```

### Phase 4: Verification (Next Run)

```
16. On next review, agent loads the updated strategy
17. After review, agent cross-references:
    - Did the new checks catch previously missed issues?
    - Did calibration adjustments reduce false positives?
    - Is the eval score for the adjusted dimensions higher?
18. Verification results feed back into the eval pipeline
19. Dashboard improvement trend chart updates
```

---

## 8. Data Models

### 8.1 Firestore Collections

**`reviews`** — One document per code review
```json
{
  "id": "review_001",
  "timestamp": "2026-05-15T14:30:00Z",
  "input_code": "...",
  "input_filename": "ProductCard.tsx",
  "findings": [
    {
      "id": "f1",
      "dimension": "performance",
      "severity": "warning",
      "line": 24,
      "message": "Missing useMemo on expensive filter operation...",
      "suggestion": "Wrap the filter call in useMemo with [products] dependency..."
    }
  ],
  "eval_scores": {
    "completeness": 0.85,
    "accuracy": 0.90,
    "actionability": 0.75,
    "calibration": 0.80
  },
  "trace_id": "phoenix_trace_abc123",
  "strategy_version": 3,
  "self_assessment": "Missed keyboard trap check in modal. Adding to strategy."
}
```

**`agent_strategy`** — Versioned strategy documents
```json
{
  "version": 3,
  "timestamp": "2026-05-15T14:35:00Z",
  "base_strategy": "default_v1",
  "adjustments": [
    {
      "dimension": "performance",
      "action": "ADD_CHECK",
      "detail": "Check for useCallback on event handler props passed to child components",
      "rationale": "Missed in reviews 001, 003, 004",
      "priority": "high",
      "added_at": "2026-05-14T10:00:00Z",
      "verified": true,
      "verification_note": "Caught in review 005 — confirmed effective"
    },
    {
      "dimension": "accessibility",
      "action": "CALIBRATE",
      "detail": "Reduce severity of aria-label on decorative SVG icons from error to info",
      "rationale": "False positive rate 60% over last 5 reviews",
      "priority": "medium",
      "added_at": "2026-05-15T14:35:00Z",
      "verified": false
    }
  ]
}
```

**`eval_history`** — Aggregated eval metrics for trend visualization
```json
{
  "review_id": "review_001",
  "timestamp": "2026-05-15T14:32:00Z",
  "scores": { "completeness": 0.85, "accuracy": 0.90, "actionability": 0.75, "calibration": 0.80 },
  "strategy_version": 3,
  "dimensions_reviewed": ["performance", "accessibility", "best_practices", "security"],
  "blind_spots_detected": ["modal_focus_trap"],
  "improvement_from_previous": { "completeness": 0.05, "accuracy": 0.00, "actionability": 0.10, "calibration": -0.05 }
}
```

---

## 9. Frontend Specifications

### 9.1 Pages and Routes

| Route | Page | Description |
|---|---|---|
| `/` | Home / Review Workspace | Code input + live agent progress + review output |
| `/traces` | Trace Explorer | Phoenix trace timeline, span drill-down, latency heatmap |
| `/improvement` | Self-Improvement Dashboard | Eval trends, blind spot tracker, before/after comparison |
| `/history` | Review History | Past reviews with filters by dimension, severity, score |
| `/architecture` | Architecture Overview | System diagram + tech stack (for judges) |

### 9.2 Design System

- **Framework:** Next.js 15 (App Router)
- **Styling:** Tailwind CSS with custom design tokens
- **Color scheme:** Dark mode default (demos look better on video), with light mode toggle
- **Typography:** Inter (body), JetBrains Mono (code)
- **Charts:** Recharts for improvement trends
- **Code display:** Custom syntax highlighting with annotation overlay
- **Animations:** Framer Motion for agent reasoning step transitions
- **Responsive:** Desktop-first (judges review on desktop), mobile not required for hackathon

### 9.3 Key UI Components

**AgentProgressFeed** — Real-time streaming display of agent reasoning steps. Each step renders as a card with: step name, dimension badge, status indicator (running/complete/failed), expandable detail showing the actual tool call and output.

**CodeAnnotationView** — Side-by-side or inline code display with severity-colored annotations. Each annotation is clickable to see the full finding detail, suggested fix, and agent's confidence score.

**ImprovementChart** — Recharts line chart showing eval scores (y-axis) over review count (x-axis), with separate lines for each dimension (completeness, accuracy, actionability, calibration). Strategy version changes marked as vertical dotted lines.

**BlindSpotTracker** — Table/Kanban of identified blind spots with status columns: Detected → Strategy Updated → Verified Fixed. Each entry links to the review where it was detected and the review where it was verified.

**SelfAssessmentPanel** — Card showing the agent's latest reflection notes in its own words, with links to the Phoenix traces that informed the assessment.

---

## 10. API Design

### 10.1 Frontend ↔ Agent Backend

```
POST /api/review
  Body: { code: string, filename?: string, language?: string }
  Response: SSE stream of agent steps + final review

GET /api/reviews
  Query: { limit?, offset?, dimension?, min_score? }
  Response: { reviews: array, total: number }

GET /api/reviews/:id
  Response: { review: object, traces: object, eval: object }

GET /api/strategy
  Response: { current_strategy: object, history: array }

GET /api/improvement
  Response: { eval_trends: array, blind_spots: array, summary: object }

POST /api/review/:id/feedback
  Body: { finding_id: string, action: "approve" | "reject" | "modify", note?: string }
  Response: { updated: boolean }
```

### 10.2 Agent Backend ↔ External Services

```
Agent → Phoenix Cloud:     OpenInference traces via OTLP/HTTP
Agent → Phoenix MCP:       MCP protocol via @arizeai/phoenix-mcp (stdio transport)
Agent → Vertex AI:         Gemini 3 API calls via Google ADK
Agent → Firestore:         State persistence via Firebase Admin SDK
Agent → Secret Manager:    Credential retrieval at startup
```

---

## 11. Deployment Architecture

### 11.1 Cloud Run Services

**Service 1: `traceforge-agent`**
- Runtime: Python 3.12
- Framework: Google ADK + FastAPI
- Port: 8080
- Min instances: 0 (scale to zero for cost)
- Max instances: 2 (hackathon budget constraint)
- Memory: 1Gi
- CPU: 1
- Env vars: `PHOENIX_API_KEY` (from Secret Manager), `GCP_PROJECT_ID`, `FIRESTORE_DATABASE`

**Service 2: `traceforge-web`**
- Runtime: Node.js 20
- Framework: Next.js 15
- Port: 3000
- Min instances: 0
- Max instances: 2
- Env vars: `AGENT_BACKEND_URL`, `NEXT_PUBLIC_APP_URL`

### 11.2 CI/CD

- **Trigger:** Push to `main` branch
- **Pipeline:** Cloud Build → build Docker images → deploy to Cloud Run
- **Environments:** Single environment (production). No staging for hackathon scope.

### 11.3 Domain and SSL

- Custom domain via Cloud Run domain mapping (e.g., `traceforge.dev`)
- SSL managed automatically by Cloud Run

---

## 12. Demo Script (3 Minutes)

### Segment 1 — Problem Frame (0:00 – 0:15)
Voice over dark screen: "Code reviews are inconsistent. Reviewers miss different things on different days. What if your reviewer got smarter every time?"

### Segment 2 — First Review (0:15 – 1:15)
- Paste a deliberately flawed React component into the dashboard (a `ProductCard.tsx` with missing memo, missing alt text, prop drilling, and an unsanitized innerHTML)
- Show agent planning 4 sub-tasks in the AgentProgressFeed
- Watch each sub-task complete with findings appearing in real-time
- Final review renders with inline code annotations — 3 warnings, 1 error, 2 info items
- Highlight: agent missed a keyboard focus trap issue in a dropdown

### Segment 3 — Phoenix Traces (1:15 – 1:45)
- Switch to Trace Explorer tab
- Show the trace timeline — every reasoning step, tool call, LLM invocation visible
- Drill into the accessibility sub-task span — show token count, latency, prompt

### Segment 4 — Self-Improvement in Action (1:45 – 2:15)
- Show agent entering Reflection Mode
- Agent queries Phoenix MCP for past traces
- Agent's self-assessment appears: "My accessibility reviews have not checked for keyboard focus traps in dropdown components. Adding this check to strategy."
- Show the strategy update persisting to Firestore

### Segment 5 — Second Review, Better Results (2:15 – 2:40)
- Submit a similar component with a dropdown focus trap issue
- Agent catches the focus trap issue this time (highlight it in the review)
- Cut to the Improvement Dashboard — show the completeness score tick up from 0.75 to 0.85
- Show the blind spot tracker: "dropdown_focus_trap" moved from "Detected" to "Verified Fixed"

### Segment 6 — Architecture + Close (2:40 – 3:00)
- Flash the Architecture page showing the system diagram
- Voice: "TraceForge — a code reviewer that debugs itself."
- Show GitHub repo URL on screen

---

## 13. Evaluation & Success Metrics

### 13.1 Agent Quality Metrics (Tracked in Phoenix)

| Metric | Target by Submission | Measurement |
|---|---|---|
| Review completeness score | ≥ 0.80 avg | LLM-as-Judge eval across 4 dimensions |
| Review accuracy score | ≥ 0.85 avg | Manual verification of findings on 10 test components |
| Measurable improvement | ≥ 15% score increase over 8+ reviews | Eval trend chart shows upward trajectory |
| Blind spots detected & fixed | ≥ 3 verified | Blind spot tracker shows Detected → Verified pipeline |
| Average review latency | < 60 seconds | Phoenix trace duration |
| Self-improvement loop completion | 100% of reviews | Every review triggers reflection mode |

### 13.2 Hackathon Submission Checklist

| Deliverable | Status |
|---|---|
| Hosted URL (Cloud Run) | ☐ |
| Public GitHub repo with Apache 2.0 license | ☐ |
| README with quickstart, architecture diagram, "Try it" link | ☐ |
| ~3 minute demo video | ☐ |
| Devpost submission form completed | ☐ |
| Track selection: Arize | ☐ |
| Phoenix Cloud account with traces visible | ☐ |
| Eval results visible in dashboard | ☐ |
| At least 8 reviews in history showing improvement trend | ☐ |

---

## 14. Test Components (Prepared for Demo)

Pre-built React components with known issues for deterministic demo scenarios:

**Component 1: `ProductCard.tsx` (Easy — first demo)**
- Missing `React.memo` on a frequently re-rendered card
- Missing `alt` text on product image
- Prop drilling of `onAddToCart` through 3 levels
- `dangerouslySetInnerHTML` on product description

**Component 2: `SearchModal.tsx` (Medium — second demo)**
- Missing keyboard focus trap in modal overlay
- No `aria-live` region for search results updates
- Synchronous filter operation in render path (should be `useMemo`)
- Missing `useCallback` on debounced search handler passed as prop
- No error boundary around API call results

**Component 3: `DataTable.tsx` (Hard — bonus if time permits)**
- Virtualization needed for large dataset rendering
- Missing column header `scope` attributes for a11y
- Inline styles instead of CSS classes (performance)
- State mutation in sort handler
- No loading/error states

---

## 15. Risk Register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Phoenix MCP server integration is fiddly / undocumented | High | High | Start MCP spike in Week 1 Day 1. Join Arize Discord. Email Richard Young if blocked. |
| Gemini 3 rate limits during demo | Medium | Critical | Request quota increase in Week 2. Add response caching for demo scenarios. Pre-record video as backup. |
| Self-improvement loop feels hand-wavy to judges | Medium | High | Pre-run 8+ reviews before submission so the improvement trend chart has real data. Include verified blind spots. |
| OpenInference instrumentor for ADK has breaking changes | Medium | Medium | Pin exact version. Test early. Have fallback to manual instrumentation. |
| Cloud Run cold starts slow down demo | Low | Medium | Set min instances to 1 the day before video recording. |
| Scope creep into too many review dimensions | Medium | Medium | Hard cap at 4 dimensions. No adding new ones after Week 3. |

---

## 16. Out of Scope (Explicitly Deferred)

These are valuable features intentionally cut for hackathon timeline:

- Multi-language support (only React/JSX/TSX for this submission)
- GitHub/GitLab PR integration (paste-only input for now)
- Team accounts / multi-user auth (single demo user)
- Mobile responsive UI (desktop-only for judges)
- Custom eval criteria editor (hardcoded 4 criteria)
- Auto-fix / code generation (review only, no writes)
- VS Code extension
- Webhook / CI pipeline integration

---

## 17. 5-Week Build Plan Summary

| Week | Focus | Key Deliverable |
|---|---|---|
| Week 1 (May 6–12) | Spike: ADK agent + Phoenix tracing + MCP hello-world | Agent calls one Phoenix MCP tool and traces are visible in Phoenix Cloud |
| Week 2 (May 13–19) | Core review agent: 4-dimension review with all tools | End-to-end review on test component with full tracing |
| Week 3 (May 20–26) | Self-improvement loop + evals | Reflection mode works, eval scores computed, strategy updates persist |
| Week 4 (May 27–Jun 2) | Operator dashboard polish | Trace explorer, improvement charts, blind spot tracker, code annotations |
| Week 5 (Jun 3–11) | Demo prep, video, bug bash, submission | 8+ pre-run reviews, demo video recorded, Devpost submitted by Jun 10 |

---

## 18. Open Questions

1. **Phoenix MCP server transport:** The Arize docs mention `@arizeai/phoenix-mcp` via npx. Need to confirm this works as an MCP client tool within a Python Google ADK agent (may need a bridge process or sidecar container).

2. **Gemini 3 model string:** Hackathon says "Gemini 3" — need to confirm the exact model ID available in Vertex AI at hackathon start (e.g., `gemini-3.0-pro` or similar).

3. **Phoenix Cloud free tier limits:** Confirm the free tier supports enough trace volume for 8+ pre-submission review runs without hitting caps.

4. **Arize starter repo:** The resources page has a placeholder link for the hackathon starter repo. Monitor for its release — it may include boilerplate that saves days.

5. **More partners TBA:** The overview says "And more partners to be announced!" — if a partner closer to DevTools (like GitLab) drops, consider whether switching tracks is worth the time cost.

---

*This PRD is a living document. Update after each week's review cycle.*
