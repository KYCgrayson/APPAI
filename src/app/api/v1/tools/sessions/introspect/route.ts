import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { introspectIframeToolSession } from "@/lib/iframe-tool-session";

/**
 * `POST /api/v1/tools/sessions/introspect`
 *
 * The identity endpoint for tools embedded with `iframe-tool`. A tool's backend
 * posts the `appai_session` it was handed on the iframe URL, together with its
 * own origin, and gets back who is watching.
 *
 *   { "token": "appai1....", "origin": "https://my-tool.vercel.app" }
 *
 * `origin` is the caller naming *itself*. Getting it wrong fails closed, and
 * that is what stops one embedded tool from replaying a visitor's token against
 * another tool's backend.
 *
 * There are deliberately no CORS headers: this is a server-to-server call. A
 * purely static tool with no backend of its own cannot enforce anything with
 * the answer anyway — the browser it would run in is the thing being asked
 * about — so it is not offered a way to pretend otherwise.
 *
 * Follows RFC 7662: a token that is wrong, expired, or minted for a different
 * origin is not an error, it is `{"active": false}` with a 200.
 */

export const dynamic = "force-dynamic";

const introspectionSchema = z.object({
  token: z.string().min(16).max(4096),
  origin: z.string().min(8).max(512),
}).strict();

const noStore = { "Cache-Control": "no-store" };

export async function POST(request: NextRequest) {
  const parsed = introspectionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ active: false }, { status: 400, headers: noStore });
  }

  const result = await introspectIframeToolSession(parsed.data.token, parsed.data.origin);
  return NextResponse.json(result, { headers: noStore });
}
