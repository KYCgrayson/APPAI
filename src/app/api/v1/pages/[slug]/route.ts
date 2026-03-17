import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { validateApiKey } from "@/lib/api-auth";
import { updatePageSchema } from "@/lib/validations/page";
import { sanitizeContent } from "@/lib/sanitize";

// Fields that cannot be changed via PUT/PATCH
const IMMUTABLE_FIELDS = ["slug", "id", "organizationId", "createdAt", "updatedAt"];

function stripImmutableFields(data: Record<string, any>) {
  const cleaned = { ...data };
  for (const field of IMMUTABLE_FIELDS) {
    delete cleaned[field];
  }
  // category is for App listing, not a HostedPage field
  delete cleaned.category;
  return cleaned;
}

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

// PUT /api/v1/pages/:slug - Full replace (sends all fields)
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
    const parsed = updatePageSchema.parse(body);
    const data = stripImmutableFields(parsed);

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
    console.error("PUT page error:", error);
    return NextResponse.json({ error: `Update failed: ${error.message || "Unknown error"}` }, { status: 500 });
  }
}

// PATCH /api/v1/pages/:slug - Partial update (only sent fields are changed)
export async function PATCH(
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
    const parsed = updatePageSchema.parse(body);
    const data = stripImmutableFields(parsed);

    // For PATCH: only include fields that were explicitly sent
    const updateData: Record<string, any> = {};
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) {
        updateData[key] = value;
      }
    }

    // Sanitize content if being updated
    if (updateData.content) {
      updateData.content = sanitizeContent(updateData.content);
    }

    const updated = await db.hostedPage.update({
      where: { id: page.id },
      data: updateData,
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    if (error.name === "ZodError") {
      return NextResponse.json({ error: "Validation failed", details: error.errors }, { status: 400 });
    }
    console.error("PATCH page error:", error);
    return NextResponse.json({ error: `Update failed: ${error.message || "Unknown error"}` }, { status: 500 });
  }
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

  // Also delete linked app
  await db.app.deleteMany({ where: { hostedPageSlug: slug } });
  await db.hostedPage.delete({ where: { id: page.id } });

  return NextResponse.json({ message: "Deleted" });
}
