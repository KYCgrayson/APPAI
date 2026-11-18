import { hostedNavigationCopy } from "./hosted-navigation-copy.ts";
import { getDirectoryCopy } from "./directory-copy.ts";

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

/** First supported browser preference; an unmatched list preserves the page copy. */
export function resolveHostedChromeLocale(languages: readonly string[], pageLocale: string): string {
  const supported = Object.keys(CHROME_LABELS);
  for (let locale of languages) {
    if (/^zh-(HK|MO|Hant)(-|$)/i.test(locale)) locale = "zh-TW";
    else if (/^zh-(SG|Hans)(-|$)/i.test(locale)) locale = "zh-CN";
    const match = supported.find(key => key.toLowerCase() === locale.toLowerCase())
      ?? supported.find(key => key.toLowerCase() === locale.split("-")[0].toLowerCase());
    if (match) return match;
  }
  return pageLocale;
}

export function hostedVisitorChromeLabels(locale: string) {
  const labels = hostedChromeLabels(locale);
  return { ...labels, ...hostedNavigationCopy(locale),
    personalPages: getDirectoryCopy(locale).personalPages,
    accountDescription: `${labels.account}: ${labels.account}`,
  };
}
export type HostedChromeLabel = keyof ReturnType<typeof hostedVisitorChromeLabels>;
