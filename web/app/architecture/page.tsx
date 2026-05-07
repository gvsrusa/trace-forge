export default function ArchitecturePage() {
  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <div>
        <h1 className="text-lg font-bold" style={{ color: "var(--text)" }}>
          System Architecture
        </h1>
        <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
          How TraceForge works end-to-end.
        </p>
      </div>

      <div
        className="rounded p-5 text-xs leading-relaxed"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <pre style={{ color: "var(--text)", fontFamily: "inherit", whiteSpace: "pre-wrap" }}>{`
┌─────────────────────────────────────────────────────────────┐
│                     TraceForge System                        │
│                                                             │
│  ┌──────────────┐    SSE stream    ┌──────────────────────┐ │
│  │  Next.js 15  │ ←────────────── │   FastAPI (Python)   │ │
│  │  Dashboard   │ ──POST /review─→ │   + ADK Runner       │ │
│  └──────────────┘                 └──────────┬───────────┘ │
│                                              │              │
│                                    ┌─────────▼───────────┐  │
│                                    │   LlmAgent (ADK)    │  │
│                                    │   gemini-3-flash     │  │
│                                    │                     │  │
│                                    │  Tools:             │  │
│                                    │  • analyze_code     │  │
│                                    │  • google_search    │  │
│                                    │  • run_evaluation   │  │
│                                    │  • phoenix_query    │  │
│                                    │  • update_strategy  │  │
│                                    │  • generate_report  │  │
│                                    └──┬──────────────┬───┘  │
│                                       │              │       │
│                               ┌───────▼───┐  ┌──────▼────┐ │
│                               │ Firestore │  │  Arize    │ │
│                               │ reviews   │  │  Phoenix  │ │
│                               │ strategy  │  │  Cloud    │ │
│                               │ eval_hist │  │  (OTEL)   │ │
│                               └───────────┘  └───────────┘ │
└─────────────────────────────────────────────────────────────┘

Self-Improvement Loop
─────────────────────
1. Agent reviews component → generates findings
2. run_evaluation scores the review (LLM-as-Judge)
3. phoenix_query_traces reads past trace data
4. Agent reflects: identifies blind spots + calibration gaps
5. update_strategy persists adjustments to Firestore v(n+1)
6. Next review loads strategy v(n+1) → improved coverage
        `}</pre>
      </div>

      <div className="grid grid-cols-2 gap-3 text-xs">
        {[
          ["Agent Runtime", "Google ADK (Python) + Gemini 3 Flash Preview via Vertex AI"],
          ["Tracing", "OpenInference auto-instrumentation → Arize Phoenix Cloud"],
          ["Self-Introspection", "@arizeai/phoenix-mcp — agent queries its own past traces"],
          ["Persistence", "Cloud Firestore — reviews, strategy versions, eval history"],
          ["Frontend", "Next.js 15 App Router + Tailwind CSS v4 + Recharts"],
          ["Hosting", "Cloud Run — 2 services (agent + web)"],
        ].map(([label, desc]) => (
          <div
            key={label}
            className="rounded p-3"
            style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
          >
            <div style={{ color: "var(--accent)" }} className="font-semibold mb-1">{label}</div>
            <div style={{ color: "var(--muted)" }}>{desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
