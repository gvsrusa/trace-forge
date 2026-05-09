"use client";

import { useState, useEffect } from "react";

type EvalScores = {
  completeness?: number;
  accuracy?: number;
  actionability?: number;
  calibration?: number;
};

type Review = {
  filename?: string;
  strategy_version?: number;
  timestamp?: string;
  report?: string;
  eval_scores?: EvalScores;
};

type Mutation = {
  dimension?: string;
  action?: string;
  detail?: string;
  rationale?: string;
  priority?: string;
  strategy_version?: number;
};

type ComparisonData = {
  from_review?: Review;
  to_review?: Review;
  from_version?: number;
  to_version?: number;
  strategy_mutations?: Mutation[];
  available_versions?: number[];
  available_components?: string[];
  error?: string;
};

const SCORE_LABELS: (keyof EvalScores)[] = ["completeness", "accuracy", "actionability", "calibration"];

const DIM_COLORS: Record<string, string> = {
  performance: "var(--info)",
  accessibility: "var(--ok)",
  best_practices: "var(--accent)",
  security: "var(--error)",
};

const ACTION_COLORS: Record<string, string> = {
  ADD_CHECK: "var(--ok)",
  CALIBRATE: "var(--warn)",
  DEPRIORITIZE: "var(--muted)",
};

function ScoreBar({ label, value }: { label: string; value: number }) {
  const pct = Math.round(value * 100);
  const color = value >= 0.9 ? "var(--ok)" : value >= 0.7 ? "var(--warn)" : "var(--error)";
  return (
    <div className="flex items-center gap-3 text-xs">
      <span style={{ color: "var(--muted)", width: 100, flexShrink: 0 }}>{label}</span>
      <div
        className="flex-1 rounded-full overflow-hidden"
        style={{ background: "var(--border)", height: 6 }}
      >
        <div style={{ width: `${pct}%`, height: 6, background: color, borderRadius: 9999 }} />
      </div>
      <span style={{ color, width: 32, textAlign: "right" }}>{pct}%</span>
    </div>
  );
}

function ScoreDelta({ label, from, to }: { label: string; from?: number; to?: number }) {
  if (from === undefined || to === undefined) return null;
  const delta = Math.round((to - from) * 100);
  const color = delta > 0 ? "var(--ok)" : delta < 0 ? "var(--error)" : "var(--muted)";
  const sign = delta > 0 ? "+" : "";
  return (
    <div className="flex items-center justify-between text-xs py-1">
      <span style={{ color: "var(--muted)" }}>{label}</span>
      <span style={{ color, fontWeight: "bold" }}>
        {sign}{delta}pp
      </span>
    </div>
  );
}

function ReviewColumn({
  review,
  version,
  label,
  badgeColor,
}: {
  review: Review;
  version: number;
  label: string;
  badgeColor: string;
}) {
  const scores = review?.eval_scores ?? {};
  const reportPreview = (review?.report ?? "").slice(0, 600);
  const ts = review?.timestamp ? new Date(review.timestamp).toLocaleDateString() : "—";

  return (
    <div
      className="rounded flex flex-col gap-3"
      style={{ background: "var(--surface)", border: "1px solid var(--border)", padding: 14 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <span
          className="text-xs font-bold px-2 py-0.5 rounded"
          style={{
            background: `${badgeColor}20`,
            color: badgeColor,
            border: `1px solid ${badgeColor}50`,
          }}
        >
          Strategy v{version}
        </span>
        <span style={{ color: "var(--muted)", fontSize: 10 }}>{label} · {ts}</span>
      </div>

      {/* Eval scores */}
      <div className="flex flex-col gap-2">
        <p className="text-xs font-semibold" style={{ color: "var(--muted)" }}>
          Eval scores (LLM-as-Judge)
        </p>
        {SCORE_LABELS.map((k) => (
          <ScoreBar key={k} label={k} value={scores[k] ?? 0} />
        ))}
      </div>

      {/* Report excerpt */}
      <div>
        <p className="text-xs font-semibold mb-1.5" style={{ color: "var(--muted)" }}>
          Review report
        </p>
        <div
          className="rounded text-xs overflow-auto"
          style={{
            background: "var(--bg)",
            border: "1px solid var(--border)",
            padding: "10px 12px",
            color: "var(--text)",
            maxHeight: 220,
            whiteSpace: "pre-wrap",
            fontFamily: "inherit",
            lineHeight: 1.6,
          }}
        >
          {reportPreview || "No report text."}
          {(review?.report ?? "").length > 600 && (
            <span style={{ color: "var(--muted)" }}>… (truncated)</span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ComparisonView() {
  const [data, setData] = useState<ComparisonData | null>(null);
  const [loading, setLoading] = useState(true);
  const [component, setComponent] = useState("ProductCard.tsx");
  const [fromV, setFromV] = useState<number | null>(null);
  const [toV, setToV] = useState<number | null>(null);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ component });
    if (fromV !== null) params.set("from_strategy", String(fromV));
    if (toV !== null) params.set("to_strategy", String(toV));

    fetch(`/api/comparison?${params}`)
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        // Set default version pins on first load
        if (fromV === null && d.available_versions?.length) {
          setFromV(d.available_versions[0]);
        }
        if (toV === null && d.available_versions?.length) {
          setToV(d.available_versions[d.available_versions.length - 1]);
        }
      })
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [component, fromV, toV]);

  const components = data?.available_components ?? [component];
  const versions = data?.available_versions ?? [];
  const mutations = data?.strategy_mutations ?? [];
  const addChecks = mutations.filter((m) => m.action === "ADD_CHECK");

  // Score deltas
  const fromScores = data?.from_review?.eval_scores ?? {};
  const toScores = data?.to_review?.eval_scores ?? {};

  const totalMutations = mutations.length;
  const newChecksCount = addChecks.length;

  return (
    <div className="flex flex-col gap-5">
      {/* Section header */}
      <div>
        <h2 className="text-sm font-bold" style={{ color: "var(--text)" }}>
          Before / After Comparison
        </h2>
        <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>
          Same component, different strategy version — see what the agent learned.
        </p>
      </div>

      {/* Controls */}
      <div
        className="flex items-center gap-4 flex-wrap rounded p-3"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <div className="flex items-center gap-2">
          <label className="text-xs" style={{ color: "var(--muted)" }}>Component</label>
          <select
            className="rounded text-xs px-2 py-1"
            style={{ background: "var(--bg)", border: "1px solid var(--border)", color: "var(--text)", fontFamily: "inherit" }}
            value={component}
            onChange={(e) => { setComponent(e.target.value); setFromV(null); setToV(null); }}
          >
            {components.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs" style={{ color: "var(--muted)" }}>From strategy</label>
          <select
            className="rounded text-xs px-2 py-1"
            style={{ background: "var(--bg)", border: "1px solid var(--border)", color: "var(--text)", fontFamily: "inherit" }}
            value={fromV ?? ""}
            onChange={(e) => setFromV(Number(e.target.value))}
          >
            {versions.map((v) => (
              <option key={v} value={v}>v{v}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs" style={{ color: "var(--muted)" }}>To strategy</label>
          <select
            className="rounded text-xs px-2 py-1"
            style={{ background: "var(--bg)", border: "1px solid var(--border)", color: "var(--text)", fontFamily: "inherit" }}
            value={toV ?? ""}
            onChange={(e) => setToV(Number(e.target.value))}
          >
            {versions.map((v) => (
              <option key={v} value={v}>v{v}</option>
            ))}
          </select>
        </div>

        {loading && (
          <span className="text-xs" style={{ color: "var(--muted)" }}>Loading…</span>
        )}
      </div>

      {data?.error ? (
        <div
          className="rounded p-4 text-sm text-center"
          style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--muted)" }}
        >
          {data.error}
        </div>
      ) : data && !loading ? (
        <>
          {/* Diff summary banner */}
          <div
            className="flex items-center gap-4 rounded px-4 py-3 flex-wrap"
            style={{ background: "var(--surface)", border: "1px solid var(--accent)" }}
          >
            <span className="text-xs" style={{ color: "var(--error)" }}>
              Strategy v{data.from_version} — baseline
            </span>
            <span style={{ color: "var(--muted)" }}>→</span>
            <span className="text-xs" style={{ color: "var(--ok)" }}>
              Strategy v{data.to_version} — latest
            </span>
            <span
              className="ml-auto text-xs font-bold px-3 py-1 rounded"
              style={{ background: "rgba(124,58,237,0.15)", color: "var(--accent)", border: "1px solid rgba(124,58,237,0.4)" }}
            >
              {totalMutations} strategy mutations · {newChecksCount} new checks added
            </span>
          </div>

          {/* Two columns */}
          <div className="grid gap-3" style={{ gridTemplateColumns: "1fr 1fr" }}>
            <ReviewColumn
              review={data.from_review!}
              version={data.from_version!}
              label="Early"
              badgeColor="var(--error)"
            />
            <ReviewColumn
              review={data.to_review!}
              version={data.to_version!}
              label="Latest"
              badgeColor="var(--ok)"
            />
          </div>

          {/* Score delta summary */}
          {Object.values(fromScores).length > 0 && Object.values(toScores).length > 0 && (
            <div
              className="rounded px-4 py-3"
              style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
            >
              <p className="text-xs font-semibold mb-2" style={{ color: "var(--muted)" }}>
                Score delta (v{data.from_version} → v{data.to_version})
              </p>
              {SCORE_LABELS.map((k) => (
                <ScoreDelta
                  key={k}
                  label={k}
                  from={fromScores[k]}
                  to={toScores[k]}
                />
              ))}
            </div>
          )}

          {/* Strategy mutations */}
          {mutations.length > 0 && (
            <div
              className="rounded overflow-hidden"
              style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
            >
              <div
                className="flex items-center justify-between px-4 py-2.5"
                style={{ borderBottom: "1px solid var(--border)" }}
              >
                <span className="text-xs font-bold" style={{ color: "var(--text)" }}>
                  What the agent learned — strategy mutations
                </span>
                <span className="text-xs" style={{ color: "var(--muted)" }}>
                  v{data.from_version} → v{data.to_version}
                </span>
              </div>
              {mutations.map((m, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 px-4 py-2.5"
                  style={{
                    borderBottom: i < mutations.length - 1 ? "1px solid var(--border)" : undefined,
                  }}
                >
                  <span
                    className="text-xs font-bold px-1.5 py-0.5 rounded shrink-0 mt-0.5"
                    style={{
                      background: `${ACTION_COLORS[m.action ?? ""] ?? "var(--muted)"}20`,
                      color: ACTION_COLORS[m.action ?? ""] ?? "var(--muted)",
                      border: `1px solid ${ACTION_COLORS[m.action ?? ""] ?? "var(--muted)"}40`,
                    }}
                  >
                    {m.action}
                  </span>
                  <span
                    className="text-xs px-1.5 py-0.5 rounded shrink-0 mt-0.5"
                    style={{
                      background: `${DIM_COLORS[m.dimension ?? ""] ?? "var(--muted)"}15`,
                      color: DIM_COLORS[m.dimension ?? ""] ?? "var(--muted)",
                    }}
                  >
                    {m.dimension}
                  </span>
                  <span className="text-xs flex-1" style={{ color: "var(--text)", lineHeight: 1.5 }}>
                    {m.detail}
                    {m.rationale && (
                      <span style={{ color: "var(--muted)" }}> — {m.rationale}</span>
                    )}
                  </span>
                  <span className="text-xs shrink-0" style={{ color: "var(--muted)" }}>
                    v{m.strategy_version}
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
