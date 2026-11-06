import { storeTypography, typographyWarnings } from "@/lib/typography";
import { pageLogoUpdate, pageLogoWarnings } from "@/lib/page-logo";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { validateApiKey } from "@/lib/api-auth";
import { updatePageSchema } from "@/lib/validations/page";
import { sanitizeContent, type SanitizeWarning } from "@/lib/sanitize";
import { hostedPageApprovalUpdate } from "@/lib/hosted-page-approval";
import { revalidateSeoIndexes } from "@/lib/revalidate-seo";

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
    return NextResponse.json(variants);
  }

  const page = await db.hostedPage.findFirst({
    where: { slug, locale, organizationId: authResult.organizationId },
  });

  if (!page) {
    return errorResponse(`Page "${slug}" (locale: ${locale}) not found in your organization`, 404);
  }

  return NextResponse.json(page);
}

// PUT /api/v1/pages/:slug - Full replace
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const locale = getLocale(request);
  const authResult = await validateApiKey(request.headers.get("authorization"));
  if (!authResult) {
    return errorResponse("Unauthorized. Provide a valid API key in the Authorization header: Bearer appai_sk_...", 401);
  }

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

    const parsed = updatePageSchema.parse(body);
    // Strip category and locale (they're not HostedPage columns to update)
    const { category, ...data } = storeTypography(parsed, page.content);
    delete data.locale;

    const putWarnings: SanitizeWarning[] = [];
    if (data.content) {
      data.content = sanitizeContent(data.content, undefined, putWarnings) as Record<string, unknown>;
    }

    const hadPersonRoot = !!await db.hostedPage.findFirst({
      where: { slug, organizationId: authResult.organizationId, parentSlug: null, template: "PERSON" },
      select: { id: true },
    });

    const updated = await db.hostedPage.update({
      where: { id: page.id },
      data: { ...data, content: data.content as Prisma.InputJsonObject },
    });

    const approvalUpdate = hostedPageApprovalUpdate(updated.template, page, hadPersonRoot);

    // Sync default-locale metadata; review the first PERSON root in any locale.
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

    putWarnings.push(...pageLogoWarnings(updated), ...typographyWarnings(updated));
    revalidateSeoIndexes(updated.slug);
    return NextResponse.json({ ...updated, ...(putWarnings.length > 0 ? { warnings: putWarnings } : {}) });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return errorResponse("Validation failed", 400, error.issues);
    }
    console.error("PUT page error:", error);
    return errorResponse(`Update failed: ${error instanceof Error ? error.message : "Unknown error"}`, 500);
  }
}

// PATCH /api/v1/pages/:slug - True partial update with deep merge
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const locale = getLocale(request);
  const authResult = await validateApiKey(request.headers.get("authorization"));
  if (!authResult) {
    return errorResponse("Unauthorized. Provide a valid API key in the Authorization header: Bearer appai_sk_...", 401);
  }

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

    const parsed = updatePageSchema.parse(body);
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
    if (updateData.content) {
      updateData.content = sanitizeContent(
        mergeContent(page.content, updateData.content),
        undefined,
        patchWarnings,
      );
    }

    const hadPersonRoot = !!await db.hostedPage.findFirst({
      where: { slug, organizationId: authResult.organizationId, parentSlug: null, template: "PERSON" },
      select: { id: true },
    });

    const updated = await db.hostedPage.update({
      where: { id: page.id },
      data: updateData as Prisma.HostedPageUpdateInput,
    });

    const approvalUpdate = hostedPageApprovalUpdate(updated.template, page, hadPersonRoot);

    // Sync default-locale metadata; review the first PERSON root in any locale.
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

    patchWarnings.push(...pageLogoWarnings(updated), ...typographyWarnings(updated));
    revalidateSeoIndexes(updated.slug);
    return NextResponse.json({ ...updated, ...(patchWarnings.length > 0 ? { warnings: patchWarnings } : {}) });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return errorResponse("Validation failed", 400, error.issues);
    }
    console.error("PATCH page error:", error);
    return errorResponse(`Update failed: ${error instanceof Error ? error.message : "Unknown error"}`, 500);
  }
}

// DELETE /api/v1/pages/:slug
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const locale = getLocale(request);
  const authResult = await validateApiKey(request.headers.get("authorization"));
  if (!authResult) {
    return errorResponse("Unauthorized. Provide a valid API key in the Authorization header: Bearer appai_sk_...", 401);
  }

  const page = await db.hostedPage.findFirst({
    where: { slug, locale, organizationId: authResult.organizationId },
  });
  if (!page) {
    return errorResponse(`Page "${slug}" (locale: ${locale}) not found in your organization`, 404);
  }

  await db.hostedPage.delete({ where: { id: page.id } });

  // Only delete the App listing if no more locale variants exist
  const remaining = await db.hostedPage.count({ where: { slug } });
  if (remaining === 0) {
    await db.app.deleteMany({ where: { hostedPageSlug: slug } });
  }

  revalidateSeoIndexes(slug);
  return NextResponse.json({
    message: `Page "${slug}" (locale: ${locale}) has been deleted`,
    remaining_variants: remaining,
  });
}
