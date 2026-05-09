/**
 * Catch-all proxy route: /api/proxy/[...path] → AGENT_BACKEND_URL/[path]
 *
 * Client components can't use NEXT_PUBLIC_AGENT_URL because it must be baked
 * at build time (before the agent Cloud Run URL is known). Instead they call
 * relative paths like /api/proxy/traces, and this handler forwards to the
 * agent backend using the runtime env var AGENT_BACKEND_URL.
 *
 * Supports GET, POST, and SSE streaming (text/event-stream).
 */

import { NextRequest } from "next/server";

const AGENT =
  process.env.AGENT_BACKEND_URL ??
  process.env.NEXT_PUBLIC_AGENT_URL ??
  "http://localhost:8080";

async function proxy(req: NextRequest, path: string[]): Promise<Response> {
  const upstream = `${AGENT}/${path.join("/")}${req.nextUrl.search}`;

  const headers = new Headers();
  req.headers.forEach((v, k) => {
    // strip host header so upstream doesn't see the web service host
    if (k.toLowerCase() !== "host") headers.set(k, v);
  });

  const upstreamRes = await fetch(upstream, {
    method: req.method,
    headers,
    body: req.method !== "GET" && req.method !== "HEAD" ? req.body : undefined,
    // @ts-expect-error — Node fetch needs duplex for streaming bodies
    duplex: "half",
  });

  const resHeaders = new Headers();
  upstreamRes.headers.forEach((v, k) => resHeaders.set(k, v));

  return new Response(upstreamRes.body, {
    status: upstreamRes.status,
    headers: resHeaders,
  });
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  return proxy(req, path);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  return proxy(req, path);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  return proxy(req, path);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  return proxy(req, path);
}
