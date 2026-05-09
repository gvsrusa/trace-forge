export default function StrategyLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <div className="h-5 w-36 rounded animate-pulse" style={{ background: "var(--border)" }} />
        <div className="h-3 w-64 rounded animate-pulse" style={{ background: "var(--border)" }} />
      </div>

      {/* Current version card skeleton */}
      <div className="rounded p-4 flex flex-col gap-3"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <div className="flex gap-3">
          <div className="h-4 w-10 rounded animate-pulse" style={{ background: "var(--border)" }} />
          <div className="h-4 w-32 rounded animate-pulse" style={{ background: "var(--border)" }} />
        </div>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex gap-2">
            <div className="h-5 w-20 rounded animate-pulse" style={{ background: "var(--border)" }} />
            <div className="h-5 w-24 rounded animate-pulse" style={{ background: "var(--border)" }} />
            <div className="h-5 flex-1 rounded animate-pulse" style={{ background: "var(--border)" }} />
          </div>
        ))}
      </div>

      {/* History header */}
      <div className="h-4 w-32 rounded animate-pulse" style={{ background: "var(--border)" }} />

      {/* History rows */}
      <div
        className="grid px-3 py-2 rounded"
        style={{ gridTemplateColumns: "60px 150px 80px 1fr", background: "var(--surface)", border: "1px solid var(--border)" }}
      >
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-3 w-16 rounded animate-pulse" style={{ background: "var(--border)" }} />
        ))}
      </div>
      {Array.from({ length: 15 }).map((_, i) => (
        <div key={i} className="grid px-3 py-3 rounded"
          style={{ gridTemplateColumns: "60px 150px 80px 1fr", background: "var(--surface)", border: "1px solid var(--border)", opacity: 1 - i * 0.05 }}>
          <div className="h-3 w-8 rounded animate-pulse" style={{ background: "var(--border)" }} />
          <div className="h-3 w-24 rounded animate-pulse" style={{ background: "var(--border)" }} />
          <div className="h-3 w-12 rounded animate-pulse" style={{ background: "var(--border)" }} />
          <div className="h-3 rounded animate-pulse" style={{ background: "var(--border)", width: "60%" }} />
        </div>
      ))}
    </div>
  );
}
