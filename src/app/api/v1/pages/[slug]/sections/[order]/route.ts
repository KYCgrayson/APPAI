import { normalizeVideoContent } from "@/lib/video-data";
import { gameContentIssues, gameSlugReserved, gamesListingResponse, gamePageWarnings } from "@/lib/game-section";
import type { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { validateApiKey } from "@/lib/api-auth";
import { sanitizeContent, sanitizePageContent, type SanitizeWarning } from "@/lib/sanitize";
import { revalidateSeoIndexes } from "@/lib/revalidate-seo";
import { hostedPageApprovalUpdate } from "@/lib/hosted-page-approval";

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
  const candidate = { ...content, sections: sections.map((section, i) => i === idx ? { ...section, data: merged } : section) };
  const videoIssues = normalizeVideoContent(candidate).issues;
  if (videoIssues.length) return NextResponse.json({ error: "Validation failed", details: videoIssues }, { status: 400 });
  const warnings: SanitizeWarning[] = [];
  const sanitized = sanitizeContent(merged, undefined, warnings, `sections[${order}].data`) as Record<string, unknown>;

  // Replace section data in-place
  sections[idx] = { ...sections[idx], data: sanitized };

  const savedContent = sanitizePageContent({ ...content, sections });
  const gameIssues = [...gameContentIssues(savedContent), ...normalizeVideoContent(savedContent).issues];
  if (gameIssues.length) return NextResponse.json({ error: "Validation failed", details: gameIssues }, { status: 400 });
  if (gameSlugReserved({ ...page, content: savedContent })) return NextResponse.json({ error: "This game slug is reserved; choose a distinct slug." }, { status: 400 });
  warnings.push(...gamePageWarnings({ ...page, content: savedContent }));

  const updated = await db.hostedPage.update({
    where: { id: page.id },
    data: { content: savedContent as Prisma.InputJsonValue },
  });

  if (!page.parentSlug && page.template === "GAME") {
    await db.app.updateMany({
      where: { hostedPageSlug: slug, organizationId: authResult.organizationId },
      data: hostedPageApprovalUpdate(page.template, page),
    });
  }

  revalidateSeoIndexes(updated.slug);
  return NextResponse.json({
    section: (savedContent.sections as typeof sections)[idx],
    ...gamesListingResponse(updated.content),
    etag: `"${updated.updatedAt.toISOString()}"`,
    ...(warnings.length > 0 ? { warnings } : {}),
  });
}
