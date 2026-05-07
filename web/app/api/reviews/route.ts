import { type NextRequest } from "next/server";

const AGENT = process.env.AGENT_BACKEND_URL ?? process.env.NEXT_PUBLIC_AGENT_URL ?? "http://localhost:8080";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const limit = searchParams.get("limit") ?? "20";
  const upstream = await fetch(`${AGENT}/api/reviews?limit=${limit}`, { cache: "no-store" });
  const data = await upstream.json();
  return Response.json(data);
}
