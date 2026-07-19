import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { universalAppIdSchema } from "@/lib/universal-apps/manifest";
import { bearerToken, introspectUniversalAppSession } from "@/lib/universal-apps/runtime-session";

const introspectionSchema = z.object({ appId: universalAppIdSchema }).strict();

export async function POST(request: NextRequest) {
  const token = bearerToken(request.headers.get("authorization"));
  if (!token) return NextResponse.json({ active: false }, { status: 401, headers: { "Cache-Control": "no-store" } });

  const parsed = introspectionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ active: false }, { status: 400, headers: { "Cache-Control": "no-store" } });

  const context = await introspectUniversalAppSession(token, parsed.data.appId);
  if (!context) return NextResponse.json({ active: false }, { status: 401, headers: { "Cache-Control": "no-store" } });
  return NextResponse.json(context, { headers: { "Cache-Control": "no-store" } });
}
