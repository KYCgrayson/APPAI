import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { generateApiKey } from "@/lib/api-auth";
import { normalizeUserCode } from "@/lib/device-auth";
import { encrypt } from "@/lib/encryption";

function isOriginAllowed(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");
  const nextAuthUrl = process.env.NEXTAUTH_URL || "https://appai.info";

  // Extract allowed hostname from NEXTAUTH_URL
  let allowedHostname: string;
  try {
    allowedHostname = new URL(nextAuthUrl).hostname.replace(/^www\./, "");
  } catch {
    allowedHostname = "appai.info";
  }

  function hostnameMatches(url: string): boolean {
    try {
      const hostname = new URL(url).hostname.replace(/^www\./, "");
      return hostname === allowedHostname;
    } catch {
      return false;
    }
  }

  if (origin) return hostnameMatches(origin);
  if (referer) return hostnameMatches(referer);
  return false;
}

export async function POST(request: NextRequest) {
  try {
    // CSRF protection: verify Origin/Referer header
    if (!isOriginAllowed(request)) {
      return NextResponse.json(
        { error: "Forbidden: invalid origin" },
        { status: 403 }
      );
    }

    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { userCode } = await request.json();
    if (!userCode || typeof userCode !== "string") {
      return NextResponse.json({ error: "userCode is required" }, { status: 400 });
    }

    const normalized = normalizeUserCode(userCode);

    // Find all pending, non-expired device codes and match by normalized code
    const pendingCodes = await db.deviceCode.findMany({
      where: {
        status: "pending",
        expiresAt: { gt: new Date() },
      },
    });

    const record = pendingCodes.find(
      (r) => normalizeUserCode(r.userCode) === normalized
    );

    if (!record) {
      return NextResponse.json(
        { error: "Invalid or expired device code" },
        { status: 400 }
      );
    }

    // Get user's organization
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { organizationId: true },
    });

    if (!user?.organizationId) {
      return NextResponse.json(
        { error: "No organization found. Please complete account setup first." },
        { status: 400 }
      );
    }

    // Generate API key for the agent
    const { key, hash, prefix } = generateApiKey();

    await db.apiKey.create({
      data: {
        keyHash: hash,
        keyPrefix: prefix,
        name: `Agent (Device Auth ${record.userCode})`,
        organizationId: user.organizationId,
      },
    });

    // Mark device code as authorized with the encrypted key
    const encryptedKey = encrypt(key);
    await db.deviceCode.update({
      where: { id: record.id },
      data: {
        status: "authorized",
        apiKey: encryptedKey,
        organizationId: user.organizationId,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Device approve error:", error);
    return NextResponse.json(
      { error: "Failed to approve device" },
      { status: 500 }
    );
  }
}
