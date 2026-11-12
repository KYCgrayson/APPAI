import type { Prisma } from "@prisma/client";

export interface VisibilityPage {
  organizationId: string;
  slug: string;
  parentSlug: string | null;
  isPublished: boolean;
}

export const publicRootSelect = {
  organizationId: true, slug: true, parentSlug: true, isPublished: true,
} as const;

/** Root publication is independent of locale: any published root row suffices. */
export function isPublicChild(page: VisibilityPage, roots: readonly VisibilityPage[]): boolean {
  return page.isPublished && (page.parentSlug === null || roots.some(root => root.isPublished
    && root.parentSlug === null && root.slug === page.parentSlug
    && root.organizationId === page.organizationId));
}

function rootGroups(roots: readonly VisibilityPage[]) {
  const groups = new Map<string, Set<string>>();
  for (const root of roots) {
    if (!root.isPublished || root.parentSlug !== null) continue;
    if (!groups.has(root.organizationId)) groups.set(root.organizationId, new Set());
    groups.get(root.organizationId)!.add(root.slug);
  }
  return [...groups].map(([organizationId, slugs]) => ({ organizationId, slugs: [...slugs] }));
}

/** With no roots supplied, select public roots only. Apply before count/take. */
export function publicPageWhere(roots?: readonly VisibilityPage[]): Prisma.HostedPageWhereInput {
  if (!roots) return { isPublished: true, parentSlug: null };
  return {
    isPublished: true,
    OR: [{ parentSlug: null }, ...rootGroups(roots).map(({ organizationId, slugs }) => ({
      organizationId, parentSlug: { in: slugs },
    }))],
  };
}

/** Empty bindings retain the standalone App behavior. Approval is always required. */
export function publicAppFilter(roots: readonly VisibilityPage[]): Prisma.AppWhereInput {
  return {
    isApproved: true,
    OR: [{ hostedPageSlug: null }, { hostedPageSlug: "" },
      ...rootGroups(roots).map(({ organizationId, slugs }) => ({
        organizationId, hostedPageSlug: { in: slugs },
      }))],
  };
}
