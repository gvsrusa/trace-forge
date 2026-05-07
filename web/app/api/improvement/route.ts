const AGENT = process.env.AGENT_BACKEND_URL ?? process.env.NEXT_PUBLIC_AGENT_URL ?? "http://localhost:8080";

export async function GET() {
  const upstream = await fetch(`${AGENT}/api/improvement`, { cache: "no-store" });
  const data = await upstream.json();
  return Response.json(data);
}
