"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";

const AGENT_URL =
  process.env.NEXT_PUBLIC_AGENT_URL ?? "http://localhost:8080";

type EventLine =
  | { type: "started"; pr_url: string }
  | { type: "files_found"; count: number; total_files: number }
  | { type: "file_start"; path: string; index: number; total: number }
  | { type: "file_done"; path: string; findings: number; index: number; total: number }
  | { type: "complete"; pr_review_id: string }
  | { type: "error"; message: string }
  | { type: "tool_call"; tool: string; status: string }
  | { type: "step"; name: string; status: string };

const EXAMPLE_PRS = [
  "https://github.com/vercel/next.js/pull/12345",
  "https://github.com/facebook/react/pull/28000",
  "https://github.com/torvalds/linux/pull/1",
];

function ProgressLog({ lines }: { lines: string[] }) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={ref}
      className="rounded px-3 py-2 text-xs flex flex-col gap-1 overflow-y-auto"
      style={{
        background: "var(--bg)",
        border: "1px solid var(--border)",
        maxHeight: 180,
        fontFamily: "monospace",
      }}
    >
      {lines.map((l, i) => (
        <span key={i} style={{ color: "var(--muted)" }}>{l}</span>
      ))}
    </div>
  );
}

export default function PRReviewTrigger() {
  const [url, setUrl] = useState("");
  const [status, setStatus] = useState<"idle" | "running" | "done" | "error">("idle");
  const [log, setLog] = useState<string[]>([]);
  const [resultId, setResultId] = useState<string | null>(null);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim() || status === "running") return;

    setStatus("running");
    setLog([`→ Submitting PR for review: ${url.trim()}`]);
    setResultId(null);

    try {
      const res = await fetch(`${AGENT_URL}/api/pr-reviews/trigger`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pr_url: url.trim() }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        setStatus("error");
        setLog((l) => [...l, `✗ Error: ${err.detail ?? "Unknown error"}`]);
        return;
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error("No response stream");

      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6).trim();
          if (raw === "[DONE]") continue;
          try {
            const event = JSON.parse(raw) as EventLine;
            if (event.type === "started") {
              setLog((l) => [...l, `✓ Connected — fetching PR files…`]);
            } else if (event.type === "files_found") {
              setLog((l) => [...l, `✓ Found ${event.total_files} changed files, reviewing ${event.count} most important`]);
            } else if (event.type === "file_start") {
              setLog((l) => [...l, `⏳ [${event.index}/${event.total}] Reviewing ${event.path}…`]);
            } else if (event.type === "file_done") {
              const icon = event.findings > 0 ? "⚠️" : "✓";
              setLog((l) => [...l, `${icon} [${event.index}/${event.total}] ${event.path} — ${event.findings} finding${event.findings !== 1 ? "s" : ""}`]);
            } else if (event.type === "step") {
              setLog((l) => [...l, `⏳ ${event.name}`]);
            } else if (event.type === "tool_call") {
              if (event.status === "running") {
                setLog((l) => [...l, `  › ${event.tool}…`]);
              }
            } else if (event.type === "complete") {
              setResultId(event.pr_review_id);
              setStatus("done");
              setLog((l) => [...l, `✓ Review saved — loading results…`]);
              router.refresh();
              if (event.pr_review_id) {
                setTimeout(() => router.push(`/pr-reviews/${event.pr_review_id}`), 800);
              }
            } else if (event.type === "error") {
              setStatus("error");
              setLog((l) => [...l, `✗ ${event.message}`]);
            }
          } catch {
            // ignore malformed lines
          }
        }
      }

      if (status !== "done" && status !== "error") {
        setStatus("done");
      }
    } catch (err) {
      setStatus("error");
      setLog((l) => [...l, `✗ ${err instanceof Error ? err.message : "Request failed"}`]);
    }
  }

  const isRunning = status === "running";
  const isDone = status === "done";
  const isError = status === "error";

  return (
    <div className="rounded flex flex-col gap-3 p-4"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      <p className="text-xs font-semibold" style={{ color: "var(--muted)" }}>
        Review a public GitHub PR
      </p>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://github.com/owner/repo/pull/123"
          disabled={isRunning}
          className="flex-1 rounded px-3 py-2 text-sm outline-none"
          style={{
            background: "var(--bg)",
            border: `1px solid ${isError ? "var(--error)" : "var(--border)"}`,
            color: "var(--text)",
            opacity: isRunning ? 0.6 : 1,
          }}
          aria-label="GitHub PR URL"
        />
        <button
          type="submit"
          disabled={isRunning || !url.trim()}
          className="px-4 py-2 rounded text-sm font-semibold"
          style={{
            background: isRunning ? "var(--border)" : "var(--accent)",
            color: "#fff",
            cursor: isRunning || !url.trim() ? "not-allowed" : "pointer",
            opacity: !url.trim() ? 0.5 : 1,
            minWidth: 100,
            border: "none",
          }}
        >
          {isRunning ? "Reviewing…" : isDone ? "Done ✓" : "Review PR"}
        </button>
      </form>

      {log.length > 0 && <ProgressLog lines={log} />}

      {!isRunning && !isDone && !isError && (
        <div className="flex flex-wrap gap-2">
          {EXAMPLE_PRS.map((ex) => (
            <button
              key={ex}
              onClick={() => setUrl(ex)}
              className="text-xs px-2 py-1 rounded"
              style={{
                background: "var(--bg)",
                border: "1px solid var(--border)",
                color: "var(--muted)",
                cursor: "pointer",
              }}
            >
              {ex.replace("https://github.com/", "")}
            </button>
          ))}
        </div>
      )}

      {isDone && resultId && (
        <p className="text-xs" style={{ color: "var(--ok)" }}>
          Review complete — redirecting to results…
        </p>
      )}

      {isError && (
        <p className="text-xs" style={{ color: "var(--error)" }}>
          Review failed. Check the log above for details.
        </p>
      )}
    </div>
  );
}
