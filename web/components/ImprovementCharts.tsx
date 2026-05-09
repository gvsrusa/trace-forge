"use client";

import {
  ComposedChart, Area, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, ReferenceLine, Legend,
} from "recharts";

type Trend = Record<string, unknown>;
type Scores = { accuracy?: number; actionability?: number; calibration?: number; completeness?: number };

const METRICS = [
  { key: "completeness",  color: "#3b82f6", label: "Completeness" },
  { key: "accuracy",      color: "#7c3aed", label: "Accuracy" },
  { key: "actionability", color: "#10b981", label: "Actionability" },
  { key: "calibration",   color: "#f59e0b", label: "Calibration" },
] as const;

function rollingAvg(data: number[], window: number): (number | null)[] {
  return data.map((_, i) => {
    if (i < window - 1) return null;
    const slice = data.slice(i - window + 1, i + 1);
    return slice.reduce((a, b) => a + b, 0) / slice.length;
  });
}

function CustomTooltip({ active, payload, label }: Record<string, unknown>) {
  if (!active || !Array.isArray(payload) || !payload.length) return null;
  const run = payload[0]?.payload as Record<string, unknown>;
  const delta = run.delta as number | null;
  return (
    <div className="rounded text-xs flex flex-col gap-1.5 p-3"
      style={{ background: "#13131a", border: "1px solid #1e1e2e", color: "#e2e2f0", minWidth: 190 }}>
      <div className="flex items-center justify-between gap-4 mb-0.5">
        <span style={{ color: "#6b7280" }}>Run #{label as number} · v{run.strategyVersion as number}</span>
        {delta !== null && (
          <span style={{ color: delta > 0 ? "#10b981" : delta < 0 ? "#ef4444" : "#6b7280", fontWeight: 700 }}>
            {delta > 0 ? "+" : ""}{(delta * 100).toFixed(0)}pp
          </span>
        )}
      </div>
      {(payload as Record<string, unknown>[])
        .filter((p) => p.dataKey !== "trendAvg")
        .map((p) => (
          <div key={p.dataKey as string} className="flex items-center justify-between gap-3">
            <span style={{ color: p.color as string }}>{p.name as string}</span>
            <span style={{ fontWeight: 600 }}>{(((p.value as number) ?? 0) * 100).toFixed(0)}%</span>
          </div>
        ))}
      {(run.trendAvg as number | null) != null && (
        <div className="flex items-center justify-between gap-3 pt-1" style={{ borderTop: "1px solid #1e1e2e" }}>
          <span style={{ color: "#6b7280" }}>5-run avg</span>
          <span style={{ fontWeight: 600 }}>{((run.trendAvg as number) * 100).toFixed(0)}%</span>
        </div>
      )}
    </div>
  );
}

export default function ImprovementCharts({ trends }: { trends: Trend[] }) {
  const avgs = trends.map((t) => {
    const s = (t.scores as Scores) ?? {};
    const vals = [s.completeness ?? 0, s.accuracy ?? 0, s.actionability ?? 0, s.calibration ?? 0];
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  });

  const rollingAvgs = rollingAvg(avgs, 5);
  const globalMean = avgs.reduce((a, b) => a + b, 0) / avgs.length;

  const chartData = trends.map((t, i) => {
    const s = (t.scores as Scores) ?? {};
    const prevAvg = i > 0 ? avgs[i - 1] : null;
    return {
      run: i + 1,
      strategyVersion: t.strategy_version,
      completeness:  s.completeness  ?? 0,
      accuracy:      s.accuracy      ?? 0,
      actionability: s.actionability ?? 0,
      calibration:   s.calibration   ?? 0,
      trendAvg: rollingAvgs[i],
      delta: prevAvg !== null ? avgs[i] - prevAvg : null,
    };
  });

  return (
    <div className="rounded p-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs font-semibold" style={{ color: "var(--muted)" }}>
          Eval scores per run — white dashed = 5-run rolling average
        </p>
        <span className="text-xs" style={{ color: "var(--muted)" }}>
          Mean: <span style={{ color: "var(--accent)", fontWeight: 700 }}>{(globalMean * 100).toFixed(0)}%</span>
        </span>
      </div>

      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart data={chartData} margin={{ top: 4, right: 8, bottom: 16, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2e" />
          <XAxis dataKey="run" tick={{ fill: "#6b7280", fontSize: 10 }}
            label={{ value: "Run #", position: "insideBottom", offset: -8, fill: "#6b7280", fontSize: 10 }} />
          <YAxis domain={[0, 1]} tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} tick={{ fill: "#6b7280", fontSize: 10 }} />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ fontSize: 11, color: "#6b7280", paddingTop: 8 }}
            formatter={(value) => value === "trendAvg" ? "5-run avg" : value} />
          <ReferenceLine y={globalMean} stroke="#4b5563" strokeDasharray="4 2" strokeWidth={1} />

          {METRICS.map(({ key, color }) => (
            <Area key={key} type="monotone" dataKey={key}
              name={key.charAt(0).toUpperCase() + key.slice(1)}
              stroke={color} fill={color} fillOpacity={0.05}
              strokeWidth={1.5} dot={false} activeDot={{ r: 3 }} />
          ))}

          <Line type="monotone" dataKey="trendAvg" name="trendAvg"
            stroke="#ffffff" strokeWidth={2} strokeDasharray="5 3"
            dot={false} connectNulls />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
