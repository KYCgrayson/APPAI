import { pickByLocale } from "../../lib/locale-match.ts";

// Hosted-page UI only; publisher copy (heading, intro, placeholder,
// disclaimer) stays in section data. Locales: en, zh-TW, zh-CN, es (D41) + ja
// (owner 11-28). `intro` is only the generic default when a section has none.
const rows = [
  {
    locale: "en", isDefault: true,
    intro: "Ask in your own words — we'll find the guide videos that cover it.",
    launcher: "Ask", title: "Ask about the videos", close: "Close", collapse: "Collapse",
    placeholder: "Ask a question…", ask: "Ask", asking: "Searching…",
    stats: "{total} videos, {indexed} indexed", browse: "Browse by topic", back: "Back",
    results: "Matching videos", noResults: "No matching videos yet. Try other words.",
    watch: "Watch on YouTube", play: "Play {title}", notEmbeddable: "This video can only be watched on YouTube.",
    loadMore: "Load more", loading: "Loading…",
    paused: "Search is paused right now. Please try again later.", retry: "Try again",
    whereToAsk: "Where to ask", defaultBackend: "This page's video index", addBackend: "Add a backend URL",
    addBackendHint: "https:// address of a backend that speaks the video-ask format. Saved only in this browser.",
    add: "Add", remove: "Remove", invalidUrl: "Enter a valid https:// URL.",
  },
  {
    locale: "zh-TW",
    intro: "用你自己的話提問，我們會找出講到這件事的攻略影片。",
    launcher: "提問", title: "問影片", close: "關閉", collapse: "收合",
    placeholder: "輸入你的問題…", ask: "提問", asking: "搜尋中…",
    stats: "共 {total} 支影片，已索引 {indexed} 支", browse: "依主題瀏覽", back: "返回",
    results: "相關影片", noResults: "目前沒有相關影片，換個說法試試。",
    watch: "在 YouTube 觀看", play: "播放：{title}", notEmbeddable: "這支影片只能在 YouTube 觀看。",
    loadMore: "載入更多", loading: "載入中…",
    paused: "搜尋暫停中，請稍後再試。", retry: "重試",
    whereToAsk: "在哪裡問", defaultBackend: "本頁的影片索引", addBackend: "新增後端網址",
    addBackendHint: "支援 video-ask 格式的 https:// 後端網址，只會存在這個瀏覽器。",
    add: "新增", remove: "移除", invalidUrl: "請輸入有效的 https:// 網址。",
  },
  {
    locale: "zh-CN",
    intro: "用你自己的话提问，我们会找出讲到这件事的攻略视频。",
    launcher: "提问", title: "问视频", close: "关闭", collapse: "收起",
    placeholder: "输入你的问题…", ask: "提问", asking: "搜索中…",
    stats: "共 {total} 个视频，已索引 {indexed} 个", browse: "按主题浏览", back: "返回",
    results: "相关视频", noResults: "暂时没有相关视频，换个说法试试。",
    watch: "在 YouTube 观看", play: "播放：{title}", notEmbeddable: "这个视频只能在 YouTube 观看。",
    loadMore: "加载更多", loading: "加载中…",
    paused: "搜索暂停中，请稍后再试。", retry: "重试",
    whereToAsk: "在哪里问", defaultBackend: "本页的视频索引", addBackend: "添加后端网址",
    addBackendHint: "支持 video-ask 格式的 https:// 后端网址，只保存在这个浏览器。",
    add: "添加", remove: "移除", invalidUrl: "请输入有效的 https:// 网址。",
  },
  {
    locale: "es",
    intro: "Pregunta con tus propias palabras: encontraremos los vídeos guía que lo explican.",
    launcher: "Preguntar", title: "Pregunta sobre los vídeos", close: "Cerrar", collapse: "Contraer",
    placeholder: "Escribe tu pregunta…", ask: "Preguntar", asking: "Buscando…",
    stats: "{total} vídeos, {indexed} indexados", browse: "Explorar por tema", back: "Volver",
    results: "Vídeos relacionados", noResults: "Aún no hay vídeos relacionados. Prueba con otras palabras.",
    watch: "Ver en YouTube", play: "Reproducir {title}", notEmbeddable: "Este vídeo solo se puede ver en YouTube.",
    loadMore: "Cargar más", loading: "Cargando…",
    paused: "La búsqueda está en pausa. Inténtalo más tarde.", retry: "Reintentar",
    whereToAsk: "Dónde preguntar", defaultBackend: "Índice de vídeos de esta página", addBackend: "Añadir URL de backend",
    addBackendHint: "Dirección https:// de un backend con el formato video-ask. Solo se guarda en este navegador.",
    add: "Añadir", remove: "Quitar", invalidUrl: "Introduce una URL https:// válida.",
  },
  {
    locale: "ja",
    intro: "自分の言葉で質問してください。その内容を扱った攻略動画を探します。",
    launcher: "質問", title: "動画に質問", close: "閉じる", collapse: "折りたたむ",
    placeholder: "質問を入力…", ask: "質問", asking: "検索中…",
    stats: "動画 {total} 本、うち {indexed} 本をインデックス済み", browse: "トピックから探す", back: "戻る",
    results: "関連する動画", noResults: "関連する動画はまだありません。別の言葉で試してください。",
    watch: "YouTube で見る", play: "再生：{title}", notEmbeddable: "この動画は YouTube でのみ視聴できます。",
    loadMore: "さらに読み込む", loading: "読み込み中…",
    paused: "現在検索を一時停止しています。しばらくしてからお試しください。", retry: "再試行",
    whereToAsk: "質問先", defaultBackend: "このページの動画インデックス", addBackend: "バックエンド URL を追加",
    addBackendHint: "video-ask 形式に対応した https:// のバックエンド。このブラウザにのみ保存されます。",
    add: "追加", remove: "削除", invalidUrl: "有効な https:// URL を入力してください。",
  },
] as const;

export type VideoAskStrings = Omit<(typeof rows)[number], "locale" | "isDefault">;

export function videoAskStrings(locale = "en"): VideoAskStrings {
  return pickByLocale(rows, locale)!;
}

export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => String(values[key] ?? ""));
}
