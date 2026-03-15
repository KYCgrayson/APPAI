import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { generateApiKey } from "@/lib/api-auth";

// POST /api/v1/keys - Generate new API key (requires session auth)
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { organizationId: true },
  });

  if (!user?.organizationId) {
    return NextResponse.json({ error: "No organization found" }, { status: 404 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const name = (body as any).name || "Default API Key";

    const { key, hash, prefix } = generateApiKey();

    await db.apiKey.create({
      data: {
        keyHash: hash,
        keyPrefix: prefix,
        name,
        organizationId: user.organizationId,
      },
    });

    // Return the full key ONLY this one time
    return NextResponse.json({
      apiKey: key,
      prefix,
      name,
      message: "Save this key! It won't be shown again.",
    }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// GET /api/v1/keys - List API keys (session auth)
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { organizationId: true },
  });

  if (!user?.organizationId) {
    return NextResponse.json({ error: "No organization found" }, { status: 404 });
  }

  const keys = await db.apiKey.findMany({
    where: { organizationId: user.organizationId },
    select: {
      id: true,
      keyPrefix: true,
      name: true,
      isActive: true,
      lastUsedAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(keys);
}

// DELETE /api/v1/keys - Revoke an API key
export async function DELETE(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { organizationId: true },
  });

  if (!user?.organizationId) {
    return NextResponse.json({ error: "No organization found" }, { status: 404 });
  }

  const body = await request.json();
  const { id } = body as { id: string };

  const apiKey = await db.apiKey.findFirst({
    where: { id, organizationId: user.organizationId },
  });

  if (!apiKey) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await db.apiKey.update({
    where: { id },
    data: { isActive: false },
  });

  return NextResponse.json({ message: "Key revoked" });
}
