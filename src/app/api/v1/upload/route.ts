import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { validateApiKey } from "@/lib/api-auth";

// POST /api/v1/upload — Upload an image file
// Accepts multipart/form-data with a "file" field
// Returns the public URL of the uploaded file
export async function POST(request: NextRequest) {
  const authResult = await validateApiKey(request.headers.get("authorization"));
  if (!authResult) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided. Send a 'file' field in multipart/form-data." }, { status: 400 });
    }

    // Validate file type
    const allowedTypes = ["image/png", "image/jpeg", "image/jpg", "image/gif", "image/webp", "image/svg+xml"];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: `Invalid file type: ${file.type}. Allowed: ${allowedTypes.join(", ")}` },
        { status: 400 }
      );
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: `File too large: ${(file.size / 1024 / 1024).toFixed(1)}MB. Maximum: 5MB.` },
        { status: 400 }
      );
    }

    // Upload to Vercel Blob
    const blob = await put(`${authResult.organizationId}/${Date.now()}-${file.name}`, file, {
      access: "public",
    });

    return NextResponse.json({
      url: blob.url,
      filename: file.name,
      size: file.size,
      type: file.type,
    }, { status: 201 });
  } catch (error: any) {
    console.error("Upload error:", error);
    const message = error?.message || "Unknown error";
    // Check for common Vercel Blob issues
    if (message.includes("BLOB_READ_WRITE_TOKEN") || message.includes("BlobAccessError")) {
      return NextResponse.json(
        { error: "Image storage not configured. Please contact the platform admin." },
        { status: 500 }
      );
    }
    return NextResponse.json(
      { error: `Failed to upload file: ${message}` },
      { status: 500 }
    );
  }
}
