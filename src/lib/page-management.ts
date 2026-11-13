import { randomUUID } from "node:crypto";
import { Prisma, type HostedPage, type PrismaClient } from "@prisma/client";

export type PageStore = Prisma.TransactionClient;
const managementSelect = { id: true, organizationId: true, slug: true, parentSlug: true, locale: true,
  title: true, isPublished: true, removalState: true, removalSource: true, removedAt: true,
  removedById: true, removalBatchId: true, wasPublished: true } as const;
type ManagedPage = Prisma.HostedPageGetPayload<{ select: typeof managementSelect }>;
export type PageActor = { kind: "user" | "admin"; userId: string; organizationId: string | null };
export type PageAction = "unpublish" | "delete" | "restore";
export class PageManagementError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message = code) { super(message); this.status = status; this.code = code; }
}
export const logicalKey = (p: Pick<HostedPage, "organizationId" | "parentSlug" | "slug">) => JSON.stringify([p.organizationId, p.parentSlug, p.slug]);
export const treeKey = (p: Pick<HostedPage, "organizationId" | "parentSlug" | "slug">) => `${p.organizationId}:${p.parentSlug || p.slug}`;
export async function lockPageTrees(tx: PageStore, trees: readonly string[]) {
  for (const tree of [...new Set(trees)].sort()) {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${'hp-tree:' + tree}, 0))::text AS locked`;
  }
}
export function transition(page: Pick<HostedPage, "removalState" | "removalSource">, action: PageAction, actor: PageActor) {
  if (actor.kind !== "admin" && page.removalSource === "ADMIN") throw new PageManagementError(403, "admin_locked");
  if ((action === "restore" && !page.removalState) || (action === "unpublish" && page.removalState === "DELETED")) {
    throw new PageManagementError(409, "invalid_transition");
  }
  const state = action === "restore" ? null : action === "delete" ? "DELETED" : "UNPUBLISHED";
  const source = action === "restore" ? null : actor.kind === "admin" ? "ADMIN" : "OWNER";
  return { state, source, changed: state !== page.removalState || source !== page.removalSource };
}
export async function activeRootSlugs(tx: Pick<PageStore, "hostedPage">, organizationId: string) {
  return tx.hostedPage.groupBy({ by: ["slug"], where: { organizationId, parentSlug: null,
    OR: [{ removalState: null }, { removalState: { not: "DELETED" } }] } });
}
async function checkRestoreLimit(tx: PageStore, rows: ManagedPage[]) {
  for (const organizationId of new Set(rows.filter(p => !p.parentSlug && p.removalState === "DELETED").map(p => p.organizationId))) {
    const org = await tx.organization.findUniqueOrThrow({ where: { id: organizationId } });
    if (org.plan !== "FREE" || await tx.user.findFirst({ where: { organizationId, role: "ADMIN" } })) continue;
    const active = new Set((await activeRootSlugs(tx, organizationId)).map(p => p.slug));
    rows.filter(p => p.organizationId === organizationId && !p.parentSlug).forEach(p => active.add(p.slug));
    if (active.size > 3) throw new PageManagementError(403, "plan_limit");
  }
}
export type ManagementInput = { action: PageAction; targets: string[]; dryRun?: boolean; expected?: { pages: number; rows: number } };
export async function managePages(store: PrismaClient, actor: PageActor, input: ManagementInput) {
  if (!Array.isArray(input.targets) || input.targets.length < 1 || input.targets.length > 100) throw new PageManagementError(400, "invalid_targets");
  if (actor.kind !== "admin" && !actor.organizationId) throw new PageManagementError(403, "organization_required");
  return store.$transaction(async tx => {
    const requested = await tx.hostedPage.findMany({ where: { id: { in: input.targets }, ...(actor.kind === "admin" ? {} : { organizationId: actor.organizationId! }) }, select: managementSelect, orderBy: [{ slug: "asc" }, { locale: "asc" }] });
    if (requested.length !== new Set(input.targets).size) throw new PageManagementError(404, "not_found");
    await lockPageTrees(tx, requested.map(treeKey));
    // A target deleted/recreated while waiting cannot redirect this operation.
    const currentTargets = await tx.hostedPage.findMany({ where: { id: { in: input.targets }, ...(actor.kind === "admin" ? {} : { organizationId: actor.organizationId! }) }, select: managementSelect, orderBy: [{ slug: "asc" }, { locale: "asc" }] });
    if (currentTargets.length !== requested.length) throw new PageManagementError(404, "not_found");
    if (currentTargets.some(p => !requested.some(old => old.id === p.id && logicalKey(old) === logicalKey(p)))) throw new PageManagementError(409, "scope_changed");
    // Re-read and expand INSIDE the locks. All locale variants are one target.
    const trees = await tx.hostedPage.findMany({ where: { OR: requested.map(p => ({ organizationId: p.organizationId, OR: [{ slug: p.parentSlug || p.slug, parentSlug: null }, { parentSlug: p.parentSlug || p.slug }] })) }, select: managementSelect, orderBy: [{ slug: "asc" }, { locale: "asc" }] });
    const directKeys = new Set(requested.map(logicalKey));
    const direct = trees.filter(p => directKeys.has(logicalKey(p)));
    if (direct.length === 0) throw new PageManagementError(404, "not_found");
    const expanded = new Map(direct.map(p => [p.id, p]));
    const skipped: { id: string; slug: string; locale: string; reason: string }[] = [];
    const rootRows = direct.filter(p => !p.parentSlug);
    for (const child of trees.filter(p => p.parentSlug)) {
      const root = rootRows.find(r => r.organizationId === child.organizationId && r.slug === child.parentSlug);
      if (!root || expanded.has(child.id)) continue;
      if (input.action === "delete") {
        if (!child.removalState) expanded.set(child.id, child);
        else skipped.push({ id: child.id, slug: child.slug, locale: child.locale, reason: child.removalSource === "ADMIN" ? "admin_locked" : "already_removed" });
      } else if (input.action === "restore" && root.removalBatchId && root.removalBatchId === child.removalBatchId) expanded.set(child.id, child);
    }
    const rows = [...expanded.values()];
    if (rows.length + skipped.length > 1000) throw new PageManagementError(413, "batch_too_large");
    for (const row of rows) {
      if (actor.kind !== "admin" && row.organizationId !== actor.organizationId) throw new PageManagementError(404, "not_found");
      transition(row, input.action, actor);
      if (input.action === "restore" && row.parentSlug) {
        const deletedRoot = trees.find(r => r.organizationId === row.organizationId && r.slug === row.parentSlug && !r.parentSlug && r.removalState === "DELETED");
        if (deletedRoot && !expanded.has(deletedRoot.id)) throw new PageManagementError(409, "parent_removed");
      }
    }
    if (input.action === "restore") await checkRestoreLimit(tx, rows);
    const pages = new Set(rows.map(logicalKey)).size;
    const children = new Set(rows.filter(p => p.parentSlug && !directKeys.has(logicalKey(p))).map(logicalKey)).size;
    const scope = { pages, rows: rows.length, children, titles: [...new Map(rows.map(p => [logicalKey(p), p.title])).values()].slice(0, 10), skipped,
      includesRoot: rows.some(p => !p.parentSlug) };
    if (input.dryRun) return { ...scope, batchId: null };
    if (!input.expected || input.expected.pages !== pages || input.expected.rows !== rows.length) throw new PageManagementError(409, "scope_changed");
    const batchId = randomUUID();
    for (const row of rows) {
      const next = transition(row, input.action, actor);
      if (!next.changed) continue;
      // Capture isPublished in the SAME conditional UPDATE (never a stale read).
      const changed = input.action === "restore"
        ? await tx.$executeRaw`UPDATE "HostedPage" SET "isPublished"="wasPublished", "removalState"=NULL, "removalSource"=NULL, "removedAt"=NULL, "removedById"=NULL, "removalBatchId"=NULL, "wasPublished"=NULL, "updatedAt"=CURRENT_TIMESTAMP WHERE id=${row.id} AND "removalState"=${row.removalState} AND "removalBatchId"=${row.removalBatchId}`
        : row.removalState === null
          ? await tx.$executeRaw`UPDATE "HostedPage" SET "wasPublished"="isPublished", "isPublished"=false, "removalState"=${next.state}, "removalSource"=${next.source}, "removedAt"=CURRENT_TIMESTAMP, "removedById"=${actor.userId}, "removalBatchId"=${batchId}, "updatedAt"=CURRENT_TIMESTAMP WHERE id=${row.id} AND "removalState" IS NULL`
          : await tx.$executeRaw`UPDATE "HostedPage" SET "isPublished"=false, "removalState"=${next.state}, "removalSource"=${next.source}, "removedAt"=CURRENT_TIMESTAMP, "removedById"=${actor.userId}, "removalBatchId"=${batchId}, "updatedAt"=CURRENT_TIMESTAMP WHERE id=${row.id} AND "removalState"=${row.removalState} AND "removalBatchId"=${row.removalBatchId}`;
      if (changed !== 1) throw new PageManagementError(409, "scope_changed");
      await tx.hostedPageEvent.create({ data: { batchId, organizationId: row.organizationId, pageId: row.id, slug: row.slug,
        parentSlug: row.parentSlug, locale: row.locale, action: input.action, fromState: row.removalState, toState: next.state,
        actorKind: actor.kind, actorUserId: actor.userId } });
    }
    return { ...scope, batchId };
  }, { maxWait: 10000, timeout: 30000 });
}
