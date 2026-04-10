import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { validateApiKey } from "@/lib/api-auth";
import { sanitizeContent, type SanitizeWarning } from "@/lib/sanitize";

/**
 * PATCH /api/v1/pages/:slug/sections/:order
 *
 * Update a single section by its `order` value. Merges the provided `data`
 * into the existing section data. Uses If-Match for optional optimistic
 * locking against `updatedAt`.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; order: string }> }
) {
  const authResult = await validateApiKey(request.headers.get("authorization"));
  if (!authResult) {
    return NextResponse.json(
      { error: "Unauthorized. Provide a valid API key in the Authorization header: Bearer appai_sk_..." },
      { status: 401 },
    );
  }

  const { slug, order: orderStr } = await params;
  const order = parseInt(orderStr, 10);
  if (isNaN(order)) {
    return NextResponse.json({ error: "Section order must be a number." }, { status: 400 });
  }

  const locale = request.nextUrl.searchParams.get("locale") || "en";

  const page = await db.hostedPage.findFirst({
    where: {
      slug,
      locale,
      organizationId: authResult.organizationId,
    },
  });

  if (!page) {
    return NextResponse.json(
      { error: `Page "${slug}" (locale: ${locale}) not found in your organization.` },
      { status: 404 },
    );
  }

  // Optimistic locking via If-Match
  const ifMatch = request.headers.get("if-match");
  if (ifMatch) {
    const etag = `"${page.updatedAt.toISOString()}"`;
    if (ifMatch !== etag) {
      return NextResponse.json(
        {
          error: "Precondition failed — the page has been modified since your last read.",
          currentEtag: etag,
          hint: "Re-fetch the page with GET, re-read the section, and retry.",
        },
        { status: 412 },
      );
    }
  }

  const content = page.content as { sections?: Array<{ type: string; order?: number; data: Record<string, unknown> }> } | null;
  const sections = content?.sections;
  if (!Array.isArray(sections)) {
    return NextResponse.json(
      { error: "Page has no sections array in its content." },
      { status: 404 },
    );
  }

  const idx = sections.findIndex((s) => s.order === order);
  if (idx === -1) {
    return NextResponse.json(
      { error: `No section with order=${order} found on page "${slug}".` },
      { status: 404 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const patchData = (body as { data?: Record<string, unknown> })?.data;
  if (!patchData || typeof patchData !== "object") {
    return NextResponse.json(
      { error: 'Request body must be { "data": { ... } } with the fields to merge.' },
      { status: 400 },
    );
  }

  // Merge + sanitize
  const merged = { ...sections[idx].data, ...patchData };
  const warnings: SanitizeWarning[] = [];
  const sanitized = sanitizeContent(merged, undefined, warnings, `sections[${order}].data`) as Record<string, unknown>;

  // Replace section data in-place
  sections[idx] = { ...sections[idx], data: sanitized };

  const updated = await db.hostedPage.update({
    where: { id: page.id },
    data: { content: { ...content, sections } as any },
  });

  return NextResponse.json({
    section: sections[idx],
    etag: `"${updated.updatedAt.toISOString()}"`,
    ...(warnings.length > 0 ? { warnings } : {}),
  });
}
