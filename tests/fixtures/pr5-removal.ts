import { page, PR5_NOW } from "./pr5-pages.ts";
export const owner = { kind: "user" as const, userId: "owner", organizationId: "org-a" };
export const admin = { kind: "admin" as const, userId: "admin", organizationId: null };
export function managedPage(slug: string, overrides: Record<string, unknown> = {}) {
  return page(slug, { removalState: null, removalSource: null, removedAt: null, removedById: null, removalBatchId: null, wasPublished: null, ...overrides });
}
export function removedPage(slug: string, state = "UNPUBLISHED", source = "OWNER", overrides: Record<string, unknown> = {}) {
  return managedPage(slug, { removalState: state, removalSource: source, removedAt: PR5_NOW, removedById: source === "ADMIN" ? "admin" : "owner", removalBatchId: `original-${slug}`, wasPublished: true, isPublished: false, ...overrides });
}
export function restoreTree() {
  return [managedPage("tree"), managedPage("c1", { parentSlug: "tree", isPublished: false }),
    removedPage("c2", "UNPUBLISHED", "OWNER", { parentSlug: "tree" }),
    removedPage("c3", "DELETED", "ADMIN", { parentSlug: "tree" }),
    managedPage("c4", { parentSlug: "tree" }), managedPage("c5", { parentSlug: "tree" })];
}
export const localeEdge = [managedPage("locale-root"), managedPage("locale-root", { id: "root-ja", locale: "ja", isDefault: false, isPublished: false }),
  managedPage("locale-child", { parentSlug: "locale-root" }), managedPage("locale-child", { id: "child-ja", locale: "ja", isDefault: false, parentSlug: "locale-root" })];
