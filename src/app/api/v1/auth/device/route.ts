import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { generateDeviceCode, generateUserCode } from "@/lib/device-auth";

const DEVICE_CODE_TTL_SECONDS = 900; // 15 minutes

export async function POST() {
  try {
    const deviceCode = generateDeviceCode();
    const userCode = generateUserCode();
    const expires = new Date(Date.now() + DEVICE_CODE_TTL_SECONDS * 1000);

    // Clean up expired device codes
    await db.deviceCode.deleteMany({
      where: { expires: { lt: new Date() } },
    });

    await db.deviceCode.create({
      data: {
        deviceCode,
        userCode,
        expires,
      },
    });

    const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3001";

    return NextResponse.json({
      deviceCode,
      userCode,
      verificationUrl: `${baseUrl}/auth/device?code=${userCode}`,
      expiresIn: DEVICE_CODE_TTL_SECONDS,
      pollingInterval: 5,
    });
  } catch (error) {
    console.error("Device auth error:", error);
    return NextResponse.json(
      { error: "Failed to initiate device authorization" },
      { status: 500 }
    );
  }
}
