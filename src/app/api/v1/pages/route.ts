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
    const upsert = request.nextUrl.searchParams.get("upsert") === "true";

    if (existing && !upsert) {
      return NextResponse.json(
        {
          error: "Slug already taken",
          hint: "Use PATCH /api/v1/pages/" + data.slug + " to update, or add ?upsert=true to this POST to overwrite.",
          existing_slug: data.slug,
        },
        { status: 409 }
      );
    }

    // Upsert: update existing page instead of creating
    if (existing && upsert) {
      // Verify ownership
      if (existing.organizationId !== authResult.organizationId) {
        return NextResponse.json({ error: "Slug belongs to another organization" }, { status: 403 });
      }

      data.content = sanitizeContent(data.content) as Record<string, any>;
      const { category: appCategory, ...pageData } = data;

      const updated = await db.hostedPage.update({
        where: { id: existing.id },
        data: {
          ...pageData,
          content: pageData.content as any,
          slug: undefined, // don't update slug
        },
      });

      // Update linked App
      const app = await db.app.findUnique({ where: { hostedPageSlug: data.slug } });
      if (app) {
        await db.app.update({
          where: { id: app.id },
          data: {
            name: updated.title,
            tagline: updated.tagline || updated.title,
            ...(appCategory ? { category: appCategory } : {}),
          },
        });
      }

      return NextResponse.json(updated, { status: 200 });
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
    console.error("POST page error:", error);
    return NextResponse.json({ error: `Failed to create page: ${error.message || "Unknown error"}` }, { status: 500 });
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
