import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { lookupDeviceRequest } from "@/lib/device-approval";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const code = request.nextUrl.searchParams.get("code");
  const result = code ? await lookupDeviceRequest(db, code, new Date()) : null;
  return NextResponse.json(result || { error: "Invalid, expired, or already used device code" }, { status: result ? 200 : 404, headers: { "Cache-Control": "no-store" } });
}
