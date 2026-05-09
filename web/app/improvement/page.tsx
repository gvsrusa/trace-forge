import ImprovementCharts from "@/components/ImprovementCharts";
import EvalTrendList from "@/components/EvalTrendList";
import ComparisonView from "@/components/ComparisonView";

const AGENT = process.env.AGENT_BACKEND_URL ?? process.env.NEXT_PUBLIC_AGENT_URL ?? "http://localhost:8080";

async function getImprovement() {
  try {
    const res = await fetch(`${AGENT}/api/improvement`, { cache: "no-store" });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export default async function ImprovementPage() {
  const data = await getImprovement();
  const trends: Record<string, unknown>[] = data?.eval_trends ?? [];
  const blindSpots: Record<string, unknown>[] = data?.blind_spots ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold" style={{ color: "var(--text)" }}>Self-Improvement</h1>
          <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
            Eval scores over time — click any run to expand its scores.
          </p>
        </div>
        {trends.length > 0 && (
          <span
            className="text-sm font-bold px-3 py-1.5 rounded"
            style={{ background: "rgba(124,58,237,0.15)", color: "var(--accent)", border: "1px solid rgba(124,58,237,0.4)" }}
          >
            {trends.length} eval runs
          </span>
        )}
      </div>

      {trends.length === 0 ? (
        <div className="rounded p-6 text-sm text-center"
          style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--muted)" }}>
          No eval data yet — run a few reviews to see improvement trends.
        </div>
      ) : (
        <>
          <ImprovementCharts trends={trends} />

          <div>
            <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--muted)" }}>
              All eval runs
            </h2>
            <EvalTrendList trends={trends} />
          </div>
        </>
      )}

      {blindSpots.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold mb-2" style={{ color: "var(--muted)" }}>
            Identified Blind Spots
          </h2>
          <div className="flex flex-col gap-2">
            {blindSpots.map((bs, i) => (
              <div key={i} className="rounded p-3 text-xs"
                style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                <span style={{ color: "var(--warn)" }} className="font-semibold">
                  {String(bs.dimension ?? "")}
                </span>
                <span style={{ color: "var(--text)" }} className="ml-3">
                  {String(bs.description ?? "")}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ borderTop: "1px solid var(--border)", paddingTop: 24 }}>
        <ComparisonView />
      </div>
    </div>
  );
}
