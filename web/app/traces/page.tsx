import TraceList from "@/components/TraceList";

const AGENT = process.env.AGENT_BACKEND_URL ?? process.env.NEXT_PUBLIC_AGENT_URL ?? "http://localhost:8080";

async function getTraces() {
  try {
    const res = await fetch(`${AGENT}/api/traces`, { cache: "no-store" });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export default async function TracesPage() {
  const data = await getTraces();
  const traces: Record<string, unknown>[] = data?.traces ?? [];
  const phoenixBase: string = (data?.phoenix_base ?? "https://app.phoenix.arize.com").replace(/\/$/, "");
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

      {traces.length === 0 ? (
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
