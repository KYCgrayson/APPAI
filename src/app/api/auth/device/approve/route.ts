import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { generateApiKey, hashApiKey } from "@/lib/api-auth";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { userCode } = await request.json();
    if (!userCode || typeof userCode !== "string") {
      return NextResponse.json({ error: "userCode is required" }, { status: 400 });
    }

    // Find the pending device code
    const record = await db.deviceCode.findFirst({
      where: {
        userCode,
        status: "pending",
        expires: { gt: new Date() },
      },
    });

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

    // Generate API key
    const { key, hash, prefix } = generateApiKey();

    await db.apiKey.create({
      data: {
        keyHash: hash,
        keyPrefix: prefix,
        name: `Device Auth (${userCode})`,
        organizationId: user.organizationId,
      },
    });

    // Update device code with result
    await db.deviceCode.update({
      where: { id: record.id },
      data: {
        status: "complete",
        apiKey: key,
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
