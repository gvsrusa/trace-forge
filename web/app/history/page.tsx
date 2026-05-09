import ReviewList from "@/components/ReviewList";

export const dynamic = "force-dynamic";

const AGENT = process.env.AGENT_BACKEND_URL ?? process.env.NEXT_PUBLIC_AGENT_URL ?? "http://localhost:8080";

async function getReviews() {
  const limit = process.env.REVIEWS_FETCH_LIMIT ?? "200";
  try {
    const res = await fetch(`${AGENT}/api/reviews?limit=${limit}`, { cache: "no-store" });
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
          All past reviews stored in Firestore — click a row to expand the full report.
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
        <ReviewList reviews={reviews} />
      )}
    </div>
  );
}
