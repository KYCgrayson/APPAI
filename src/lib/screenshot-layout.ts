/** Editorial sections opt the whole page into framed screenshots. */
export function usesEditorialScreenshots(sections: { type: string }[]): boolean {
  return sections.some(section => ["profile-header", "project-cards", "entries"].includes(section.type));
}

/** Legacy pages retain their original heading and numbered image descriptions. */
export function legacyScreenshotContent(data: { heading?: string; images?: (string | { url: string; alt?: string })[] }) {
  return {
    heading: data.heading ?? "Screenshots",
    images: (Array.isArray(data.images) ? data.images : []).flatMap((item, index) => {
      if (typeof item !== "string" && (!item || typeof item !== "object" || typeof item.url !== "string")) return [];
      return [{
      url: typeof item === "string" ? item : item.url,
      alt: (typeof item === "string" ? "" : item.alt) || `Screenshot ${index + 1}`,
    }];
    }),
  };
}
