export type BreadcrumbItem = { name: string; href: string };

/** The same items drive visible navigation and structured data. */
export function breadcrumbJsonLd(items: readonly BreadcrumbItem[], origin: string) {
  if (items.length < 2) return null;
  return {
    "@type": "BreadcrumbList",
    itemListElement: items.map(({ name, href }, index) => ({
      "@type": "ListItem", position: index + 1, name, item: new URL(href, origin).href,
    })),
  };
}
