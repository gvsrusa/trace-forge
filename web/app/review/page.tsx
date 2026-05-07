import ReviewPanel from "@/components/ReviewPanel";

export default function ReviewPage() {
  return (
    <div className="flex flex-col gap-4 h-full">
      <div>
        <h1 className="text-lg font-bold" style={{ color: "var(--text)" }}>
          Code Review
        </h1>
        <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
          Paste a React component — the agent reviews it across 4 dimensions in real time.
        </p>
      </div>
      <ReviewPanel />
    </div>
  );
}
