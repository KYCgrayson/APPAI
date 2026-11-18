/** Hero media is intentionally variant-specific; root and child pages share this rule. */
export function heroMediaWarnings(content: unknown) {
  const sections = (content as { sections?: unknown } | null)?.sections;
  if (!Array.isArray(sections)) return [];
  return sections.flatMap((section, index) => {
    if (section?.type !== "hero") return [];
    const data = section.data ?? {};
    const warnings: { path: string; message: string }[] = [];
    const warn = (field: string, message: string) => warnings.push({ path: `content.sections[${index}].data.${field}`, message });
    for (const field of ["backgroundImage", "backgroundVideo"]) {
      if (data[field] === undefined) continue;
      if (data.variant === "minimal" || field === "backgroundVideo" && data.variant === "split") {
        warn(field, `hero variant "${data.variant}" ignores ${field}. Use "centered" for background media or "split" for a right-side backgroundImage.`);
      } else if (field === "backgroundImage" && data.backgroundVideo && data.variant !== "split") {
        warn(field, "hero backgroundVideo takes precedence over backgroundImage in the centered variant. Remove backgroundVideo to show the image.");
      }
      const url = typeof data[field] === "string" ? data[field].trim() : "";
      let https = false;
      try { const parsed = new URL(url); https = parsed.protocol === "https:" && !!parsed.hostname; } catch { /* Report below, without fetching. */ }
      const relative = /^\/(?![\/\\])/.test(url) && !/[\\\r\n\t]/.test(url);
      if (!https && !relative) {
        warn(field, "Hero media must use an HTTPS URL or same-origin /path; other sources may be sanitized or blocked by the hosted-page CSP. YouTube thumbnail HTTPS URLs are allowed; watch URLs belong in a video section.");
      }
    }
    for (const field of ["image", "background", "backgroundUrl", "imageUrl"]) {
      if (data[field] !== undefined) warn(field, `hero ignores ${field}; use data.backgroundImage with variant "centered" or "split".`);
    }
    return warnings;
  });
}
