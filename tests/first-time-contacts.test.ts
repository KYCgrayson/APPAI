import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { registerHostedRenderLoader } from "./helpers/hosted-render-loader.mjs";

const hooks = registerHostedRenderLoader();
const { ContactSection } = await import("../src/templates/sections/ContactSection.tsx");
const { LinksSection } = await import("../src/templates/sections/LinksSection.tsx");
const { sanitizeContent, sanitizeSocialUrl } = await import("../src/lib/sanitize.ts");
const { SECTION_DEFS, PRESET_DEFS } = await import("../src/lib/template-registry.ts");
const { ICON_PATHS } = await import("../src/components/ui/icon-data.ts");

test("social links render supplied text or platform names and omit unsafe URLs", () => {
  const html = renderToStaticMarkup(createElement(ContactSection, { themeColor: "#123456", data: { socials: [
    { platform: "instagram", url: "https://ig.me/m/example", label: "Book by DM" },
    { platform: "line", url: "https://line.me/ti/p/~example" },
    { platform: "website", url: "javascript:alert(1)" },
    { platform: "website", url: "data:text/html,bad" },
  ] } }));
  assert.match(html, /href="https:\/\/ig.me\/m\/example"/);
  assert.match(html, /Book by DM/);
  assert.match(html, />LINE<\/a>/);
  assert.match(html, /aria-hidden="true"/);
  assert.match(html, /rel="noopener noreferrer"/);
  assert.doesNotMatch(html, /javascript:|data:text/);
});

test("social sanitizer enforces HTTPS including nested contact content", () => {
  for (const url of ["javascript:alert(1)", "data:text/html,bad", "http://example.com", "line://example", "//example.com", "/path"]) {
    assert.equal(sanitizeSocialUrl(url), "#");
    const content = sanitizeContent({ sections: [{ type: "contact", data: { socials: [{ platform: "line", url }] } }] }) as any;
    assert.equal(content.sections[0].data.socials[0].url, "#");
  }
  assert.equal(sanitizeSocialUrl("https://line.me/ti/p/~example"), "https://line.me/ti/p/~example");
});

test("links headings render with typography and are discoverable", () => {
  const html = renderToStaticMarkup(createElement(LinksSection, { themeColor: "#123456", typographyActive: true, data: { heading: "Book a class", subheading: "Choose a channel", items: [{ title: "Message", url: "https://example.com" }] } }));
  assert.match(html, /<h2[^>]*>Book a class<\/h2>/);
  assert.match(html, /Choose a channel/);
  assert.match(html, /data-typography-role="heading"/);
  const fields = SECTION_DEFS.find(s => s.type === "links")!.fields;
  assert.ok(fields.some(f => f.name === "heading" && !f.required));
  assert.ok(fields.some(f => f.name === "subheading" && !f.required));
  const socials = SECTION_DEFS.find(s => s.type === "contact")!.fields.find(f => f.name === "socials")!;
  assert.equal(socials.items?.find(f => f.name === "platform")?.enum?.length, 9);
});

test("company service preset and example use the local-shop order", () => {
  const preset = PRESET_DEFS.find(p => p.id === "company-service")!;
  const order = ["hero", "features", "about", "about", "contact", "cta"];
  assert.deepEqual(preset.sections, order);
  assert.deepEqual((preset.example.content as { sections: Array<{ type: string }> }).sections.map(s => s.type), order);
});

test("everyday workshop icons are bundled Ionicons SVGs", () => {
  for (const name of ["people", "time", "calendar", "chatbubble", "location", "call", "mail", "camera", "color-palette", "hand-left", "leaf", "cafe", "cut", "bicycle", "brush", "school", "gift"]) {
    assert.match(ICON_PATHS[`${name}-outline`], /<(path|circle|rect|ellipse|polygon|polyline|line)/);
  }
});
test.after(() => hooks.deregister());
