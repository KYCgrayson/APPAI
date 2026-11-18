import test from "node:test";
import assert from "node:assert/strict";
import { diagramContentIssues, normalizeDiagramData } from "../src/lib/diagram.ts";
import { sanitizePageContent } from "../src/lib/sanitize.ts";
import { checkPagePreview } from "../src/lib/page-preview.ts";
import { diagramContent, diagramFixture, invalidDiagrams } from "./helpers/diagram-fixtures.ts";

for (const { name, data, path } of invalidDiagrams) test(`diagram rejects ${name} with its field path`, () => {
  const issues = diagramContentIssues(diagramContent(data));
  assert.ok(issues.some(issue => issue.message.includes(`sections[1].data${path ? "." + path : ""}:`)), JSON.stringify(issues));
  const preview = checkPagePreview({ slug: "paper-workshop", title: "Workshop", content: diagramContent(data) });
  assert.equal(preview.valid, false);
  assert.ok(preview.errors.some(issue => issue.message.includes(`sections[1].data${path ? "." + path : ""}:`)), JSON.stringify(preview));
});

test("all inclusive limits, optional fields and safe destinations are accepted without mutating input", () => {
  for (const [kind, field, min, max] of [["compare", "columns", 2, 4], ["steps", "steps", 2, 8], ["layers", "layers", 2, 6], ["cycle", "steps", 3, 6]] as const) for (const count of [min, max]) {
    const item = { kind, title: "x".repeat(80), takeaway: "x".repeat(120),
      [field]: Array.from({ length: count }, () => kind === "compare" ? { label: "x".repeat(40), points: Array(6).fill("x".repeat(160)) } : { label: "x".repeat(40), detail: "x".repeat(160) }),
      ...(kind === "layers" ? { focus: count - 1 } : {}), sources: Array.from({ length: 6 }, () => ({ label: "x".repeat(40), url: "HTTPS://example.com" })),
    };
    const data = { heading: "x".repeat(80), subheading: "x".repeat(160), items: Array(12).fill(item) };
    assert.deepEqual(diagramContentIssues(diagramContent(data)), []);
    assert.equal(normalizeDiagramData(data)?.items.length, 12);
  }
  for (const url of ["https://example.com", "HTTPS://Example.com/Case?Q=A#ID", "/p/paper", "/p/paper/notes?t=90#video", "#anchor", "?t=90#id", "?t=1:30#id", "https://example.com/" + "x".repeat(2028)]) {
    const data = { items: [{ ...diagramFixture.items[0], link: { label: "x".repeat(40), url } }] };
    const before = structuredClone(data);
    const normalized = normalizeDiagramData(data)!;
    assert.ok(normalized, url); assert.equal(normalized.items[0].link?.url, url.replace(/^https:/i, "https:"));
    assert.deepEqual(data, before);
  }
  assert.deepEqual(diagramContentIssues({ sections: [{ type: "stats", data: {} }] }), []);
});

test("plain text strips tags on writes; markdown remains literal; unknown icons disappear", () => {
  const content = diagramContent({ items: [{ kind: "steps", title: '<img src=x onerror="alert(1)">Safe & <b>clear</b>', icon: "constructor", takeaway: "**Literal** [link](javascript:alert(1))", steps: [{ label: "<b>First</b>", detail: '<script>alert("x")</script>' }, { label: "Second" }] }] });
  const result = sanitizePageContent(content) as { sections: { data: { items: { title: string; icon?: string; takeaway: string; steps: { label: string; detail?: string }[] }[] } }[] };
  const item = result.sections[1].data.items[0];
  assert.equal(item.title, "Safe & clear"); assert.equal(item.steps[0].label, "First");
  assert.equal(item.icon, undefined); assert.ok(item.takeaway.startsWith("**Literal**"));
  assert.deepEqual(diagramContentIssues(result), []);
  for (const title of ["<b></b>", "<img src=x>"]) {
    const preview = checkPagePreview({ slug: "paper-workshop", title: "Workshop", content: diagramContent({ items: [{ ...diagramFixture.items[0], title }] }) });
    assert.equal(preview.valid, false); assert.match(JSON.stringify(preview.errors), /sections\[1\]\.data\.items\[0\]\.title/);
  }
});

test("error indices refer to array positions, including nested columns and second diagram", () => {
  const content = { sections: [{}, {}, {}, { type: "diagram", order: 99, data: { items: [diagramFixture.items[0], { ...diagramFixture.items[1], kind: "numbers" }] } }] };
  assert.match(diagramContentIssues(content)[0].message, /^sections\[3\]\.data\.items\[1\]\.kind:/);
});

test("invalid diagram links explain accepted destinations without dumping the pattern", () => {
  const content = diagramContent({ items: [{ ...diagramFixture.items[0], link: { label: "More", url: "javascript:alert(1)" } }] });
  const issues = diagramContentIssues(content);
  assert.ok(issues.some(issue => issue.message === "sections[1].data.items[0].link.url: Link must be https, /p/…, #anchor or ?t=…#anchor"));
  for (const issue of issues) assert.ok(issue.message.length < 150, issue.message);
  const preview = checkPagePreview({ slug: "paper-workshop", title: "Workshop", content });
  assert.equal(preview.valid, false);
  assert.ok(preview.errors.some(issue => issue.message.includes("Link must be https")));
  assert.doesNotMatch(JSON.stringify(preview.errors), /must match pattern/);
});

test("UTF-16 limits and parsed HTTPS host semantics remain authoritative", () => {
  const item = diagramFixture.items[0];
  assert.ok(normalizeDiagramData({ items: [{ ...item, title: "😀".repeat(40) }] }));
  assert.equal(normalizeDiagramData({ items: [{ ...item, title: "😀".repeat(41) }] }), undefined);
  for (const url of ["https://[a]", "https://999.999.999.999", "https://%example.com"]) {
    assert.equal(normalizeDiagramData({ items: [{ ...item, link: { label: "Notes", url } }] }), undefined);
    assert.equal(normalizeDiagramData({ items: [{ ...item, sources: [{ label: "Notes", url }] }] }), undefined);
  }
  assert.ok(normalizeDiagramData({ items: [{ ...item, sources: [{ label: "Notes", url: "https://example.com/" + "x".repeat(2028) }] }] }));
  for (const focus of [undefined, 0, 1]) assert.ok(normalizeDiagramData({ items: [{ kind: "layers", title: "Layers", layers: [{ label: "Top" }, { label: "Base" }], focus }] }));
});
