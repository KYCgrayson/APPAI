import { pickByLocale } from "../../lib/locale-match.ts";

// Hosted-page accessibility copy; never read the platform message catalogs.
const rows = [
  { locale: "en", repeats: "This cycle repeats from the first step.", isDefault: true },
  { locale: "zh-TW", repeats: "此循環會從第一步重新開始。" },
  { locale: "zh-CN", repeats: "此循环会从第一步重新开始。" },
  { locale: "ja", repeats: "このサイクルは最初のステップから繰り返します。" },
  { locale: "ko", repeats: "이 순환은 첫 단계부터 반복됩니다." },
  { locale: "es", repeats: "Este ciclo se repite desde el primer paso." },
  { locale: "fr", repeats: "Ce cycle reprend à la première étape." },
  { locale: "de", repeats: "Dieser Kreislauf beginnt wieder beim ersten Schritt." },
  { locale: "hi", repeats: "यह चक्र पहले चरण से दोहराया जाता है।" },
] as const;

export function diagramStrings(locale = "en") { return pickByLocale(rows, locale)!; }
