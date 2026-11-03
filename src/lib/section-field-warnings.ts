import { COMMON_SECTION_FIELDS, getSectionDef } from "./template-registry.ts";
/** Informational only: publisher extensions must never block publishing. */
export function sectionFieldWarnings(sections: { type: string; data?: Record<string, unknown> }[]) {
  return sections.flatMap(section => {
    const fields = getSectionDef(section.type)?.fields;
    if (!fields?.length) return [];
    const known = [...fields, ...COMMON_SECTION_FIELDS].map(field => field.name);
    const images = section.data?.images;
    const screenshotWarnings = section.type === "screenshots" && Array.isArray(images) && images.some(image => typeof image === "string" || (image && typeof image === "object" && !("kind" in image && image.kind)))
      ? [{ path: "sections[screenshots].images", message: 'screenshots.images: set kind ("phone"|"web") plus width/height for the framed layout and no layout shift' }] : [];
    return [...screenshotWarnings, ...Object.keys(section.data || {}).filter(key => !known.includes(key)).map(key => ({
      path: `sections[${section.type}].${key}`,
      message: `unknown field "${key}" in ${section.type}; known fields: ${known.join(", ")}`,
    }))];
  });
}
