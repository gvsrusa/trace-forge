import { type NextRequest } from "next/server";

const AGENT = process.env.AGENT_BACKEND_URL ?? process.env.NEXT_PUBLIC_AGENT_URL ?? "http://localhost:8080";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const component = searchParams.get("component") ?? "ProductCard.tsx";
  const fromStrategy = searchParams.get("from_strategy");
  const toStrategy = searchParams.get("to_strategy");

  let url = `${AGENT}/api/comparison?component=${encodeURIComponent(component)}`;
  if (fromStrategy) url += `&from_strategy=${fromStrategy}`;
  if (toStrategy) url += `&to_strategy=${toStrategy}`;

  const upstream = await fetch(url, { cache: "no-store" });
  const data = await upstream.json();
  return Response.json(data);
}
