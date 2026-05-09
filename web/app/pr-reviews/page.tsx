import PRReviewList from "@/components/PRReviewList";
import PRReviewTrigger from "@/components/PRReviewTrigger";

export const dynamic = "force-dynamic";

const AGENT = process.env.AGENT_BACKEND_URL ?? process.env.NEXT_PUBLIC_AGENT_URL ?? "http://localhost:8080";

async function getPRReviews() {
  const limit = process.env.PR_REVIEWS_FETCH_LIMIT ?? "100";
  try {
    const res = await fetch(`${AGENT}/api/pr-reviews?limit=${limit}`, { cache: "no-store" });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export default async function PRReviewsPage() {
  const data = await getPRReviews();
  const reviews: Record<string, unknown>[] = data?.pr_reviews ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold" style={{ color: "var(--text)" }}>PR Reviews</h1>
          <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
            Paste any public GitHub PR URL to get an expert review across all languages.
          </p>
        </div>
        {reviews.length > 0 && (
          <span
            className="text-sm font-bold px-3 py-1.5 rounded"
            style={{ background: "rgba(124,58,237,0.15)", color: "var(--accent)", border: "1px solid rgba(124,58,237,0.4)" }}
          >
            {reviews.length} PR{reviews.length !== 1 ? "s" : ""} reviewed
          </span>
        )}
      </div>

      <PRReviewTrigger />

      {reviews.length === 0 ? (
        <div className="rounded p-6 text-sm text-center"
          style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--muted)" }}>
          No PR reviews yet — paste a GitHub PR URL above to run your first review.
        </div>
      ) : (
        <PRReviewList reviews={reviews} />
      )}
    </div>
  );
}
