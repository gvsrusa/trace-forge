"use client";

import { useState, useRef, useCallback } from "react";
import { streamReview, streamRepoReview, type AgentEvent } from "@/lib/agent";

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

type Tab = "paste" | "repo";

export default function ReviewPanel() {
  const [tab, setTab] = useState<Tab>("paste");

  // Paste mode state
  const [code, setCode] = useState("");
  const [filename, setFilename] = useState("Component.tsx");

  // Repo mode state
  const [repoUrl, setRepoUrl] = useState("");

  // Shared state
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [running, setRunning] = useState(false);
  const [reports, setReports] = useState<{ path: string; content: string }[]>([]);
  const [activeReport, setActiveReport] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  const scrollLog = () =>
    setTimeout(() => logRef.current?.scrollTo(0, logRef.current.scrollHeight), 0);

  const runPaste = useCallback(async () => {
    if (!code.trim()) return;
    setEvents([]);
    setReports([]);
    setActiveReport(0);
    setRunning(true);
    abortRef.current = new AbortController();
    let finalMd = "";

    try {
      for await (const ev of streamReview(code, filename, "tsx", abortRef.current.signal)) {
        setEvents((prev) => [...prev, ev]);
        if (ev.type === "final") finalMd = ev.content;
        scrollLog();
      }
    } catch (e: unknown) {
      if ((e as Error).name !== "AbortError") {
        setEvents((prev) => [...prev, { type: "error", message: String(e) }]);
      }
    } finally {
      if (finalMd) setReports([{ path: filename, content: finalMd }]);
      setRunning(false);
    }
  }, [code, filename]);

  const runRepo = useCallback(async () => {
    if (!repoUrl.trim()) return;
    setEvents([]);
    setReports([]);
    setActiveReport(0);
    setRunning(true);
    abortRef.current = new AbortController();

    const fileReports: { path: string; content: string }[] = [];
    let currentPath = "";
    let currentMd = "";

    try {
      for await (const ev of streamRepoReview(repoUrl.trim(), abortRef.current.signal)) {
        setEvents((prev) => [...prev, ev]);
        scrollLog();

        if (ev.type === "file_start") {
          currentPath = ev.path;
          currentMd = "";
        } else if (ev.type === "final") {
          currentMd = ev.content;
        } else if (ev.type === "file_done") {
          if (currentMd) {
            fileReports.push({ path: currentPath, content: currentMd });
            setReports([...fileReports]);
          }
        }
      }
    } catch (e: unknown) {
      if ((e as Error).name !== "AbortError") {
        setEvents((prev) => [...prev, { type: "error", message: String(e) }]);
      }
    } finally {
      setRunning(false);
    }
  }, [repoUrl]);

  const stop = () => abortRef.current?.abort();

  const canRun = tab === "paste" ? code.trim().length > 0 : repoUrl.trim().length > 0;

  return (
    <div className="flex gap-4 h-full">
      {/* Left: input */}
      <div className="flex flex-col gap-3 w-1/2">
        {/* Tabs */}
        <div className="flex flex-wrap gap-1">
          {(["paste", "repo"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="px-3 py-1 rounded text-xs font-medium transition-colors"
              style={{
                background: tab === t ? "var(--accent)" : "var(--surface)",
                color: tab === t ? "#fff" : "var(--muted)",
                border: "1px solid var(--border)",
                cursor: "pointer",
              }}
            >
              {t === "paste" ? "Paste Component" : "GitHub Repo"}
            </button>
          ))}
          <div className="flex-1" />
          <button
            onClick={running ? stop : tab === "paste" ? runPaste : runRepo}
            disabled={!canRun && !running}
            className="px-4 py-1 rounded text-sm font-semibold transition-colors"
            style={{
              background: running ? "#7f1d1d" : canRun ? "var(--accent)" : "var(--surface)",
              color: running || canRun ? "#fff" : "var(--muted)",
              border: "1px solid var(--border)",
              cursor: canRun || running ? "pointer" : "default",
            }}
          >
            {running ? "■ Stop" : "▶ Review"}
          </button>
        </div>

        {tab === "paste" ? (
          <>
            <input
              value={filename}
              onChange={(e) => setFilename(e.target.value)}
              placeholder="Filename"
              className="px-2 py-1 rounded text-sm w-56"
              style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)" }}
            />
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
                minHeight: "380px",
                fontFamily: "inherit",
              }}
            />
          </>
        ) : (
          <div className="flex flex-col gap-3 flex-1">
            <input
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              placeholder="https://github.com/owner/repo"
              className="px-3 py-2 rounded text-sm"
              style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)" }}
            />
            <div
              className="flex-1 rounded p-4 text-xs leading-relaxed"
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                color: "var(--muted)",
              }}
            >
              <p className="mb-2" style={{ color: "var(--text)", fontWeight: 600 }}>How it works</p>
              <ul className="space-y-1 list-none">
                <li>① Fetches the full file tree via GitHub API</li>
                <li>② Discovers React components (.tsx / .jsx)</li>
                <li>③ Also detects .ts / .js files with React imports</li>
                <li>④ Skips node_modules, dist, .next, build folders</li>
                <li>⑤ Reviews up to 10 components, streams results live</li>
              </ul>
              <p className="mt-3">
                Works with any public repository. For private repos, set{" "}
                <code style={{ color: "var(--accent)" }}>GITHUB_TOKEN</code> env var on the agent.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Right: live log + reports */}
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

        {/* Report tabs for multi-file repo reviews */}
        {reports.length > 1 && (
          <div className="flex gap-1 flex-wrap">
            {reports.map((r, i) => (
              <button
                key={i}
                onClick={() => setActiveReport(i)}
                className="px-2 py-0.5 rounded text-xs"
                style={{
                  background: activeReport === i ? "var(--accent)" : "var(--surface)",
                  color: activeReport === i ? "#fff" : "var(--muted)",
                  border: "1px solid var(--border)",
                  cursor: "pointer",
                  maxWidth: "140px",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
                title={r.path}
              >
                {r.path.split("/").pop()}
              </button>
            ))}
          </div>
        )}

        {/* Final report */}
        <div
          className="flex-1 rounded p-4 overflow-y-auto text-xs leading-relaxed whitespace-pre-wrap"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            color: reports[activeReport] ? "var(--text)" : "var(--muted)",
            fontFamily: "inherit",
          }}
        >
          {reports[activeReport]?.content || "Review report will appear here…"}
        </div>
      </div>
    </div>
  );
}

function EventLine({ ev }: { ev: AgentEvent }) {
  if (ev.type === "repo_info") {
    return (
      <div style={{ color: "var(--accent)", fontWeight: 600 }}>
        ⬢ {ev.repo}@{ev.ref} — {ev.total} component{ev.total !== 1 ? "s" : ""} found
      </div>
    );
  }
  if (ev.type === "file_start") {
    return (
      <div style={{ color: "#a855f7", fontWeight: 600 }}>
        ▶ [{ev.index}/{ev.total}] {ev.path}
      </div>
    );
  }
  if (ev.type === "file_done") {
    return (
      <div style={{ color: "var(--ok)" }}>
        ✓ Done: {ev.path}
      </div>
    );
  }
  if (ev.type === "step") {
    const c = DIM_COLOR[ev.dimension] ?? "var(--text)";
    return <div style={{ color: c }}>▶ {ev.name}</div>;
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
