import type { TypographySettings } from "./typography";

/** Lightweight style suggestions; section backgrounds are opt-in. */
export const PAGE_STYLES = [
  { id: "indigo", themeColor: "#4F46E5", themeColorSecondary: "#0891B2", fontFamily: "Inter", darkMode: false, backgroundColors: ["#FFFFFF", "#EEF2FF"] },
  { id: "forest", themeColor: "#047857", themeColorSecondary: "#B45309", fontFamily: "Lato", darkMode: false, backgroundColors: ["#FFFFFF", "#ECFDF5"] },
  { id: "editorial", themeColor: "#9F1239", themeColorSecondary: "#57534E", fontFamily: "Lora", darkMode: false, backgroundColors: ["#FFFBEB", "#FFF1F2"] },
  { id: "ocean", themeColor: "#0369A1", themeColorSecondary: "#0F766E", fontFamily: "Manrope", darkMode: false, backgroundColors: ["#FFFFFF", "#F0F9FF"] },
  { id: "midnight", themeColor: "#A5B4FC", themeColorSecondary: "#67E8F9", fontFamily: "Space Grotesk", darkMode: true, backgroundColors: ["#0F172A", "#1E293B"] },
  { id: "ember", themeColor: "#FDBA74", themeColorSecondary: "#FCA5A5", fontFamily: "DM Sans", darkMode: true, backgroundColors: ["#1C1917", "#292524"] },
];

/** Optional recipes; existing style kits keep their current typography. */
export const TYPOGRAPHY_RECIPES = {
  compact: { textSize: "sm", textContrast: "low", typography: { body: "md" } },
  general: { textSize: "md", textContrast: "normal" },
  health: { textSize: "xl", textContrast: "normal", typography: { body: "xl" } },
  kiosk: { textSize: "lg", textContrast: "high" },
} satisfies Record<string, TypographySettings>;
