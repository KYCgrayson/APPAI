import { chineseFallback, chineseSourceLocales } from "./zh-convert";
import { db } from "@/lib/db";
import { sanitizeUrl } from "@/lib/sanitize";

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

export type SiblingRow = {
  slug: string;
  locale: string;
  title: string;
  isDefault: boolean;
  hideFromNav: boolean;
  navOrder: number | null;
  createdAt: Date;
};

export interface NavItem {
  label: string;
  /** Child page slug, anchor (#section), or absolute URL */
  target: string;
}

/**
 * Load all sibling child pages for the site nav. Returns one entry per logical
 * page (slug), with the title chosen by locale preference:
 *   1. current-locale variant if it exists
 *   2. default-locale variant otherwise
 * Entries with hideFromNav=true are omitted. Sort is (navOrder asc, createdAt asc),
 * with nulls last so explicit ordering wins over accidental creation order.
 */
export async function loadSiblings(
  parentSlug: string,
  organizationId: string,
  locale: string,
): Promise<SiblingRow[]> {
  const rows = await db.hostedPage.findMany({
    where: {
      organizationId,
      parentSlug,
      isPublished: true,
      hideFromNav: false,
      OR: [{ locale }, { locale: { in: chineseSourceLocales(locale) } }, { isDefault: true }],
    },
    select: {
      slug: true,
      locale: true,
      title: true,
      isDefault: true,
      hideFromNav: true,
      navOrder: true,
      createdAt: true,
    },
  });

  const grouped = new Map<string, SiblingRow[]>();
  for (const row of rows) grouped.set(row.slug, [...(grouped.get(row.slug) ?? []), row]);
  const bySlug = new Map<string, SiblingRow>();
  for (const [slug, variants] of grouped) {
    bySlug.set(slug, chineseFallback(variants, locale) ?? variants.find(v => v.locale === locale) ?? variants.find(v => v.isDefault) ?? variants[0]);
  }

  return Array.from(bySlug.values()).sort((a, b) => {
    const ao = a.navOrder;
    const bo = b.navOrder;
    if (ao != null && bo != null && ao !== bo) return ao - bo;
    if (ao != null && bo == null) return -1;
    if (ao == null && bo != null) return 1;
    return a.createdAt.getTime() - b.createdAt.getTime();
  });
}

/**
 * Build the navigation list for a site. Priority:
 *   1. Explicit `content.nav` array on the root page (escape hatch)
 *   2. Auto-generated: localized "Home" + one entry per visible child
 *   3. Empty list when the site is single-page
 */
export function buildNav(
  rootContent: unknown,
  siblings: SiblingRow[],
  rootHref: string,
  locale: string,
): NavItem[] {
  const explicit = (rootContent as { nav?: unknown })?.nav;
  if (Array.isArray(explicit)) {
    return explicit
      .filter((item): item is NavItem =>
        typeof item === "object" &&
        item !== null &&
        typeof (item as NavItem).label === "string" &&
        typeof (item as NavItem).target === "string",
      )
      .map((item) => ({ label: item.label, target: item.target }));
  }
  if (siblings.length === 0) return [];
  const homeLabel = HOME_LABELS[locale] || HOME_LABELS.en;
  return [
    { label: homeLabel, target: rootHref },
    ...siblings.map((s) => ({ label: s.title, target: s.slug })),
  ];
}

/**
 * Resolve a NavItem.target into a real href + external flag.
 *
 *   "https://..."     → external URL, opens in new tab
 *   "#anchor"         → in-page anchor
 *   "/p/..."          → absolute internal path (used by Home)
 *   "child-slug"      → child page on the same root site
 */
export function resolveNavHref(
  target: string,
  rootSlug: string,
  localeSegment: string,
): { href: string; external: boolean } {
  if (typeof target !== "string") return { href: "#", external: false };
  if (/^https?:\/\//i.test(target)) {
    return { href: sanitizeUrl(target), external: true };
  }
  if (target.startsWith("#") || target.startsWith("/")) {
    return { href: target, external: false };
  }
  const parts = ["/p", rootSlug];
  if (localeSegment) parts.push(localeSegment);
  parts.push(target);
  return { href: parts.join("/"), external: false };
}

// Hosted chrome uses the same supported locale set as Home.
const CHROME_LABELS: Record<string, string> = {
  "en": "Sign in|Dashboard|Sign out|Account|Browse more tools|Privacy|Terms|Privacy Policy|Terms of Service|Download|Official site|Landing page",
  "ja": "ログイン|ダッシュボード|ログアウト|アカウント|ほかのツールを見る|プライバシー|利用規約|プライバシーポリシー|利用規約|ダウンロード|公式サイト|紹介ページ",
  "zh-TW": "登入|控制台|登出|帳號|探索更多工具|隱私|條款|隱私權政策|服務條款|下載|官方網站|介紹頁面",
  "zh-CN": "登录|控制台|退出|账户|浏览更多工具|隐私|条款|隐私政策|服务条款|下载|官方网站|介绍页面",
  "ko": "로그인|대시보드|로그아웃|계정|다른 도구 보기|개인정보|약관|개인정보 처리방침|이용약관|다운로드|공식 사이트|소개 페이지",
  "es": "Iniciar sesión|Panel|Cerrar sesión|Cuenta|Ver más herramientas|Privacidad|Condiciones|Política de privacidad|Condiciones del servicio|Descargar|Sitio oficial|Página de presentación",
  "fr": "Connexion|Tableau de bord|Déconnexion|Compte|Voir plus d’outils|Confidentialité|Conditions|Politique de confidentialité|Conditions d’utilisation|Télécharger|Site officiel|Page de présentation",
  "de": "Anmelden|Übersicht|Abmelden|Konto|Weitere Tools entdecken|Datenschutz|Bedingungen|Datenschutzerklärung|Nutzungsbedingungen|Herunterladen|Offizielle Website|Präsentationsseite",
  "pt": "Entrar|Painel|Sair|Conta|Ver mais ferramentas|Privacidade|Termos|Política de privacidade|Termos de serviço|Descarregar|Site oficial|Página de apresentação",
  "it": "Accedi|Pannello|Esci|Account|Altri strumenti|Privacy|Termini|Informativa sulla privacy|Termini di servizio|Scarica|Sito ufficiale|Pagina di presentazione",
  "nl": "Inloggen|Overzicht|Uitloggen|Account|Meer tools bekijken|Privacy|Voorwaarden|Privacybeleid|Servicevoorwaarden|Downloaden|Officiële website|Presentatiepagina",
  "ru": "Войти|Панель|Выйти|Аккаунт|Другие инструменты|Конфиденциальность|Условия|Политика конфиденциальности|Условия использования|Скачать|Официальный сайт|Страница проекта",
  "ar": "تسجيل الدخول|لوحة التحكم|تسجيل الخروج|الحساب|تصفح المزيد من الأدوات|الخصوصية|الشروط|سياسة الخصوصية|شروط الخدمة|تنزيل|الموقع الرسمي|صفحة تعريفية",
  "hi": "साइन इन|डैशबोर्ड|साइन आउट|खाता|और टूल देखें|गोपनीयता|शर्तें|गोपनीयता नीति|सेवा की शर्तें|डाउनलोड|आधिकारिक साइट|परिचय पृष्ठ",
  "th": "เข้าสู่ระบบ|แดชบอร์ด|ออกจากระบบ|บัญชี|ดูเครื่องมือเพิ่มเติม|ความเป็นส่วนตัว|ข้อกำหนด|นโยบายความเป็นส่วนตัว|ข้อกำหนดการใช้บริการ|ดาวน์โหลด|เว็บไซต์ทางการ|หน้าแนะนำ",
  "vi": "Đăng nhập|Bảng điều khiển|Đăng xuất|Tài khoản|Xem thêm công cụ|Quyền riêng tư|Điều khoản|Chính sách quyền riêng tư|Điều khoản dịch vụ|Tải xuống|Trang chính thức|Trang giới thiệu",
  "id": "Masuk|Dasbor|Keluar|Akun|Jelajahi alat lainnya|Privasi|Ketentuan|Kebijakan privasi|Ketentuan layanan|Unduh|Situs resmi|Halaman pengantar",
  "ms": "Log masuk|Papan pemuka|Log keluar|Akaun|Lihat alat lain|Privasi|Terma|Dasar privasi|Terma perkhidmatan|Muat turun|Laman rasmi|Halaman pengenalan",
  "tr": "Giriş yap|Panel|Çıkış yap|Hesap|Diğer araçlara göz at|Gizlilik|Koşullar|Gizlilik politikası|Hizmet koşulları|İndir|Resmî site|Tanıtım sayfası",
  "pt-BR": "Entrar|Painel|Sair|Conta|Ver mais ferramentas|Privacidade|Termos|Política de privacidade|Termos de serviço|Baixar|Site oficial|Página de apresentação"
};
export function hostedChromeLabels(locale: string) {
  if (/^zh-(HK|MO|Hant)(-|$)/i.test(locale)) locale = "zh-TW";
  else if (/^zh-(SG|Hans)(-|$)/i.test(locale)) locale = "zh-CN";
  const [signIn, dashboard, signOut, account, browse, privacy, terms, privacyPolicy, termsOfService, download, officialSite, landingPage] = (CHROME_LABELS[locale] || CHROME_LABELS[locale.split("-")[0]] || CHROME_LABELS.en).split("|");
  return { signIn, dashboard, signOut, account, browse, privacy, terms, privacyPolicy, termsOfService, download, officialSite, landingPage };
}
