import { DIRECTORY_KINDS, UNIVERSAL_APP_CATEGORIES, type DirectoryKind } from "./directory-taxonomy.ts";

const categories: ReadonlySet<string> = new Set(UNIVERSAL_APP_CATEGORIES);

export function directoryKind(value: string | null | undefined) {
  return DIRECTORY_KINDS.find(kind => kind === value);
}

function singleParam(query: URLSearchParams, name: string) {
  const values = query.getAll(name);
  return values.length > 1 ? undefined : values[0] ?? null;
}

export function directoryRewritePath(section: DirectoryKind, query: URLSearchParams) {
  const category = singleParam(query, "category");
  // Ambiguous or unknown categories share the section's unfiltered page.
  if (category === undefined || (category && category !== "ALL" && !categories.has(category))) {
    return `/${section}`;
  }
  if (section === "websites" && singleParam(query, "type") === "personal") {
    return "/directory-filtered/websites/personal";
  }

  const kind = section === "apps" ? directoryKind(singleParam(query, "kind")) : undefined;
  const activeCategory = category || "ALL";
  if (activeCategory === "ALL") {
    if (!kind) return `/${section}`;
    if (kind === "apps") return "/apps/native";
  }
  const filter = kind ? `${kind}-${activeCategory}` : activeCategory;
  return `/directory-filtered/${section}/${filter}`;
}

// Validate the internal ISR params before asking the catalog for data.
export function directoryFilter(section: DirectoryKind, filter: string) {
  if (section === "websites" && filter === "personal") {
    return { kind: section, personalOnly: true };
  }
  if (categories.has(filter)) {
    return { kind: section === "apps" ? undefined : section, category: filter };
  }
  if (section === "apps") {
    for (const kind of DIRECTORY_KINDS) {
      if (!filter.startsWith(`${kind}-`)) continue;
      const category = filter.slice(kind.length + 1);
      if (categories.has(category) || (category === "ALL" && kind !== "apps")) {
        return { kind, category };
      }
    }
  }
}
