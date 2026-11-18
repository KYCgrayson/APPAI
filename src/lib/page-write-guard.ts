import { randomUUID } from "node:crypto";
import type { HostedPage, Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { validateApiKey } from "@/lib/api-auth";
import { revalidateSeoIndexes } from "@/lib/revalidate-seo";
import { removalDto, toPageDto } from "./page-dto.ts";
import { lockPageTrees, treeKey, type PageStore } from "./page-management.ts";

class AbortedWrite { response: NextResponse; constructor(response: NextResponse) { this.response = response; } }

export class PageWriteConflict extends Error {
  page: HostedPage | null;
  constructor(page: HostedPage | null) { super("Page changed before the write"); this.page = page; }
}

/** Conditional writes must report a conflict, including removal after the initial read. */
export async function updateLivePage(tx: PageStore, page: HostedPage, data: Prisma.HostedPageUpdateManyMutationInput) {
  const { id, organizationId, slug, parentSlug, locale } = page;
  const result = await tx.hostedPage.updateMany({
    where: { id, organizationId, slug, parentSlug, locale, removalState: null }, data,
  });
  const current = await tx.hostedPage.findUnique({ where: { id } });
  if (result.count !== 1 || !current) throw new PageWriteConflict(current?.organizationId === organizationId ? current : null);
  return current;
}

export type PageApiActor = NonNullable<Awaited<ReturnType<typeof validateApiKey>>>;
type ApiActor = { organizationId: string; apiKeyId: string };
export function removalError(page: HostedPage, parent = false) {
  return { error: "This page was removed by its owner or an administrator.",
    code: parent ? "parent_removed_by_owner" : "removed_by_owner", retryable: false,
    requiredAction: "owner_restore_in_dashboard", removal: removalDto(page),
    hint: `Page "${page.slug}" (locale: ${page.locale}, parentSlug: ${page.parentSlug ?? "null"}, id: ${page.id}) was removed. Skip this page and its cards. Ask the owner to restore it in Dashboard; do not retry or delete and recreate it.` };
}
export async function recordAgentBlocked(page: HostedPage, actor: ApiActor) {
  await db.hostedPageEvent.create({ data: { batchId: randomUUID(), organizationId: page.organizationId,
    pageId: page.id, slug: page.slug, parentSlug: page.parentSlug, locale: page.locale,
    action: "agent_blocked", fromState: page.removalState, toState: page.removalState,
    actorKind: "apiKey", apiKeyId: actor.apiKeyId } });
}

/** One lock protocol for every page mutation, including creates and App rebindings. */
export async function withPageWrite(request: NextRequest, slug: string | null,
  operation: (tx: PageStore, actor: PageApiActor) => Promise<NextResponse>, options: { unpublish?: boolean; appId?: string; appCreate?: boolean } = {}) {
  const actor = await validateApiKey(request.headers.get("authorization"));
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let blocked: HostedPage | undefined;
  let parentBlocked = false;
  let refreshSlug: string | undefined;
  const run = async (tx: PageStore) => {
    const result = await operation(tx, actor);
    if (!result.ok) throw new AbortedWrite(result);
    return result;
  };
  let response: NextResponse;
  try {
    response = await db.$transaction(async tx => {
      let parentSlug: string | null = null;
      let targetLocale = request.nextUrl.searchParams.get("locale") || "en";
      let targetSlug = slug;
      if (options.appId || options.appCreate) {
        const app = options.appId ? await tx.app.findFirst({ where: { id: options.appId, organizationId: actor.organizationId } }) : null;
        if (options.appId && !app) return NextResponse.json({ error: "Not found" }, { status: 404 });
        const body = await request.clone().json().catch(() => ({}));
        const bindings = [app?.hostedPageSlug, body.hostedPageSlug].filter((s): s is string => typeof s === "string" && !!s);
        const pages = bindings.length ? await tx.hostedPage.findMany({ where: { organizationId: actor.organizationId, slug: { in: bindings } }, orderBy: [{ slug: "asc" }, { locale: "asc" }] }) : [];
        await lockPageTrees(tx, [...bindings.map(s => `${actor.organizationId}:${s}`), ...pages.map(treeKey)]);
        if (app) {
          const current = await tx.app.findFirst({ where: { id: app.id, organizationId: actor.organizationId } });
          if (!current || current.hostedPageSlug !== app.hostedPageSlug) return NextResponse.json({ error: "App binding changed; read it again.", code: "scope_changed" }, { status: 409 });
        }
        const removed = bindings.length ? await tx.hostedPage.findFirst({ where: { organizationId: actor.organizationId, slug: { in: bindings }, removalState: { not: null } }, orderBy: [{ slug: "asc" }, { locale: "asc" }] }) : null;
        if (removed) { blocked = removed; return NextResponse.json(removalError(removed), { status: 409 }); }
        return run(tx);
      }
      if (!targetSlug) {
        const body = await request.clone().json().catch(() => ({}));
        if (typeof body.slug !== "string") return run(tx);
        targetSlug = body.slug;
        targetLocale = typeof body.locale === "string" ? body.locale : "en";
        parentSlug = typeof body.parentSlug === "string" ? body.parentSlug : null;
      }
      const exact = await tx.hostedPage.findFirst({ where: { organizationId: actor.organizationId, slug: targetSlug!, locale: targetLocale } });
      const existing = exact || (slug ? await tx.hostedPage.findFirst({ where: { organizationId: actor.organizationId, slug: targetSlug! } }) : null);
      const logicalParent = existing ? existing.parentSlug : parentSlug;
      const rootSlug = logicalParent || targetSlug!;
      // POST reserves the slug across trees/locales, including a removed child's old URL.
      const sameSlug = slug === null ? await tx.hostedPage.findMany({ where: { organizationId: actor.organizationId, slug: targetSlug! }, orderBy: { locale: "asc" } }) : [];
      await lockPageTrees(tx, [treeKey({ organizationId: actor.organizationId, slug: rootSlug, parentSlug: null }), ...sameSlug.map(treeKey)]);
      refreshSlug = rootSlug;
      const current = await tx.hostedPage.findFirst({ where: { organizationId: actor.organizationId, slug: targetSlug!, locale: targetLocale } });
      if (current && current.parentSlug !== logicalParent) return NextResponse.json({ error: "Page tree changed; read it again.", code: "scope_changed" }, { status: 409 });
      const logical = await tx.hostedPage.findMany({ where: { organizationId: actor.organizationId, slug: targetSlug!, parentSlug: logicalParent }, orderBy: { locale: "asc" } });
      if (logical.some(p => (p.parentSlug || p.slug) !== rootSlug)) return NextResponse.json({ error: "Page tree changed; read it again.", code: "scope_changed" }, { status: 409 });
      blocked = slug === null
        ? await tx.hostedPage.findFirst({ where: { organizationId: actor.organizationId, slug: targetSlug!, removalState: { not: null } }, orderBy: { locale: "asc" } }) ?? undefined
        : logical.find(p => p.removalState);
      const creatingLocale = !logical.some(p => p.locale === targetLocale);
      const parent = logicalParent;
      if (!blocked && parent && slug === null && creatingLocale) {
        blocked = await tx.hostedPage.findFirst({ where: { organizationId: actor.organizationId, slug: parent, parentSlug: null, removalState: { not: null } } }) ?? undefined;
        parentBlocked = !!blocked;
      }
      if (blocked) {
        // Even the idempotent unpublish is observable in audit, but never changes the row.
        if (options.unpublish) {
          const row = logical.find(p => p.locale === (request.nextUrl.searchParams.get("locale") || "en"));
          return row ? NextResponse.json(toPageDto(row)) : NextResponse.json({ error: "Not found" }, { status: 404 });
        }
        return NextResponse.json(removalError(blocked, parentBlocked), { status: 409 });
      }
      return run(tx);
    }, { maxWait: 10000, timeout: 30000 });
  } catch (error) {
    if (error instanceof AbortedWrite) return error.response;
    if (error instanceof PageWriteConflict) {
      blocked = error.page?.removalState ? error.page : undefined;
      response = NextResponse.json(blocked ? removalError(blocked) : { error: "Page scope changed; read it again.", code: "scope_changed" }, { status: 409 });
    } else {
      console.error("Page write transaction failed", error);
      return NextResponse.json({ error: "Page write failed" }, { status: 500 });
    }
  }
  if (blocked) await recordAgentBlocked(blocked, actor);
  // Mutation callbacks do not invalidate caches: the transaction must commit first.
  if (!blocked && response.ok) revalidateSeoIndexes(refreshSlug || slug || undefined);
  return response;
}
