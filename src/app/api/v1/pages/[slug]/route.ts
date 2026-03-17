import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { validateApiKey } from "@/lib/api-auth";
import { updatePageSchema } from "@/lib/validations/page";
import { sanitizeContent } from "@/lib/sanitize";

// GET /api/v1/pages/:slug
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const authResult = await validateApiKey(request.headers.get("authorization"));
  if (!authResult) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const page = await db.hostedPage.findFirst({
    where: { slug, organizationId: authResult.organizationId },
  });

  if (!page) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(page);
}

// PUT /api/v1/pages/:slug - Full update
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const authResult = await validateApiKey(request.headers.get("authorization"));
  if (!authResult) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const page = await db.hostedPage.findFirst({
    where: { slug, organizationId: authResult.organizationId },
  });
  if (!page) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const body = await request.json();
    const data = updatePageSchema.parse(body);

    // Sanitize content before saving: strip HTML tags and validate URLs
    if (data.content) {
      data.content = sanitizeContent(data.content) as Record<string, any>;
    }

    const updated = await db.hostedPage.update({
      where: { id: page.id },
      data: {
        ...data,
        content: data.content as any,
      },
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    if (error.name === "ZodError") {
      return NextResponse.json({ error: "Validation failed", details: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PATCH /api/v1/pages/:slug - Partial update
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  return PUT(request, { params });
}

// DELETE /api/v1/pages/:slug
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const authResult = await validateApiKey(request.headers.get("authorization"));
  if (!authResult) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const page = await db.hostedPage.findFirst({
    where: { slug, organizationId: authResult.organizationId },
  });
  if (!page) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await db.hostedPage.delete({ where: { id: page.id } });

  return NextResponse.json({ message: "Deleted" });
}
