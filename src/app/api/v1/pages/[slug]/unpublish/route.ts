import { withPageWrite, type PageApiActor } from "@/lib/page-write-guard";
import type { PageStore } from "@/lib/page-management";
import { toPageDto } from "@/lib/page-dto";
import { NextRequest, NextResponse } from "next/server";

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

  const updated = await db.hostedPage.update({
    where: { id: page.id, removalState: null },
    data: { isPublished: false },
  });

  return NextResponse.json(toPageDto(updated));
}

export async function POST(request: NextRequest, context: { params: Promise<{ slug: string }> }) {
  return withPageWrite(request, (await context.params).slug, (tx, actor) => postPage(request, context, tx, actor), { unpublish: true });
}
