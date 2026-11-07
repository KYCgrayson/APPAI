/** Hosted typography sizes in CSS pixels; no rendering work for default settings. */
export const TEXT_STEPS = ["xs", "sm", "md", "lg", "xl", "2xl", "3xl", "4xl"] as const;
export type TextStep = typeof TEXT_STEPS[number];
export const ROLES = ["caption", "card", "body", "heading", "display"] as const;
export type Role = typeof ROLES[number];
export interface TypographySettings {
  textSize?: TextStep;
  textContrast?: "low" | "normal" | "high";
  typography?: Partial<Record<Role, TextStep>>;
}
const factors = [0.75, 0.87, 1, 1.15, 1.32, 1.52, 1.75, 2];
/** Reference elements: section meta, card copy, body copy, section h2, hero h1. */
export const REFERENCE_PX = {
  desktop: { caption: 14, card: 16, body: 16, heading: 48, display: 60 },
  mobile: { caption: 14, card: 16, body: 16, heading: 30, display: 36 },
} as const;
export const TEXT_SIZE_REM = { "text-xs": .75, "text-sm": .875, "text-base": 1, "text-lg": 1.125, "text-xl": 1.25, "text-2xl": 1.5, "text-3xl": 1.875, "text-4xl": 2.25, "text-5xl": 3, "text-6xl": 3.75, "text-7xl": 4.5, "text-[13px]": 13 / 16 };
export function typographySettings(value: unknown): TypographySettings {
  return value && typeof value === "object" ? value as TypographySettings : {};
}
export function hasTypography(settings: TypographySettings) {
  return !!((settings.textSize && settings.textSize !== "md") || (settings.textContrast && settings.textContrast !== "normal") || Object.values(settings.typography || {}).some(step => step !== "md"));
}
export function typographyFactors(settings: TypographySettings = {}) {
  const desktop = {} as Record<Role, number>;
  const mobile = {} as Record<Role, number>;
  const tablet = {} as Record<Role, number>;
  for (const role of ROLES) {
    const step = factors[TEXT_STEPS.indexOf(settings.typography?.[role] ?? settings.textSize ?? "md")] ?? 1;
    const contrast = role === "heading" || role === "display" ? ({ low: .8, normal: 1, high: 1.25 }[settings.textContrast ?? "normal"] ?? 1) : 1;
    desktop[role] = step * contrast;
    tablet[role] = 1 + (desktop[role] - 1) * .75;
    // Display's 36px mobile base must remain <=56px even at 4xl/high.
    mobile[role] = 1 + (desktop[role] - 1) * (role === "display" ? .35 : role === "heading" ? .5 : .75);
    if (role === "body" || role === "card") mobile[role] = Math.max(14 / REFERENCE_PX.mobile[role], mobile[role]);
  }
  return { desktop, tablet, mobile };
}
export function computeTypography(settings: TypographySettings = {}) {
  const scale = typographyFactors(settings);
  const desktop = {} as Record<Role, number>;
  const mobile = {} as Record<Role, number>;
  const warnings: { path: string; message: string }[] = [];
  for (const role of ROLES) for (const viewport of ["desktop", "mobile"] as const) {
    const px = Math.round(REFERENCE_PX[viewport][role] * scale[viewport][role] * 100) / 100;
    (viewport === "desktop" ? desktop : mobile)[role] = px;
  }
  const byPath = new Map<string, string[]>();
  const warn = (role: Role, message: string) => {
    const path = settings.typography?.[role] ? `typography.${role}` : "textSize";
    byPath.set(path, [...(byPath.get(path) || []), message]);
  };
  if (desktop.body < 14 || mobile.body < 14) warn("body", `Body is ${desktop.body}px desktop / ${mobile.body}px mobile, below 14px on at least one viewport. Increase the body size.`);
  for (const role of ["heading", "display"] as const) if (desktop[role] < desktop.body || mobile[role] < mobile.body) warn(role, `${role} is ${desktop[role]}px desktop / ${mobile[role]}px mobile, smaller than body (${desktop.body}px desktop / ${mobile.body}px mobile) on at least one viewport. Increase ${role} or reduce body.`);
  for (const [path, messages] of byPath) warnings.push({ path, message: messages.join(" ") });
  return { desktop, mobile, warnings };
}
/** Only explicitly tagged elements participate; preserve each Tailwind class's base size. */
export function typographyCss(settings: TypographySettings) {
  const scale = typographyFactors(settings);
  const selector = (role: Role) => `[data-typography="active"] [data-typography-role="${role}"]`;
  const size = (role: Role, rem: number, mobile = false) => mobile && (role === "body" || role === "card") ? `max(14px, calc(${rem}rem * var(--ts-${role})))` : `calc(${rem}rem * var(--ts-${role}))`;
  const rules = (prefix = "", mobile = false) => ROLES.flatMap(role => Object.entries({ "prose-sm": .875, "prose-base": 1, ...TEXT_SIZE_REM }).map(([cls, rem]) => `${selector(role)}.${prefix}${cls.replace(/([\[\].])/g, "\\$1")}{font-size:${size(role, rem, mobile)}}`)).join("\n");
  return `[data-typography="active"] [data-typography-role]{overflow-wrap:anywhere;min-width:0}` +
    ROLES.map(role => `${selector(role)}{font-size:${size(role, 1)}}`).join("\n") +
    ROLES.filter(role => (role === "heading" || role === "display") && scale.desktop[role] > 1).map(role => `${selector(role)}{line-height:1.2;hyphens:auto}`).join("\n") +
    `@media(min-width:640px) and (max-width:1023px){[data-typography="active"]{${ROLES.map(role => `--ts-${role}:${scale.tablet[role]} !important`).join(";")}}}` +
    rules() + `@media(max-width:639px){[data-typography="active"]{${ROLES.map(role => `--ts-${role}:${scale.mobile[role]} !important`).join(";")}}${ROLES.map(role => `${selector(role)}{font-size:${size(role, 1, true)}}`).join("")}${rules("", true)}}` +
    ([["sm",640],["md",768],["lg",1024],["xl",1280]] as const).map(([prefix, width]) => `@media(min-width:${width}px){${rules(`${prefix}\\:`)}}`).join("\n");
}
/** Move API convenience fields into persisted content JSON; never add DB columns. */
export function storeTypography<T extends TypographySettings & { content?: unknown }>(data: T, existing?: unknown): Omit<T, keyof TypographySettings> {
  const { textSize, textContrast, typography, ...rest } = data;
  if (textSize !== undefined || textContrast !== undefined || typography !== undefined) {
    rest.content = { ...typographySettings(data.content === undefined ? existing : data.content), ...(textSize !== undefined ? { textSize } : {}), ...(textContrast !== undefined ? { textContrast } : {}), ...(typography !== undefined ? { typography } : {}) };
  }
  return rest;
}
export function typographyWarnings(page: { content: unknown }) {
  return computeTypography(typographySettings(page.content)).warnings;
}
