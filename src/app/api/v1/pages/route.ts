import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { validateApiKey } from "@/lib/api-auth";
import { createPageSchema } from "@/lib/validations/page";
import { sanitizeContent } from "@/lib/sanitize";

function mapTemplateToCategory(template: string): string {
  const map: Record<string, string> = {
    APP_LANDING: "PRODUCTIVITY",
    COMPANY_PROFILE: "OTHER",
    PRODUCT_SHOWCASE: "OTHER",
    PORTFOLIO: "DESIGN",
    LINK_IN_BIO: "SOCIAL",
  };
  return map[template] || "OTHER";
}

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

    // Sanitize content before saving: strip HTML tags and validate URLs
    data.content = sanitizeContent(data.content) as Record<string, any>;

    const { category: appCategory, ...pageData } = data;

    const page = await db.hostedPage.create({
      data: {
        ...pageData,
        content: pageData.content as any,
        organizationId: authResult.organizationId,
      },
    });

    // Auto-create a corresponding App record so the page appears in listings
    const existingApp = await db.app.findUnique({
      where: { hostedPageSlug: page.slug },
    });
    if (!existingApp) {
      await db.app.create({
        data: {
          organizationId: authResult.organizationId,
          name: page.title,
          tagline: page.tagline || page.title,
          description: page.tagline || page.title,
          category: appCategory || mapTemplateToCategory(data.template),
          hostedPageSlug: page.slug,
          logoUrl: page.heroImage,
          isApproved: true,
        },
      });
    }

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
