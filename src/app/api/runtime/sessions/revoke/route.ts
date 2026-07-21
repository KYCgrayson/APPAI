import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { universalAppIdSchema } from "@/lib/universal-apps/manifest";
import { bearerToken, revokeUniversalAppSession } from "@/lib/universal-apps/runtime-session";

const revokeSchema = z.object({ appId: universalAppIdSchema }).strict();
const noStore = { "Cache-Control": "no-store" };

export async function POST(request: NextRequest) {
  const token = bearerToken(request.headers.get("authorization"));
  if (!token) return NextResponse.json({ revoked: false }, { status: 401, headers: noStore });

  const parsed = revokeSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ revoked: false }, { status: 400, headers: noStore });

  const revoked = await revokeUniversalAppSession(token, parsed.data.appId);
  if (!revoked) return NextResponse.json({ revoked: false }, { status: 401, headers: noStore });
  return NextResponse.json({ revoked: true }, { headers: noStore });
}
