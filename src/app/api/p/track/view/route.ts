import { NextRequest } from "next/server";
import { createHmac } from "crypto";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function hashIp(ip: string): string {
  const secret = process.env.IP_HASH_SECRET || "appai-default-ip-hash-salt-change-me";
  return createHmac("sha256", secret).update(ip).digest("hex").slice(0, 32);
}

function getClientIp(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]?.trim() || "unknown";
  return req.headers.get("x-real-ip") || "unknown";
}

interface Body {
  pageId?: unknown;
  slug?: unknown;
  locale?: unknown;
  orgId?: unknown;
  referrer?: unknown;
}

export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return new Response(null, { status: 204 });
  }

  if (
    typeof body.pageId !== "string" ||
    typeof body.slug !== "string" ||
    typeof body.locale !== "string" ||
    typeof body.orgId !== "string"
  ) {
    return new Response(null, { status: 204 });
  }

  const ip = getClientIp(req);
  const ipHash = hashIp(ip);
  const country = req.headers.get("x-vercel-ip-country") || null;

  const rawReferrer =
    typeof body.referrer === "string" ? body.referrer.slice(0, 500) : null;

  try {
    await db.pageView.create({
      data: {
        pageId: body.pageId,
        slug: body.slug,
        locale: body.locale,
        orgId: body.orgId,
        ipHash,
        country,
        referrer: rawReferrer,
      },
    });
  } catch {
    // Swallow — tracking must never break the page
  }

  return new Response(null, { status: 204 });
}
