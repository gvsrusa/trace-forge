"use client";

type Span = Record<string, unknown>;

const STATUS_COLOR: Record<string, string> = {
  OK: "var(--ok)",
  ERROR: "var(--error)",
  UNSET: "var(--muted)",
};

function durationMs(span: Span): string {
  const start = span.start_time as string;
  const end = span.end_time as string;
  if (!start || !end) return "—";
  const ms = new Date(end).getTime() - new Date(start).getTime();
  return ms > 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;
}

export default function TraceList({
  spans,
  phoenixBase,
}: {
  spans: Span[];
  phoenixBase: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div
        className="grid text-xs font-semibold px-3 py-2 rounded"
        style={{
          gridTemplateColumns: "2fr 1fr 1fr 1fr 80px",
          color: "var(--muted)",
          background: "var(--surface)",
          border: "1px solid var(--border)",
        }}
      >
        <span>Span Name</span>
        <span>Kind</span>
        <span>Status</span>
        <span>Started</span>
        <span>Duration</span>
      </div>

      {spans.map((span, i) => {
        const status = String(span.status_code ?? "UNSET");
        const kind = String(span.span_kind ?? "");
        const name = String(span.name ?? "unknown");
        const traceId = String(span.trace_id ?? "");
        const started = span.start_time
          ? new Date(span.start_time as string).toLocaleTimeString()
          : "—";

        return (
          <a
            key={i}
            href={`${phoenixBase}/projects/traceforge/traces/${traceId}`}
            target="_blank"
            rel="noreferrer"
            className="grid text-xs px-3 py-2.5 rounded transition-colors hover:opacity-80"
            style={{
              gridTemplateColumns: "2fr 1fr 1fr 1fr 80px",
              background: "var(--surface)",
              border: "1px solid var(--border)",
              color: "var(--text)",
              textDecoration: "none",
            }}
          >
            <span className="truncate font-mono">{name}</span>
            <span style={{ color: "var(--accent)" }}>{kind}</span>
            <span style={{ color: STATUS_COLOR[status] ?? "var(--muted)" }}>
              {status}
            </span>
            <span style={{ color: "var(--muted)" }}>{started}</span>
            <span style={{ color: "var(--muted)" }}>{durationMs(span)}</span>
          </a>
        );
      })}
    </div>
  );
}
