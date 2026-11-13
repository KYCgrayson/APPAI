import { withPageWrite, updateLivePage, PageWriteConflict, type PageApiActor } from "@/lib/page-write-guard";
import type { PageStore } from "@/lib/page-management";
import { toPageDto } from "@/lib/page-dto";
import { normalizeVideoContent } from "@/lib/video-data";
import { gameContentIssues, gameSlugReserved, gamesListingResponse, gamePageWarnings } from "@/lib/game-section";
import { storeTypography, typographyWarnings } from "@/lib/typography";
import { pageLogoUpdate, pageLogoWarnings } from "@/lib/page-logo";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { validateApiKey } from "@/lib/api-auth";
import { updatePageSchemaFor } from "@/lib/validations/page";
import { sanitizePageContent, type SanitizeWarning } from "@/lib/sanitize";
import { hostedPageApprovalUpdate } from "@/lib/hosted-page-approval";

// Fields that cannot be changed via PUT/PATCH. parentSlug is immutable because
// reparenting (root <-> child) is destructive — agents must delete and recreate.
const IMMUTABLE_FIELDS = ["slug", "locale", "id", "organizationId", "createdAt", "updatedAt", "parentSlug"];

/**
 * Check for immutable fields in the request body.
 * Returns a 400 response if any are found, or null if clean.
 */
function checkImmutableFields(body: Record<string, unknown>): NextResponse | null {
  const violations = IMMUTABLE_FIELDS.filter((f) => f in body);
  if (violations.length > 0) {
    return NextResponse.json(
      {
        error: "Immutable fields cannot be updated",
        immutable_fields: violations,
        hint: `Remove these fields from your request: ${violations.join(", ")}`,
      },
      { status: 400 }
    );
  }
  return null;
}

/**
 * Deep merge content for PATCH: merge sections by order or type,
 * preserve existing sections not in the patch.
 */
type Section = { order?: number; type?: string; data?: Record<string, unknown> };
function mergeContent(existingValue: unknown, patchValue: unknown): unknown {
  const existing = existingValue as { sections?: Section[] } | null;
  const patch = patchValue as { sections?: Section[] } | null;
  if (!existing || typeof existing !== "object") return patch;
  if (!patch || typeof patch !== "object") return patch;

  const merged = { ...existing, ...patch };

  // Deep merge sections array: match by order, then merge data
  if (Array.isArray(existing.sections) && Array.isArray(patch.sections)) {
    const existingSections = [...existing.sections];
    const patchSections = patch.sections;

    for (const patchSection of patchSections) {
      const idx = existingSections.findIndex(
        (s) =>
          (patchSection.order !== undefined && s.order === patchSection.order) ||
          (patchSection.type && s.type === patchSection.type && patchSection.order === undefined)
      );
      if (idx >= 0) {
        // Merge existing section with patch
        existingSections[idx] = {
          ...existingSections[idx],
          ...patchSection,
          data: { ...existingSections[idx].data, ...patchSection.data },
        };
      } else {
        // New section, append
        existingSections.push(patchSection);
      }
    }

    merged.sections = existingSections.sort(
      (a, b) => (a.order || 0) - (b.order || 0)
    );
  }

  return merged;
}

/**
 * Standard error response with structured info for agents.
 */
function errorResponse(message: string, status: number, details?: unknown) {
  return NextResponse.json(
    { error: message, ...(details ? { details } : {}) },
    { status }
  );
}

/** Extract locale from query params, default to "en" */
function getLocale(request: NextRequest): string {
  return request.nextUrl.searchParams.get("locale") || "en";
}

// GET /api/v1/pages/:slug
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const locale = getLocale(request);
  const authResult = await validateApiKey(request.headers.get("authorization"));
  if (!authResult) {
    return errorResponse("Unauthorized. Provide a valid API key in the Authorization header: Bearer appai_sk_...", 401);
  }

  // If ?variants=true, return all locale variants for this slug
  if (request.nextUrl.searchParams.get("variants") === "true") {
    const variants = await db.hostedPage.findMany({
      where: { slug, organizationId: authResult.organizationId },
      orderBy: { locale: "asc" },
    });
    return NextResponse.json(variants.map(page => ({ ...toPageDto(page), ...gamesListingResponse(page.content) })));
  }

  const page = await db.hostedPage.findFirst({
    where: { slug, locale, organizationId: authResult.organizationId },
  });

  if (!page) {
    return errorResponse(`Page "${slug}" (locale: ${locale}) not found in your organization`, 404);
  }

  return NextResponse.json({ ...toPageDto(page), ...gamesListingResponse(page.content) });
}

// PUT /api/v1/pages/:slug - Full replace
async function putPage(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
  db: PageStore,
  authResult: PageApiActor,
) {
  const { slug } = await params;
  const locale = getLocale(request);

  const page = await db.hostedPage.findFirst({
    where: { slug, locale, organizationId: authResult.organizationId },
  });
  if (!page) {
    return errorResponse(`Page "${slug}" (locale: ${locale}) not found in your organization`, 404);
  }

  try {
    const body = await request.json();

    // Check for immutable fields
    const immutableError = checkImmutableFields(body);
    if (immutableError) return immutableError;

    const parsed = updatePageSchemaFor(page.content).parse(body);
    // Strip category and locale (they're not HostedPage columns to update)
    const { category, ...data } = storeTypography(parsed, page.content);
    delete data.locale;

    const putWarnings: SanitizeWarning[] = [];
    data.content = sanitizePageContent(data.content ?? page.content, undefined, putWarnings, page.content);

    const effective = { ...page, ...data };
    const gameIssues = [...gameContentIssues(effective.content), ...normalizeVideoContent(effective.content, false, page.content).issues];
    if (gameIssues.length) throw new z.ZodError(gameIssues);
    if (gameSlugReserved(effective)) return errorResponse("This game slug is reserved; choose a distinct slug.", 400);

    const hadPersonRoot = !!await db.hostedPage.findFirst({
      where: { slug, organizationId: authResult.organizationId, parentSlug: null, template: "PERSON" },
      select: { id: true },
    });

    const updated = await updateLivePage(db, page, { ...data, content: data.content as Prisma.InputJsonObject });

    const approvalUpdate = hostedPageApprovalUpdate(updated.template, page, hadPersonRoot);

    // Sync default-locale metadata and apply template approval rules.
    if (!page.parentSlug && ((page.isDefault && (data.title || data.tagline || category || data.content || data.headerLogo)) || approvalUpdate.isApproved === false)) {
      const app = await db.app.findFirst({ where: { hostedPageSlug: slug, organizationId: authResult.organizationId } });
      if (app) {
        await db.app.update({
          where: { id: app.id },
          data: {
            ...(page.isDefault && data.title ? { name: data.title } : {}),
            ...(page.isDefault && data.tagline ? { tagline: data.tagline } : {}),
            ...(page.isDefault && category ? { category } : {}),
            ...(page.isDefault ? { ...pageLogoUpdate(updated.content, updated.headerLogo) } : {}),
            ...approvalUpdate,
          },
        });
      }
    }

    putWarnings.push(...pageLogoWarnings(updated), ...typographyWarnings(updated), ...gamePageWarnings(updated));

    return NextResponse.json({ ...toPageDto(updated), ...gamesListingResponse(updated.content), ...(putWarnings.length > 0 ? { warnings: putWarnings } : {}) });
  } catch (error: unknown) {
    if (error instanceof PageWriteConflict) throw error;
    if (error instanceof z.ZodError) {
      return errorResponse("Validation failed", 400, error.issues);
    }
    console.error("PUT page error:", error);
    return errorResponse(`Update failed: ${error instanceof Error ? error.message : "Unknown error"}`, 500);
  }
}

// PATCH /api/v1/pages/:slug - True partial update with deep merge
async function patchPage(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
  db: PageStore,
  authResult: PageApiActor,
) {
  const { slug } = await params;
  const locale = getLocale(request);

  const page = await db.hostedPage.findFirst({
    where: { slug, locale, organizationId: authResult.organizationId },
  });
  if (!page) {
    return errorResponse(`Page "${slug}" (locale: ${locale}) not found in your organization`, 404);
  }

  try {
    const body = await request.json();

    // Check for immutable fields
    // Repeated identity values are harmless; changed values remain immutable.
    for (const field of ["slug", "locale"] as const) {
      if (body[field] === page[field]) delete body[field];
    }
    const immutableError = checkImmutableFields(body);
    if (immutableError) return immutableError;

    const parsed = updatePageSchemaFor(page.content).parse(body);
    const { category, ...fields } = storeTypography(parsed, page.content);
    delete fields.locale;

    // Build update: only include fields that were explicitly sent in the body
    const updateData: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(fields)) {
      if ((key in body || (key === "content" && ("textSize" in body || "textContrast" in body || "typography" in body))) && value !== undefined) {
        updateData[key] = value;
      }
    }

    // Deep merge content with existing content
    const patchWarnings: SanitizeWarning[] = [];
    const mergedContent = updateData.content ? mergeContent(page.content, updateData.content) : page.content;
    const previousSections = (page.content as { sections?: Section[] } | null)?.sections;
    const previous = Array.isArray(previousSections) ? previousSections : [];
    const merged = mergedContent as { sections?: Section[] } | null;
    // mergeContent retains object identity for untouched sections. Validate only
    // changed sections, with their final merged data and original field indices.
    const touchedContent = { ...merged, ...(Array.isArray(merged?.sections) ? { sections: merged.sections.map(section => previous.includes(section) ? {} : section) } : {}) };
    const issues = [...gameContentIssues(touchedContent), ...normalizeVideoContent(touchedContent, false, page.content).issues];
    if (issues.length) throw new z.ZodError(issues);
    const sanitized = sanitizePageContent(
      mergedContent,
      undefined,
      patchWarnings,
      page.content,
    );
    if (Array.isArray(merged?.sections) && Array.isArray(sanitized.sections)) {
      const sanitizedTouched = { ...sanitized, sections: merged.sections.map((section, i) => previous.includes(section) ? {} : (sanitized.sections as unknown[])[i]) };
      const sanitizedIssues = [...gameContentIssues(sanitizedTouched), ...normalizeVideoContent(sanitizedTouched, false, page.content).issues];
      if (sanitizedIssues.length) throw new z.ZodError(sanitizedIssues);
      sanitized.sections = merged.sections.map((section, i) => previous.includes(section) ? section : (sanitized.sections as unknown[])[i]);
    }
    updateData.content = sanitized;

    const effective = { ...page, ...updateData };
    if (gameSlugReserved(effective)) return errorResponse("This game slug is reserved; choose a distinct slug.", 400);

    const hadPersonRoot = !!await db.hostedPage.findFirst({
      where: { slug, organizationId: authResult.organizationId, parentSlug: null, template: "PERSON" },
      select: { id: true },
    });

    const updated = await updateLivePage(db, page, updateData as Prisma.HostedPageUpdateManyMutationInput);

    const approvalUpdate = hostedPageApprovalUpdate(updated.template, page, hadPersonRoot);

    // Sync default-locale metadata and apply template approval rules.
    if (!page.parentSlug && ((page.isDefault && (updateData.title || updateData.tagline || category || updateData.content || updateData.headerLogo)) || approvalUpdate.isApproved === false)) {
      const app = await db.app.findFirst({ where: { hostedPageSlug: slug, organizationId: authResult.organizationId } });
      if (app) {
        await db.app.update({
          where: { id: app.id },
          data: {
            ...(page.isDefault && updateData.title ? { name: updateData.title } : {}),
            ...(page.isDefault && updateData.tagline ? { tagline: updateData.tagline } : {}),
            ...(page.isDefault && category ? { category } : {}),
            ...(page.isDefault ? { ...pageLogoUpdate(updated.content, updated.headerLogo) } : {}),
            ...approvalUpdate,
          },
        });
      }
    }

    patchWarnings.push(...pageLogoWarnings(updated), ...typographyWarnings(updated), ...gamePageWarnings(updated));

    return NextResponse.json({ ...toPageDto(updated), ...gamesListingResponse(updated.content), ...(patchWarnings.length > 0 ? { warnings: patchWarnings } : {}) });
  } catch (error: unknown) {
    if (error instanceof PageWriteConflict) throw error;
    if (error instanceof z.ZodError) {
      return errorResponse("Validation failed", 400, error.issues);
    }
    console.error("PATCH page error:", error);
    return errorResponse(`Update failed: ${error instanceof Error ? error.message : "Unknown error"}`, 500);
  }
}

// DELETE /api/v1/pages/:slug
async function deletePage(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
  db: PageStore,
  authResult: PageApiActor,
) {
  const { slug } = await params;
  const locale = getLocale(request);

  const page = await db.hostedPage.findFirst({
    where: { slug, locale, organizationId: authResult.organizationId },
  });
  if (!page) {
    return errorResponse(`Page "${slug}" (locale: ${locale}) not found in your organization`, 404);
  }

  await db.hostedPage.delete({ where: { id: page.id } });

  // Only delete the App listing if no more locale variants exist
  const remaining = await db.hostedPage.count({ where: { slug, organizationId: authResult.organizationId } });
  if (remaining === 0) {
    await db.app.deleteMany({ where: { hostedPageSlug: slug, organizationId: authResult.organizationId } });
  }

  return NextResponse.json({
    message: `Page "${slug}" (locale: ${locale}) has been deleted`,
    remaining_variants: remaining,
  });
}

export async function PUT(request: NextRequest, context: { params: Promise<{ slug: string }> }) {
  return withPageWrite(request, (await context.params).slug, (tx, actor) => putPage(request, context, tx, actor));
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ slug: string }> }) {
  return withPageWrite(request, (await context.params).slug, (tx, actor) => patchPage(request, context, tx, actor));
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ slug: string }> }) {
  return withPageWrite(request, (await context.params).slug, (tx, actor) => deletePage(request, context, tx, actor));
}
