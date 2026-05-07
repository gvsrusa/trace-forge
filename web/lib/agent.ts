// Use Next.js API proxy routes — works locally and on Cloud Run
const AGENT = "";

export type AgentEvent =
  | { type: "step"; name: string; dimension: string; status: string }
  | { type: "tool_call"; tool: string; status: "running" | "complete" }
  | { type: "thought"; content: string }
  | { type: "final"; content: string }
  | { type: "error"; message: string };

export async function* streamReview(
  code: string,
  filename: string,
  language: string,
  signal: AbortSignal
): AsyncGenerator<AgentEvent> {
  const res = await fetch(`${AGENT}/api/review`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, filename, language }),
    signal,
  });

  if (!res.ok) throw new Error(`Agent error ${res.status}`);
  if (!res.body) throw new Error("No response body");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const raw = line.slice(6).trim();
      if (raw === "[DONE]") return;
      try {
        yield JSON.parse(raw) as AgentEvent;
      } catch {
        // skip malformed line
      }
    }
  }
}
