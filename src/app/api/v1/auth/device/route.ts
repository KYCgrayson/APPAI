import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { generateDeviceCode, generateUserCode } from "@/lib/device-auth";

const DEVICE_CODE_TTL_SECONDS = 900; // 15 minutes (matches GitHub)

export async function POST() {
  try {
    const deviceCode = generateDeviceCode();
    const userCode = generateUserCode();
    const expiresAt = new Date(Date.now() + DEVICE_CODE_TTL_SECONDS * 1000);

    // Clean up expired device codes (check-on-write pattern)
    await db.deviceCode.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });

    await db.deviceCode.create({
      data: {
        deviceCode,
        userCode,
        expiresAt,
      },
    });

    const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3001";

    // RFC 8628 §3.2: Device Authorization Response
    return NextResponse.json({
      device_code: deviceCode,
      user_code: userCode,
      verification_uri: `${baseUrl}/auth/device`,
      verification_uri_complete: `${baseUrl}/auth/device?code=${userCode}`,
      expires_in: DEVICE_CODE_TTL_SECONDS,
      interval: 5,
    });
  } catch (error) {
    console.error("Device auth error:", error);
    return NextResponse.json(
      { error: "server_error", error_description: "Failed to initiate device authorization" },
      { status: 500 }
    );
  }
}
