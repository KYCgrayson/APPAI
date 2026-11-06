import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { decrypt } from "@/lib/encryption";

import { pollDeviceToken } from "@/lib/device-approval";

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

    const result = await pollDeviceToken(db, { deviceCode: code, now: new Date(), decrypt });
    return NextResponse.json(result, { status: "error" in result ? 400 : 200 });
  } catch (error) {
    console.error("Token polling error:", error);
    return NextResponse.json(
      { error: "server_error", error_description: "Failed to check device authorization status" },
      { status: 500 }
    );
  }
}
