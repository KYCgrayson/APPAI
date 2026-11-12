// Fictional, deterministic PR-5a fixtures. No database or personal data.
export const PR5_NOW = new Date("2026-11-12T00:00:00.000Z");
export const ago = (days: number) => new Date(PR5_NOW.getTime() - days * 86_400_000);
export function page(slug: string, overrides: Record<string, unknown> = {}) {
  return {
    id: `${slug}-en`, organizationId: "org-a", slug, parentSlug: null, locale: "en", isDefault: true,
    title: slug, tagline: "Fixture page", template: "APP_LANDING", isPublished: true,
    createdAt: ago(10), updatedAt: ago(1), privacyPolicy: "Fixture privacy", termsOfService: "Fixture terms",
    content: { sections: [{ type: "about", order: 0, data: { text: "Fixture content" } }] },
    headerLogo: null, heroImage: null, canonicalUrl: null, customCss: null, darkMode: false,
    themeColor: "#123456", fontFamily: null, hideFromNav: false, navOrder: null,
    ...overrides,
  };
}
export function app(id: string, hostedPageSlug: string | null, overrides: Record<string, unknown> = {}) {
  return { id, hostedPageSlug, organizationId: "org-a", isApproved: true, isFeatured: true,
    name: `App ${id}`, tagline: "Fixture app", description: "Fixture description", category: "OTHER", tags: [],
    screenshots: [], logoUrl: null, appType: null, createdAt: ago(10), updatedAt: ago(1), ...overrides };
}
export const f0Pages = ["en", "zh-TW", "zh-CN"].flatMap((locale, index) => [
  page("f0", { id: `f0-${locale}`, locale, isDefault: index === 0 }),
  page("f0-faq", { id: `f0-faq-${locale}`, parentSlug: "f0", locale, isDefault: index === 0 }),
]);
export const f0Urls = ["", "/zh-TW", "/zh-CN"].flatMap(locale => [
  `/p/f0${locale}`, `/p/f0${locale}/f0-faq`, `/p/f0${locale}/privacy`, `/p/f0${locale}/terms`,
]);
export const f0Apps = [app("f0-hosted", "f0"), app("f0-universal", null, { appType: "fixture" })];
export const interactionContent = { sections: [
  { type: "form", order: 1, data: { fields: [{ type: "text", name: "message", label: "Message" }], submitTo: "https://example.com/webhook" } },
  { type: "simple-order", order: 2, data: { notificationEmail: "orders@example.com", paymentUrl: "https://example.com/pay" } },
  { type: "iframe-tool", order: 3, data: { src: "https://fixture.pages.dev", identity: true } },
] };
export const f1Pages = [
  page("live", { content: interactionContent }), page("draft", { isPublished: false }),
  page("live-child", { parentSlug: "live", content: interactionContent }),
  page("hidden-child", { parentSlug: "draft", content: interactionContent }),
  page("foreign", { organizationId: "org-b", content: interactionContent }),
  page("wrong-org-child", { parentSlug: "foreign", content: interactionContent }),
  page("orphan", { parentSlug: "missing", content: interactionContent }),
  page("draft-child", { parentSlug: "live", isPublished: false, content: interactionContent }),
];
export const f1Apps = [app("live-app", "live"), app("hidden-app", "draft"), app("foreign-app", "foreign"),
  app("child-bound-app", "live-child"), app("standalone", null, { appType: "fixture" }), app("empty", ""),
  app("unapproved", "live", { isApproved: false }), app("missing", "missing")];
export const f1Expected = {
  pages: ["live", "live-child", "foreign"],
  roots: ["live", "foreign"],
  apps: ["live-app", "standalone", "empty"],
  interactive: ["live", "live-child", "foreign"],
};
export function f2Pages(large = false) {
  const rows = [];
  const locales = ["en", "ja", "fr"];
  const root = large ? "large" : "recent";
  for (const locale of locales) rows.push(page(root, { id: `${root}-${locale}`, locale, isDefault: locale === "en", createdAt: ago(120), title: "Older root" }));
  for (let index = 0; index < (large ? 250 : 60); index++) for (const locale of locales) {
    const slug = `${root}-${String(index).padStart(3, "0")}`;
    rows.push(page(slug, { id: `${slug}-${locale}`, parentSlug: root, locale, isDefault: locale === "en",
      title: locale === "ja" ? `Translated ${index}` : `Child ${index}`,
      createdAt: ago(large ? 1 : index * 2) }));
  }
  rows.push(page("interference", { organizationId: "org-b", createdAt: ago(1) }));
  return rows;
}
