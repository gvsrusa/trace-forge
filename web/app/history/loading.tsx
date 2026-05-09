export default function HistoryLoading() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <div className="h-5 w-40 rounded animate-pulse" style={{ background: "var(--border)" }} />
        <div className="h-3 w-56 rounded animate-pulse" style={{ background: "var(--border)" }} />
      </div>

      {/* Header row */}
      <div
        className="grid px-3 py-2 rounded"
        style={{
          gridTemplateColumns: "2fr 70px 160px 150px 70px",
          background: "var(--surface)",
          border: "1px solid var(--border)",
        }}
      >
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-3 w-16 rounded animate-pulse" style={{ background: "var(--border)" }} />
        ))}
      </div>

      {Array.from({ length: 15 }).map((_, i) => (
        <div
          key={i}
          className="grid px-3 py-3 rounded"
          style={{
            gridTemplateColumns: "2fr 70px 160px 150px 70px",
            background: "var(--surface)",
            border: "1px solid var(--border)",
            opacity: 1 - i * 0.05,
          }}
        >
          <div className="h-3 rounded animate-pulse" style={{ background: "var(--border)", width: `${55 + (i % 4) * 10}%` }} />
          <div className="h-3 w-8 rounded animate-pulse" style={{ background: "var(--border)" }} />
          <div className="h-3 w-24 rounded animate-pulse" style={{ background: "var(--border)" }} />
          <div className="h-3 w-20 rounded animate-pulse" style={{ background: "var(--border)" }} />
          <div className="h-3 w-10 rounded animate-pulse" style={{ background: "var(--border)" }} />
        </div>
      ))}
    </div>
  );
}
