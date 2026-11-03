import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { validateApiKey } from "@/lib/api-auth";
import { createPageSchema } from "@/lib/validations/page";
import { sanitizeContent, type SanitizeWarning } from "@/lib/sanitize";
import { sectionFieldWarnings } from "@/lib/section-field-warnings";
import { pageParentConflict } from "@/lib/page-parent-conflict";
import { ICON_NAMES } from "@/components/ui/Icon";

/**
 * POST /api/v1/pages/preview
 *
 * Dry-run validation endpoint. Accepts the same body as POST /api/v1/pages,
 * runs the full validation + sanitization pipeline, and returns structured
 * results WITHOUT writing anything to the database.
 *
 * Response: { valid, warnings[], sanitizedContent, errors? }
 */
export async function POST(request: NextRequest) {
  const authResult = await validateApiKey(request.headers.get("authorization"));
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

  // Step 1: Zod validation
  const parseResult = createPageSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      {
        valid: false,
        errors: parseResult.error.issues.map((e) => ({
          path: e.path.map(String).join("."),
          message: e.message,
        })),
        warnings: [],
      },
      { status: 200 }, // 200, not 400 — the preview itself succeeded, the content failed
    );
  }

  const data = parseResult.data;

  // Step 2: Sanitize and collect warnings
  const warnings: SanitizeWarning[] = [];
  const sanitized = sanitizeContent(data.content, undefined, warnings) as Record<string, unknown>;

  const existing = await db.hostedPage.findUnique({
    where: { slug_locale: { slug: data.slug, locale: data.locale || "en" } },
    select: { organizationId: true, parentSlug: true },
  });
  if (existing && existing.organizationId !== authResult.organizationId) {
    return NextResponse.json({ valid: false, errors: [{ path: "slug", message: `Slug "${data.slug}" is already used for locale "${data.locale || "en"}" by another organization.` }], warnings, sanitizedContent: sanitized });
  }
  if (existing && request.nextUrl.searchParams.get("upsert") === "true") {
    const conflict = pageParentConflict(data.slug, data.locale || "en", data.parentSlug, existing.parentSlug);
    if (conflict) {
      return NextResponse.json({ valid: false, errors: [{ path: "parentSlug", message: conflict.error }], hint: conflict.hint, warnings, sanitizedContent: sanitized });
    }
  }
  if (existing && request.nextUrl.searchParams.get("upsert") !== "true") {
    warnings.push({ path: "slug", message: `Slug "${data.slug}" already taken for locale "${data.locale || "en"}". POST needs ?upsert=true, or use PATCH.` });
  }

  // Step 3: Extra content-level checks (non-blocking, informational)
  const sections = (sanitized as { sections?: Array<{ type: string; data: Record<string, unknown> }> })?.sections;
  if (Array.isArray(sections)) {
    warnings.push(...sectionFieldWarnings(sections));
    for (const section of sections) {
      // Check icon field values against our known Ionicons map
      const iconFields = extractIconFields(section.data);
      for (const { path, value } of iconFields) {
        if (
          typeof value === "string" &&
          /^[a-z][a-z0-9-]*$/.test(value) &&
          !ICON_NAMES.includes(value)
        ) {
          warnings.push({
            path: `sections[${section.type}].${path}`,
            message: `Icon name "${value}" is not in our Ionicons map (${ICON_NAMES.length} available). It will render as plain text instead of SVG. Check the full list at GET /api/v1/sections or https://ionic.io/ionicons.`,
          });
        }
      }
    }
  }

  return NextResponse.json({
    valid: true,
    errors: [],
    warnings,
    sanitizedContent: sanitized,
  });
}

/** Recursively find fields named "icon" and return their paths + values. */
function extractIconFields(
  obj: unknown,
  pathPrefix = "",
): Array<{ path: string; value: unknown }> {
  if (obj === null || obj === undefined || typeof obj !== "object") return [];
  const results: Array<{ path: string; value: unknown }> = [];

  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      results.push(...extractIconFields(obj[i], `${pathPrefix}[${i}]`));
    }
    return results;
  }

  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    const path = pathPrefix ? `${pathPrefix}.${key}` : key;
    if (key === "icon" && typeof value === "string") {
      results.push({ path, value });
    }
    if (typeof value === "object" && value !== null) {
      results.push(...extractIconFields(value, path));
    }
  }
  return results;
}
