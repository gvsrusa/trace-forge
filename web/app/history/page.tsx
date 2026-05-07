async function getReviews() {
  try {
    const base = process.env.AGENT_BACKEND_URL ?? process.env.NEXT_PUBLIC_AGENT_URL ?? "http://localhost:8080";
    const res = await fetch(`${base}/api/reviews?limit=20`, { cache: "no-store" });
    if (!res.ok) return [];
    const data = await res.json();
    return data.reviews ?? [];
  } catch {
    return [];
  }
}

export default async function HistoryPage() {
  const reviews = await getReviews();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-bold" style={{ color: "var(--text)" }}>
          Review History
        </h1>
        <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
          All past reviews stored in Firestore.
        </p>
      </div>

      {reviews.length === 0 ? (
        <div
          className="rounded p-6 text-sm text-center"
          style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--muted)" }}
        >
          No reviews yet — run one from the Review page.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {reviews.map((r: Record<string, unknown>, i: number) => (
            <div
              key={i}
              className="rounded p-4 text-xs flex items-center justify-between"
              style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
            >
              <div>
                <span style={{ color: "var(--accent)" }} className="font-semibold">
                  {String(r.filename ?? "unknown")}
                </span>
                <span style={{ color: "var(--muted)" }} className="ml-3">
                  {r.timestamp ? new Date(String(r.timestamp)).toLocaleString() : "—"}
                </span>
              </div>
              <span style={{ color: "var(--ok)" }}>{String(r.id ?? "")}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
