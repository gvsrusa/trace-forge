export default function Loading() {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between mb-2">
        <div className="h-6 w-32 rounded animate-pulse" style={{ background: "var(--surface)" }} />
        <div className="h-7 w-24 rounded animate-pulse" style={{ background: "var(--surface)" }} />
      </div>
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="h-12 rounded animate-pulse" style={{ background: "var(--surface)", border: "1px solid var(--border)" }} />
      ))}
    </div>
  );
}
