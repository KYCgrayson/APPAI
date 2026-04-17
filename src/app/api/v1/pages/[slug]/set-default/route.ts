import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { validateApiKey } from "@/lib/api-auth";
import { revalidateSeoIndexes } from "@/lib/revalidate-seo";

// POST /api/v1/pages/:slug/set-default?locale=ja
// Sets the specified locale as the default for this slug.
// The default locale is shown at /p/:slug (without locale suffix).
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const locale = request.nextUrl.searchParams.get("locale");
  if (!locale) {
    return NextResponse.json(
      { error: "Missing locale query parameter", hint: "Add ?locale=ja to specify which locale to set as default" },
      { status: 400 }
    );
  }

  const authResult = await validateApiKey(request.headers.get("authorization"));
  if (!authResult) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
    where: { slug, organizationId: authResult.organizationId },
    data: { isDefault: false },
  });

  const updated = await db.hostedPage.update({
    where: { id: page.id },
    data: { isDefault: true },
  });

  // Update the App listing from the new default
  const app = await db.app.findUnique({ where: { hostedPageSlug: slug } });
  if (app) {
    await db.app.update({
      where: { id: app.id },
      data: {
        name: updated.title,
        tagline: updated.tagline || updated.title,
      },
    });
  }

  revalidateSeoIndexes(slug);
  return NextResponse.json({
    message: `Locale "${locale}" is now the default for "${slug}"`,
    page: updated,
  });
}
