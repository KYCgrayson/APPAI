import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { connectorBaseUrl, getConnector } from "@/lib/connectors/registry";

/**
 * Generic connector proxy. One route for every interactive tool backend.
 *
 *   /api/connect/{connector}/{...path}
 *
 * Pipeline: resolve connector → gating → quota → usage log → inject server
 * auth + identity → forward. File payloads are NOT proxied here — backends
 * serve those directly via signed URLs. See
 * docs/interactive-tools-architecture.md.
 */

export const dynamic = "force-dynamic";

function problem(status: number, title: string, detail?: string, extra?: Record<string, string>) {
  return NextResponse.json(
    { type: "about:blank", title, status, ...(detail ? { detail } : {}) },
    { status, headers: extra },
  );
}

function windowStart(window: "24h" | "1h"): Date {
  const ms = window === "1h" ? 3600_000 : 24 * 3600_000;
  return new Date(Date.now() - ms);
}

async function proxy(
  req: NextRequest,
  ctx: { params: Promise<{ connector: string; path?: string[] }> },
): Promise<NextResponse> {
  const { connector: name, path } = await ctx.params;
  const connector = getConnector(name);
  if (!connector) return problem(404, "Unknown connector");

  const rel = (path ?? []).join("/");
  if (!connector.allowPaths.test(rel)) return problem(404, "Not Found");

  // ---- identity ----
  const session = await auth();
  const userId = session?.user?.id ?? null;
  const isAdmin =
    ((session as unknown as { role?: string })?.role ?? "USER") === "ADMIN";

  // ---- gating ----
  if (connector.gating === "login" && !userId) {
    return problem(401, "Unauthorized", "Sign in to use this tool.");
  }

  // ---- backend config ----
  const base = connectorBaseUrl(connector);
  if (!base || (connector.auth === "server-token" && !process.env[connector.secretEnv!])) {
    return problem(503, "Service Unavailable", `Connector "${name}" is not configured.`);
  }

  const body =
    req.method === "GET" || req.method === "HEAD" ? undefined : await req.text();
  const parsedBody = body ? safeJson(body) : null;
  const action = connector.usageAction?.(req.method, rel, parsedBody) ?? null;

  // ---- quota (admins exempt) ----
  if (connector.quota && !isAdmin && action) {
    const who =
      connector.quota.per === "user" ? userId : ipHash(req);
    if (who) {
      const used = await db.usageEvent.count({
        where: {
          connector: name,
          userId: connector.quota.per === "user" ? who : undefined,
          createdAt: { gte: windowStart(connector.quota.window) },
        },
      });
      if (used >= connector.quota.limit) {
        return problem(
          429,
          "Too Many Requests",
          `Limit reached (${connector.quota.limit}/${connector.quota.window}). Try again later.`,
          { "retry-after": connector.quota.window === "1h" ? "3600" : "86400" },
        );
      }
    }
  }

  // ---- forward ----
  const headers: Record<string, string> = {
    "content-type": req.headers.get("content-type") ?? "application/json",
  };
  if (connector.auth === "server-token") {
    headers["authorization"] = `Bearer ${process.env[connector.secretEnv!]}`;
  }
  if (connector.forwardIdentity) {
    if (userId) headers["x-appai-user"] = userId;
    headers["x-appai-admin"] = isAdmin ? "1" : "0";
    // Back-compat with the subtitle backend's current header names.
    if (userId) headers["x-subtitle-user"] = userId;
    headers["x-subtitle-admin"] = isAdmin ? "1" : "0";
  }

  const upstream = await fetch(`${base}/${rel}${req.nextUrl.search}`, {
    method: req.method,
    headers,
    body,
    cache: "no-store",
    redirect: "manual", // pass signed-URL 3xx through to the browser
  });
  const text = await upstream.text();

  // ---- usage log (best-effort) ----
  if (action && upstream.status < 400) {
    try {
      await db.usageEvent.create({
        data: {
          connector: name,
          userId,
          action,
          meta: metaFor(parsedBody, text),
        },
      });
    } catch {
      /* best-effort */
    }
  }

  const out = new Headers();
  for (const h of [
    "content-type",
    "location",
    "retry-after",
    "ratelimit-limit",
    "ratelimit-remaining",
    "ratelimit-reset",
  ]) {
    const v = upstream.headers.get(h);
    if (v) out.set(h, v);
  }
  return new NextResponse(text || null, { status: upstream.status, headers: out });
}

function safeJson(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

function ipHash(req: NextRequest): string {
  return (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
}

function metaFor(reqBody: unknown, respText: string): Prisma.InputJsonValue {
  const meta: Record<string, string> = {};
  const kind = (reqBody as { kind?: string } | null)?.kind;
  if (kind) meta.kind = kind;
  const id = safeJson(respText) as { id?: string } | null;
  if (id?.id) meta.jobId = id.id;
  return meta;
}

// Only the methods interactive tools use.
export { proxy as GET, proxy as POST, proxy as DELETE };
