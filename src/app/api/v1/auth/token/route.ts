import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { deviceCode } = body;

    if (!deviceCode || typeof deviceCode !== "string") {
      return NextResponse.json(
        { error: "deviceCode is required" },
        { status: 400 }
      );
    }

    const record = await db.deviceCode.findUnique({
      where: { deviceCode },
    });

    if (!record) {
      return NextResponse.json(
        { error: "Invalid device code" },
        { status: 400 }
      );
    }

    if (record.expires < new Date()) {
      // Clean up expired record
      await db.deviceCode.delete({ where: { id: record.id } });
      return NextResponse.json({ status: "expired" });
    }

    if (record.status === "pending") {
      return NextResponse.json({ status: "pending" });
    }

    if (record.status === "complete" && record.apiKey && record.organizationId) {
      const { apiKey, organizationId } = record;

      // Delete the record — plaintext key should not persist
      await db.deviceCode.delete({ where: { id: record.id } });

      return NextResponse.json({
        status: "complete",
        apiKey,
        organizationId,
      });
    }

    return NextResponse.json({ status: "pending" });
  } catch (error) {
    console.error("Token polling error:", error);
    return NextResponse.json(
      { error: "Failed to check device authorization status" },
      { status: 500 }
    );
  }
}
