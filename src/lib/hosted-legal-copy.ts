import { chineseScript } from "./zh-convert.ts";
import { pickByLocale } from "./locale-match.ts";
import type { Subpage } from "./parse-page-segments.ts";

const labels: Record<string, [string, string, string, string]> = {
  en: ["Privacy Policy", "Terms of Service", "Read the privacy policy for", "Read the terms of service for"],
  ja: ["プライバシーポリシー", "利用規約", "プライバシーポリシー：", "利用規約："],
  ko: ["개인정보 처리방침", "이용약관", "개인정보 처리방침 안내:", "이용약관 안내:"],
  "zh-TW": ["隱私權政策", "服務條款", "閱讀隱私權政策：", "閱讀服務條款："],
  "zh-CN": ["隐私政策", "服务条款", "阅读隐私政策：", "阅读服务条款："],
  de: ["Datenschutzerklärung", "Nutzungsbedingungen", "Datenschutzerklärung für", "Nutzungsbedingungen für"],
  fr: ["Politique de confidentialité", "Conditions d’utilisation", "Consultez la politique de confidentialité de", "Consultez les conditions d’utilisation de"],
  es: ["Política de privacidad", "Condiciones del servicio", "Lee la política de privacidad de", "Lee las condiciones del servicio de"],
  hi: ["गोपनीयता नीति", "सेवा की शर्तें", "गोपनीयता नीति पढ़ें:", "सेवा की शर्तें पढ़ें:"],
};

export function hostedLegalCopy(locale: string, subpage: Subpage, name: string) {
  const copy = pickByLocale(Object.entries(labels).map(([locale, copy]) => ({ locale, copy, isDefault: locale === "en" })), chineseScript(locale) ?? locale)!.copy;
  const index = subpage === "privacy" ? 0 : 1;
  return { heading: copy[index], title: `${copy[index]} — ${name}`, description: `${copy[index + 2]} ${name}.` };
}
