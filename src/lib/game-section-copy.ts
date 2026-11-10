const copy = {
  en: ["Play fullscreen", "Exit fullscreen", "How to play", "Third-party content from {hostname}. AppAI will never ask for your password here."],
  "zh-TW": ["全螢幕遊玩", "結束全螢幕", "怎麼玩", "來自 {hostname} 的第三方內容。AppAI 絕不會在此要求您輸入密碼。"],
  "zh-CN": ["全屏游玩", "退出全屏", "怎么玩", "来自 {hostname} 的第三方内容。AppAI 绝不会在此要求您输入密码。"],
  es: ["Jugar a pantalla completa", "Salir de pantalla completa", "Cómo jugar", "Contenido de terceros de {hostname}. AppAI nunca te pedirá tu contraseña aquí."],
  ja: ["全画面でプレイ", "全画面を終了", "遊び方", "{hostname} のサードパーティコンテンツです。AppAI がここでパスワードを求めることはありません。"],
  ko: ["전체 화면으로 플레이", "전체 화면 종료", "플레이 방법", "{hostname}의 타사 콘텐츠입니다. AppAI는 여기에서 비밀번호를 요청하지 않습니다."],
  de: ["Im Vollbild spielen", "Vollbild beenden", "Spielanleitung", "Inhalte von Drittanbietern auf {hostname}. AppAI wird hier niemals nach deinem Passwort fragen."],
  fr: ["Jouer en plein écran", "Quitter le plein écran", "Comment jouer", "Contenu tiers provenant de {hostname}. AppAI ne vous demandera jamais votre mot de passe ici."],
  hi: ["फ़ुलस्क्रीन में खेलें", "फ़ुलस्क्रीन से बाहर निकलें", "कैसे खेलें", "{hostname} की तृतीय-पक्ष सामग्री। AppAI यहाँ कभी आपका पासवर्ड नहीं माँगेगा।"],
} as const;

export function gameSectionCopy(locale: string, hostname: string) {
  const [play, close, how, notice] = copy[locale as keyof typeof copy] || copy[locale.split("-")[0] as keyof typeof copy] || copy.en;
  return { play, close, how, notice: notice.replace("{hostname}", hostname) };
}
