import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { registerHostedRenderLoader } from "./helpers/hosted-render-loader.mjs";
const hooks = registerHostedRenderLoader();
const { ContactSection } = await import("../src/templates/sections/ContactSection.tsx");
const { FeaturesSection } = await import("../src/templates/app-landing/sections/FeaturesSection.tsx");
const { detectProvider, buildEmbed, EmbedSection } = await import("../src/templates/sections/EmbedSection.tsx");
const { isBusinessHours, formatBusinessHours, mapLinks } = await import("../src/lib/business-hours.ts");
const { sanitizeContent } = await import("../src/lib/sanitize.ts");
const { buildJsonLd } = await import("../src/lib/hosted-page-seo.ts");
const { serializeJsonLd } = await import("../src/lib/json-ld.ts");
const { createPageSchema } = await import("../src/lib/validations/page.ts");
const { PRESET_DEFS } = await import("../src/lib/template-registry.ts");
const hours = { days: ["mon", "fri"] as ("mon" | "fri")[], open: "09:00", close: "17:30" };
const page = { slug: "cafe-demo", title: "Demo </script>\u2028\u2029", content: { logo: "https://example.com/logo.png", sections: [{ type: "contact", data: { address: "Example & Place", phone: "demo", hours: [hours], socials: [{ platform: "instagram", url: "https://example.com/profile" }, { platform: "website", url: "javascript:alert(1)" }] } }] } };
test("hours reject malformed days/times in publication and sanitizer", () => {
  assert.ok(isBusinessHours(hours));
  for (const bad of [{ ...hours, days: [] }, { ...hours, days: ["Monday"] }, { ...hours, open: "24:00" }, { ...hours, close: "12:60" }, { ...hours, open: "9:00" }, { ...hours, note: 3 }, null]) {
    assert.equal(isBusinessHours(bad), false);
    assert.equal(createPageSchema.safeParse({ ...page, content: { sections: [{ type: "contact", data: { hours: [bad] } }] } }).success, false);
    assert.deepEqual(sanitizeContent({ hours: [bad] }), { hours: [] });
  }
  assert.equal(createPageSchema.safeParse(page).success, true);
  assert.deepEqual(sanitizeContent({ socials: [{ url: "javascript:alert(1)" }] }), { socials: [{ url: "#" }] });
});
test("contact renders localized hours, notes and opt-in encoded map links", () => {
  assert.match(formatBusinessHours(hours, "fr"), /lundi, vendredi/);
  const html = renderToStaticMarkup(createElement(ContactSection, { themeColor: "#047857", locale: "fr", data: { hours: [hours], note: "Holiday closures", address: "A & B #1", map: true } }));
  assert.match(html, /lundi, vendredi: 09:00–17:30/);
  assert.match(html, /Holiday closures/);
  assert.ok(html.includes(mapLinks("A & B #1").google.replaceAll("&", "&amp;")));
  assert.ok(html.includes(mapLinks("A & B #1").apple));
  const legacy = renderToStaticMarkup(createElement(ContactSection, { themeColor: "#047857", data: { address: "Demo" } }));
  assert.doesNotMatch(legacy, /maps|<ul/);
});
test("LocalBusiness graph uses safe URLs and existing script escaping", () => {
  const graph = buildJsonLd(page, "https://appai.info/p/cafe-demo", "https://appai.info", null);
  const business = graph["@graph"].find(item => item["@type"] === "LocalBusiness");
  assert.equal(business.name, page.title);
  assert.equal(business.address, "Example & Place");
  assert.equal(business.telephone, "demo");
  assert.equal(business.image, page.content.logo);
  assert.deepEqual(business.sameAs, ["https://example.com/profile"]);
  assert.deepEqual(business.openingHoursSpecification[0], { "@type": "OpeningHoursSpecification", dayOfWeek: ["https://schema.org/Monday", "https://schema.org/Friday"], opens: "09:00", closes: "17:30" });
  const serialized = serializeJsonLd(graph);
  assert.doesNotMatch(serialized, /<\/script>|\u2028|\u2029/);
  assert.match(serialized, /\\u003c\/script\\u003e\\u2028\\u2029/);
  assert.deepEqual(JSON.parse(serialized), JSON.parse(JSON.stringify(graph)));
  assert.equal(buildJsonLd({ ...page, content: { sections: [] } }, "https://example.com", "https://example.com", null)["@graph"].length, 1);
});
test("feature prices appear next to titles only when supplied", () => {
  const html = renderToStaticMarkup(createElement(FeaturesSection, { themeColor: "#047857", data: { items: [{ title: "Tea", description: "Demo", price: "NT$140" }] } }));
  assert.match(html, /Tea<span[^>]*>NT\$140<\/span><\/h3>/);
  const legacy = renderToStaticMarkup(createElement(FeaturesSection, { themeColor: "#047857", data: { items: [{ title: "Tea", description: "Demo" }] } }));
  assert.match(legacy, />Tea<\/h3>/);
  assert.doesNotMatch(legacy, /whitespace-nowrap/);
});
test("Instagram post and reel URLs preserve parsing and use the shared official iframe", () => {
  for (const kind of ["p", "reel"]) {
    const provider = detectProvider(`https://www.instagram.com/${kind}/Ab_C-123/?igsh=demo`);
    assert.equal(provider?.kind, "instagram");
    assert.equal(buildEmbed(provider!).src, `https://www.instagram.com/${kind}/Ab_C-123/embed`);
    const html = renderToStaticMarkup(createElement(EmbedSection, { themeColor: "#047857", data: { url: `https://instagram.com/${kind}/Ab_C-123/` } }));
    assert.match(html, /<iframe/);
    assert.match(html, /sandbox="allow-scripts allow-same-origin allow-popups allow-presentation allow-forms"/);
  }
});
test("company-service preset alternates forest backgrounds starting with white", () => {
  const preset = PRESET_DEFS.find(p => p.id === "company-service")!;
  (preset.example.content as { sections: { type: string; data: { backgroundColor?: string } }[] }).sections.forEach((section, index) => {
    if (section.type !== "cta") assert.equal(section.data.backgroundColor, ["#FFFFFF", "#ECFDF5"][index % 2]);
  });
});
test.after(() => hooks.deregister());
