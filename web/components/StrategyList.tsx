"use client";

import { useState, useTransition, useDeferredValue, useCallback, memo } from "react";

type Adjustment = {
  action: string;
  dimension: string;
  detail: string;
  rationale?: string;
  priority?: string;
  verified?: boolean;
};

type StrategyVersion = {
  version: number;
  timestamp: string;
  adjustments: Adjustment[];
  base_strategy?: string;
};

const PAGE_SIZE = parseInt(process.env.NEXT_PUBLIC_STRATEGY_PAGE_SIZE ?? "15", 10) || 15;

const ACTION_COLOR: Record<string, string> = {
  ADD_CHECK: "var(--ok)",
  CALIBRATE: "var(--warn)",
  DEPRIORITIZE: "var(--muted)",
};
const DIM_COLOR: Record<string, string> = {
  performance: "var(--warn)",
  accessibility: "var(--info)",
  security: "var(--error)",
  best_practices: "var(--ok)",
};
const PRIORITY_COLOR: Record<string, string> = {
  high: "var(--error)",
  medium: "var(--warn)",
  low: "var(--muted)",
};

function formatDateTime(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return (
    d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) +
    " " +
    d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
  );
}

function Badge({ text, color }: { text: string; color: string }) {
  return (
    <span
      className="px-1.5 py-0.5 rounded shrink-0 text-xs font-semibold"
      style={{ background: `${color}20`, color, border: `1px solid ${color}40` }}
    >
      {text}
    </span>
  );
}

const StrategyRow = memo(function StrategyRow({
  item, isCurrent,
}: { item: StrategyVersion; isCurrent: boolean }) {
  const [open, setOpen] = useState(false);
  const adjs = item.adjustments ?? [];

  return (
    <div className="flex flex-col">
      <div
        role="button"
        tabIndex={0}
        aria-expanded={open}
        className="grid text-xs px-3 py-2.5 cursor-pointer"
        style={{
          gridTemplateColumns: "60px 160px 80px 1fr",
          background: "var(--surface)",
          border: `1px solid ${open ? "var(--accent)" : isCurrent ? "var(--accent)" : "var(--border)"}`,
          borderRadius: open ? "6px 6px 0 0" : 6,
          color: "var(--text)",
        }}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => e.key === "Enter" && setOpen((v) => !v)}
      >
        {/* Version */}
        <span className="flex items-center gap-1.5 font-bold" style={{ color: "var(--accent)" }}>
          <span style={{ color: "var(--muted)", fontSize: 9 }} aria-hidden>{open ? "▼" : "▶"}</span>
          v{item.version}
          {isCurrent && (
            <span className="px-1 rounded" style={{ background: "var(--accent)", color: "#fff", fontSize: 8, fontWeight: 700 }}>LATEST</span>
          )}
        </span>
        {/* Date */}
        <span style={{ color: "var(--muted)" }}>{formatDateTime(item.timestamp)}</span>
        {/* Adj count */}
        <span style={{ color: "var(--text)" }}>
          {adjs.length} <span style={{ color: "var(--muted)" }}>adj.</span>
        </span>
        {/* First adjustment preview */}
        <span className="truncate" style={{ color: "var(--muted)" }}>
          {adjs[0]?.detail ?? "—"}
        </span>
      </div>

      {open && (
        <div
          className="flex flex-col gap-2 px-4 py-3"
          style={{
            background: "var(--bg)",
            border: "1px solid var(--accent)",
            borderTop: "none",
            borderRadius: "0 0 6px 6px",
          }}
        >
          <p className="text-xs font-semibold" style={{ color: "var(--muted)" }}>
            {adjs.length} adjustment{adjs.length !== 1 ? "s" : ""} in v{item.version}
          </p>
          {adjs.map((adj, i) => (
            <div
              key={i}
              className="rounded px-3 py-2.5 flex flex-col gap-1.5"
              style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
            >
              <div className="flex items-center gap-2 flex-wrap">
                <Badge text={adj.action} color={ACTION_COLOR[adj.action] ?? "var(--muted)"} />
                <Badge text={adj.dimension} color={DIM_COLOR[adj.dimension] ?? "var(--muted)"} />
                {adj.priority && (
                  <span className="text-xs" style={{ color: PRIORITY_COLOR[adj.priority] ?? "var(--muted)" }}>
                    {adj.priority} priority
                  </span>
                )}
                {adj.verified === true && (
                  <span className="text-xs" style={{ color: "var(--ok)" }}>✓ verified</span>
                )}
              </div>
              <p className="text-xs" style={{ color: "var(--text)", lineHeight: 1.6 }}>{adj.detail}</p>
              {adj.rationale && (
                <p className="text-xs" style={{ color: "var(--muted)", lineHeight: 1.5 }}>
                  <span style={{ color: "var(--accent)" }}>Why: </span>{adj.rationale}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
});

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
        {start}–{end} of {total} versions
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

export default function StrategyList({
  history, currentVersion,
}: { history: Record<string, unknown>[]; currentVersion: number }) {
  const [page, setPage] = useState(1);
  const [isPending, startTransition] = useTransition();
  const deferredPage = useDeferredValue(page);
  const isStale = deferredPage !== page;

  const totalPages = Math.max(1, Math.ceil(history.length / PAGE_SIZE));
  const visible = (history as StrategyVersion[]).slice(
    (deferredPage - 1) * PAGE_SIZE,
    deferredPage * PAGE_SIZE,
  );

  const goTo = useCallback((p: number) => {
    startTransition(() => setPage(Math.max(1, Math.min(p, totalPages))));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [totalPages]);

  return (
    <div className="flex flex-col gap-2">
      <div className="grid text-xs font-semibold px-3 py-2 rounded"
        style={{ gridTemplateColumns: "60px 160px 80px 1fr", color: "var(--muted)", background: "var(--surface)", border: "1px solid var(--border)" }}>
        <span>Version</span>
        <span>Date</span>
        <span>Changes</span>
        <span>Preview</span>
      </div>

      <div className="flex flex-col gap-1.5" style={{ opacity: isStale ? 0.5 : 1, transition: "opacity 200ms" }}>
        {visible.map((item) => (
          <StrategyRow
            key={(item as StrategyVersion).version}
            item={item as StrategyVersion}
            isCurrent={(item as StrategyVersion).version === currentVersion}
          />
        ))}
      </div>

      <Pagination page={deferredPage} totalPages={totalPages} total={history.length}
        isPending={isPending || isStale} onPage={goTo} />
    </div>
  );
}
