/** Root locale variants share one organization-owned slug namespace. */
export function slugOwnershipDecision(
  roots: readonly { organizationId: string }[],
  organizationId: string,
  parentSlug?: string | null,
): { status: 200 } | { status: 403; error: string } {
  return !parentSlug && roots.some((root) => root.organizationId !== organizationId)
    ? { status: 403, error: "Slug belongs to another organization" }
    : { status: 200 };
}
