import { NextRequest, NextResponse } from "next/server";

/**
 * DEV ONLY: forwards the local preview (/dev/video-ask?backend=local) to a
 * video-ask backend running on this machine (my-tools services/video-ask/serve.py),
 * so the section can be checked against the real index before any tunnel exists.
 * Target: VIDEO_ASK_DEV_LOCAL_URL, default http://127.0.0.1:8146. 404s in production.
 */

export const dynamic = "force-dynamic";

const ALLOWED = /^(search|stats|videos)$/;

async function forward(req: NextRequest, path: string[]) {
  if (process.env.NODE_ENV === "production") return new NextResponse(null, { status: 404 });
  const sub = path.join("/");
  if (!ALLOWED.test(sub)) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const base = (process.env.VIDEO_ASK_DEV_LOCAL_URL || "http://127.0.0.1:8146").replace(/\/$/, "");
  const url = `${base}/${sub}${req.nextUrl.search}`;
  try {
    const res = await fetch(url, {
      method: req.method,
      headers: { "Content-Type": "application/json" },
      body: req.method === "POST" ? await req.text() : undefined,
      signal: AbortSignal.timeout(30_000),
    });
    return new NextResponse(await res.text(), { status: res.status, headers: { "Content-Type": "application/json" } });
  } catch {
    return NextResponse.json({ error: "backend_unreachable" }, { status: 503 });
  }
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return forward(req, (await ctx.params).path);
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return forward(req, (await ctx.params).path);
}
