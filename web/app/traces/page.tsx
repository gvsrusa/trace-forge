import TraceList from "@/components/TraceList";

const PHOENIX_BASE = "https://app.phoenix.arize.com/s/YOUR_SPACE";
const PHOENIX_API = "https://app.phoenix.arize.com/s/YOUR_SPACE/v1";
const PHOENIX_API_KEY = process.env.PHOENIX_API_KEY ?? "";

async function getTraces() {
  try {
    const res = await fetch(
      `${PHOENIX_API}/spans?project_name=traceforge&limit=20`,
      {
        headers: { authorization: `Bearer ${PHOENIX_API_KEY}` },
        cache: "no-store",
      }
    );
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export default async function TracesPage() {
  const data = await getTraces();
  const spans: Record<string, unknown>[] = data?.data ?? [];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold" style={{ color: "var(--text)" }}>
            Trace Explorer
          </h1>
          <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
            Every span, tool call, and LLM invocation from Phoenix Cloud.
          </p>
        </div>
        <a
          href={`${PHOENIX_BASE}/projects/traceforge/traces`}
          target="_blank"
          rel="noreferrer"
          className="px-4 py-2 rounded text-sm font-semibold"
          style={{ background: "var(--accent)", color: "#fff" }}
        >
          Open in Phoenix ↗
        </a>
      </div>

      {spans.length === 0 ? (
        <div
          className="rounded p-8 flex flex-col items-center gap-4"
          style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
        >
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            No traces yet — run a review to generate spans.
          </p>
          <p className="text-xs" style={{ color: "var(--muted)" }}>
            Or view them directly in Phoenix Cloud:
          </p>
          <a
            href={`${PHOENIX_BASE}/projects/traceforge/traces`}
            target="_blank"
            rel="noreferrer"
            className="px-5 py-2.5 rounded text-sm font-semibold"
            style={{ background: "var(--accent)", color: "#fff" }}
          >
            Open Phoenix Cloud ↗
          </a>
        </div>
      ) : (
        <TraceList spans={spans} phoenixBase={PHOENIX_BASE} />
      )}
    </div>
  );
}
