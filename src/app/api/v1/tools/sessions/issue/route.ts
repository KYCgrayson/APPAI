import { isPublicChild, publicPageWhere, publicRootSelect } from "@/lib/hosted-page-visibility";
import { orderedHostedSections } from "@/lib/hosted-content";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { issueIframeToolSession } from "@/lib/iframe-tool-session";
import { decideSectionAccess, sectionWantsIdentity } from "@/lib/iframe-tool-session-contract";

/**
 * `POST /api/v1/tools/sessions/issue`
 *
 * Reissues the `appai_session` for one already-rendered `iframe-tool` section,
 * for the visitor's own browser. Tool sessions are short-lived on purpose, and
 * a tool that is mid-job should not have to reload — and lose its state — to
 * stay signed in. The embedding page calls this and posts the new token into
 * the iframe.
 *
 * Same-origin and cookie-authenticated: it mints only for whoever is asking,
 * so it can hand out nothing the page render would not have handed out anyway.
 * Third-party tools do not call this; they call `introspect`.
 */

export const dynamic = "force-dynamic";

const issueSchema = z.object({
  pageId: z.string().min(1).max(64),
  section: z.number().int().min(0).max(1000),
}).strict();

const noStore = { "Cache-Control": "no-store" };

export async function POST(request: NextRequest) {
  const parsed = issueSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400, headers: noStore });
  }

  const session = await auth();
  const userId = session?.user?.id ?? null;
  const isAdmin = ((session as unknown as { role?: string })?.role ?? "USER") === "ADMIN";

  const page = await db.hostedPage.findFirst({
    where: { id: parsed.data.pageId },
    select: { ...publicRootSelect, id: true, content: true },
  });
  if (!page) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404, headers: noStore });

  const roots = page.parentSlug ? await db.hostedPage.findMany({
    where: { ...publicPageWhere(), slug: page.parentSlug, organizationId: page.organizationId }, select: publicRootSelect,
    orderBy: [{ slug: "asc" }, { locale: "asc" }],
  }) : [];
  if (!isPublicChild(page, roots)) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404, headers: noStore });

  const section = orderedHostedSections(page.content).find(s => s.order === parsed.data.section);
  if (!section || section.type !== "iframe-tool" || !sectionWantsIdentity(section.data)) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404, headers: noStore });
  }

  // The same gate the page render applies. A section the visitor may not see is
  // not a section they may hold a token for.
  if (decideSectionAccess(section.data?.access, { isLoggedIn: !!userId, isAdmin }) !== "render") {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403, headers: noStore });
  }

  const source = section.data?.src;
  const src = typeof source === "string" ? source : null;
  const grant = src
    ? issueIframeToolSession({ src, slug: page.slug, section: parsed.data.section, userId })
    : null;
  if (!grant) {
    return NextResponse.json({ error: "UNAVAILABLE" }, { status: 503, headers: noStore });
  }

  return NextResponse.json(
    { token: grant.token, expiresAt: grant.expiresAt.toISOString() },
    { headers: noStore },
  );
}
