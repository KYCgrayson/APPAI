import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { universalAppIdSchema } from "@/lib/universal-apps/manifest";
import { exchangeUniversalAppLaunchCode, UniversalAppRuntimeError } from "@/lib/universal-apps/runtime-session";

const exchangeSchema = z.object({
  code: z.string().min(32).max(200),
  appId: universalAppIdSchema,
}).strict();

export async function POST(request: NextRequest) {
  try {
    const input = exchangeSchema.parse(await request.json());
    const session = await exchangeUniversalAppLaunchCode(input.code, input.appId);
    return NextResponse.json({
      sessionToken: session.sessionToken,
      expiresAt: session.expiresAt.toISOString(),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const status = error instanceof UniversalAppRuntimeError ? error.status : 400;
    const code = error instanceof UniversalAppRuntimeError ? error.code : "INVALID_REQUEST";
    return NextResponse.json({ error: code }, { status, headers: { "Cache-Control": "no-store" } });
  }
}
