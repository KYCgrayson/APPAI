import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * Login-gated proxy to the self-hosted video-subtitle backend.
 *
 * Browser → (this route: session check + usage logging)
 *         → iMac backend over the Cloudflare tunnel, authenticated with a
 *           server-to-server bearer token that never reaches the browser.
 *
 * Only the JSON job API is proxied. File payloads (clips, rendered mp4,
 * subtitle files) are served by the backend directly via signed,
 * time-limited URLs — they must not flow through a Vercel function.
 *
 * Env (Vercel): SUBTITLE_BACKEND_URL (e.g. https://subtitle.myaiapp.uk),
 *               SUBTITLE_BACKEND_TOKEN (same value as backend BEARER_TOKEN).
 */

export const dynamic = "force-dynamic";

const ALLOWED_PATH = /^jobs(\/[A-Za-z0-9-]+)?(\/file)?$/;

async function proxy(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
): Promise<NextResponse> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json(
      { type: "about:blank", title: "Unauthorized", status: 401 },
      { status: 401 },
    );
  }

  const backend = process.env.SUBTITLE_BACKEND_URL;
  const token = process.env.SUBTITLE_BACKEND_TOKEN;
  if (!backend || !token) {
    return NextResponse.json(
      {
        type: "about:blank",
        title: "Service Unavailable",
        status: 503,
        detail: "Subtitle backend is not configured.",
      },
      { status: 503 },
    );
  }

  const { path } = await params;
  const rel = (path ?? []).join("/");
  if (!ALLOWED_PATH.test(rel)) {
    return NextResponse.json(
      { type: "about:blank", title: "Not Found", status: 404 },
      { status: 404 },
    );
  }

  const isAdmin =
    ((session as unknown as { role?: string }).role ?? "USER") === "ADMIN";
  const body =
    req.method === "GET" || req.method === "HEAD"
      ? undefined
      : await req.text();

  const upstream = await fetch(
    `${backend.replace(/\/$/, "")}/v1/${rel}${req.nextUrl.search}`,
    {
      method: req.method,
      headers: {
        "content-type": req.headers.get("content-type") ?? "application/json",
        authorization: `Bearer ${token}`,
        "x-subtitle-user": userId,
        "x-subtitle-admin": isAdmin ? "1" : "0",
      },
      body,
      cache: "no-store",
      redirect: "manual", // pass 303 (signed file URL) through to the browser
    },
  );

  const text = await upstream.text();

  // Usage log: one row per successfully created job. Best-effort — a
  // logging failure must never break the user's request.
  if (req.method === "POST" && rel === "jobs" && upstream.status === 202) {
    try {
      const job = JSON.parse(text) as { id?: string; kind?: string };
      const srcUrl = body
        ? (JSON.parse(body)?.input?.source?.url as string | undefined)
        : undefined;
      await db.subtitleUsage.create({
        data: {
          userId,
          kind: job.kind ?? "unknown",
          jobId: job.id,
          videoHash: srcUrl
            ? createHash("sha256").update(srcUrl).digest("hex").slice(0, 16)
            : null,
        },
      });
    } catch {
      /* best-effort */
    }
  }

  const headers = new Headers();
  const ct = upstream.headers.get("content-type");
  if (ct) headers.set("content-type", ct);
  const loc = upstream.headers.get("location");
  if (loc) headers.set("location", loc);
  for (const h of ["retry-after", "ratelimit-limit", "ratelimit-remaining", "ratelimit-reset"]) {
    const v = upstream.headers.get(h);
    if (v) headers.set(h, v);
  }
  return new NextResponse(text || null, { status: upstream.status, headers });
}

export { proxy as GET, proxy as POST, proxy as DELETE };
