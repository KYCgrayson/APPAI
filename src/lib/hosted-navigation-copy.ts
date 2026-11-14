import { pickByLocale } from "./locale-match.ts";

/**
 * Localized label for the root-page "Home" nav entry. Falls back to "Home"
 * for unlisted locales. Keep short — it appears as a nav tab.
 */
export const HOME_LABELS: Record<string, string> = {
  en: "Home",
  "zh-TW": "首頁",
  "zh-CN": "首页",
  ja: "ホーム",
  ko: "홈",
  es: "Inicio",
  fr: "Accueil",
  de: "Startseite",
  pt: "Início",
  "pt-BR": "Início",
  it: "Home",
  nl: "Home",
  ru: "Главная",
  ar: "الرئيسية",
  hi: "होम",
  th: "หน้าแรก",
  vi: "Trang chủ",
  id: "Beranda",
  ms: "Laman Utama",
  tr: "Ana Sayfa",
};

// Hosted UI has its own locale system; keep these strings out of src/messages.
const COPY = [
  { locale: "en", websites: "Websites", tools: "Tools", apps: "Apps", games: "Games", breadcrumb: "Breadcrumb", isDefault: true, home: "Home", appai: "AppAI", notFound: "Page not found", unavailable: "The page you requested is unavailable.", openMenu: "Open menu", closeMenu: "Close menu", language: "Language" },
  { locale: "zh-TW", websites: "網站", tools: "工具", apps: "應用程式", games: "遊戲", breadcrumb: "導覽路徑", home: "首頁", appai: "AppAI", notFound: "找不到頁面", unavailable: "您要求的頁面目前無法使用。", openMenu: "開啟選單", closeMenu: "關閉選單", language: "語言" },
  { locale: "zh-CN", websites: "网站", tools: "工具", apps: "应用程序", games: "游戏", breadcrumb: "导航路径", home: "首页", appai: "AppAI", notFound: "找不到页面", unavailable: "您请求的页面目前无法使用。", openMenu: "打开菜单", closeMenu: "关闭菜单", language: "语言" },
  { locale: "ja", websites: "ウェブサイト", tools: "ツール", apps: "アプリ", games: "ゲーム", breadcrumb: "パンくずリスト", home: "ホーム", appai: "AppAI", notFound: "ページが見つかりません", unavailable: "お探しのページは現在ご利用いただけません。", openMenu: "メニューを開く", closeMenu: "メニューを閉じる", language: "言語" },
  { locale: "ko", websites: "웹사이트", tools: "도구", apps: "앱", games: "게임", breadcrumb: "탐색 경로", home: "홈", appai: "AppAI", notFound: "페이지를 찾을 수 없습니다", unavailable: "요청하신 페이지를 이용할 수 없습니다.", openMenu: "메뉴 열기", closeMenu: "메뉴 닫기", language: "언어" },
  { locale: "es", websites: "Sitios web", tools: "Herramientas", apps: "Apps", games: "Juegos", breadcrumb: "Ruta de navegación", home: "Inicio", appai: "AppAI", notFound: "Página no encontrada", unavailable: "La página solicitada no está disponible.", openMenu: "Abrir menú", closeMenu: "Cerrar menú", language: "Idioma" },
  { locale: "fr", websites: "Sites web", tools: "Outils", apps: "Apps", games: "Jeux", breadcrumb: "Fil d’Ariane", home: "Accueil", appai: "AppAI", notFound: "Page introuvable", unavailable: "La page demandée n’est pas disponible.", openMenu: "Ouvrir le menu", closeMenu: "Fermer le menu", language: "Langue" },
  { locale: "de", websites: "Websites", tools: "Tools", apps: "Apps", games: "Spiele", breadcrumb: "Brotkrümelnavigation", home: "Startseite", appai: "AppAI", notFound: "Seite nicht gefunden", unavailable: "Die angeforderte Seite ist nicht verfügbar.", openMenu: "Menü öffnen", closeMenu: "Menü schließen", language: "Sprache" },
  { locale: "hi", websites: "वेबसाइट", tools: "टूल्स", apps: "ऐप्स", games: "गेम", breadcrumb: "पेज का रास्ता", home: "होम", appai: "AppAI", notFound: "Page not found", unavailable: "The page you requested is unavailable.", openMenu: "Open menu", closeMenu: "Close menu", language: "Language" },
];

// Preserve Home translations already supported by hosted navigation.
const rows = Object.entries(HOME_LABELS).map(([locale, home]) => ({
  ...COPY[0], ...COPY.find(copy => copy.locale === locale), locale, home, isDefault: locale === "en",
}));

export function hostedNavigationCopy(locale: string) {
  // pickByLocale's same-language fallback takes the first Chinese row (TW).
  // Normalize Chinese UI copy here; leave publisher-content matching alone.
  if (/^zh(?:-|$)/i.test(locale)) {
    const subtags = locale.toLowerCase().split("-").slice(1);
    const traditional = subtags.includes("hant")
      || (!subtags.includes("hans") && subtags.some(tag => ["tw", "hk", "mo"].includes(tag)));
    locale = traditional ? "zh-TW" : "zh-CN";
  }
  return pickByLocale(rows, locale)!;
}

// Neutral colours keep navigation readable independently of publisher themes.
export const hostedLinkFocus = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:ring-offset-2";
