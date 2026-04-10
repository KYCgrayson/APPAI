import { NextRequest, NextResponse } from "next/server";
import { validateApiKey } from "@/lib/api-auth";
import { createPageSchema } from "@/lib/validations/page";
import { sanitizeContent, type SanitizeWarning } from "@/lib/sanitize";
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

  // Step 3: Extra content-level checks (non-blocking, informational)
  const sections = (sanitized as { sections?: Array<{ type: string; data: Record<string, unknown> }> })?.sections;
  if (Array.isArray(sections)) {
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
