import { COMMON_SECTION_FIELDS, getSectionDef } from "./template-registry.ts";
import { normalizeHostedContent } from "./hosted-content.ts";

/** Match the public renderer: empty sections get a legacy hero; prose demotes H1s. */
export function pageHeadingWarnings(content: unknown, template?: string) {
  const { sections } = normalizeHostedContent(content);
  const count = (template === "GAME" ? 1 : 0) + (sections.length === 0 ? (template === "GAME" ? 0 : 1) : sections.filter(section => {
    if (section.data.access === "login" || section.data.access === "admin") return false;
    return section.type === "hero" || (section.type === "profile-header"
      && typeof section.data.name === "string" && Boolean(section.data.name.trim()));
  }).length);
  return count === 1 ? [] : [{
    path: "content.sections",
    message: `The public page renders ${count} H1 headings; aim for exactly one. ${count === 0 ? "Add a hero or a named profile-header section." : template === "GAME" ? "GAME already supplies the title H1; use section headings instead of hero/profile-header H1s." : "Keep one hero or named profile-header and use section headings for the rest."}`,
  }];
}

/** Informational only: publisher extensions must never block publishing. */
export function sectionFieldWarnings(sections: { type: string; data?: Record<string, unknown> }[]) {
  return sections.flatMap((section, index) => {
    if (!section || typeof section !== "object") return [];
    const fields = getSectionDef(section.type)?.fields;
    if (!fields?.length) return [];
    const known = [...fields, ...COMMON_SECTION_FIELDS].map(field => field.name);
    const images = section.data?.images;
    const screenshotWarnings = section.type === "screenshots" && Array.isArray(images) && images.some(image => typeof image === "string" || (image && typeof image === "object" && !("kind" in image && image.kind)))
      ? [{ path: `sections[${index}](screenshots).images`, message: 'screenshots.images: set kind ("phone"|"web") plus width/height for the framed layout and no layout shift' }] : [];
    return [...screenshotWarnings, ...Object.keys(section.data || {}).filter(key => !known.includes(key)).map(key => ({
      path: `sections[${index}](${section.type}).${key}`,
      message: `unknown field "${key}" in ${section.type}; known fields: ${known.join(", ")}`,
    }))];
  });
}
