"use client";

import { useState, useTransition, useDeferredValue, useCallback, memo } from "react";
import Link from "next/link";

type EvalScores = {
  correctness?: number;
  security?: number;
  best_practices?: number;
  performance?: number;
  completeness?: number;
  accuracy?: number;
  actionability?: number;
  calibration?: number;
};

type PRReview = {
  id: string;
  repo: string;
  pr_number: number;
  pr_title: string;
  pr_url: string;
  github_review_id: number;
  files_reviewed: number;
  total_findings: number;
  eval_scores: EvalScores;
  strategy_version: number;
  timestamp: string;
};

const PAGE_SIZE = parseInt(process.env.NEXT_PUBLIC_PR_REVIEWS_PAGE_SIZE ?? "10", 10) || 10;

function scoreColor(v: number): string {
  return v >= 0.9 ? "var(--ok)" : v >= 0.7 ? "var(--warn)" : "var(--error)";
}

function avgScore(scores: EvalScores): number {
  const vals = Object.values(scores).filter((v): v is number => typeof v === "number");
  if (!vals.length) return 0;
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

function SeverityBadge({ count, label, color }: { count: number; label: string; color: string }) {
  return (
    <span className="px-1.5 py-0.5 rounded text-xs font-bold"
      style={{ background: `${color}18`, color, border: `1px solid ${color}40` }}>
      {count} {label}
    </span>
  );
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  const pct = Math.round(value * 100);
  const color = scoreColor(value);
  return (
    <div className="flex items-center gap-2 text-xs">
      <span style={{ color: "var(--muted)", width: 112, flexShrink: 0 }}>{label}</span>
      <div className="flex-1 rounded-full overflow-hidden" style={{ background: "var(--border)", height: 5 }}>
        <div style={{ width: `${pct}%`, height: 5, background: color, borderRadius: 9999 }} />
      </div>
      <span style={{ color, width: 34, textAlign: "right", fontWeight: 600 }}>{pct}%</span>
    </div>
  );
}

const PRReviewRow = memo(function PRReviewRow({ item }: { item: PRReview }) {
  const [open, setOpen] = useState(false);
  const avg = avgScore(item.eval_scores ?? {});
  const avgColor = scoreColor(avg);
  const scoreEntries = Object.entries(item.eval_scores ?? {}).filter(
    ([, v]) => typeof v === "number"
  ) as [string, number][];

  return (
    <div className="flex flex-col">
      <div
        role="button"
        tabIndex={0}
        aria-expanded={open}
        className="grid text-xs px-3 py-2.5 cursor-pointer"
        style={{
          gridTemplateColumns: "1fr 60px 60px 70px 60px 60px 120px",
          background: "var(--surface)",
          border: `1px solid ${open ? "var(--accent)" : "var(--border)"}`,
          borderRadius: open ? "6px 6px 0 0" : 6,
          color: "var(--text)",
          alignItems: "center",
          gap: 8,
        }}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => e.key === "Enter" && setOpen((v) => !v)}
      >
        <div className="flex flex-col gap-0.5 min-w-0">
          <span className="font-semibold truncate" style={{ color: "var(--text)" }}>
            <span style={{ color: "var(--muted)", fontSize: 10 }} aria-hidden>
              {open ? "▼ " : "▶ "}
            </span>
            {item.repo}
          </span>
          <span className="truncate" style={{ color: "var(--muted)", fontSize: 10 }}>
            #{item.pr_number} · {item.pr_title}
          </span>
        </div>
        <span style={{ color: "var(--accent)", fontWeight: 600, textAlign: "center" }}>
          v{item.strategy_version}
        </span>
        <span style={{ textAlign: "center", color: "var(--muted)" }}>
          {item.files_reviewed} file{item.files_reviewed !== 1 ? "s" : ""}
        </span>
        <span style={{ textAlign: "center" }}>
          {item.total_findings > 0 ? (
            <SeverityBadge count={item.total_findings} label="issues" color="var(--warn)" />
          ) : (
            <span style={{ color: "var(--ok)", fontWeight: 600 }}>✓ clean</span>
          )}
        </span>
        <span style={{ color: avgColor, fontWeight: 700, textAlign: "center" }}>
          {avg > 0 ? `${Math.round(avg * 100)}%` : "—"}
        </span>
        <span style={{ textAlign: "center" }}>
          {item.pr_url ? (
            <a
              href={item.pr_url}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "var(--accent)", fontSize: 10 }}
              onClick={(e) => e.stopPropagation()}
            >
              GitHub ↗
            </a>
          ) : "—"}
        </span>
        <span style={{ color: "var(--muted)", textAlign: "right" }}>
          {formatDateTime(item.timestamp)}
        </span>
      </div>

      {open && (
        <div
          className="flex flex-col gap-3 px-4 py-3"
          style={{
            background: "var(--bg)",
            border: `1px solid var(--accent)`,
            borderTop: "none",
            borderRadius: "0 0 6px 6px",
          }}
        >
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold" style={{ color: "var(--muted)" }}>
                {item.repo} · PR #{item.pr_number}
              </span>
              {item.pr_url && (
                <a
                  href={item.pr_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs"
                  style={{ color: "var(--accent)" }}
                >
                  View on GitHub ↗
                </a>
              )}
            </div>
            <Link
              href={`/pr-reviews/${item.id}`}
              className="text-xs px-2 py-1 rounded"
              style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--muted)" }}
            >
              Full detail →
            </Link>
          </div>

          {scoreEntries.length > 0 && (
            <div className="rounded px-4 py-3 flex flex-col gap-2"
              style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
              <p className="text-xs font-semibold mb-1" style={{ color: "var(--muted)" }}>Eval scores</p>
              {scoreEntries.map(([k, v]) => (
                <ScoreBar key={k} label={k} value={v} />
              ))}
            </div>
          )}

          <div className="grid gap-2 text-xs"
            style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
            {[
              { label: "Files reviewed", value: item.files_reviewed },
              { label: "Total findings", value: item.total_findings },
              { label: "Strategy version", value: `v${item.strategy_version}` },
            ].map(({ label, value }) => (
              <div key={label} className="rounded px-3 py-2 flex flex-col gap-0.5"
                style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                <span style={{ color: "var(--muted)" }}>{label}</span>
                <span className="font-bold" style={{ color: "var(--text)" }}>{value}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
});

function Pagination({ page, totalPages, total, isPending, onPage }: {
  page: number; totalPages: number; total: number; isPending: boolean; onPage: (p: number) => void;
}) {
  const start = (page - 1) * PAGE_SIZE + 1;
  const end = Math.min(page * PAGE_SIZE, total);
  const btn = (disabled: boolean): React.CSSProperties => ({
    padding: "4px 10px", borderRadius: 4, fontSize: 12,
    border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)",
    cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.4 : 1,
  });
  const pages: (number | "…")[] = [];
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= page - 1 && i <= page + 1)) pages.push(i);
    else if (pages[pages.length - 1] !== "…") pages.push("…");
  }
  return (
    <div className="flex items-center justify-between flex-wrap gap-3 pt-2"
      style={{ opacity: isPending ? 0.6 : 1, transition: "opacity 150ms" }}>
      <span className="text-xs" style={{ color: "var(--muted)" }}>
        {start}–{end} of {total} PR reviews
      </span>
      <div className="flex items-center gap-1">
        <button style={btn(page <= 1)} disabled={page <= 1 || isPending} onClick={() => onPage(page - 1)}>← Prev</button>
        {pages.map((p, i) =>
          p === "…" ? <span key={`e${i}`} style={{ color: "var(--muted)", fontSize: 12, padding: "0 4px" }}>…</span> : (
            <button key={p} disabled={isPending} style={{
              ...btn(false),
              background: p === page ? "var(--accent)" : "var(--surface)",
              color: p === page ? "#fff" : "var(--text)",
              fontWeight: p === page ? 600 : 400,
            }} onClick={() => onPage(p as number)}>{p}</button>
          )
        )}
        <button style={btn(page >= totalPages)} disabled={page >= totalPages || isPending} onClick={() => onPage(page + 1)}>Next →</button>
      </div>
    </div>
  );
}

export default function PRReviewList({ reviews }: { reviews: Record<string, unknown>[] }) {
  const [page, setPage] = useState(1);
  const [isPending, startTransition] = useTransition();
  const deferredPage = useDeferredValue(page);
  const isStale = deferredPage !== page;

  const typed = reviews as PRReview[];
  const totalPages = Math.max(1, Math.ceil(typed.length / PAGE_SIZE));
  const startIdx = (deferredPage - 1) * PAGE_SIZE;
  const visible = typed.slice(startIdx, startIdx + PAGE_SIZE);

  const goTo = useCallback((p: number) => {
    startTransition(() => setPage(Math.max(1, Math.min(p, totalPages))));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [totalPages]);

  return (
    <div className="flex flex-col gap-3">
      <div className="grid text-xs font-semibold px-3 py-2 rounded"
        style={{
          gridTemplateColumns: "1fr 60px 60px 70px 60px 60px 120px",
          gap: 8,
          color: "var(--muted)", background: "var(--surface)", border: "1px solid var(--border)",
          alignItems: "center",
        }}>
        <span>Repo / PR</span>
        <span style={{ textAlign: "center" }}>Strat.</span>
        <span style={{ textAlign: "center" }}>Files</span>
        <span style={{ textAlign: "center" }}>Findings</span>
        <span style={{ textAlign: "center" }}>Avg</span>
        <span style={{ textAlign: "center" }}>Link</span>
        <span style={{ textAlign: "right" }}>Date</span>
      </div>

      <div className="flex flex-col gap-1.5" style={{ opacity: isStale ? 0.5 : 1, transition: "opacity 200ms" }}>
        {visible.map((item, i) => (
          <PRReviewRow key={item.id ?? i} item={item} />
        ))}
      </div>

      {totalPages > 1 && (
        <Pagination page={deferredPage} totalPages={totalPages} total={typed.length}
          isPending={isPending || isStale} onPage={goTo} />
      )}
    </div>
  );
}
