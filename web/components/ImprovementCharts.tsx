"use client";

import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";

type Trend = Record<string, unknown>;

export default function ImprovementCharts({ trends }: { trends: Trend[] }) {
  const chartData = trends.map((t, i) => {
    const scores = (t.scores as Record<string, number>) ?? {};
    return {
      run: i + 1,
      accuracy: scores.accuracy ?? 0,
      actionability: scores.actionability ?? 0,
      calibration: scores.calibration ?? 0,
      completeness: scores.completeness ?? 0,
    };
  });

  return (
    <div
      className="rounded p-4"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
    >
      <p className="text-xs mb-4" style={{ color: "var(--muted)" }}>
        Eval scores per review run (LLM-as-Judge)
      </p>
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2e" />
          <XAxis dataKey="run" tick={{ fill: "#6b7280", fontSize: 11 }} label={{ value: "Run #", position: "insideBottom", offset: -2, fill: "#6b7280", fontSize: 11 }} />
          <YAxis domain={[0, 1]} tick={{ fill: "#6b7280", fontSize: 11 }} />
          <Tooltip
            contentStyle={{ background: "#13131a", border: "1px solid #1e1e2e", color: "#e2e2f0", fontSize: 11 }}
          />
          <Legend wrapperStyle={{ fontSize: 11, color: "#6b7280" }} />
          <Line type="monotone" dataKey="accuracy" stroke="#7c3aed" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="actionability" stroke="#10b981" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="calibration" stroke="#f59e0b" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="completeness" stroke="#3b82f6" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
