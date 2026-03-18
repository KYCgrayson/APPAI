import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { validateApiKey } from "@/lib/api-auth";
import { createPageSchema } from "@/lib/validations/page";
import { sanitizeContent } from "@/lib/sanitize";

function extractLogoFromContent(content: any, heroImage?: string | null): string | null {
  if (content?.logo) return content.logo;
  const heroSection = content?.sections?.find((s: any) => s.type === "hero");
  if (heroSection?.data?.logo) return heroSection.data.logo;
  return heroImage || null;
}

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
    const locale = data.locale || "en";

    // Check slug+locale availability
    const existing = await db.hostedPage.findUnique({
      where: { slug_locale: { slug: data.slug, locale } },
    });
    const upsert = request.nextUrl.searchParams.get("upsert") === "true";

    if (existing && !upsert) {
      return NextResponse.json(
        {
          error: `Slug "${data.slug}" already taken for locale "${locale}"`,
          hint: `Use PATCH /api/v1/pages/${data.slug}?locale=${locale} to update, or add ?upsert=true to this POST to overwrite.`,
          existing_slug: data.slug,
          existing_locale: locale,
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
      const { category: appCategory, locale: _locale, ...pageData } = data;

      const updated = await db.hostedPage.update({
        where: { id: existing.id },
        data: {
          ...pageData,
          content: pageData.content as any,
          slug: undefined, // don't update slug
        },
      });

      // Update linked App (only from default locale)
      if (existing.isDefault) {
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
      }

      return NextResponse.json(updated, { status: 200 });
    }

    // Check plan limits — count distinct slugs, not locale variants
    const slugCount = await db.hostedPage.groupBy({
      by: ["slug"],
      where: { organizationId: authResult.organizationId },
    });
    if (authResult.organization.plan === "FREE" && slugCount.length >= 3) {
      // Allow locale variants of existing slugs
      const existingSlugs = slugCount.map((g) => g.slug);
      if (!existingSlugs.includes(data.slug)) {
        return NextResponse.json(
          { error: "Free plan limit: max 3 pages (locale variants are free). Upgrade to Pro." },
          { status: 403 }
        );
      }
    }

    // Sanitize content before saving: strip HTML tags and validate URLs
    data.content = sanitizeContent(data.content) as Record<string, any>;

    const { category: appCategory, locale: _locale, ...pageData } = data;

    // First locale variant for this slug becomes the default
    const existingVariants = await db.hostedPage.count({
      where: { slug: data.slug },
    });
    const shouldBeDefault = existingVariants === 0;

    const page = await db.hostedPage.create({
      data: {
        ...pageData,
        locale,
        isDefault: shouldBeDefault,
        content: pageData.content as any,
        organizationId: authResult.organizationId,
      },
    });

    // Auto-create a corresponding App record (only for default locale)
    if (shouldBeDefault) {
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
            logoUrl: extractLogoFromContent(pageData.content, page.heroImage),
            isApproved: true,
          },
        });
      }
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

  const locale = request.nextUrl.searchParams.get("locale");

  const pages = await db.hostedPage.findMany({
    where: {
      organizationId: authResult.organizationId,
      ...(locale ? { locale } : {}),
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(pages);
}
