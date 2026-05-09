import Link from "next/link";

const AGENT = process.env.AGENT_BACKEND_URL ?? process.env.NEXT_PUBLIC_AGENT_URL ?? "http://localhost:8080";

async function getPRReview(id: string) {
  try {
    const res = await fetch(`${AGENT}/api/pr-reviews/${id}`, { cache: "no-store" });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

function scoreColor(v: number): string {
  return v >= 0.9 ? "var(--ok)" : v >= 0.7 ? "var(--warn)" : "var(--error)";
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  const pct = Math.round(value * 100);
  const color = scoreColor(value);
  return (
    <div className="flex items-center gap-2 text-xs">
      <span style={{ color: "var(--muted)", width: 120, flexShrink: 0 }}>{label}</span>
      <div className="flex-1 rounded-full overflow-hidden" style={{ background: "var(--border)", height: 5 }}>
        <div style={{ width: `${pct}%`, height: 5, background: color, borderRadius: 9999 }} />
      </div>
      <span style={{ color, width: 34, textAlign: "right", fontWeight: 600 }}>{pct}%</span>
    </div>
  );
}

const SEVERITY_COLOR: Record<string, string> = {
  error: "var(--error)",
  warning: "var(--warn)",
  info: "var(--muted)",
};

const SEVERITY_ICON: Record<string, string> = {
  error: "🔴",
  warning: "🟡",
  info: "ℹ️",
};

export default async function PRReviewDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const review = await getPRReview(id);

  if (!review) {
    return (
      <div className="flex flex-col gap-4">
        <Link href="/pr-reviews" className="text-xs" style={{ color: "var(--muted)" }}>← Back to PR Reviews</Link>
        <div className="rounded p-6 text-sm text-center"
          style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--muted)" }}>
          PR review not found.
        </div>
      </div>
    );
  }

  const evalScores = (review.eval_scores ?? {}) as Record<string, number>;
  const scoreEntries = Object.entries(evalScores).filter(([, v]) => typeof v === "number") as [string, number][];
  const hunkResults: Record<string, unknown>[] = review.hunk_results ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Link href="/pr-reviews" className="text-xs" style={{ color: "var(--muted)" }}>← PR Reviews</Link>
        <span style={{ color: "var(--border)" }}>·</span>
        <h1 className="text-sm font-bold" style={{ color: "var(--text)" }}>
          {String(review.repo)} · PR #{String(review.pr_number)}
        </h1>
        {review.pr_url && (
          <a href={String(review.pr_url)} target="_blank" rel="noopener noreferrer"
            className="text-xs" style={{ color: "var(--accent)" }}>
            View on GitHub ↗
          </a>
        )}
      </div>

      <div className="rounded p-4 flex flex-col gap-2"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <p className="text-xs font-semibold mb-2" style={{ color: "var(--muted)" }}>PR Title</p>
        <p className="text-sm font-semibold" style={{ color: "var(--text)" }}>{String(review.pr_title)}</p>
        <div className="grid gap-2 mt-2" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
          {[
            { label: "Files reviewed", value: String(review.files_reviewed) },
            { label: "Total findings", value: String(review.total_findings) },
            { label: "Strategy version", value: `v${String(review.strategy_version)}` },
            { label: "GitHub review ID", value: `#${String(review.github_review_id || "—")}` },
          ].map(({ label, value }) => (
            <div key={label} className="rounded px-3 py-2 flex flex-col gap-0.5"
              style={{ background: "var(--bg)", border: "1px solid var(--border)" }}>
              <span className="text-xs" style={{ color: "var(--muted)" }}>{label}</span>
              <span className="text-sm font-bold" style={{ color: "var(--text)" }}>{value}</span>
            </div>
          ))}
        </div>
      </div>

      {scoreEntries.length > 0 && (
        <div className="rounded p-4 flex flex-col gap-2"
          style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <p className="text-xs font-semibold mb-1" style={{ color: "var(--muted)" }}>Eval scores (average across all files)</p>
          {scoreEntries.map(([k, v]) => <ScoreBar key={k} label={k} value={v} />)}
        </div>
      )}

      {hunkResults.length > 0 && (
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold" style={{ color: "var(--muted)" }}>Per-file findings</h2>
          {hunkResults.map((hunk, i) => {
            const findings = (hunk.findings as Record<string, unknown>[]) ?? [];
            const path = String(hunk.path ?? "");
            const hunkEval = (hunk.eval_scores as Record<string, number>) ?? {};

            return (
              <div key={i} className="rounded flex flex-col"
                style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                <div className="flex items-center justify-between px-4 py-3"
                  style={{ borderBottom: "1px solid var(--border)" }}>
                  <code className="text-xs font-semibold" style={{ color: "var(--accent)" }}>{path}</code>
                  <span className="text-xs" style={{ color: "var(--muted)" }}>
                    {findings.length} finding{findings.length !== 1 ? "s" : ""}
                  </span>
                </div>

                {findings.length === 0 ? (
                  <p className="px-4 py-3 text-xs" style={{ color: "var(--ok)" }}>✓ No issues found in this hunk</p>
                ) : (
                  <div className="flex flex-col gap-2 px-4 py-3">
                    {findings.map((f, fi) => {
                      const sev = String(f.severity ?? "info");
                      const dim = String(f.dimension ?? "");
                      const msg = String(f.message ?? "");
                      const sug = String(f.suggestion ?? "");
                      const color = SEVERITY_COLOR[sev] ?? "var(--muted)";
                      const icon = SEVERITY_ICON[sev] ?? "ℹ️";
                      return (
                        <div key={fi} className="rounded px-3 py-2 flex flex-col gap-1 text-xs"
                          style={{ background: "var(--bg)", border: `1px solid ${color}30` }}>
                          <div className="flex items-center gap-2">
                            <span>{icon}</span>
                            <span className="font-semibold px-1.5 py-0.5 rounded"
                              style={{ background: `${color}18`, color, border: `1px solid ${color}40` }}>
                              {dim}
                            </span>
                            <span className="font-semibold" style={{ color: "var(--text)" }}>{msg}</span>
                          </div>
                          {sug && (
                            <p style={{ color: "var(--muted)", paddingLeft: 20 }}>
                              Fix: {sug}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {Object.keys(hunkEval).length > 0 && (
                  <div className="px-4 py-2 flex flex-col gap-1.5"
                    style={{ borderTop: "1px solid var(--border)" }}>
                    {Object.entries(hunkEval)
                      .filter(([, v]) => typeof v === "number")
                      .map(([k, v]) => <ScoreBar key={k} label={k} value={v as number} />)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
