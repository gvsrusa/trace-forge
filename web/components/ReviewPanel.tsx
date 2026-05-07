"use client";

import { useState, useRef, useCallback } from "react";
import { streamReview, type AgentEvent } from "@/lib/agent";

const PLACEHOLDER = `// Paste your React component here
import React, { useState } from 'react';

export function MyComponent({ title }: { title: string }) {
  const [count, setCount] = useState(0);
  return (
    <div onClick={() => setCount(c => c + 1)}>
      <h1>{title}</h1>
      <p>Count: {count}</p>
    </div>
  );
}`;

const DIM_COLOR: Record<string, string> = {
  performance: "#f59e0b",
  accessibility: "#3b82f6",
  security: "#ef4444",
  best_practices: "#10b981",
  setup: "#7c3aed",
};

export default function ReviewPanel() {
  const [code, setCode] = useState("");
  const [filename, setFilename] = useState("Component.tsx");
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [running, setRunning] = useState(false);
  const [finalMd, setFinalMd] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  const run = useCallback(async () => {
    if (!code.trim()) return;
    setEvents([]);
    setFinalMd("");
    setRunning(true);
    abortRef.current = new AbortController();

    try {
      for await (const ev of streamReview(code, filename, "tsx", abortRef.current.signal)) {
        setEvents((prev) => [...prev, ev]);
        if (ev.type === "final") setFinalMd(ev.content);
        setTimeout(() => logRef.current?.scrollTo(0, logRef.current.scrollHeight), 0);
      }
    } catch (e: unknown) {
      if ((e as Error).name !== "AbortError") {
        setEvents((prev) => [...prev, { type: "error", message: String(e) }]);
      }
    } finally {
      setRunning(false);
    }
  }, [code, filename]);

  const stop = () => abortRef.current?.abort();

  return (
    <div className="flex gap-4 h-full">
      {/* Left: input */}
      <div className="flex flex-col gap-3 w-1/2">
        <div className="flex gap-2 items-center">
          <input
            value={filename}
            onChange={(e) => setFilename(e.target.value)}
            className="px-2 py-1 rounded text-sm w-48"
            style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)" }}
          />
          <button
            onClick={running ? stop : run}
            className="px-4 py-1.5 rounded text-sm font-semibold transition-colors"
            style={{
              background: running ? "#7f1d1d" : "var(--accent)",
              color: "#fff",
              cursor: "pointer",
            }}
          >
            {running ? "■ Stop" : "▶ Review"}
          </button>
        </div>
        <textarea
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder={PLACEHOLDER}
          spellCheck={false}
          className="flex-1 resize-none p-3 rounded text-xs leading-relaxed"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            color: "var(--text)",
            minHeight: "400px",
            fontFamily: "inherit",
          }}
        />
      </div>

      {/* Right: live log + report */}
      <div className="flex flex-col gap-3 w-1/2">
        {/* Live event log */}
        <div
          ref={logRef}
          className="rounded p-3 text-xs overflow-y-auto"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            height: "220px",
            fontFamily: "inherit",
          }}
        >
          {events.length === 0 && (
            <span style={{ color: "var(--muted)" }}>Waiting for review…</span>
          )}
          {events.map((ev, i) => (
            <EventLine key={i} ev={ev} />
          ))}
          {running && (
            <span style={{ color: "var(--accent)" }} className="animate-pulse">
              ● running
            </span>
          )}
        </div>

        {/* Final report */}
        <div
          className="flex-1 rounded p-4 overflow-y-auto text-xs leading-relaxed whitespace-pre-wrap"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            color: finalMd ? "var(--text)" : "var(--muted)",
            fontFamily: "inherit",
          }}
        >
          {finalMd || "Review report will appear here…"}
        </div>
      </div>
    </div>
  );
}

function EventLine({ ev }: { ev: AgentEvent }) {
  if (ev.type === "step") {
    const c = DIM_COLOR[ev.dimension] ?? "var(--text)";
    return (
      <div style={{ color: c }}>
        ▶ {ev.name}
      </div>
    );
  }
  if (ev.type === "tool_call") {
    const done = ev.status === "complete";
    return (
      <div style={{ color: done ? "var(--ok)" : "var(--muted)" }}>
        {done ? "✓" : "→"} {ev.tool}()
      </div>
    );
  }
  if (ev.type === "thought") {
    return (
      <div style={{ color: "var(--muted)" }} className="pl-2">
        💭 {ev.content.slice(0, 140)}
      </div>
    );
  }
  if (ev.type === "error") {
    return <div style={{ color: "var(--error)" }}>✗ {ev.message}</div>;
  }
  if (ev.type === "final") {
    return <div style={{ color: "var(--ok)" }}>✅ Review complete</div>;
  }
  return null;
}
