/** Approval fields for a new listing or an existing App-owning page variant. */
export function hostedPageApprovalUpdate(
  template: string,
  previous?: { template: string; isDefault: boolean; parentSlug: string | null },
  hadPersonRoot = false,
): { isApproved?: boolean } {
  if (template === "GAME" && !previous?.parentSlug) return { isApproved: false };
  if (!previous) return { isApproved: template !== "PERSON" };
  return !hadPersonRoot && !previous.parentSlug
    && previous.template !== "PERSON" && template === "PERSON"
    ? { isApproved: false }
    : {};
}
