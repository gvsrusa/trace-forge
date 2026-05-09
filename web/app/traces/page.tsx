import TraceList from "@/components/TraceList";

export const dynamic = "force-dynamic";

const AGENT = process.env.AGENT_BACKEND_URL ?? process.env.NEXT_PUBLIC_AGENT_URL ?? "http://localhost:8080";

async function getTraces(): Promise<{ traces: Record<string, unknown>[]; phoenix_base?: string } | { error: string }> {
  try {
    const res = await fetch(`${AGENT}/api/traces`, { cache: "no-store" });
    if (!res.ok) return { error: `Agent backend returned ${res.status}` };
    return res.json();
  } catch (e) {
    return { error: `Could not reach agent backend (${AGENT}): ${e}` };
  }
}

export default async function TracesPage() {
  const data = await getTraces();
  const fetchError = "error" in data ? data.error : null;
  const traces: Record<string, unknown>[] = "traces" in data ? data.traces : [];
  const phoenixBase: string = ("phoenix_base" in data ? data.phoenix_base ?? "https://app.phoenix.arize.com" : "https://app.phoenix.arize.com").replace(/\/$/, "");
  const phoenixTracesUrl = `${phoenixBase}/projects/traceforge/traces`;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold" style={{ color: "var(--text)" }}>
            Trace Explorer
          </h1>
          <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
            Every span, tool call, and LLM invocation — click a trace to expand.
          </p>
        </div>
        <a
          href={phoenixTracesUrl}
          target="_blank"
          rel="noreferrer"
          className="px-4 py-2 rounded text-sm font-semibold"
          style={{ background: "var(--accent)", color: "#fff" }}
        >
          Open in Phoenix ↗
        </a>
      </div>

      {fetchError ? (
        <div
          className="rounded p-8 flex flex-col items-center gap-3"
          style={{ background: "rgba(239,68,68,0.04)", border: "1px solid rgba(239,68,68,0.35)" }}
        >
          <p className="text-sm font-semibold" style={{ color: "var(--error)" }}>Failed to load traces</p>
          <p className="text-xs font-mono text-center" style={{ color: "var(--muted)", maxWidth: 500 }}>{fetchError}</p>
          <p className="text-xs" style={{ color: "var(--muted)" }}>
            Check that <code>AGENT_BACKEND_URL</code> is set correctly in Cloud Run env vars.
          </p>
        </div>
      ) : traces.length === 0 ? (
        <div
          className="rounded p-8 flex flex-col items-center gap-4"
          style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
        >
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            No traces loaded — run a review to generate traces.
          </p>
        </div>
      ) : (
        <TraceList traces={traces} />
      )}
    </div>
  );
}
