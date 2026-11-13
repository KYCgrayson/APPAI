import { withPageWrite, updateLivePage, type PageApiActor } from "@/lib/page-write-guard";
import type { PageStore } from "@/lib/page-management";
import { toPageDto } from "@/lib/page-dto";
import { NextRequest, NextResponse } from "next/server";
import { hostedPageApprovalUpdate } from "@/lib/hosted-page-approval";

async function postPage(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
  db: PageStore,
  authResult: PageApiActor,
) {
  const { slug } = await params;
  const locale = request.nextUrl.searchParams.get("locale") || "en";

  const page = await db.hostedPage.findFirst({
    where: { slug, locale, organizationId: authResult.organizationId },
  });
  if (!page) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const updated = await updateLivePage(db, page, { isPublished: true });

  if (!page.parentSlug && page.template === "GAME") {
    await db.app.updateMany({
      where: { hostedPageSlug: slug, organizationId: authResult.organizationId },
      data: hostedPageApprovalUpdate(page.template, page),
    });
  }

  return NextResponse.json(toPageDto(updated));
}

export async function POST(request: NextRequest, context: { params: Promise<{ slug: string }> }) {
  return withPageWrite(request, (await context.params).slug, (tx, actor) => postPage(request, context, tx, actor));
}
