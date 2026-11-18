import { z } from "zod";
import { ICON_NAMES } from "../components/ui/icon-data.ts";
import { editorialLink, PROJECT_CARD_HREF_PATTERN } from "./hosted-editorial-links.ts";
import { PLATFORM_ORIGIN } from "./platform-identity.ts";
import { videoFieldPath } from "./video-data.ts";

export const DIAGRAM_KINDS = ["compare", "steps", "layers", "cycle"] as const;
const text = (max: number) => z.string().min(1).max(max).regex(/\S/, "Must contain non-whitespace text")
  .describe(`Nonblank plain text; the API limit is ${max} UTF-16 code units. JSON Schema maxLength counts Unicode code points.`);
const safeHref = z.string().max(2048).regex(new RegExp(PROJECT_CARD_HREF_PATTERN))
  .refine(value => !!editorialLink(value, PLATFORM_ORIGIN, "project-card"), "Use HTTPS without credentials, /p/..., #anchor, or ?t=time#anchor")
  .describe("Shared project-card/gallery safe href. The API additionally parses HTTPS URLs; the pattern alone cannot validate host semantics.");
const sourceHref = z.string().max(2048).regex(new RegExp(`^(?=[hH][tT][tT][pP][sS]://)${PROJECT_CARD_HREF_PATTERN.slice(1)}`), "Sources require HTTPS")
  .refine(value => !!editorialLink(value, PLATFORM_ORIGIN, "project-card"), "Use HTTPS without credentials")
  .describe("Absolute HTTPS source without credentials. The API additionally parses the URL; the pattern alone cannot validate host semantics.");
const label = text(40);
const node = z.object({ label, detail: text(160).optional() });
const common = {
  title: text(80),
  takeaway: text(120).optional(),
  icon: z.string().optional(),
  sources: z.array(z.object({ label, url: sourceHref })).min(1).max(6).optional(),
  link: z.object({ label, url: safeHref }).optional(),
};
const layerSchema = z.object({
  ...common, kind: z.literal("layers"), layers: z.array(node).min(2).max(6),
  focus: z.number().int().min(0).max(5).optional(),
}).superRefine((item, ctx) => {
  if (item.focus !== undefined && item.focus >= item.layers.length) {
    ctx.addIssue({ code: "custom", path: ["focus"], message: "focus must be an index within layers" });
  }
});
export const diagramDataSchema = z.object({
  heading: text(80).optional(),
  subheading: text(160).optional(),
  items: z.array(z.discriminatedUnion("kind", [
    z.object({ ...common, kind: z.literal("compare"), columns: z.array(z.object({ label, points: z.array(text(160)).min(1).max(6) })).min(2).max(4) }),
    z.object({ ...common, kind: z.literal("steps"), steps: z.array(node).min(2).max(8) }),
    layerSchema,
    z.object({ ...common, kind: z.literal("cycle"), steps: z.array(node).min(3).max(6) }),
  ])).min(1).max(12),
}).passthrough();

export type DiagramData = z.infer<typeof diagramDataSchema>;
export type DiagramItem = DiagramData["items"][number];

/** Pure normalizer; invalid data stays invalid for post-sanitization validation. */
export function normalizeDiagramData(value: unknown): DiagramData | undefined {
  const parsed = diagramDataSchema.safeParse(value);
  if (!parsed.success) return undefined;
  return { ...parsed.data, items: parsed.data.items.map(item => {
    const { icon, ...rest } = item;
    const normalizeLink = (link: { label: string; url: string }) => ({ ...link, url: editorialLink(link.url, PLATFORM_ORIGIN, "project-card")!.href });
    return { ...rest,
      ...(icon && ICON_NAMES.includes(icon) ? { icon } : {}),
      ...(item.link ? { link: normalizeLink(item.link) } : {}),
      ...(item.sources ? { sources: item.sources.map(normalizeLink) } : {}),
    };
  }) };
}

/** Same indexed paths on create, replace, merged patches, dry-run and preview. */
export function diagramContentIssues(content: unknown, partial = false) {
  const issues: { code: "custom"; path: (string | number)[]; message: string }[] = [];
  const sections = (content as { sections?: unknown[] } | null)?.sections;
  if (!Array.isArray(sections)) return issues;
  sections.forEach((value, index) => {
    const section = value as { type?: string; data?: unknown } | null;
    if (section?.type !== "diagram") return;
    const parsed = (partial ? diagramDataSchema.partial() : diagramDataSchema).safeParse(section.data);
    if (!parsed.success) for (const issue of parsed.error.issues) {
      const path = ["sections", index, "data", ...issue.path] as (string | number)[];
      issues.push({ code: "custom", path, message: `${videoFieldPath(path)}: ${issue.message}` });
    }
  });
  return issues;
}

// Publish the same discriminated contract, including the length-dependent focus.
export function diagramJsonSchema() {
  const schema = z.toJSONSchema(diagramDataSchema, { io: "input" });
  const items = z.toJSONSchema(diagramDataSchema.shape.items, { io: "input" });
  items.items = { oneOf: diagramDataSchema.shape.items.element.options.map(option => {
    const variant = z.toJSONSchema(option, { io: "input" });
    if (option === layerSchema) {
      variant.allOf = Array.from({ length: 6 }, (_, focus) => ({
        if: { properties: { focus: { const: focus } }, required: ["focus"] },
        then: { properties: { layers: { minItems: focus + 1 } } },
      }));
    }
    return variant;
  }) };
  schema.properties!.items = items;
  return schema;
}
