"use client";

import { useState, useTransition, useDeferredValue, useCallback, memo } from "react";

type Scores = {
  accuracy?: number;
  actionability?: number;
  calibration?: number;
  completeness?: number;
};

type EvalTrend = {
  review_id: string;
  strategy_version: number;
  timestamp: string;
  scores: Scores;
};

type EnrichedTrend = EvalTrend & {
  run: number;
  avg: number;
  delta: number | null;       // vs previous run
  deltaVsBest: number | null; // vs best run so far
};

const PAGE_SIZE = parseInt(process.env.NEXT_PUBLIC_EVALS_PAGE_SIZE ?? "15", 10) || 15;
const SCORE_KEYS: (keyof Scores)[] = ["completeness", "accuracy", "actionability", "calibration"];
const SCORE_COLOR: Record<keyof Scores, string> = {
  completeness: "#3b82f6",
  accuracy: "#7c3aed",
  actionability: "#10b981",
  calibration: "#f59e0b",
};

function scoreColor(v: number): string {
  return v >= 0.9 ? "var(--ok)" : v >= 0.7 ? "var(--warn)" : "var(--error)";
}

function avg(scores: Scores): number {
  const vals = SCORE_KEYS.map((k) => scores[k] ?? 0);
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function formatDateTime(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return (
    d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) +
    " " +
    d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
  );
}

// Pre-compute deltas across the full array so pagination doesn't break them
function enrich(trends: EvalTrend[]): EnrichedTrend[] {
  let bestAvg = -1;
  return trends.map((t, i) => {
    const a = avg(t.scores ?? {});
    const prevAvg = i > 0 ? avg(trends[i - 1].scores ?? {}) : null;
    const delta = prevAvg !== null ? a - prevAvg : null;
    const deltaVsBest = bestAvg >= 0 ? a - bestAvg : null;
    if (a > bestAvg) bestAvg = a;
    return { ...t, run: i + 1, avg: a, delta, deltaVsBest };
  });
}

// ── Stat summary cards ────────────────────────────────────────────────────────

function SummaryCards({ enriched }: { enriched: EnrichedTrend[] }) {
  if (!enriched.length) return null;
  const best = enriched.reduce((a, b) => (b.avg > a.avg ? b : a));
  const latest = enriched[enriched.length - 1];
  const first = enriched[0];
  const netDelta = latest.avg - first.avg;
  const regressions = enriched.filter((e) => (e.delta ?? 0) < -0.01).length;

  const cards = [
    { label: "Latest avg", value: `${(latest.avg * 100).toFixed(0)}%`, color: scoreColor(latest.avg) },
    { label: "Best run", value: `#${best.run} · ${(best.avg * 100).toFixed(0)}%`, color: "var(--ok)" },
    {
      label: "Net Δ (first→last)",
      value: `${netDelta >= 0 ? "+" : ""}${(netDelta * 100).toFixed(0)}pp`,
      color: netDelta >= 0 ? "var(--ok)" : "var(--error)",
    },
    { label: "Regressions", value: String(regressions), color: regressions > 0 ? "var(--warn)" : "var(--ok)" },
  ];

  return (
    <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
      {cards.map(({ label, value, color }) => (
        <div key={label} className="rounded px-3 py-3 flex flex-col gap-1"
          style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
          <span className="text-xs" style={{ color: "var(--muted)" }}>{label}</span>
          <span className="text-sm font-bold" style={{ color }}>{value}</span>
        </div>
      ))}
    </div>
  );
}

// ── Score mini bar ────────────────────────────────────────────────────────────

function MiniBar({ value, color }: { value: number; color: string }) {
  const pct = Math.round(value * 100);
  return (
    <div className="flex items-center gap-1.5">
      <div className="rounded-full overflow-hidden" style={{ background: "var(--border)", height: 5, width: 40 }}>
        <div style={{ width: `${pct}%`, height: 5, background: color, borderRadius: 9999 }} />
      </div>
      <span style={{ color, fontSize: 10, fontWeight: 600, width: 26 }}>{pct}%</span>
    </div>
  );
}

function ScoreBar({ label, value, delta }: { label: string; value: number; delta?: number }) {
  const pct = Math.round(value * 100);
  const color = scoreColor(value);
  return (
    <div className="flex items-center gap-2 text-xs">
      <span style={{ color: "var(--muted)", width: 104, flexShrink: 0 }}>{label}</span>
      <div className="flex-1 rounded-full overflow-hidden" style={{ background: "var(--border)", height: 5 }}>
        <div style={{ width: `${pct}%`, height: 5, background: color, borderRadius: 9999 }} />
      </div>
      <span style={{ color, width: 34, textAlign: "right", fontWeight: 600 }}>{pct}%</span>
      {delta !== undefined && Math.abs(delta) >= 1 && (
        <span style={{
          color: delta > 0 ? "var(--ok)" : "var(--error)",
          width: 36, textAlign: "right", fontSize: 10,
        }}>
          {delta > 0 ? "+" : ""}{delta.toFixed(0)}pp
        </span>
      )}
    </div>
  );
}

// ── Delta pill ────────────────────────────────────────────────────────────────

function DeltaPill({ delta }: { delta: number | null }) {
  if (delta === null) return <span style={{ color: "var(--muted)", fontSize: 10 }}>—</span>;
  const pp = Math.round(delta * 100);
  if (Math.abs(pp) < 1) return <span style={{ color: "var(--muted)", fontSize: 10 }}>→ 0pp</span>;
  const color = pp > 0 ? "var(--ok)" : "var(--error)";
  const arrow = pp > 0 ? "↑" : "↓";
  return (
    <span className="px-1.5 py-0.5 rounded text-xs font-bold"
      style={{ background: `${color}18`, color, border: `1px solid ${color}40` }}>
      {arrow} {Math.abs(pp)}pp
    </span>
  );
}

// ── Eval row ─────────────────────────────────────────────────────────────────

const EvalRow = memo(function EvalRow({
  item, prevScores,
}: { item: EnrichedTrend; prevScores?: Scores }) {
  const [open, setOpen] = useState(false);
  const scores = item.scores ?? {};
  const avgColor = scoreColor(item.avg);
  const isRegression = (item.delta ?? 0) < -0.01;
  const isImprovement = (item.delta ?? 0) > 0.01;

  return (
    <div className="flex flex-col">
      <div
        role="button"
        tabIndex={0}
        aria-expanded={open}
        className="grid text-xs px-3 py-2.5 cursor-pointer"
        style={{
          gridTemplateColumns: "44px 56px 130px 1fr 1fr 1fr 1fr 72px 80px",
          background: isRegression
            ? "rgba(239,68,68,0.04)"
            : isImprovement
            ? "rgba(16,185,129,0.04)"
            : "var(--surface)",
          border: `1px solid ${
            open ? "var(--accent)"
            : isRegression ? "rgba(239,68,68,0.3)"
            : isImprovement ? "rgba(16,185,129,0.25)"
            : "var(--border)"
          }`,
          borderRadius: open ? "6px 6px 0 0" : 6,
          color: "var(--text)",
          alignItems: "center",
        }}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => e.key === "Enter" && setOpen((v) => !v)}
      >
        <span className="flex items-center gap-1" style={{ color: "var(--muted)" }}>
          <span style={{ fontSize: 9 }} aria-hidden>{open ? "▼" : "▶"}</span>
          #{item.run}
        </span>
        <span style={{ color: "var(--accent)", fontWeight: 600 }}>v{item.strategy_version}</span>
        <span style={{ color: "var(--muted)" }}>{formatDateTime(item.timestamp)}</span>
        <MiniBar value={scores.completeness ?? 0} color={SCORE_COLOR.completeness} />
        <MiniBar value={scores.accuracy ?? 0} color={SCORE_COLOR.accuracy} />
        <MiniBar value={scores.actionability ?? 0} color={SCORE_COLOR.actionability} />
        <MiniBar value={scores.calibration ?? 0} color={SCORE_COLOR.calibration} />
        <span style={{ color: avgColor, fontWeight: 700, textAlign: "right" }}>
          {Math.round(item.avg * 100)}%
        </span>
        <span style={{ textAlign: "right" }}>
          <DeltaPill delta={item.delta} />
        </span>
      </div>

      {open && (
        <div
          className="flex flex-col gap-3 px-4 py-3"
          style={{
            background: "var(--bg)",
            border: `1px solid ${open ? "var(--accent)" : "var(--border)"}`,
            borderTop: "none",
            borderRadius: "0 0 6px 6px",
          }}
        >
          <div className="flex items-center justify-between flex-wrap gap-2">
            <p className="text-xs font-semibold" style={{ color: "var(--muted)" }}>
              Run #{item.run} · Strategy v{item.strategy_version}
            </p>
            <span className="font-mono text-xs" style={{ color: "var(--muted)" }}>
              {item.review_id}
            </span>
          </div>

          <div className="rounded px-4 py-3 flex flex-col gap-2"
            style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <p className="text-xs font-semibold mb-1" style={{ color: "var(--muted)" }}>Score breakdown</p>
            {SCORE_KEYS.map((k) => {
              const prev = prevScores?.[k];
              const curr = scores[k] ?? 0;
              const d = prev !== undefined ? (curr - prev) * 100 : undefined;
              return <ScoreBar key={k} label={k} value={curr} delta={d} />;
            })}
            <div className="flex items-center gap-2 text-xs pt-1 mt-1"
              style={{ borderTop: "1px solid var(--border)" }}>
              <span style={{ color: "var(--muted)", width: 104, flexShrink: 0 }}>average</span>
              <div className="flex-1 rounded-full overflow-hidden" style={{ background: "var(--border)", height: 5 }}>
                <div style={{ width: `${Math.round(item.avg * 100)}%`, height: 5, background: avgColor, borderRadius: 9999 }} />
              </div>
              <span style={{ color: avgColor, width: 34, textAlign: "right", fontWeight: 700 }}>
                {Math.round(item.avg * 100)}%
              </span>
              <DeltaPill delta={item.delta} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

// ── Pagination ────────────────────────────────────────────────────────────────

function Pagination({ page, totalPages, total, isPending, onPage }: {
  page: number; totalPages: number; total: number; isPending: boolean; onPage: (p: number) => void;
}) {
  const start = (page - 1) * PAGE_SIZE + 1;
  const end = Math.min(page * PAGE_SIZE, total);
  const pages: (number | "…")[] = [];
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= page - 1 && i <= page + 1)) pages.push(i);
    else if (pages[pages.length - 1] !== "…") pages.push("…");
  }
  const btn = (disabled: boolean): React.CSSProperties => ({
    padding: "4px 10px", borderRadius: 4, fontSize: 12,
    border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)",
    cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.4 : 1,
    pointerEvents: disabled ? "none" : "auto",
  });
  return (
    <div className="flex items-center justify-between flex-wrap gap-3 pt-2"
      style={{ opacity: isPending ? 0.6 : 1, transition: "opacity 150ms" }}>
      <span className="text-xs" style={{ color: "var(--muted)" }}>
        {start}–{end} of {total} eval runs
        {isPending && <span style={{ color: "var(--accent)", marginLeft: 8 }}>Loading…</span>}
      </span>
      <div className="flex items-center gap-1">
        <button style={btn(page <= 1)} disabled={page <= 1 || isPending} onClick={() => onPage(page - 1)}>← Prev</button>
        {pages.map((p, i) =>
          p === "…" ? <span key={`e${i}`} style={{ color: "var(--muted)", fontSize: 12, padding: "0 4px" }}>…</span> : (
            <button key={p} disabled={isPending} style={{
              ...btn(false),
              background: p === page ? "var(--accent)" : "var(--surface)",
              color: p === page ? "#fff" : "var(--text)",
              border: `1px solid ${p === page ? "var(--accent)" : "var(--border)"}`,
              fontWeight: p === page ? 600 : 400,
              cursor: isPending ? "not-allowed" : "pointer",
              opacity: isPending ? 0.6 : 1,
            }} onClick={() => onPage(p as number)} aria-current={p === page ? "page" : undefined}>{p}</button>
          )
        )}
        <button style={btn(page >= totalPages)} disabled={page >= totalPages || isPending} onClick={() => onPage(page + 1)}>Next →</button>
      </div>
    </div>
  );
}

// ── Root export ───────────────────────────────────────────────────────────────

export default function EvalTrendList({ trends }: { trends: Record<string, unknown>[] }) {
  const [page, setPage] = useState(1);
  const [isPending, startTransition] = useTransition();
  const deferredPage = useDeferredValue(page);
  const isStale = deferredPage !== page;

  const enriched = enrich(trends as EvalTrend[]);
  const totalPages = Math.max(1, Math.ceil(enriched.length / PAGE_SIZE));
  const startIdx = (deferredPage - 1) * PAGE_SIZE;
  const visible = enriched.slice(startIdx, startIdx + PAGE_SIZE);

  const goTo = useCallback((p: number) => {
    startTransition(() => setPage(Math.max(1, Math.min(p, totalPages))));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [totalPages]);

  return (
    <div className="flex flex-col gap-3">
      <SummaryCards enriched={enriched} />

      <div className="grid text-xs font-semibold px-3 py-2 rounded"
        style={{
          gridTemplateColumns: "44px 56px 130px 1fr 1fr 1fr 1fr 72px 80px",
          color: "var(--muted)", background: "var(--surface)", border: "1px solid var(--border)",
          alignItems: "center",
        }}>
        <span>Run</span>
        <span>Strat.</span>
        <span>Date</span>
        <span style={{ color: SCORE_COLOR.completeness }}>Complete.</span>
        <span style={{ color: SCORE_COLOR.accuracy }}>Accuracy</span>
        <span style={{ color: SCORE_COLOR.actionability }}>Action.</span>
        <span style={{ color: SCORE_COLOR.calibration }}>Calibr.</span>
        <span style={{ textAlign: "right" }}>Avg</span>
        <span style={{ textAlign: "right" }}>Δ prev</span>
      </div>

      <div className="flex flex-col gap-1.5" style={{ opacity: isStale ? 0.5 : 1, transition: "opacity 200ms" }}>
        {visible.map((item, i) => (
          <EvalRow
            key={item.review_id ?? i}
            item={item}
            prevScores={startIdx + i > 0 ? enriched[startIdx + i - 1].scores : undefined}
          />
        ))}
      </div>

      <Pagination page={deferredPage} totalPages={totalPages} total={enriched.length}
        isPending={isPending || isStale} onPage={goTo} />
    </div>
  );
}
