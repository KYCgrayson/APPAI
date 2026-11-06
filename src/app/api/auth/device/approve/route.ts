import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { checkMutationRequest, approveDeviceRequest } from "@/lib/device-approval";
import { generateApiKey } from "@/lib/api-auth";
import { encrypt } from "@/lib/encryption";
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
    const user = await db.user.findUnique({ where: { id: session.user.id }, select: { organizationId: true } });
    if (!user?.organizationId) return NextResponse.json({ error: "No organization found. Please complete account setup first." }, { status: 400 });
    const result = await approveDeviceRequest(db, { userCode: body.userCode, now: new Date() , organizationId: user.organizationId, createKey: () => {
      const key = generateApiKey();
      return { hash: key.hash, prefix: key.prefix, encryptedKey: encrypt(key.key) };
    } });
    return "error" in result ? NextResponse.json({ error: result.error }, { status: result.status }) : NextResponse.json({ success: true });
  } catch (error) {
    console.error("Device approve error:", error);
    return NextResponse.json({ error: "Failed to approve device" }, { status: 500 });
  }
}
