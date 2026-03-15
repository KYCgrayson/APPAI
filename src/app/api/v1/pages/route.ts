import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { validateApiKey } from "@/lib/api-auth";
import { createPageSchema } from "@/lib/validations/page";

// POST /api/v1/pages - Create a new hosted page
export async function POST(request: NextRequest) {
  const authResult = await validateApiKey(request.headers.get("authorization"));
  if (!authResult) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const data = createPageSchema.parse(body);

    // Check slug availability
    const existing = await db.hostedPage.findUnique({ where: { slug: data.slug } });
    if (existing) {
      return NextResponse.json({ error: "Slug already taken" }, { status: 409 });
    }

    // Check plan limits
    const pageCount = await db.hostedPage.count({
      where: { organizationId: authResult.organizationId },
    });
    if (authResult.organization.plan === "FREE" && pageCount >= 3) {
      return NextResponse.json(
        { error: "Free plan limit: max 3 pages. Upgrade to Pro." },
        { status: 403 }
      );
    }

    const page = await db.hostedPage.create({
      data: {
        ...data,
        content: data.content as any,
        organizationId: authResult.organizationId,
      },
    });

    return NextResponse.json(page, { status: 201 });
  } catch (error: any) {
    if (error.name === "ZodError") {
      return NextResponse.json({ error: "Validation failed", details: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// GET /api/v1/pages - List own pages
export async function GET(request: NextRequest) {
  const authResult = await validateApiKey(request.headers.get("authorization"));
  if (!authResult) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const pages = await db.hostedPage.findMany({
    where: { organizationId: authResult.organizationId },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(pages);
}
