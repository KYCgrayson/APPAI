import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { validateApiKey } from "@/lib/api-auth";

/**
 * GET /api/v1/pages/:slug/children
 *
 * List all child pages of the given root page within the agent's organization.
 * Optional ?locale=en filters to a single locale variant per child.
 *
 * Returns 404 if the root page does not exist or is itself a child page.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const authResult = await validateApiKey(request.headers.get("authorization"));
  if (!authResult) {
    return NextResponse.json(
      { error: "Unauthorized. Provide a valid API key in the Authorization header: Bearer appai_sk_..." },
      { status: 401 }
    );
  }

  const { slug } = await params;
  const locale = request.nextUrl.searchParams.get("locale");

  // Verify the root page exists in this org and is itself a root.
  const root = await db.hostedPage.findFirst({
    where: {
      organizationId: authResult.organizationId,
      slug,
      parentSlug: null,
    },
    select: { id: true },
  });

  if (!root) {
    return NextResponse.json(
      { error: `Root page "${slug}" not found in your organization.` },
      { status: 404 }
    );
  }

  const children = await db.hostedPage.findMany({
    where: {
      organizationId: authResult.organizationId,
      parentSlug: slug,
      ...(locale ? { locale } : {}),
    },
    orderBy: [{ createdAt: "asc" }],
  });

  return NextResponse.json({ parentSlug: slug, children });
}
