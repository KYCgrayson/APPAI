import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { NativeAppError } from "@/lib/native-apps/errors";

export function nativeAppErrorResponse(error: unknown) {
  if (error instanceof NativeAppError) {
    return NextResponse.json(
      { error: error.code, message: error.message },
      { status: error.status },
    );
  }
  if (error instanceof ZodError) {
    return NextResponse.json(
      { error: "VALIDATION_FAILED", issues: error.issues },
      { status: 400 },
    );
  }

  console.error("Native app request failed", error);
  return NextResponse.json(
    { error: "INTERNAL_ERROR", message: "Native app request failed." },
    { status: 500 },
  );
}
