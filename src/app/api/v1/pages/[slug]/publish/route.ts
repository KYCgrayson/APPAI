import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { validateApiKey } from "@/lib/api-auth";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const locale = request.nextUrl.searchParams.get("locale") || "en";
  const authResult = await validateApiKey(request.headers.get("authorization"));
  if (!authResult) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const page = await db.hostedPage.findFirst({
    where: { slug, locale, organizationId: authResult.organizationId },
  });
  if (!page) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const updated = await db.hostedPage.update({
    where: { id: page.id },
    data: { isPublished: true },
  });

  return NextResponse.json(updated);
}
