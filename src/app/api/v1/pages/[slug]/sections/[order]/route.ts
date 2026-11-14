import { projectCardsContentIssues } from "@/lib/project-cards";
import { withPageWrite, updateLivePage, type PageApiActor } from "@/lib/page-write-guard";
import type { PageStore } from "@/lib/page-management";
import { normalizeVideoContent } from "@/lib/video-data";
import { gameContentIssues, gameSlugReserved, gamesListingResponse, gamePageWarnings } from "@/lib/game-section";
import type { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { sanitizePageContent, type SanitizeWarning } from "@/lib/sanitize";
import { hostedPageApprovalUpdate } from "@/lib/hosted-page-approval";

/**
 * PATCH /api/v1/pages/:slug/sections/:order
 *
 * Update a single section by its `order` value. Merges the provided `data`
 * into the existing section data. Uses If-Match for optional optimistic
 * locking against `updatedAt`.
 */
async function patchPage(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; order: string }> },
  db: PageStore,
  authResult: PageApiActor,
) {

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
  const candidate = { ...content, sections: sections.map((section, i) => i === idx ? { ...section, data: merged } : {}) };
  const issues = [...projectCardsContentIssues(candidate), ...gameContentIssues(candidate), ...normalizeVideoContent(candidate, false, page.content).issues];
  if (issues.length) return NextResponse.json({ error: "Validation failed", details: issues }, { status: 400 });
  const warnings: SanitizeWarning[] = [];
  const savedContent = sanitizePageContent(candidate, undefined, warnings, page.content);
  const sanitizedIssues = [...projectCardsContentIssues(savedContent), ...gameContentIssues(savedContent), ...normalizeVideoContent(savedContent, false, page.content).issues];
  if (sanitizedIssues.length) return NextResponse.json({ error: "Validation failed", details: sanitizedIssues }, { status: 400 });
  savedContent.sections = sections.map((section, i) => i === idx ? (savedContent.sections as typeof sections)[i] : section);
  // Report legacy warnings without revalidating or rewriting untouched sections.
  warnings.push(...normalizeVideoContent({ sections: sections.map((section, i) => i !== idx ? section : {}) }, false, page.content).warnings);
  if (gameSlugReserved({ ...page, content: savedContent })) return NextResponse.json({ error: "This game slug is reserved; choose a distinct slug." }, { status: 400 });
  warnings.push(...gamePageWarnings({ ...page, content: savedContent }));

  const updated = await updateLivePage(db, page, { content: savedContent as Prisma.InputJsonValue });

  if (!page.parentSlug && page.template === "GAME") {
    await db.app.updateMany({
      where: { hostedPageSlug: slug, organizationId: authResult.organizationId },
      data: hostedPageApprovalUpdate(page.template, page),
    });
  }

  return NextResponse.json({
    section: (savedContent.sections as typeof sections)[idx],
    ...gamesListingResponse(updated.content),
    etag: `"${updated.updatedAt.toISOString()}"`,
    ...(warnings.length > 0 ? { warnings } : {}),
  });
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ slug: string; order: string }> }) {
  return withPageWrite(request, (await context.params).slug, (tx, actor) => patchPage(request, context, tx, actor));
}
