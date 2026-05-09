import StrategyList from "@/components/StrategyList";

export const dynamic = "force-dynamic";

const AGENT = process.env.AGENT_BACKEND_URL ?? process.env.NEXT_PUBLIC_AGENT_URL ?? "http://localhost:8080";

async function getStrategy() {
  try {
    const res = await fetch(`${AGENT}/api/strategy`, { cache: "no-store" });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export default async function StrategyPage() {
  const data = await getStrategy();
  const current = data?.current_strategy;
  const history: Record<string, unknown>[] = data?.history ?? [];

  if (!current) {
    return (
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-lg font-bold" style={{ color: "var(--text)" }}>Agent Strategy</h1>
          <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
            Adjustments the agent has made to its own review checklist over time.
          </p>
        </div>
        <div className="rounded p-6 text-sm text-center"
          style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--muted)" }}>
          No strategy yet — run a review to trigger the self-improvement loop.
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold" style={{ color: "var(--text)" }}>Agent Strategy</h1>
          <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
            Adjustments the agent has made to its own review checklist over time.
          </p>
        </div>
        <span
          className="text-sm font-bold px-3 py-1.5 rounded"
          style={{ background: "rgba(124,58,237,0.15)", color: "var(--accent)", border: "1px solid rgba(124,58,237,0.4)" }}
        >
          {history.length} versions · v{current.version} current
        </span>
      </div>

      {history.length > 0 && <StrategyList history={history} currentVersion={Number(current.version)} />}
    </div>
  );
}
