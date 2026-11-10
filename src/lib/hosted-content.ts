import { COMMON_SECTION_FIELDS, getSectionDef, type SectionFieldDef } from "./template-registry.ts";

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
export type HostedSection = { type: string; order?: number; id?: string; data: Record<string, unknown> };
/** Structural normalization only: valid section objects/data retain their identity. */
export function normalizeHostedContent(value: unknown): Record<string, unknown> & { sections: HostedSection[] } {
  const content = isRecord(value) ? value : {};
  const sections = Array.isArray(content.sections) ? content.sections.flatMap(section => {
    if (!isRecord(section) || typeof section.type !== "string") return [];
    const data = normalizeFields(isRecord(section.data) ? section.data : {}, [...(getSectionDef(section.type)?.fields ?? []), ...COMMON_SECTION_FIELDS]);
    if (data === section.data && (section.order === undefined || typeof section.order === "number" && Number.isFinite(section.order))
      && (section.id === undefined || typeof section.id === "string")) return [section as HostedSection];
    return [{ ...section, type: section.type, order: (typeof section.order === "number" || typeof section.order === "string") && Number.isFinite(Number(section.order)) ? Number(section.order) : undefined,
      id: typeof section.id === "string" ? section.id : undefined,
      data }];
  }) : [];
  return { ...content, sections };
}

/** Render order and fallback section numbers shared by rendering and session renewal. */
export function orderedHostedSections(value: unknown): (HostedSection & { order: number })[] {
  return [...normalizeHostedContent(value).sections]
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((section, index) => ({ ...section, order: section.order ?? index }));
}
/** Repair only known crash-prone lists and numeric text; never validate publication rules here. */
function normalizeFields(data: Record<string, unknown>, fields: SectionFieldDef[]): Record<string, unknown> {
  let result = data;
  const set = (key: string, value: unknown) => {
    if (value !== data[key]) { if (result === data) result = { ...data }; result[key] = value; }
  };
  for (const field of fields) {
    const value = data[field.name];
    if (value == null) continue;
    if (field.type === "array") {
      set(field.name, Array.isArray(value) ? value.flatMap(item => {
        const itemFields = field.items?.length ? field.items : field.name === "options" ? [{ name: "label", type: "string" as const, required: false, description: "Option text" }, { name: "value", type: "string" as const, required: false, description: "Option text" }] : undefined;
        if (itemFields) {
          if (field.allowStringItems && typeof item === "string") return [item];
          return isRecord(item) ? [normalizeFields(item, itemFields)] : [];
        }
        return typeof item === "number" ? [String(item)] : item == null || typeof item === "object" ? [] : [item];
      }) : []);
    } else if (field.type === "object" && isRecord(value) && field.fields) {
      set(field.name, normalizeFields(value, field.fields));
    } else if (field.type === "string" && typeof value === "number") set(field.name, String(value));
  }
  return result;
}
export function contentString(value: unknown): string | undefined {
  return typeof value === "string" && value ? value : undefined;
}
