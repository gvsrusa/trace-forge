"use client";

import { useState, useTransition, useDeferredValue, useCallback, memo, useRef } from "react";

type Span = Record<string, unknown>;
type Trace = { trace_id: string; root: Span; spans: Span[] };

const PAGE_SIZE = 15;

const STATUS_COLOR: Record<string, string> = {
  OK: "var(--ok)",
  ERROR: "var(--error)",
  UNSET: "var(--muted)",
};
const KIND_COLOR: Record<string, string> = {
  CHAIN: "var(--accent)",
  AGENT: "var(--info)",
  LLM: "var(--ok)",
  TOOL: "var(--warn)",
  RETRIEVER: "var(--muted)",
};

function duration(span: Span): string {
  const s = span.start_time as string;
  const e = span.end_time as string;
  if (!s || !e) return "—";
  const ms = new Date(e).getTime() - new Date(s).getTime();
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;
}

function shortDateTime(iso: unknown): string {
  if (!iso) return "—";
  const d = new Date(iso as string);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" })
    + " " + d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

// ── Span detail row ──────────────────────────────────────────────────────────

const SpanRow = memo(function SpanRow({ span, depth }: { span: Span; depth: number }) {
  const [open, setOpen] = useState(false);
  const attrs = (span.attributes as Record<string, unknown>) ?? {};

  const name = String(span.name ?? "span");
  const kind = String(span.span_kind ?? "");
  const status = String(span.status_code ?? "UNSET");
  const inputVal = attrs["input.value"] as string | undefined;
  const outputVal = attrs["output.value"] as string | undefined;
  const tokenTotal = attrs["llm.token_count.total"] ?? attrs["gen_ai.usage.total_tokens"];
  const agentName = attrs["agent.name"] ?? attrs["gen_ai.agent.name"];
  const sessionId = attrs["session.id"] ?? attrs["gen_ai.conversation.id"];
  const hasDetail = !!(inputVal || outputVal || tokenTotal || agentName || sessionId);

  const toggle = useCallback(() => { if (hasDetail) setOpen((v) => !v); }, [hasDetail]);

  return (
    <>
      <div
        role={hasDetail ? "button" : undefined}
        tabIndex={hasDetail ? 0 : -1}
        aria-expanded={hasDetail ? open : undefined}
        className="grid text-xs px-3 py-2.5 rounded"
        style={{
          gridTemplateColumns: "2fr 80px 70px 150px 70px",
          background: open ? "var(--surface)" : "transparent",
          border: `1px solid ${open ? "var(--accent)" : "var(--border)"}`,
          color: "var(--text)",
          marginLeft: depth * 16,
          cursor: hasDetail ? "pointer" : "default",
        }}
        onClick={toggle}
        onKeyDown={(e) => e.key === "Enter" && toggle()}
      >
        <span className="truncate font-mono flex items-center gap-1.5">
          {depth > 0 && <span style={{ color: "var(--border)", userSelect: "none" }}>└ </span>}
          {hasDetail && (
            <span style={{ color: "var(--muted)", fontSize: 9 }} aria-hidden>{open ? "▼" : "▶"}</span>
          )}
          {name}
        </span>
        <span style={{ color: KIND_COLOR[kind] ?? "var(--muted)" }}>{kind}</span>
        <span style={{ color: STATUS_COLOR[status] ?? "var(--muted)" }}>{status}</span>
        <span style={{ color: "var(--muted)" }}>{shortDateTime(span.start_time)}</span>
        <span style={{ color: "var(--muted)" }}>{duration(span)}</span>
      </div>

      {open && (
        <div
          className="rounded text-xs flex flex-col gap-3 px-4 py-3"
          style={{ background: "var(--bg)", border: "1px solid var(--border)", marginLeft: depth * 16 + 8 }}
        >
          {agentName ? <DetailRow label="Agent" value={String(agentName)} color="var(--accent)" /> : null}
          {sessionId ? <DetailRow label="Session" value={String(sessionId)} mono /> : null}
          {tokenTotal ? <DetailRow label="Tokens" value={String(tokenTotal)} color="var(--ok)" /> : null}
          {inputVal ? <JsonView label="Input" value={inputVal} maxHeight={200} /> : null}
          {outputVal ? <JsonView label="Output" value={outputVal} maxHeight={260} /> : null}
        </div>
      )}
    </>
  );
});

function DetailRow({
  label, value, color, mono,
}: { label: string; value: string; color?: string; mono?: boolean }) {
  return (
    <div className="flex gap-2">
      <span style={{ color: "var(--muted)", width: 90, flexShrink: 0 }}>{label}</span>
      <span style={{ color: color ?? "var(--text)", wordBreak: "break-all", fontFamily: mono ? "monospace" : "inherit" }}>
        {value}
      </span>
    </div>
  );
}

// ── JSON parsing helpers ─────────────────────────────────────────────────────

function tryParse(raw: string): unknown {
  try {
    const first = JSON.parse(raw);
    // Some values are double-encoded strings
    if (typeof first === "string") {
      try { return JSON.parse(first); } catch { /* not double-encoded */ }
    }
    return first;
  } catch {
    return raw;
  }
}

// Tokenise a JSON string for syntax highlighting (no regex backtracking issues)
type Token = { type: "key" | "string" | "number" | "bool" | "null" | "punct"; text: string };

function tokenize(json: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < json.length) {
    // Whitespace
    if (/\s/.test(json[i])) { tokens.push({ type: "punct", text: json[i++] }); continue; }
    // String
    if (json[i] === '"') {
      let j = i + 1;
      while (j < json.length && (json[j] !== '"' || json[j - 1] === "\\")) j++;
      const text = json.slice(i, j + 1);
      // Peek ahead: if followed by optional whitespace then ":", it's a key
      const after = json.slice(j + 1).trimStart();
      tokens.push({ type: after.startsWith(":") ? "key" : "string", text });
      i = j + 1;
      continue;
    }
    // Number
    if (/[-\d]/.test(json[i])) {
      let j = i;
      while (j < json.length && /[\d.eE+\-]/.test(json[j])) j++;
      tokens.push({ type: "number", text: json.slice(i, j) });
      i = j;
      continue;
    }
    // Boolean / null
    for (const kw of ["true", "false", "null"]) {
      if (json.startsWith(kw, i)) {
        tokens.push({ type: kw === "null" ? "null" : "bool", text: kw });
        i += kw.length;
        break;
      }
    }
    if (/[{}[\]:,]/.test(json[i])) { tokens.push({ type: "punct", text: json[i++] }); continue; }
    // Fallback
    tokens.push({ type: "punct", text: json[i++] });
  }
  return tokens;
}

const TOKEN_COLOR: Record<Token["type"], string> = {
  key:    "var(--info)",
  string: "var(--ok)",
  number: "var(--warn)",
  bool:   "var(--accent)",
  null:   "var(--error)",
  punct:  "var(--muted)",
};

function HighlightedJson({ code }: { code: string }) {
  const tokens = tokenize(code);
  return (
    <>
      {tokens.map((t, i) => (
        <span key={i} style={{ color: TOKEN_COLOR[t.type] }}>{t.text}</span>
      ))}
    </>
  );
}

// ── JsonView ─────────────────────────────────────────────────────────────────

function JsonView({ label, value, maxHeight }: { label: string; value: string; maxHeight: number }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const parsed = tryParse(value);
  const isObject = parsed !== null && typeof parsed === "object";
  const formatted = isObject ? JSON.stringify(parsed, null, 2) : String(parsed);

  // Show a shorter preview when collapsed
  const PREVIEW_LINES = 8;
  const lines = formatted.split("\n");
  const preview = lines.slice(0, PREVIEW_LINES).join("\n");
  const needsExpand = lines.length > PREVIEW_LINES;
  const shown = expanded ? formatted : preview;

  const copy = () => {
    navigator.clipboard.writeText(formatted).then(() => {
      setCopied(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span style={{ color: "var(--muted)", fontSize: 11 }}>{label}</span>
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
      </div>

      <pre
        className="rounded overflow-auto"
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          padding: "10px 12px",
          maxHeight: expanded ? maxHeight * 2 : maxHeight,
          whiteSpace: "pre-wrap",
          wordBreak: "break-all",
          overflowX: "hidden",
          fontFamily: "ui-monospace, SFMono-Regular, monospace",
          lineHeight: 1.6,
          fontSize: 11,
        }}
      >
        {isObject ? <HighlightedJson code={shown} /> : <span style={{ color: "var(--text)" }}>{shown}</span>}
        {!expanded && needsExpand && (
          <span style={{ color: "var(--muted)" }}>{"\n"}…</span>
        )}
      </pre>

      {needsExpand && (
        <button
          onClick={() => setExpanded((v) => !v)}
          style={{
            fontSize: 10,
            padding: "2px 0",
            background: "none",
            border: "none",
            color: "var(--accent)",
            cursor: "pointer",
            textAlign: "left",
          }}
        >
          {expanded ? "▲ Show less" : `▼ Show all ${lines.length} lines`}
        </button>
      )}
    </div>
  );
}

// ── Trace row (collapsible) ──────────────────────────────────────────────────

const TraceRow = memo(function TraceRow({ trace }: { trace: Trace }) {
  const [open, setOpen] = useState(false);
  const { root, spans } = trace;
  const status = String(root.status_code ?? "UNSET");
  const kind = String(root.span_kind ?? "");
  const children = spans.filter((s) => s.parent_id !== null);
  const isError = status === "ERROR";
  const errorMsg = isError ? String(root.status_message ?? "").split("\n")[0].slice(0, 90) : "";

  return (
    <div className="flex flex-col gap-1">
      <div
        role="button"
        tabIndex={0}
        aria-expanded={open}
        className="grid text-xs px-3 py-2.5 rounded cursor-pointer"
        style={{
          gridTemplateColumns: "2fr 80px 70px 150px 70px",
          background: isError ? "rgba(239,68,68,0.04)" : "var(--surface)",
          border: `1px solid ${open ? "var(--accent)" : isError ? "rgba(239,68,68,0.35)" : "var(--border)"}`,
          color: "var(--text)",
        }}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => e.key === "Enter" && setOpen((v) => !v)}
      >
        <span className="truncate font-mono flex items-center gap-1.5 min-w-0">
          <span style={{ color: "var(--muted)", fontSize: 9 }} aria-hidden>{open ? "▼" : "▶"}</span>
          <span className="truncate">{String(root.name ?? "trace")}</span>
          <span
            className="px-1.5 py-0.5 rounded shrink-0"
            style={{ background: "rgba(124,58,237,0.12)", color: "var(--accent)", fontSize: 9, fontWeight: 600 }}
          >
            {spans.length} spans
          </span>
          {isError && errorMsg && (
            <span className="truncate shrink" style={{ color: "var(--error)", fontSize: 9, opacity: 0.8 }}>
              · {errorMsg}
            </span>
          )}
        </span>
        <span style={{ color: KIND_COLOR[kind] ?? "var(--muted)" }}>{kind}</span>
        <span style={{ color: STATUS_COLOR[status] ?? "var(--muted)", fontWeight: isError ? 700 : 400 }}>{status}</span>
        <span style={{ color: "var(--muted)" }}>{shortDateTime(root.start_time)}</span>
        <span style={{ color: "var(--muted)" }}>{duration(root)}</span>
      </div>

      {open && (
        <div className="flex flex-col gap-1 pl-2">
          {isError && errorMsg && (
            <div className="rounded px-3 py-2 text-xs"
              style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.25)", color: "var(--error)" }}>
              <span className="font-semibold">Error: </span>{String(root.status_message ?? "")}
            </div>
          )}
          <SpanRow span={root} depth={0} />
          {children.map((s, i) => <SpanRow key={i} span={s} depth={1} />)}
        </div>
      )}
    </div>
  );
});

// ── Pagination controls ──────────────────────────────────────────────────────

function Pagination({
  page, totalPages, total, isPending, onPage,
}: {
  page: number; totalPages: number; total: number;
  isPending: boolean; onPage: (p: number) => void;
}) {
  const start = (page - 1) * PAGE_SIZE + 1;
  const end = Math.min(page * PAGE_SIZE, total);

  // Always show first, last, current ±1, ellipsis elsewhere
  const pages: (number | "…")[] = [];
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= page - 1 && i <= page + 1)) {
      pages.push(i);
    } else if (pages[pages.length - 1] !== "…") {
      pages.push("…");
    }
  }

  const btn = (disabled: boolean): React.CSSProperties => ({
    padding: "4px 10px",
    borderRadius: 4,
    fontSize: 12,
    border: "1px solid var(--border)",
    background: "var(--surface)",
    color: "var(--text)",
    lineHeight: 1.5,
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
        {start}–{end} of {total} traces
        {isPending && <span style={{ color: "var(--accent)", marginLeft: 8 }}>Loading…</span>}
      </span>

      <div className="flex items-center gap-1" aria-label="Pagination">
        <button style={btn(page <= 1)} disabled={page <= 1 || isPending}
          onClick={() => onPage(page - 1)} aria-label="Previous page">
          ← Prev
        </button>

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
          onClick={() => onPage(page + 1)} aria-label="Next page">
          Next →
        </button>
      </div>
    </div>
  );
}

// ── Root export ──────────────────────────────────────────────────────────────

type StatusFilter = "all" | "OK" | "ERROR" | "UNSET";

export default function TraceList({ traces }: { traces: Record<string, unknown>[] }) {
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [isPending, startTransition] = useTransition();
  const deferredPage = useDeferredValue(page);
  const isStale = deferredPage !== page;

  const typed = traces as Trace[];

  const counts = { OK: 0, ERROR: 0, UNSET: 0 };
  for (const t of typed) {
    const s = String((t.root?.status_code) ?? "UNSET") as keyof typeof counts;
    if (s in counts) counts[s]++;
  }

  const filtered = filter === "all" ? typed : typed.filter(
    (t) => String(t.root?.status_code ?? "UNSET") === filter
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visible = filtered.slice(
    (deferredPage - 1) * PAGE_SIZE,
    deferredPage * PAGE_SIZE,
  );

  const goTo = useCallback((p: number) => {
    startTransition(() => setPage(Math.max(1, Math.min(p, totalPages))));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [totalPages]);

  const setFilterAndReset = (f: StatusFilter) => {
    setFilter(f);
    startTransition(() => setPage(1));
  };

  const filterBtn = (f: StatusFilter, label: string, count: number, color: string) => {
    const active = filter === f;
    return (
      <button
        key={f}
        onClick={() => setFilterAndReset(f)}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold"
        style={{
          background: active ? `${color}18` : "var(--surface)",
          color: active ? color : "var(--muted)",
          border: `1px solid ${active ? `${color}60` : "var(--border)"}`,
          cursor: "pointer",
        }}
      >
        {label}
        <span className="px-1 rounded" style={{ background: active ? `${color}30` : "var(--border)", fontSize: 10 }}>
          {count}
        </span>
      </button>
    );
  };

  return (
    <div className="flex flex-col gap-2">
      {/* Status filter bar */}
      <div className="flex items-center gap-2 flex-wrap">
        {filterBtn("all", "All", typed.length, "var(--accent)")}
        {filterBtn("OK", "OK", counts.OK, "var(--ok)")}
        {filterBtn("ERROR", "Error", counts.ERROR, "var(--error)")}
        {filterBtn("UNSET", "Unset", counts.UNSET, "var(--muted)")}
        {counts.ERROR > 0 && filter !== "ERROR" && (
          <span className="text-xs ml-auto" style={{ color: "var(--error)" }}>
            {counts.ERROR} error{counts.ERROR !== 1 ? "s" : ""} in {typed.length} traces
          </span>
        )}
      </div>

      {/* Column header */}
      <div
        className="grid text-xs font-semibold px-3 py-2 rounded"
        style={{
          gridTemplateColumns: "2fr 80px 70px 150px 70px",
          color: "var(--muted)",
          background: "var(--surface)",
          border: "1px solid var(--border)",
        }}
      >
        <span>Trace / Span</span>
        <span>Kind</span>
        <span>Status</span>
        <span>Started</span>
        <span>Duration</span>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded p-4 text-xs text-center" style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--muted)" }}>
          No traces with status &quot;{filter}&quot;
        </div>
      ) : (
        <div style={{ opacity: isStale ? 0.5 : 1, transition: "opacity 200ms" }}>
          {visible.map((trace, i) => (
            <TraceRow key={trace.trace_id ?? i} trace={trace} />
          ))}
        </div>
      )}

      <Pagination
        page={deferredPage}
        totalPages={totalPages}
        total={filtered.length}
        isPending={isPending || isStale}
        onPage={goTo}
      />
    </div>
  );
}
