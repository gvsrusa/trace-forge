export default function TracesLoading() {
  return (
    <div className="flex flex-col gap-5">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-2">
          <div className="h-5 w-36 rounded animate-pulse" style={{ background: "var(--border)" }} />
          <div className="h-3 w-64 rounded animate-pulse" style={{ background: "var(--border)" }} />
        </div>
        <div className="h-8 w-32 rounded animate-pulse" style={{ background: "var(--border)" }} />
      </div>

      {/* Table header */}
      <div
        className="grid px-3 py-2 rounded"
        style={{
          gridTemplateColumns: "2fr 80px 70px 90px 70px",
          background: "var(--surface)",
          border: "1px solid var(--border)",
        }}
      >
        {["Trace / Span", "Kind", "Status", "Started", "Duration"].map((col) => (
          <div key={col} className="h-3 w-16 rounded animate-pulse" style={{ background: "var(--border)" }} />
        ))}
      </div>

      {/* Row skeletons */}
      {Array.from({ length: 15 }).map((_, i) => (
        <div
          key={i}
          className="grid px-3 py-3 rounded"
          style={{
            gridTemplateColumns: "2fr 80px 70px 90px 70px",
            background: "var(--surface)",
            border: "1px solid var(--border)",
            opacity: 1 - i * 0.09,
          }}
        >
          <div className="h-3 rounded animate-pulse" style={{ background: "var(--border)", width: `${60 + (i % 3) * 15}%` }} />
          <div className="h-3 w-12 rounded animate-pulse" style={{ background: "var(--border)" }} />
          <div className="h-3 w-8 rounded animate-pulse" style={{ background: "var(--border)" }} />
          <div className="h-3 w-16 rounded animate-pulse" style={{ background: "var(--border)" }} />
          <div className="h-3 w-10 rounded animate-pulse" style={{ background: "var(--border)" }} />
        </div>
      ))}
    </div>
  );
}
