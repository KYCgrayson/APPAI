import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { decrypt } from "@/lib/encryption";

// RFC 8628 §3.5: Device Access Token Response
// All errors return HTTP 400 with standard error codes

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { device_code, deviceCode: legacyDeviceCode } = body;
    const code = device_code || legacyDeviceCode; // support both formats

    if (!code || typeof code !== "string") {
      return NextResponse.json(
        { error: "invalid_request", error_description: "device_code is required" },
        { status: 400 }
      );
    }

    const record = await db.deviceCode.findUnique({
      where: { deviceCode: code },
    });

    if (!record) {
      return NextResponse.json(
        { error: "invalid_grant", error_description: "Invalid device code" },
        { status: 400 }
      );
    }

    // Check expiration
    if (record.expiresAt < new Date()) {
      await db.deviceCode.delete({ where: { id: record.id } });
      return NextResponse.json(
        { error: "expired_token", error_description: "The device code has expired" },
        { status: 400 }
      );
    }

    // Rate limiting: enforce minimum polling interval (RFC 8628 §3.5)
    if (record.lastPolledAt) {
      const elapsed = (Date.now() - record.lastPolledAt.getTime()) / 1000;
      if (elapsed < record.interval) {
        // Increase interval by 5 seconds as penalty
        await db.deviceCode.update({
          where: { id: record.id },
          data: {
            interval: record.interval + 5,
            lastPolledAt: new Date(),
          },
        });
        return NextResponse.json(
          { error: "slow_down", error_description: "Polling too frequently, interval increased", interval: record.interval + 5 },
          { status: 400 }
        );
      }
    }

    // Update lastPolledAt
    await db.deviceCode.update({
      where: { id: record.id },
      data: { lastPolledAt: new Date() },
    });

    if (record.status === "denied") {
      await db.deviceCode.delete({ where: { id: record.id } });
      return NextResponse.json(
        { error: "access_denied", error_description: "The user denied the authorization request" },
        { status: 400 }
      );
    }

    if (record.status === "pending") {
      return NextResponse.json(
        { error: "authorization_pending", error_description: "The user has not yet completed authorization" },
        { status: 400 }
      );
    }

    if (record.status === "consumed") {
      return NextResponse.json(
        { error: "invalid_grant", error_description: "This device code has already been used" },
        { status: 400 }
      );
    }

    if (record.status === "authorized" && record.apiKey && record.organizationId) {
      const { organizationId } = record;

      // Decrypt the API key and delete the entire row — no trace left in DB
      const apiKey = decrypt(record.apiKey);
      await db.deviceCode.delete({ where: { id: record.id } });

      return NextResponse.json({
        status: "complete",
        api_key: apiKey,
        organization_id: organizationId,
        // Also include camelCase for backwards compat
        apiKey,
        organizationId,
      });
    }

    // Fallback for any other state
    return NextResponse.json(
      { error: "authorization_pending", error_description: "The user has not yet completed authorization" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Token polling error:", error);
    return NextResponse.json(
      { error: "server_error", error_description: "Failed to check device authorization status" },
      { status: 500 }
    );
  }
}
