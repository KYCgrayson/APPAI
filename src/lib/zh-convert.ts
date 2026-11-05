import * as OpenCC from "opencc-js";

export function chineseScript(locale: string): "zh-TW" | "zh-CN" | null {
  if (/^zh-(TW|HK|Hant)(-|$)/i.test(locale)) return "zh-TW";
  if (/^zh-(CN|SG|Hans)(-|$)/i.test(locale)) return "zh-CN";
  return null;
}
export function oppositeChineseLocale(locale: string): string | null {
  const script = chineseScript(locale);
  return script === "zh-TW" ? "zh-CN" : script === "zh-CN" ? "zh-TW" : null;
}
/** Published aliases accepted as sources for the opposite-script fallback. */
export function chineseSourceLocales(requestedLocale: string): string[] {
  const opposite = oppositeChineseLocale(requestedLocale);
  return opposite === "zh-TW" ? ["zh-TW", "zh-Hant", "zh-HK"]
    : opposite === "zh-CN" ? ["zh-CN", "zh-Hans", "zh-SG"] : [];
}
const toTraditional = OpenCC.Converter({ from: "cn", to: "tw" });
const toSimplified = OpenCC.Converter({ from: "tw", to: "cn" });
const machineKey = /^(?:url|href|src|image|logo|photo|avatar|color|email|slug|font|fontFamily|icon|screenshot|background|backgroundImage|backgroundVideo|backgroundColor|themeColor|themeColorSecondary|apiBase|id|type|target|access|nameId|locale|rel|method|platform|provider|format|accept)$|(?:Id|_id)$/i;
function isUri(value: string): boolean {
  return /^(?:\/|#|https?:|mailto:|tel:|data:)/i.test(value);
}
// Preserve machine values even when nested in a text field (including markdown links).
const machineValue = /(https?:\/\/[^\s)\]<>]+|mailto:[^\s)]+|[\w.+-]+@[\w.-]+\.[a-z]{2,}|\]\([^)]*\))/gi;
function convertText(value: string, convert: (s: string) => string): string {
  return value.split(machineValue).map((part, index) => index % 2 ? part : convert(part)).join("");
}
function deepConvert(value: unknown, convert: (s: string) => string, key = "", option = false, field = false): unknown {
  if (key === "body" || key === "headers" || (field && key === "name")) return value;
  if (typeof value === "string") {
    if (machineKey.test(key) || (option && key === "value") || isUri(value)) return value;
    return convertText(value, convert);
  }
  if (Array.isArray(value)) return value.map(item => deepConvert(item, convert, key, option || key === "options", key === "fields"));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, deepConvert(v, convert, k, option, field && k === "name")]));
  }
  return value;
}
export type ConvertibleVariant = { locale: string; isDefault?: boolean; title?: string; tagline?: string | null; content?: unknown };
/** Read-only derived variant. Never persist this object. */
export function convertChineseVariant<T extends ConvertibleVariant>(page: T, requestedLocale: string): T & { autoConverted?: boolean } {
  const script = chineseScript(requestedLocale);
  if (!script || chineseScript(page.locale) !== oppositeChineseLocale(script)) return page;
  const convert = script === "zh-TW" ? toTraditional : toSimplified;
  const result = { ...page, locale: requestedLocale, isDefault: false, autoConverted: true } as T & { autoConverted: boolean };
  for (const field of ["title", "tagline", "metaTitle", "metaDescription", "privacyPolicy", "termsOfService", "content"] as const) {
    if (field in page) (result as Record<string, unknown>)[field] = deepConvert((page as Record<string, unknown>)[field], convert);
  }
  return result;
}
export function chineseFallback<T extends ConvertibleVariant>(variants: T[], locale: string): (T & { autoConverted?: boolean }) | undefined {
  const exact = variants.find(page => page.locale.toLowerCase() === locale.toLowerCase());
  if (exact) return exact;
  const opposite = oppositeChineseLocale(locale);
  const source = opposite && variants.find(page => chineseScript(page.locale) === opposite);
  return source ? convertChineseVariant(source, locale) : undefined;
}
export function withChineseLocales<T extends { locale: string; isDefault: boolean }>(variants: T[]): Array<T | { locale: string; isDefault: boolean }> {
  const result: Array<T | { locale: string; isDefault: boolean }> = [...variants];
  for (const locale of ["zh-TW", "zh-CN"]) {
    if (!result.some(v => v.locale === locale) && variants.some(v => chineseScript(v.locale) === oppositeChineseLocale(locale))) result.push({ locale, isDefault: false });
  }
  return result;
}
