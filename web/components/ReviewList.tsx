"use client";

import { useState, useTransition, useDeferredValue, useCallback, memo, useRef } from "react";

type EvalScores = {
  completeness?: number;
  accuracy?: number;
  actionability?: number;
  calibration?: number;
};

type Review = {
  id: string;
  filename: string;
  language: string;
  strategy_version: number;
  timestamp: string;
  eval_scores: EvalScores;
  report: string;
  code_snippet: string;
};

const PAGE_SIZE = parseInt(process.env.NEXT_PUBLIC_REVIEWS_PAGE_SIZE ?? "15", 10) || 15;
const SCORE_KEYS: (keyof EvalScores)[] = ["completeness", "accuracy", "actionability", "calibration"];

// ── Helpers ──────────────────────────────────────────────────────────────────

function scoreColor(v: number): string {
  return v >= 0.9 ? "var(--ok)" : v >= 0.7 ? "var(--warn)" : "var(--error)";
}

function avgScore(scores: EvalScores): number {
  const vals = SCORE_KEYS.map((k) => scores[k] ?? 0);
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function formatDateTime(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return (
    d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) +
    " " +
    d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" })
  );
}

function langColor(lang: string): string {
  const map: Record<string, string> = {
    tsx: "var(--info)",
    ts: "var(--info)",
    jsx: "var(--warn)",
    js: "var(--warn)",
  };
  return map[lang.toLowerCase()] ?? "var(--muted)";
}

// ── Mini score bar row ────────────────────────────────────────────────────────

function ScoreBar({ label, value }: { label: string; value: number }) {
  const pct = Math.round(value * 100);
  const color = scoreColor(value);
  return (
    <div className="flex items-center gap-2 text-xs">
      <span style={{ color: "var(--muted)", width: 96, flexShrink: 0 }}>{label}</span>
      <div className="flex-1 rounded-full overflow-hidden" style={{ background: "var(--border)", height: 5 }}>
        <div style={{ width: `${pct}%`, height: 5, background: color, borderRadius: 9999 }} />
      </div>
      <span style={{ color, width: 34, textAlign: "right", fontWeight: 600 }}>{pct}%</span>
    </div>
  );
}

// ── Inline score chips (table cell) ──────────────────────────────────────────

function ScoreChips({ scores }: { scores: EvalScores }) {
  const avg = avgScore(scores);
  const color = scoreColor(avg);
  const pct = Math.round(avg * 100);
  return (
    <div className="flex items-center gap-1.5">
      <div className="rounded-full overflow-hidden" style={{ background: "var(--border)", height: 5, width: 60 }}>
        <div style={{ width: `${pct}%`, height: 5, background: color, borderRadius: 9999 }} />
      </div>
      <span style={{ color, fontSize: 10, fontWeight: 600 }}>{pct}%</span>
    </div>
  );
}

// ── Copy button ───────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <button
      onClick={copy}
      style={{
        fontSize: 10,
        padding: "2px 8px",
        borderRadius: 4,
        border: "1px solid var(--border)",
        background: "var(--surface)",
        color: copied ? "var(--ok)" : "var(--muted)",
        cursor: "pointer",
      }}
    >
      {copied ? "✓ Copied" : "Copy"}
    </button>
  );
}

// ── Expandable code / report block ───────────────────────────────────────────

function ExpandableBlock({
  label, value, maxLines = 10, mono = false,
}: {
  label: string; value: string; maxLines?: number; mono?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const lines = value.split("\n");
  const needsExpand = lines.length > maxLines;
  const shown = expanded ? value : lines.slice(0, maxLines).join("\n");

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span style={{ color: "var(--muted)", fontSize: 11 }}>{label}</span>
        <CopyButton text={value} />
      </div>
      <pre
        className="rounded overflow-auto"
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          padding: "10px 12px",
          color: "var(--text)",
          maxHeight: expanded ? 480 : 200,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          fontFamily: mono ? "ui-monospace, SFMono-Regular, monospace" : "inherit",
          lineHeight: 1.6,
          fontSize: 11,
          overflowX: "hidden",
        }}
      >
        {shown}
        {!expanded && needsExpand && (
          <span style={{ color: "var(--muted)" }}>{"\n"}…</span>
        )}
      </pre>
      {needsExpand && (
        <button
          onClick={() => setExpanded((v) => !v)}
          style={{
            fontSize: 10, padding: "2px 0", background: "none", border: "none",
            color: "var(--accent)", cursor: "pointer", textAlign: "left",
          }}
        >
          {expanded ? "▲ Show less" : `▼ Show all ${lines.length} lines`}
        </button>
      )}
    </div>
  );
}

// ── Review row ────────────────────────────────────────────────────────────────

const ReviewRow = memo(function ReviewRow({ review }: { review: Review }) {
  const [open, setOpen] = useState(false);
  const scores = review.eval_scores ?? {};

  return (
    <div className="flex flex-col">
      {/* Summary row */}
      <div
        role="button"
        tabIndex={0}
        aria-expanded={open}
        className="grid text-xs px-3 py-2.5 cursor-pointer"
        style={{
          gridTemplateColumns: "2fr 70px 160px 150px 70px",
          background: "var(--surface)",
          border: `1px solid ${open ? "var(--accent)" : "var(--border)"}`,
          borderRadius: open ? "6px 6px 0 0" : 6,
          color: "var(--text)",
        }}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => e.key === "Enter" && setOpen((v) => !v)}
      >
        {/* Filename + language */}
        <span className="flex items-center gap-2 truncate">
          <span style={{ color: "var(--muted)", fontSize: 9 }} aria-hidden>{open ? "▼" : "▶"}</span>
          <span className="font-semibold truncate" style={{ color: "var(--accent)" }}>
            {review.filename || "unknown"}
          </span>
          <span
            className="px-1.5 py-0.5 rounded shrink-0"
            style={{
              background: `${langColor(review.language)}20`,
              color: langColor(review.language),
              fontSize: 9, fontWeight: 600,
              border: `1px solid ${langColor(review.language)}40`,
            }}
          >
            {review.language}
          </span>
        </span>

        {/* Strategy version */}
        <span style={{ color: "var(--muted)" }}>
          v<span style={{ color: "var(--text)", fontWeight: 600 }}>{review.strategy_version}</span>
        </span>

        {/* Avg score bar */}
        <span><ScoreChips scores={scores} /></span>

        {/* Date + time */}
        <span style={{ color: "var(--muted)" }}>{formatDateTime(review.timestamp)}</span>

        {/* ID */}
        <span className="truncate font-mono" style={{ color: "var(--muted)", fontSize: 10 }}>
          {review.id?.slice(0, 8)}…
        </span>
      </div>

      {/* Expanded detail panel */}
      {open && (
        <div
          className="flex flex-col gap-4 px-4 py-4"
          style={{
            background: "var(--bg)",
            border: "1px solid var(--accent)",
            borderTop: "none",
            borderRadius: "0 0 6px 6px",
          }}
        >
          {/* Full eval scores */}
          <div
            className="rounded px-4 py-3 flex flex-col gap-2"
            style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
          >
            <p className="text-xs font-semibold mb-1" style={{ color: "var(--muted)" }}>
              Eval scores — strategy v{review.strategy_version}
            </p>
            {SCORE_KEYS.map((k) => (
              <ScoreBar key={k} label={k} value={scores[k] ?? 0} />
            ))}
          </div>

          {/* Report */}
          {review.report && (
            <ExpandableBlock label="Review report" value={review.report} maxLines={12} />
          )}

          {/* Code snippet */}
          {review.code_snippet && (
            <ExpandableBlock label="Code reviewed" value={review.code_snippet} maxLines={10} mono />
          )}
        </div>
      )}
    </div>
  );
});

// ── Pagination ────────────────────────────────────────────────────────────────

function Pagination({
  page, totalPages, total, isPending, onPage,
}: {
  page: number; totalPages: number; total: number;
  isPending: boolean; onPage: (p: number) => void;
}) {
  const start = (page - 1) * PAGE_SIZE + 1;
  const end = Math.min(page * PAGE_SIZE, total);

  const pages: (number | "…")[] = [];
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= page - 1 && i <= page + 1)) {
      pages.push(i);
    } else if (pages[pages.length - 1] !== "…") {
      pages.push("…");
    }
  }

  const btn = (disabled: boolean): React.CSSProperties => ({
    padding: "4px 10px", borderRadius: 4, fontSize: 12,
    border: "1px solid var(--border)", background: "var(--surface)",
    color: "var(--text)", lineHeight: 1.5,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.4 : 1,
    pointerEvents: disabled ? "none" : "auto",
  });

  return (
    <div
      className="flex items-center justify-between flex-wrap gap-3 pt-2"
      style={{ opacity: isPending ? 0.6 : 1, transition: "opacity 150ms" }}
    >
      <span className="text-xs" style={{ color: "var(--muted)" }}>
        {start}–{end} of {total} reviews
        {isPending && <span style={{ color: "var(--accent)", marginLeft: 8 }}>Loading…</span>}
      </span>
      <div className="flex items-center gap-1" aria-label="Pagination">
        <button style={btn(page <= 1)} disabled={page <= 1 || isPending}
          onClick={() => onPage(page - 1)} aria-label="Previous page">← Prev</button>

        {pages.map((p, i) =>
          p === "…" ? (
            <span key={`e${i}`} style={{ color: "var(--muted)", fontSize: 12, padding: "0 4px" }}>…</span>
          ) : (
            <button
              key={p}
              disabled={isPending}
              style={{
                ...btn(false),
                background: p === page ? "var(--accent)" : "var(--surface)",
                color: p === page ? "#fff" : "var(--text)",
                border: `1px solid ${p === page ? "var(--accent)" : "var(--border)"}`,
                fontWeight: p === page ? 600 : 400,
                cursor: isPending ? "not-allowed" : "pointer",
                opacity: isPending ? 0.6 : 1,
              }}
              onClick={() => onPage(p as number)}
              aria-label={`Page ${p}`}
              aria-current={p === page ? "page" : undefined}
            >
              {p}
            </button>
          )
        )}

        <button style={btn(page >= totalPages)} disabled={page >= totalPages || isPending}
          onClick={() => onPage(page + 1)} aria-label="Next page">Next →</button>
      </div>
    </div>
  );
}

// ── Root export ───────────────────────────────────────────────────────────────

export default function ReviewList({ reviews }: { reviews: Record<string, unknown>[] }) {
  const [page, setPage] = useState(1);
  const [isPending, startTransition] = useTransition();
  const deferredPage = useDeferredValue(page);
  const isStale = deferredPage !== page;

  const totalPages = Math.max(1, Math.ceil(reviews.length / PAGE_SIZE));
  const visible = (reviews as Review[]).slice(
    (deferredPage - 1) * PAGE_SIZE,
    deferredPage * PAGE_SIZE,
  );

  const goTo = useCallback((p: number) => {
    startTransition(() => setPage(Math.max(1, Math.min(p, totalPages))));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [totalPages]);

  return (
    <div className="flex flex-col gap-2">
      {/* Column header */}
      <div
        className="grid text-xs font-semibold px-3 py-2 rounded"
        style={{
          gridTemplateColumns: "2fr 70px 160px 150px 70px",
          color: "var(--muted)",
          background: "var(--surface)",
          border: "1px solid var(--border)",
        }}
      >
        <span>Component</span>
        <span>Strategy</span>
        <span>Avg score</span>
        <span>Reviewed</span>
        <span>ID</span>
      </div>

      <div
        className="flex flex-col gap-1.5"
        style={{ opacity: isStale ? 0.5 : 1, transition: "opacity 200ms" }}
      >
        {visible.map((r, i) => (
          <ReviewRow key={(r as Review).id ?? i} review={r as Review} />
        ))}
      </div>

      <Pagination
        page={deferredPage}
        totalPages={totalPages}
        total={reviews.length}
        isPending={isPending || isStale}
        onPage={goTo}
      />
    </div>
  );
}
