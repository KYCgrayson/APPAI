import { NextRequest, NextResponse } from "next/server";

/**
 * DEV ONLY mock of the video-ask backend contract, for the local preview at
 * /dev/video-ask. 404s in production builds.
 *
 *   /api/dev/video-ask-mock/{search|stats|videos}           healthy backend
 *   /api/dev/video-ask-mock/down/{...}                      every call 503
 *   /api/dev/video-ask-mock/nostats/{...}                   /stats 404, rest ok
 *   /api/dev/video-ask-mock/malformed/{...}                 garbage JSON shapes
 *
 * All titles/authors are fake. Video IDs are PLACEHOLDERS: arbitrary public
 * YouTube videos used only so thumbnails and embeds render; they are not GTA
 * content.
 */

export const dynamic = "force-dynamic";

// The 13 category codes and zh-TW labels used by the real GTA indexer.
const CATEGORIES = [
  { code: "main-story", label: { en: "Main story", "zh-TW": "主線任務", "zh-CN": "主线任务", es: "Historia principal" , ja: "メインストーリー" } },
  { code: "side-missions", label: { en: "Side & stranger missions", "zh-TW": "支線／陌生人任務", "zh-CN": "支线／陌生人任务", es: "Misiones secundarias" , ja: "サイド・見知らぬ人ミッション" } },
  { code: "heists", label: { en: "Heists", "zh-TW": "搶劫", "zh-CN": "抢劫", es: "Golpes" , ja: "強盗" } },
  { code: "money", label: { en: "Making money", "zh-TW": "賺錢", "zh-CN": "赚钱", es: "Ganar dinero" , ja: "お金稼ぎ" } },
  { code: "vehicles", label: { en: "Vehicles", "zh-TW": "載具", "zh-CN": "载具", es: "Vehículos" , ja: "乗り物" } },
  { code: "weapons", label: { en: "Weapons & combat", "zh-TW": "武器與戰鬥", "zh-CN": "武器与战斗", es: "Armas y combate" , ja: "武器と戦闘" } },
  { code: "collectibles-secrets", label: { en: "Collectibles, secrets & easter eggs", "zh-TW": "收集品・隱藏要素・彩蛋", "zh-CN": "收集品・隐藏要素・彩蛋", es: "Coleccionables y secretos" , ja: "収集品・隠し要素・イースターエッグ" } },
  { code: "map-locations", label: { en: "Map & locations", "zh-TW": "地圖與地點", "zh-CN": "地图与地点", es: "Mapa y lugares" , ja: "マップと場所" } },
  { code: "skills-progression", label: { en: "Skills & progression", "zh-TW": "角色能力與成長", "zh-CN": "角色能力与成长", es: "Habilidades y progreso" , ja: "スキルと成長" } },
  { code: "beginner-tips", label: { en: "Beginner tips & settings", "zh-TW": "新手技巧・設定", "zh-CN": "新手技巧・设置", es: "Consejos y ajustes" , ja: "初心者のコツ・設定" } },
  { code: "online", label: { en: "Online mode", "zh-TW": "線上模式", "zh-CN": "线上模式", es: "Modo online" , ja: "オンラインモード" } },
  { code: "achievements", label: { en: "Achievements & trophies", "zh-TW": "成就／獎盃", "zh-CN": "成就／奖杯", es: "Logros y trofeos" , ja: "実績・トロフィー" } },
  { code: "other", label: { en: "Other", "zh-TW": "其他", "zh-CN": "其他", es: "Otros" , ja: "その他" } },
];

const cat = (code: string) => {
  const c = CATEGORIES.find(item => item.code === code)!;
  // Some items carry a localized label object, some a plain string (both valid).
  return { code: c.code, label: ["map-locations", "beginner-tips", "vehicles"].includes(code) ? c.label : c.label.en };
};

// Placeholder IDs (not GTA content) — see header comment.
const VIDEOS: { videoId: string; title: string; author: string; language: string; summary: string; summaryOriginal?: string; summaries?: Record<string, string>; keywords?: string[]; category: { code: string; label: string | Record<string, string> }; embeddable: boolean }[] = [
  { videoId: "M7lc1UVf-VE", title: "[FAKE] Every story detail from the second trailer", author: "Placeholder Channel A", language: "en", summary: "Fake summary: walks through the two leads and how their story begins.", category: cat("main-story"), embeddable: true,
    summaries: { "zh-TW": "假摘要：介紹兩位主角以及故事如何展開。", ja: "ダミー要約：二人の主人公と物語の始まりを解説。", es: "Resumen falso: presenta a los dos protagonistas y cómo empieza la historia." },
    keywords: ["主角", "劇情", "主人公", "ストーリー", "historia"] },
  { videoId: "aqz-KE-bpKQ", title: "[FAKE] Full map size compared to the last game", author: "Placeholder Channel B", language: "en", summary: "Fake summary: overlays the leaked map outline on the previous city.", category: cat("map-locations"), embeddable: true,
    summaries: { "zh-TW": "假摘要：把外流的地圖輪廓疊在上一代城市上比較大小。", ja: "ダミー要約：流出したマップの輪郭を前作の街と重ねて広さを比較。", es: "Resumen falso: superpone el contorno del mapa filtrado sobre la ciudad anterior." },
    keywords: ["地圖", "地图", "マップ", "地図", "広さ", "mapa", "tamaño"] },
  { videoId: "jNQXAC9IVRw", title: "[FAKE] Ten vehicles spotted in the trailers", author: "Placeholder Channel C", language: "en", summary: "Fake summary: boats, bikes and a swamp airboat, frame by frame.", category: cat("vehicles"), embeddable: true,
    summaries: { ja: "ダミー要約：ボート、バイク、湿地のエアボートをコマ送りで確認。", es: "Resumen falso: barcos, motos y un hidrodeslizador, fotograma a fotograma." },
    keywords: ["載具", "车", "車", "乗り物", "vehículos", "coche"] },
  { videoId: "eRsGyueVLvQ", title: "[FAKE] Weapon wheel changes explained", author: "Placeholder Channel D", language: "en", summary: "Fake summary: why the new carry limit matters for missions.", category: cat("weapons"), embeddable: true },
  { videoId: "R6MlUcmOul8", title: "[FAKE] Heist missions: what we know so far", author: "Placeholder Channel E", language: "en", summary: "Fake summary: rumoured heist structure and co-op roles.", category: cat("heists"), embeddable: true },
  { videoId: "YE7VzlLtp-4", title: "[FAKE] Will online launch on day one?", author: "Placeholder Channel F", language: "en", summary: "Fake summary: past launch patterns and what they suggest.", category: cat("online"), embeddable: true },
  { videoId: "dQw4w9WgXcQ", title: "[FAKE] How money works in the new economy", author: "Placeholder Channel G", language: "en", summary: "Fake summary: businesses, cash stashes and laundering rumours.", category: cat("money"), embeddable: false,
    summaries: { "zh-CN": "假摘要：产业、藏钱点和洗钱传闻。", ja: "ダミー要約：ビジネス、隠し資金、資金洗浄のうわさ。" },
    keywords: ["賺錢", "赚钱", "錢", "お金", "稼ぐ", "dinero"] },
  { videoId: "9bZkp7q19f0", title: "[FAKE] 假影片：預告片逐格解析", author: "假頻道 H", language: "zh-TW", summary: "Fake summary: frame-by-frame landmarks and characters from the trailer.", summaryOriginal: "假摘要：逐格找出預告片裡的地標與角色。", category: cat("side-missions"), embeddable: true,
    keywords: ["預告", "预告", "支線", "トレーラー"] },
  { videoId: "kJQP7kiw5Fk", title: "[FAKE] Release date and editions roundup", author: "Placeholder Channel I", language: "en", summary: "Fake summary: standard vs special editions and pre-order bonuses.", category: cat("other"), embeddable: true },
  { videoId: "OPf0YbXqDm0", title: "[FAKE] Will it come to PC? Performance guesses", author: "Placeholder Channel J", language: "en", summary: "Fake summary: console-first history and expected PC timing.", category: cat("skills-progression"), embeddable: true },
  { videoId: "fJ9rUzIMcZQ", title: "[FAKE] Five easter eggs hidden in the trailer", author: "Placeholder Channel K", language: "es", summary: "Fake summary: references to older games in background signs.", summaryOriginal: "Resumen falso: referencias a juegos anteriores en carteles del fondo.", category: cat("collectibles-secrets"), embeddable: true,
    keywords: ["彩蛋", "隠し", "secretos", "easter"] },
  { videoId: "hT_nvWreIhg", title: "[FAKE] Beginner tips for your first hour", author: "Placeholder Channel L", language: "en", summary: "Fake summary: controls, saving and early money tips.", category: cat("beginner-tips"), embeddable: true,
    summaries: { "zh-TW": "假摘要：操作、存檔與前期賺錢技巧。", ja: "ダミー要約：操作、セーブ、序盤の金策のコツ。", es: "Resumen falso: controles, guardado y consejos para ganar dinero al principio." },
    keywords: ["新手", "初心者", "コツ", "consejos", "principiante"] },
];

type MockVideo = (typeof VIDEOS)[number];

/** Drop mock-only fields (keywords) from the wire shape. */
function publicItem(video: MockVideo) {
  const { keywords: _keywords, ...item } = video;
  void _keywords;
  return item;
}

const STOP = new Set(["the", "how", "what", "are", "for", "and", "qué", "que", "tan", "los", "las", "del", "con", "una"]);

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "cache-control": "no-store" } });
}

async function handle(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  if (process.env.NODE_ENV === "production") return new NextResponse(null, { status: 404 });
  const segments = [...(await ctx.params).path];
  const variant = ["down", "nostats", "malformed"].includes(segments[0]) ? segments.shift()! : "ok";
  const endpoint = segments.join("/");

  // Small delay so loading states are visible.
  await new Promise(resolve => setTimeout(resolve, 250));

  if (variant === "down") return json({ title: "Service Unavailable" }, 503);
  if (variant === "malformed") return endpoint === "search" ? json({ results: "nope", answer: 42 }) : json(["not", "an", "object"]);

  if (endpoint === "stats" && req.method === "GET") {
    if (variant === "nostats") return json({ title: "Not Found" }, 404);
    return json({
      totalVideos: 1284,
      indexedVideos: 1172,
      updatedAt: "2026-11-27T12:00:00Z",
      categories: CATEGORIES.map((c, i) => ({ ...c, count: 40 + ((i * 37) % 120) })),
    });
  }

  if (endpoint === "videos" && req.method === "GET") {
    const code = req.nextUrl.searchParams.get("category") ?? "";
    const page = Math.max(1, Number(req.nextUrl.searchParams.get("page")) || 1);
    // Category browse returns the matching fake videos first, padded with
    // others so pagination is visible.
    const ordered = [...VIDEOS.filter(v => v.category.code === code), ...VIDEOS.filter(v => v.category.code !== code)];
    const size = 4;
    const results = ordered.slice((page - 1) * size, page * size).map(publicItem);
    return json({ results, page, hasMore: page * size < ordered.length });
  }

  if (endpoint === "search" && req.method === "POST") {
    const body = await req.json().catch(() => ({})) as { q?: string; lang?: string };
    const q = String(body.q ?? "").toLowerCase();
    const lang = String(body.lang ?? "").toLowerCase().split("-")[0];
    const words = q.split(/[^\p{L}\p{N}]+/u).filter(w => w.length > 2 && !STOP.has(w));
    const scored = VIDEOS.map(v => {
      const hay = `${v.title} ${v.summary} ${v.category.code} ${JSON.stringify(v.category.label)}`.toLowerCase();
      const keywordHits = (v.keywords ?? []).filter(k => q.includes(k.toLowerCase())).length;
      const score = words.reduce((n, w) => n + (hay.includes(w) ? 1 : 0), 0) + keywordHits * 2;
      // Same-language videos first on ties (what the real backend does with lang).
      const sameLang = lang && v.language.toLowerCase().split("-")[0] === lang ? 1 : 0;
      return { v, score, sameLang };
    }).filter(s => s.score > 0).sort((a, b) => b.score - a.score || b.sameLang - a.sameLang);
    const results = (scored.length ? scored.map(s => s.v) : q.includes("zzz") ? [] : VIDEOS.slice(0, 4)).slice(0, 5);
    return json({ results: results.map(publicItem), answer: null });
  }

  return json({ title: "Not Found" }, 404);
}

export { handle as GET, handle as POST };
