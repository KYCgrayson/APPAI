import { withPageWrite, updateLivePage, type PageApiActor } from "@/lib/page-write-guard";
import type { PageStore } from "@/lib/page-management";
import { toPageDto } from "@/lib/page-dto";
import { NextRequest, NextResponse } from "next/server";
import { hostedPageApprovalUpdate } from "@/lib/hosted-page-approval";

// POST /api/v1/pages/:slug/set-default?locale=ja
// Sets the specified locale as the default for this slug.
// The default locale is shown at /p/:slug (without locale suffix).
async function postPage(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
  db: PageStore,
  authResult: PageApiActor,
) {
  const { slug } = await params;
  const locale = request.nextUrl.searchParams.get("locale");
  if (!locale) {
    return NextResponse.json(
      { error: "Missing locale query parameter", hint: "Add ?locale=ja to specify which locale to set as default" },
      { status: 400 }
    );
  }


  // Verify the target locale exists
  const page = await db.hostedPage.findFirst({
    where: { slug, locale, organizationId: authResult.organizationId },
  });
  if (!page) {
    return NextResponse.json(
      { error: `Page "${slug}" (locale: ${locale}) not found in your organization` },
      { status: 404 }
    );
  }

  // Unset all existing defaults for this slug, then set the new one
  await db.hostedPage.updateMany({
    where: { slug, organizationId: authResult.organizationId, parentSlug: page.parentSlug, removalState: null },
    data: { isDefault: false },
  });

  const updated = await updateLivePage(db, page, { isDefault: true });

  // Update the App listing from the new default
  const app = await db.app.findFirst({ where: { hostedPageSlug: slug, organizationId: authResult.organizationId } });
  if (app) {
    await db.app.update({
      where: { id: app.id },
      data: {
        name: updated.title,
        tagline: updated.tagline || updated.title,
        ...(updated.template === "GAME" ? hostedPageApprovalUpdate(updated.template, updated) : {}),
      },
    });
  }

  return NextResponse.json({
    message: `Locale "${locale}" is now the default for "${slug}"`,
    page: toPageDto(updated),
  });
}

export async function POST(request: NextRequest, context: { params: Promise<{ slug: string }> }) {
  return withPageWrite(request, (await context.params).slug, (tx, actor) => postPage(request, context, tx, actor));
}
