import { computeTypography, storeTypography, typographySettings } from "./typography.ts";
import { buildPagePath } from "./parse-page-segments.ts";
import { createPageSchema } from "./validations/page.ts";
import { sanitizePageContent, type SanitizeWarning } from "./sanitize.ts";
import { sectionFieldWarnings, pageHeadingWarnings } from "./section-field-warnings.ts";
import { pageLogoWarnings } from "./page-logo.ts";
import { SECTION_DEFS, type SectionFieldDef } from "./template-registry.ts";

export function checkPagePreview(body: unknown, iconNames: readonly string[] = [], context: { origin?: string; isDefault?: boolean; exists?: boolean } = {}) {
  const parsed = createPageSchema.safeParse(body);
  if (!parsed.success) return { valid: false, errors: parsed.error.issues.map(e => ({ path: e.path.map(String).join("."), message: e.message })), warnings: [] as SanitizeWarning[], sanitizedContent: null, next: "Fix errors and dry-run again." };
  const warnings: SanitizeWarning[] = [];
  const rawBody = body as Record<string, unknown>;
  for (const field of ["themeColor", "fontFamily"]) {
    if (!context.exists && !(field === "themeColor" && parsed.data.parentSlug) && rawBody[field] === undefined) warnings.push({ path: field, message: `The page will use defaults for ${field}; pick a style kit at ${context.origin || "https://appai.info"}/spec/style.` });
  }
  const sanitizedContent = sanitizePageContent(storeTypography(parsed.data).content, undefined, warnings) as Record<string, unknown>;

  const computedTypography = computeTypography(typographySettings(sanitizedContent));
  warnings.push(...computedTypography.warnings);
  warnings.push(...pageLogoWarnings({ ...parsed.data, content: sanitizedContent }));
  warnings.push(...pageHeadingWarnings(sanitizedContent));
  // Step 3: Extra content-level checks (non-blocking, informational)
  const rawSections = sanitizedContent.sections;
  const sections = Array.isArray(rawSections) ? rawSections.filter(section => section && typeof section === "object" && !Array.isArray(section)) as Array<{ type: string; data: Record<string, unknown> }> : [];
  if (rawSections !== undefined && !Array.isArray(rawSections)) warnings.push({ path: "content.sections", message: "sections must be an array." });
  if (Array.isArray(rawSections) && sections.length !== rawSections.length) warnings.push({ path: "content.sections", message: "Each section must be an object." });
  if (Array.isArray(sections)) {
    warnings.push(...sectionFieldWarnings(Array.isArray(rawSections) ? rawSections : []));
    for (const section of sections) {
      const path = `sections[${(rawSections as unknown[]).indexOf(section)}](${section.type})`;
      if (!SECTION_DEFS.some(def => def.type === section?.type)) warnings.push({ path, message: `Unknown section type "${section?.type}"; it will not render. See GET /api/v1/sections.` });
      if (!section?.data || typeof section.data !== "object" || Array.isArray(section.data)) warnings.push({ path, message: "Section data must be an object." });
    }
    for (const section of sections) {
      const index = (rawSections as unknown[]).indexOf(section);
      const def = SECTION_DEFS.find(def => def.type === section.type);
      if (def) checkFields(section.data, def.fields, `sections[${index}](${section.type})`, warnings);
      // Check icon field values against our known Ionicons map
      const iconFields = extractIconFields(section.data);
      for (const { path, value } of iconFields) {
        if (
          typeof value === "string" &&
          /^[a-z][a-z0-9-]*$/.test(value) &&
          iconNames.length > 0 && !iconNames.includes(value)
        ) {
          warnings.push({
            path: `sections[${index}](${section.type}).${path}`,
            message: `Icon name "${value}" is not in our Ionicons map (${iconNames.length} available). It will render as plain text instead of SVG. Try ${closestIcons(value, iconNames).join(", ")} (GET /api/v1/sections); emoji also works.`,
          });
        }
      }
    }
  }


  demoValueWarnings({ ...parsed.data, content: sanitizedContent }, "", warnings);
  for (const warning of warnings) warning.path = warning.path.replace(/sections\[(\d+)\](?!\()/g, (match, index) => {
    const section = Array.isArray(rawSections) ? rawSections[Number(index)] : null;
    return section && typeof section === "object" && "type" in section ? `${match}(${section.type})` : match;
  });
  return { valid: true, errors: [], warnings, sanitizedContent, typography: computedTypography.desktop, typographyMobile: computedTypography.mobile, next: pagePreviewNext(parsed.data, context) };
}

/** Recursively find fields named "icon" and return their paths + values. */
function extractIconFields(
  obj: unknown,
  pathPrefix = "",
): Array<{ path: string; value: unknown }> {
  if (obj === null || obj === undefined || typeof obj !== "object") return [];
  const results: Array<{ path: string; value: unknown }> = [];

  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      results.push(...extractIconFields(obj[i], `${pathPrefix}[${i}]`));
    }
    return results;
  }

  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    const path = pathPrefix ? `${pathPrefix}.${key}` : key;
    if (key === "icon" && typeof value === "string") {
      results.push({ path, value });
    }
    if (typeof value === "object" && value !== null) {
      results.push(...extractIconFields(value, path));
    }
  }
  return results;
}

function checkFields(value: unknown, fields: SectionFieldDef[], path: string, warnings: SanitizeWarning[]) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return;
  const obj = value as Record<string, unknown>;
  for (const field of fields) {
    const item = obj[field.name];
    const location = `${path}.${field.name}`;
    if (item === undefined || item === null) {
      if (field.required) warnings.push({ path: location, message: `Missing required field ${field.name}.` });
      continue;
    }
    const expected = ["url", "markdown"].includes(field.type) ? "string" : field.type;
    if (expected === "array" ? !Array.isArray(item) : typeof item !== expected || (expected === "object" && Array.isArray(item))) {
      warnings.push({ path: location, message: `Expected ${expected} for ${field.name}.` });
      continue;
    }
    if (field.fields) checkFields(item, field.fields, location, warnings);
    if (field.items && Array.isArray(item)) item.forEach((entry, i) => {
      if (field.allowStringItems && typeof entry === "string") return;
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) warnings.push({ path: `${location}[${i}]`, message: "Expected an object item." });
      else checkFields(entry, field.items!, `${location}[${i}]`, warnings);
    });
  }
}

export function pagePreviewNext(page: { slug: string; locale?: string; parentSlug?: string | null }, context: { origin?: string; isDefault?: boolean; exists?: boolean } = {}) {
  const path = buildPagePath(page.parentSlug || page.slug, page.locale || "en", null, context.isDefault ?? (page.parentSlug ? (page.locale || "en") === "en" : true)) + (page.parentSlug ? `/${page.slug}` : "");
  return `Review warnings, then POST the same body to /api/v1/pages${context.exists ? "?upsert=true" : ""} and open ${context.origin || ""}${path}`;
}

export function parseDryRun(value: string | null): boolean | "invalid" {
  if (!value) return false;
  if (["true", "1", "yes"].includes(value.toLowerCase())) return true;
  if (["false", "0", "no"].includes(value.toLowerCase())) return false;
  return "invalid";
}

function demoValueWarnings(value: unknown, path: string, warnings: SanitizeWarning[]) {
  if (value === "https://color-bench-demo.pages.dev") warnings.push({ path, message: "Replace demo value: replace with your deployed tool URL." });
  if (typeof value === "string" && /^(?:[hH][tT][tT][pP][sS]?:\/\/[^/]+)?\/spec\/examples\/placeholder-logo\.png(?:[?#].*)?$/.test(value)) warnings.push({ path, message: "Replace demo logo: supply the user’s logo, or create a square 512×512 PNG with its own background; upload local files with POST /api/v1/upload and replace this value with the returned url before publishing." });
  if (typeof value === "string" && /(?:^|\/)placeholder-screen[^/?#]*\.(?:svg|png|webp|jpg)(?:[?#].*)?$/i.test(value)) warnings.push({ path, message: "Replace demo screenshot: upload a real screenshot of the user’s app and replace this URL before publishing." });
  if (Array.isArray(value)) value.forEach((child, index) => {
    const type = path === "content.sections" && child && typeof child === "object" ? child.type : undefined;
    demoValueWarnings(child, `${path}[${index}]${type ? `(${type})` : ""}`, warnings);
  });
  else if (value && typeof value === "object") for (const [key, child] of Object.entries(value)) demoValueWarnings(child, path ? `${path}.${key}` : key, warnings);
}

/** Prefer matching names, then use Levenshtein distance for deterministic typo suggestions. */
function closestIcons(value: string, names: readonly string[]) {
  function distance(name: string) {
    let row = Array.from({ length: name.length + 1 }, (_, i) => i);
    for (let i = 0; i < value.length; i++) {
      const next = [i + 1];
      for (let j = 0; j < name.length; j++) next.push(Math.min(next[j] + 1, row[j + 1] + 1, row[j] + Number(value[i] !== name[j])));
      row = next;
    }
    return row[name.length];
  }
  const rank = (name: string) => name.startsWith(`${value}-`) ? 0 : name.includes(value) ? 1 : 2;
  return [...names].sort((a, b) => rank(a) - rank(b) || distance(a) - distance(b) || a.localeCompare(b)).slice(0, 3);
}
