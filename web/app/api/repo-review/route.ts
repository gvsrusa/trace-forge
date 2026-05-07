import { type NextRequest } from "next/server";

const AGENT = process.env.AGENT_BACKEND_URL ?? process.env.NEXT_PUBLIC_AGENT_URL ?? "http://localhost:8080";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const upstream = await fetch(`${AGENT}/api/repo-review`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "X-Accel-Buffering": "no",
    },
  });
}
