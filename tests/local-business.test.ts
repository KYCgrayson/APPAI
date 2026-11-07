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
  assert.ok(isBusinessHours({ ...hours, note: "x".repeat(200) }));
  for (const bad of [{ ...hours, days: [] }, { ...hours, days: ["Monday"] }, { ...hours, open: "24:00" }, { ...hours, close: "12:60" }, { ...hours, open: "9:00" }, { ...hours, note: 3 }, { ...hours, note: "x".repeat(201) }, { ...hours, close: hours.open }, null]) {
    assert.equal(isBusinessHours(bad), false);
    assert.equal(createPageSchema.safeParse({ ...page, content: { sections: [{ type: "contact", data: { hours: [bad] } }] } }).success, false);
    assert.deepEqual(sanitizeContent({ type: "contact", data: { hours: [bad] } }), { type: "contact", data: { hours: [] } });
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
test("sanitization scopes hours and price to their section fields", () => {
  const about = { type: "about", data: { hours: "Mon-Fri 9-5", price: "x".repeat(41) } };
  assert.deepEqual(sanitizeContent(about), about);
  assert.deepEqual(sanitizeContent({ type: "contact", data: { hours: [{ ...hours, days: ["mon", "mon"] }] } }),
    { type: "contact", data: { hours: [{ ...hours, days: ["mon"] }] } });
  assert.equal(createPageSchema.safeParse({ ...page, content: { sections: [{ type: "features", data: { items: [{ price: "x".repeat(40) }] } }] } }).success, true);
  for (const price of ["x".repeat(41), 123]) {
    const content = { sections: [{ type: "features", data: { items: [{ title: "Tea", price }] } }] };
    assert.equal(createPageSchema.safeParse({ ...page, content }).success, false);
    const sanitized = sanitizeContent(content) as typeof content;
    assert.equal(sanitized.sections[0].data.items[0].price, typeof price === "string" ? price.slice(0, 40) : undefined);
  }
});
test("LocalBusiness requires a business template/preset or hours and cleans contact text", () => {
  const graph = (template: string, data: unknown, preset?: string) => buildJsonLd({ ...page, template, preset, content: { sections: [{ type: "contact", data }] } }, "https://example.com", "https://example.com", null)["@graph"];
  for (const template of ["PERSON", "APP_LANDING", "PORTFOLIO"]) assert.equal(graph(template, { address: "Demo" }).length, 1);
  assert.equal(graph("COMPANY_PROFILE", { address: "<b>Demo</b>", phone: "**123**" })[1].address, "Demo");
  assert.equal(graph("COMPANY_PROFILE", { address: {}, phone: 123 })[1].telephone, undefined);
  assert.equal(graph("COMPANY_PROFILE", { address: {}, phone: 123 })[1].address, undefined);
  assert.equal(graph("PERSON", { hours: [] }).length, 2);
  assert.equal(graph("APP_LANDING", {}, "company-service").length, 2);
});
test("map links use localized labels, English fallback and strictly true opt-in", () => {
  const render = (locale: string, map: unknown) => renderToStaticMarkup(createElement(ContactSection, { themeColor: "#123456", locale, data: { address: "Demo", map: map as boolean } }));
  assert.match(render("fr", true), /Ouvrir dans Google Maps/);
  assert.match(render("zh-TW", true), /在 Apple Maps 中開啟/);
  assert.match(render("xx", true), /Open in Google Maps/);
  for (const value of ["true", 1, false, undefined]) assert.doesNotMatch(render("en", value), /maps\.apple|google\.com\/maps/);
});
test("legacy Instagram matching requires the actual Instagram host", () => {
  for (const host of ["instagram.com", "www.instagram.com"]) {
    for (const scheme of ["http", "https"]) {
      for (const path of ["p/X", "reel/Ab_C-123/trailing?igsh=demo", "p/X/extra"]) {
        const url = `${scheme}://${host}/${path}`;
        assert.deepEqual(detectProvider(url), { kind: "instagram", url: url.replace(/^http:/, "https:") });
      }
    }
  }
  for (const url of ["https://other.example/instagram.com/p/X", "https://instagram.com.evil.example/p/X", "https://fakeinstagram.com/p/X", "https://other.example/?url=https://instagram.com/reel/X"]) {
    assert.equal(detectProvider(url), null, url);
    assert.doesNotMatch(renderToStaticMarkup(createElement(EmbedSection, { themeColor: "#123456", data: { url } })), /<iframe/);
  }
});
test.after(() => hooks.deregister());
