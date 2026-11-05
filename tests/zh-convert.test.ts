import assert from "node:assert/strict";
import test from "node:test";
import { convertChineseVariant, chineseFallback, withChineseLocales } from "../src/lib/zh-convert.ts";

for (const [source, requested, text, expected] of [
  ["zh-TW", "zh-CN", "網站與應用程式", "网站与应用程式"],
  ["zh-CN", "zh-TW", "网站与应用程序", "網站與應用程序"],
]) {
  test(`${source} to ${requested}: deep human text only, immutable`, () => {
    const page = { locale: source, isDefault: true, title: text, tagline: text, metaTitle: text,
      metaDescription: text, privacyPolicy: text, termsOfService: text,
      content: { sections: [{ type: "hero", data: { heading: text, nested: [text, { label: text }],
        url: "https://example.test/網站", href: "/網站", id: "網站", slug: "網站", target: "網站", src: "/網站", color: "#fff", image: "網站", email: "test@example.test",
        textUrl: "https://example.test/網站", markdown: `[${text}](/網站)` } }] } };
    const before = structuredClone(page);
    const converted = convertChineseVariant(page, requested);
    assert.equal(converted.title, expected);
    assert.equal(converted.locale, requested);
    assert.equal(converted.isDefault, false);
    assert.equal(converted.autoConverted, true);
    assert.equal(converted.privacyPolicy, expected);
    assert.deepEqual(converted.content.sections[0].data.nested, [expected, { label: expected }]);
    for (const key of ["url", "href", "id", "slug", "target", "src", "color", "image", "email", "textUrl"] as const) {
      assert.equal(converted.content.sections[0].data[key], page.content.sections[0].data[key]);
    }
    assert.equal(converted.content.sections[0].data.markdown, `[${expected}](/網站)`);
    assert.deepEqual(page, before);
  });
}
test("exact variants win; aliases convert; unrelated locales do not", () => {
  const variants = [{ locale: "zh-TW", title: "網站", isDefault: true }];
  assert.equal(chineseFallback(variants, "zh-TW"), variants[0]);
  assert.equal(chineseFallback(variants, "zh-Hans")?.title, "网站");
  assert.equal(chineseFallback(variants, "en"), undefined);
  assert.deepEqual(withChineseLocales(variants).map(v => v.locale), ["zh-TW", "zh-CN"]);
});

test("text prefixes and descriptive keys convert while URIs and submitted option values stay intact", () => {
  const data = { text: "Note: 網站", emailPlaceholder: "網站", imageAlt: "網站", iconLabel: "網站", logoLabel: "網站", backgroundLabel: "網站",
    options: [{ label: "網站", value: "網站" }], sections: ["form", "tool"].map(type => ({ type, data: { fields: [{ options: [{ label: "網站", value: "網站" }] }] } })), url: "https://example.test/網站", contact: "mailto:網站@example.test", phone: "tel:123", payload: "data:text/plain,網站" };
  const converted = convertChineseVariant({ locale: "zh-TW", content: data }, "zh-CN").content;
  for (const key of ["emailPlaceholder", "imageAlt", "iconLabel", "logoLabel", "backgroundLabel"] as const) assert.equal(converted[key], "网站");
  for (const section of converted.sections) assert.deepEqual(section.data.fields[0].options, [{ label: "网站", value: "網站" }]);
  assert.equal(converted.text, "Note: 网站");
  assert.deepEqual(converted.options, [{ label: "网站", value: "網站" }]);
  for (const key of ["url", "contact", "phone", "payload"] as const) assert.equal(converted[key], data[key]);
});

test("backend field names, accept, request subtrees and option values remain unchanged", () => {
  const content = { sections: ["form", "tool"].map(type => ({ type, data: {
    name: "网站", fields: [{ name: "网站", label: "网站", placeholder: "简介", accept: ".网站", options: [{ label: "网站", value: "网站" }] }],
  } })), action: { label: "网站", body: { label: "网站", nested: ["简介"] }, headers: { "网站": "简介" } } };
  const result = convertChineseVariant({ locale: "zh-CN", content }, "zh-TW").content;
  for (const section of result.sections) {
    assert.equal(section.data.name, "網站");
    assert.deepEqual(section.data.fields, [{ name: "网站", label: "網站", placeholder: "簡介", accept: ".网站", options: [{ label: "網站", value: "网站" }] }]);
  }
  assert.equal(result.action.label, "網站");
  assert.deepEqual(result.action.body, content.action.body);
  assert.deepEqual(result.action.headers, content.action.headers);
});

test("only allowed URI schemes and relative paths bypass text conversion", () => {
  const content = { note: "Note:网站", tip: "Tip:简介", uris: ["http://example.test/网站", "https://example.test/网站", "mailto:网站@example.test", "tel:网站", "data:text/plain,网站", "//example.test/网站", "/网站", "#网站"] };
  const result = convertChineseVariant({ locale: "zh-CN", content }, "zh-TW").content;
  assert.equal(result.note, "Note:網站");
  assert.equal(result.tip, "Tip:簡介");
  assert.deepEqual(result.uris, content.uris);
});
