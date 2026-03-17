import { NextRequest, NextResponse } from "next/server";
import { randomInt } from "crypto";
import { z } from "zod/v4";
import { db } from "@/lib/db";

const registerSchema = z.object({
  email: z.email("Invalid email address"),
});

// POST /api/v1/auth/register - Request a verification code
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = registerSchema.parse(body);

    // Generate 6-digit code using cryptographically secure RNG
    const code = randomInt(100000, 999999).toString();
    const expires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Delete any existing pending code for this email
    await db.verificationToken.deleteMany({
      where: { identifier: email },
    });

    // Store the new code
    await db.verificationToken.create({
      data: {
        identifier: email,
        token: code,
        expires,
      },
    });

    // In development, return the code for easy testing
    if (process.env.NODE_ENV !== "production") {
      return NextResponse.json({
        message: "Verification code sent to your email",
        code,
      });
    }

    return NextResponse.json({
      message: "Verification code sent to your email",
    });
  } catch (error: any) {
    if (error.name === "ZodError") {
      return NextResponse.json(
        { error: "Validation failed", details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
