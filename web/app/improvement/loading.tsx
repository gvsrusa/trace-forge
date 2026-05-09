export default function ImprovementLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <div className="h-5 w-40 rounded animate-pulse" style={{ background: "var(--border)" }} />
        <div className="h-3 w-60 rounded animate-pulse" style={{ background: "var(--border)" }} />
      </div>

      {/* Chart skeleton */}
      <div className="rounded p-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <div className="h-3 w-48 rounded animate-pulse mb-4" style={{ background: "var(--border)" }} />
        <div className="rounded animate-pulse" style={{ background: "var(--border)", height: 260 }} />
      </div>

      {/* Eval runs table header */}
      <div className="h-4 w-32 rounded animate-pulse" style={{ background: "var(--border)" }} />
      <div className="grid px-3 py-2 rounded"
        style={{ gridTemplateColumns: "50px 150px 60px 1fr 1fr 1fr 1fr", background: "var(--surface)", border: "1px solid var(--border)" }}>
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="h-3 w-12 rounded animate-pulse" style={{ background: "var(--border)" }} />
        ))}
      </div>
      {Array.from({ length: 15 }).map((_, i) => (
        <div key={i} className="grid px-3 py-3 rounded"
          style={{ gridTemplateColumns: "50px 150px 60px 1fr 1fr 1fr 1fr", background: "var(--surface)", border: "1px solid var(--border)", opacity: 1 - i * 0.05 }}>
          {Array.from({ length: 7 }).map((_, j) => (
            <div key={j} className="h-3 rounded animate-pulse" style={{ background: "var(--border)", width: "70%" }} />
          ))}
        </div>
      ))}
    </div>
  );
}
