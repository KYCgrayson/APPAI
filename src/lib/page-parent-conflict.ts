/** Upsert cannot change an existing page's parent. Call only for owned pages. */
export function pageParentConflict(
  slug: string,
  locale: string,
  requestedParent?: string | null,
  existingParent?: string | null,
): { error: string; hint: string } | null {
  if ((requestedParent ?? null) === (existingParent ?? null)) return null;

  const location = existingParent == null ? "as a root page" : `as a child of "${existingParent}"`;
  return {
    error: `Page "${slug}" (locale "${locale}") already exists ${location}`,
    hint: `Reparenting is not supported. Use the existing parent, or DELETE /api/v1/pages/${slug}?locale=${locale} first, or choose a different slug.`,
  };
}
