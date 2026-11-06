import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { checkMutationRequest, denyDeviceRequest } from "@/lib/device-approval";

export async function POST(request: NextRequest) {
  try {
    let hostname = "appai.info";
    try { hostname = new URL(process.env.NEXTAUTH_URL || "https://appai.info").hostname; } catch {}
    const guard = checkMutationRequest(request.headers, hostname);
    if (guard) return NextResponse.json({ error: guard.error }, { status: guard.status });
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    const body = await request.json().catch(() => null);
    if (typeof body?.userCode !== "string" || !body.userCode.trim()) return NextResponse.json({ error: "userCode is required" }, { status: 400 });
    
    const result = await denyDeviceRequest(db, { userCode: body.userCode, now: new Date()  });
    return "error" in result ? NextResponse.json({ error: result.error }, { status: result.status }) : NextResponse.json({ success: true });
  } catch (error) {
    console.error("Device deny error:", error);
    return NextResponse.json({ error: "Failed to deny device" }, { status: 500 });
  }
}
