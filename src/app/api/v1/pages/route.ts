import { withPageWrite, updateLivePage, PageWriteConflict, type PageApiActor } from "@/lib/page-write-guard";
import type { PageStore } from "@/lib/page-management";
import { toPageDto } from "@/lib/page-dto";
import { normalizeVideoContent } from "@/lib/video-data";
import { gameContentIssues, gamesListingResponse, gamePageWarnings } from "@/lib/game-section";
import { storeTypography, typographyWarnings } from "@/lib/typography";
import { parseDryRun } from "@/lib/page-preview";
import { pageLogoUpdate, pageLogoWarnings } from "@/lib/page-logo";
import { POST as previewPage } from "./preview/route";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { validateApiKey } from "@/lib/api-auth";
import { createPageSchemaFor, pageIdentitySchema } from "@/lib/validations/page";
import { sanitizePageContent, type SanitizeWarning } from "@/lib/sanitize";
import { hostedPageApprovalUpdate } from "@/lib/hosted-page-approval";
import { pageParentConflict } from "@/lib/page-parent-conflict";
import { slugOwnershipDecision } from "@/lib/slug-ownership";

function mapTemplateToCategory(template: string): string {
  const map: Record<string, string> = {
    APP_LANDING: "PRODUCTIVITY",
    COMPANY_PROFILE: "OTHER",
    PRODUCT_SHOWCASE: "OTHER",
    PERSON: "OTHER",
    PORTFOLIO: "DESIGN",
    LINK_IN_BIO: "SOCIAL",
    GAME: "GAMES",
  };
  return map[template] || "OTHER";
}

// POST /api/v1/pages - Create a new hosted page
async function postPage(request: NextRequest, db: PageStore, authResult: PageApiActor) {
  try {
    const body = await request.json();
    const identity = pageIdentitySchema.parse(body);
    const locale = identity.locale || "en";

    // Check slug+locale availability
    const existing = await db.hostedPage.findUnique({
      where: { slug_locale: { slug: identity.slug, locale } },
    });
    const upsert = request.nextUrl.searchParams.get("upsert") === "true";

    if (existing && existing.organizationId !== authResult.organizationId) {
      return NextResponse.json({
        error: `Slug "${identity.slug}" is already used for locale "${locale}" by another organization.`,
        hint: `Choose a different slug. For child pages, prefix it with the parent slug, e.g. "kenji-tidepool".`,
      }, { status: 409 });
    }

    const data = storeTypography(createPageSchemaFor(upsert ? existing?.content : undefined).parse(body));
    const parentSlug = data.parentSlug ?? null;

    if (existing && upsert) {
      const conflict = pageParentConflict(data.slug, locale, parentSlug, existing.parentSlug);
      if (conflict) {
        return NextResponse.json(conflict, { status: 409 });
      }
    }

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

    // A slug is an organization namespace across all root locale variants.
    const owners = parentSlug ? [] : await db.hostedPage.findMany({
      where: { slug: data.slug, parentSlug: null },
      select: { organizationId: true },
      orderBy: [{ slug: "asc" }, { locale: "asc" }],
    });
    const ownership = slugOwnershipDecision(owners, authResult.organizationId, parentSlug);
    if (ownership.status === 403) {
      return NextResponse.json({ error: ownership.error }, { status: ownership.status });
    }

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

      const upsertWarnings: SanitizeWarning[] = [];
      data.content = sanitizePageContent(data.content, undefined, upsertWarnings, existing.content) as Record<string, unknown>;
      const gameIssues = [...gameContentIssues(data.content), ...normalizeVideoContent(data.content, false, existing.content).issues];
      if (gameIssues.length) throw new z.ZodError(gameIssues);

      // parentSlug is intentionally excluded from upsert mutations: reparenting
      // a page (root <-> child) is destructive and must go through delete+create.
      const { category: appCategory, ...pageData } = data;

      delete pageData.locale;
      delete pageData.parentSlug;

      const hadPersonRoot = !!await db.hostedPage.findFirst({
        where: { slug: data.slug, organizationId: authResult.organizationId, parentSlug: null, template: "PERSON" },
        select: { id: true },
      });

      const updated = await updateLivePage(db, existing, {
        ...pageData,
        content: pageData.content as Prisma.InputJsonObject,
        slug: undefined, // don't update slug
      });

      // Sync default-locale metadata and apply template approval rules.
      const approvalUpdate = hostedPageApprovalUpdate(updated.template, existing, hadPersonRoot);
      if (!existing.parentSlug && (existing.isDefault || approvalUpdate.isApproved === false)) {
        const app = await db.app.findFirst({ where: { hostedPageSlug: data.slug, organizationId: authResult.organizationId } });
        if (app) {
          await db.app.update({
            where: { id: app.id },
            data: {
              ...approvalUpdate,
              ...(existing.isDefault ? {
                name: updated.title,
                tagline: updated.tagline || updated.title,
                ...pageLogoUpdate(updated.content, updated.headerLogo),
                ...(appCategory ? { category: appCategory } : {}),
              } : {}),
            },
          });
        }
      }

      upsertWarnings.push(...pageLogoWarnings(updated), ...typographyWarnings(updated), ...gamePageWarnings(updated));

      return NextResponse.json(
        { ...toPageDto(updated), ...gamesListingResponse(updated.content), ...(upsertWarnings.length > 0 ? { warnings: upsertWarnings } : {}) },
        { status: 200 },
      );
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
        where: { organizationId: authResult.organizationId, parentSlug: null, OR: [{ removalState: null }, { removalState: { not: "DELETED" } }] },
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
    const contentWarnings: SanitizeWarning[] = [];
    data.content = sanitizePageContent(data.content, undefined, contentWarnings) as Record<string, unknown>;

    const gameIssues = [...gameContentIssues(data.content), ...normalizeVideoContent(data.content).issues];
    if (gameIssues.length) throw new z.ZodError(gameIssues);

    // parentSlug is set explicitly below from the validated `parentSlug`
    // local, so it's stripped here from the spread to avoid double-set.
    const { category: appCategory, ...pageData } = data;

    delete pageData.locale;
    delete pageData.parentSlug;

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

    const hadPersonRoot = !!await db.hostedPage.findFirst({
      where: { slug: data.slug, organizationId: authResult.organizationId, parentSlug: null, template: "PERSON" },
      select: { id: true },
    });

    const page = await db.hostedPage.create({
      data: {
        ...pageData,
        locale,
        isDefault: shouldBeDefault,
        parentSlug,
        content: pageData.content as Prisma.InputJsonObject,
        organizationId: authResult.organizationId,
      },
    });

    // Auto-create a corresponding App record (only for default locale of root
    // pages — child pages do not get their own App listing).
    if (shouldBeDefault && !parentSlug) {
      const existingApp = await db.app.findFirst({
        where: { hostedPageSlug: page.slug, organizationId: authResult.organizationId },
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
            ...pageLogoUpdate(pageData.content, page.headerLogo),
            ...hostedPageApprovalUpdate(page.template),
          },
        });
      }
    }

    if (!parentSlug && (page.template === "GAME" || (page.template === "PERSON" && !hadPersonRoot))) {
      await db.app.updateMany({
        where: { hostedPageSlug: page.slug, organizationId: authResult.organizationId, isApproved: true },
        data: { isApproved: false },
      });
    }

    contentWarnings.push(...pageLogoWarnings(page), ...typographyWarnings(page), ...gamePageWarnings(page));

    return NextResponse.json(
      { ...toPageDto(page), ...gamesListingResponse(page.content), ...(contentWarnings.length > 0 ? { warnings: contentWarnings } : {}) },
      { status: 201 },
    );
  } catch (error: unknown) {
    if (error instanceof PageWriteConflict) throw error;
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation failed", details: error.issues }, { status: 400 });
    }
    console.error("POST page error:", error);
    return NextResponse.json({ error: `Failed to create page: ${error instanceof Error ? error.message : "Unknown error"}` }, { status: 500 });
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
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });

  return NextResponse.json(pages.map(page => ({ ...toPageDto(page), ...gamesListingResponse(page.content) })));
}

export async function POST(request: NextRequest) {
  const dryRun = parseDryRun(request.nextUrl.searchParams.get("dryRun"));
  if (dryRun === "invalid") return NextResponse.json({ error: "Invalid dryRun value", hint: "Use dryRun=true/1/yes to preview, or false/0/no to publish." }, { status: 400 });
  if (dryRun) return previewPage(request);
  return withPageWrite(request, null, (tx, actor) => postPage(request, tx, actor));
}
