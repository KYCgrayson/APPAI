import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { validateApiKey } from "@/lib/api-auth";
import { createPageSchema } from "@/lib/validations/page";
import { checkPagePreview, pagePreviewNext } from "@/lib/page-preview";
import { pageParentConflict } from "@/lib/page-parent-conflict";
import { ICON_NAMES } from "@/components/ui/Icon";

/**
 * POST /api/v1/pages/preview
 *
 * Dry-run validation endpoint. Accepts the same body as POST /api/v1/pages,
 * runs the full validation + sanitization pipeline, and returns structured
 * results WITHOUT writing anything to the database.
 *
 * Response: { valid, errors[], warnings[], sanitizedContent, next }
 */
export async function POST(request: NextRequest) {
  const authResult = await validateApiKey(request.headers.get("authorization"), { readOnly: true });
  if (!authResult) {
    return NextResponse.json(
      { error: "Unauthorized. Provide a valid API key in the Authorization header: Bearer appai_sk_..." },
      { status: 401 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = createPageSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json(checkPagePreview(body, ICON_NAMES, { origin: request.nextUrl.origin }));
  const data = parsed.data;

  const existing = await db.hostedPage.findUnique({
    where: { slug_locale: { slug: data.slug, locale: data.locale || "en" } },
    select: { organizationId: true, parentSlug: true, isDefault: true },
  });
  const result = checkPagePreview(body, ICON_NAMES, { origin: request.nextUrl.origin, exists: !!existing });
  const { warnings, sanitizedContent: sanitized } = result;
  const rootDefault = await db.hostedPage.findFirst({
    where: { slug: data.parentSlug || data.slug, organizationId: authResult.organizationId, parentSlug: null, isDefault: true },
    select: { locale: true },
  });
  result.next = pagePreviewNext(data, { origin: request.nextUrl.origin, exists: !!existing, isDefault: rootDefault ? rootDefault.locale === data.locale : true });
  if (existing && existing.organizationId !== authResult.organizationId) {
    return NextResponse.json({ valid: false, errors: [{ path: "slug", message: `Slug "${data.slug}" is already used for locale "${data.locale || "en"}" by another organization.` }], warnings, sanitizedContent: sanitized, next: "Fix errors and dry-run again." });
  }
  if (existing && request.nextUrl.searchParams.get("upsert") === "true") {
    const conflict = pageParentConflict(data.slug, data.locale || "en", data.parentSlug, existing.parentSlug);
    if (conflict) {
      return NextResponse.json({ valid: false, errors: [{ path: "parentSlug", message: conflict.error }], hint: conflict.hint, warnings, sanitizedContent: sanitized, next: "Fix errors and dry-run again." });
    }
  }
  if (existing && request.nextUrl.searchParams.get("upsert") !== "true") {
    warnings.push({ path: "slug", message: `Slug "${data.slug}" already taken for locale "${data.locale || "en"}". POST needs ?upsert=true, or use PATCH.` });
  }

  return NextResponse.json(result);
}
