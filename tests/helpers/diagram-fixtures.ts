import fixture from "../fixtures/diagram.json" with { type: "json" };
export const diagramFixture = fixture;
const bilingualNodes = Array.from({ length: 8 }, (_, index) => ({
  label: index % 2 ? "Subscription 訂閱" : "Authentication 驗證",
  detail: "Authentication protects your Subscription. 使用者完成驗證後，即可管理訂閱及接收通知。",
}));
export const bilingualDiagramFixture = {
  heading: "Subscription workflow 訂閱流程",
  items: [
    { kind: "compare", title: "Compare subscriptions 比較訂閱", columns: Array.from({ length: 4 }, () => ({
      label: "Authentication 驗證", points: ["Subscription management 訂閱管理", "Authentication protects your account. 驗證可保護帳戶。"],
    })) },
    { kind: "steps", title: "Eight steps 八個步驟", steps: bilingualNodes },
    ...[3, 4, 5, 6].map(count => ({ kind: "cycle", title: `Subscription cycle ${count} 訂閱循環`, steps: bilingualNodes.slice(0, count) })),
  ],
};
export const diagramContent = (data: unknown) => ({ sections: [
  { type: "hero", order: 0, data: { headline: "Paper workshop" } },
  { type: "diagram", order: 8, data },
] });
const base = { kind: "steps", title: "Build", steps: [{ label: "Sketch" }, { label: "Fold" }] };
const array = (length: number, item: unknown = { label: "Band", detail: "A detail" }) => Array.from({ length }, () => structuredClone(item));
export const invalidDiagrams: { name: string; data: unknown; path: string }[] = [];
const bad = (name: string, item: unknown, path: string) => invalidDiagrams.push({ name, data: { items: [item] }, path: `items[0].${path}` });
for (const items of [[], array(13, base), null, "wrong"]) invalidDiagrams.push({ name: `items ${JSON.stringify(items).slice(0, 40)}`, data: { items }, path: "items" });
for (const data of [null, [], {}, undefined]) invalidDiagrams.push({ name: `data ${JSON.stringify(data)}`, data, path: data && !Array.isArray(data) ? "items" : "" });
for (const kind of ["numbers", "timeline", "unknown", "STEPS", null, 1, undefined]) bad(`kind ${kind}`, { ...base, kind }, "kind");
for (const [field, max] of [["title", 80], ["takeaway", 120]] as const) {
  for (const value of ["", " ", "x".repeat(max + 1), null, 1]) bad(`${field} ${JSON.stringify(value).slice(0, 30)}`, { ...base, [field]: value }, field);
}
bad("missing title", { ...base, title: undefined }, "title");
for (const [kind, field, min, max] of [["steps", "steps", 2, 8], ["cycle", "steps", 3, 6], ["layers", "layers", 2, 6], ["compare", "columns", 2, 4]] as const) {
  const node = kind === "compare" ? { label: "Choice", points: ["Point"] } : { label: "Node" };
  for (const length of [0, min - 1, max + 1]) bad(`${kind} length ${length}`, { kind, title: "Diagram", [field]: array(length, node) }, field);
  bad(`${kind} missing nodes`, { kind, title: "Diagram" }, field);
  for (const label of ["", " ", "x".repeat(41), null]) bad(`${kind} label ${JSON.stringify(label).slice(0, 30)}`, { kind, title: "Diagram", [field]: [{ ...node, label }, ...array(min - 1, node)] }, `${field}[0].label`);
  if (kind !== "compare") for (const detail of ["", " ", "x".repeat(161), 1]) bad(`${kind} detail ${JSON.stringify(detail).slice(0, 30)}`, { kind, title: "Diagram", [field]: [{ ...node, detail }, ...array(min - 1, node)] }, `${field}[0].detail`);
}
for (const points of [[], array(7, "Point"), [""], [" "], ["x".repeat(161)], [null]]) bad(`points ${JSON.stringify(points).slice(0, 30)}`, { kind: "compare", title: "Choices", columns: [{ label: "A", points }, { label: "B", points: ["Point"] }] }, !Array.isArray(points) || points.length === 0 || points.length > 6 ? "columns[0].points" : "columns[0].points[0]");
for (const focus of [-1, 2, 6, 1.5, "1", null]) bad(`focus ${JSON.stringify(focus)}`, { kind: "layers", title: "Bands", layers: array(2), focus }, "focus");
for (const url of ["javascript:alert(1)", "http://example.com", "//example.com", "data:text/html,x", "https://user@example.com", "https://example.com:99999", "#", "?t=90", "https://example.com/" + "x".repeat(2048)]) bad(`link ${url.slice(0, 40)}`, { ...base, link: { label: "More", url } }, "link.url");
for (const url of ["http://example.com", "javascript:alert(1)", "//example.com", "data:text/html,x", "/p/paper", "#start", "?t=90#video", "https://user@example.com", "https://example.com/" + "x".repeat(2048)]) bad(`source ${url.slice(0, 40)}`, { ...base, sources: [{ label: "Notes", url }] }, "sources[0].url");
for (const field of ["sources", "link"] as const) for (const label of ["", " ", "x".repeat(41), null]) {
  const link = { label, url: "https://example.com" };
  bad(`${field} label ${JSON.stringify(label).slice(0, 30)}`, { ...base, [field]: field === "sources" ? [link] : link }, `${field}${field === "sources" ? "[0]" : ""}.label`);
}
for (const sources of [[], array(7, { label: "Notes", url: "https://example.com" })]) bad(`sources length ${sources.length}`, { ...base, sources }, "sources");
for (const [field, max] of [["heading", 80], ["subheading", 160]] as const) for (const value of [" ", "x".repeat(max + 1)]) invalidDiagrams.push({ name: `${field} length ${value.length}`, data: { items: [base], [field]: value }, path: field });
