async function getStrategy() {
  try {
    const base = process.env.AGENT_BACKEND_URL ?? process.env.NEXT_PUBLIC_AGENT_URL ?? "http://localhost:8080";
    const res = await fetch(`${base}/api/strategy`, { cache: "no-store" });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

const ACTION_COLOR: Record<string, string> = {
  ADD_CHECK: "#10b981",
  CALIBRATE: "#f59e0b",
  DEPRIORITIZE: "#6b7280",
};

const DIM_COLOR: Record<string, string> = {
  performance: "#f59e0b",
  accessibility: "#3b82f6",
  security: "#ef4444",
  best_practices: "#10b981",
};

export default async function StrategyPage() {
  const data = await getStrategy();
  const current = data?.current_strategy;
  const history: Record<string, unknown>[] = data?.history ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-bold" style={{ color: "var(--text)" }}>
          Agent Strategy
        </h1>
        <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
          Adjustments the agent has made to its own review checklist over time.
        </p>
      </div>

      {!current ? (
        <div
          className="rounded p-6 text-sm text-center"
          style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--muted)" }}
        >
          No strategy yet — run a review to trigger the self-improvement loop.
        </div>
      ) : (
        <>
          <div
            className="rounded p-4"
            style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
          >
            <div className="flex items-center gap-3 mb-3">
              <span style={{ color: "var(--accent)" }} className="text-sm font-bold">
                v{String(current.version)}
              </span>
              <span style={{ color: "var(--muted)" }} className="text-xs">
                {current.timestamp ? new Date(String(current.timestamp)).toLocaleString() : ""}
              </span>
            </div>
            <div className="flex flex-col gap-2">
              {(current.adjustments as Record<string, string>[] ?? []).map(
                (adj: Record<string, string>, i: number) => (
                  <div key={i} className="flex gap-3 text-xs items-start">
                    <span
                      className="px-1.5 py-0.5 rounded text-xs font-semibold shrink-0"
                      style={{
                        background: ACTION_COLOR[adj.action] + "22",
                        color: ACTION_COLOR[adj.action] ?? "var(--text)",
                      }}
                    >
                      {adj.action}
                    </span>
                    <span
                      className="px-1.5 py-0.5 rounded text-xs shrink-0"
                      style={{
                        background: DIM_COLOR[adj.dimension] + "22",
                        color: DIM_COLOR[adj.dimension] ?? "var(--text)",
                      }}
                    >
                      {adj.dimension}
                    </span>
                    <span style={{ color: "var(--text)" }}>{adj.detail}</span>
                  </div>
                )
              )}
            </div>
          </div>

          <div>
            <h2 className="text-sm font-semibold mb-2" style={{ color: "var(--muted)" }}>
              Version History
            </h2>
            <div className="flex flex-col gap-2">
              {history.map((s, i) => (
                <div
                  key={i}
                  className="rounded p-3 text-xs flex items-center gap-3"
                  style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
                >
                  <span style={{ color: "var(--accent)" }}>v{String(s.version)}</span>
                  <span style={{ color: "var(--muted)" }}>
                    {s.timestamp ? new Date(String(s.timestamp)).toLocaleString() : ""}
                  </span>
                  <span style={{ color: "var(--text)" }}>
                    {(s.adjustments as unknown[])?.length ?? 0} adjustments
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
