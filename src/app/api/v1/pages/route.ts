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
    const parentSlug = data.parentSlug ?? null;

    // Multi-page sites: when creating a child page, the parent root page must
    // already exist in the same organization and must itself be a root page
    // (only one level of nesting is allowed).
    if (parentSlug) {
      if (parentSlug === data.slug) {
        return NextResponse.json(
          { error: "parentSlug cannot equal slug — a page cannot be its own parent." },
          { status: 400 }
        );
      }
      const parent = await db.hostedPage.findFirst({
        where: {
          organizationId: authResult.organizationId,
          slug: parentSlug,
          parentSlug: null,
        },
        select: { id: true },
      });
      if (!parent) {
        return NextResponse.json(
          {
            error: `parentSlug "${parentSlug}" does not exist as a root page in your organization.`,
            hint: "Create the parent page first (without parentSlug), then create children.",
          },
          { status: 400 }
        );
      }
    }

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
      // parentSlug is intentionally excluded from upsert mutations: reparenting
      // a page (root <-> child) is destructive and must go through delete+create.
      const { category: appCategory, locale: _locale, parentSlug: _parentSlug, ...pageData } = data;

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
    // Admin organizations bypass plan limits
    const isAdmin = await db.user.findFirst({
      where: { organizationId: authResult.organizationId, role: "ADMIN" },
      select: { id: true },
    });

    if (!isAdmin) {
      // Plan limits count only ROOT pages. Locale variants of an existing
      // slug and child pages of an existing root are free.
      const rootSlugs = await db.hostedPage.groupBy({
        by: ["slug"],
        where: { organizationId: authResult.organizationId, parentSlug: null },
      });
      if (authResult.organization.plan === "FREE" && rootSlugs.length >= 3 && !parentSlug) {
        const existingSlugs = rootSlugs.map((g) => g.slug);
        if (!existingSlugs.includes(data.slug)) {
          return NextResponse.json(
            { error: "Free plan limit: max 3 root pages (locale variants and child pages are free). Upgrade to Pro." },
            { status: 403 }
          );
        }
      }
    }

    // Sanitize content before saving: strip HTML tags and validate URLs
    data.content = sanitizeContent(data.content) as Record<string, any>;

    // parentSlug is set explicitly below from the validated `parentSlug`
    // local, so it's stripped here from the spread to avoid double-set.
    const { category: appCategory, locale: _locale, parentSlug: _parentSlug, ...pageData } = data;

    // First locale variant for this slug becomes the default. For child pages
    // we scope the variant count by (slug, parentSlug) so a child "faq" under
    // root "foo" is independent from a root page named "faq" elsewhere.
    const existingVariants = await db.hostedPage.count({
      where: {
        slug: data.slug,
        organizationId: authResult.organizationId,
        parentSlug,
      },
    });
    const shouldBeDefault = existingVariants === 0;

    const page = await db.hostedPage.create({
      data: {
        ...pageData,
        locale,
        isDefault: shouldBeDefault,
        parentSlug,
        content: pageData.content as any,
        organizationId: authResult.organizationId,
      },
    });

    // Auto-create a corresponding App record (only for default locale of root
    // pages — child pages do not get their own App listing).
    if (shouldBeDefault && !parentSlug) {
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
