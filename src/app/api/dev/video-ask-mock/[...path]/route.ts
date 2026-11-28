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

const CATEGORIES = [
  { code: "story", label: { en: "Story & characters", "zh-TW": "劇情與角色", "zh-CN": "剧情与角色", es: "Historia y personajes" } },
  { code: "map", label: { en: "Map & locations", "zh-TW": "地圖與地點", "zh-CN": "地图与地点", es: "Mapa y lugares" } },
  { code: "vehicles", label: { en: "Vehicles", "zh-TW": "載具", "zh-CN": "载具", es: "Vehículos" } },
  { code: "weapons", label: { en: "Weapons", "zh-TW": "武器", "zh-CN": "武器", es: "Armas" } },
  { code: "missions", label: { en: "Missions", "zh-TW": "任務", "zh-CN": "任务", es: "Misiones" } },
  { code: "online", label: { en: "Online mode", "zh-TW": "線上模式", "zh-CN": "线上模式", es: "Modo online" } },
  { code: "money", label: { en: "Money & economy", "zh-TW": "金錢與經濟", "zh-CN": "金钱与经济", es: "Dinero y economía" } },
  { code: "trailers", label: { en: "Trailer breakdowns", "zh-TW": "預告解析", "zh-CN": "预告解析", es: "Análisis de tráilers" } },
  { code: "release", label: { en: "Release & editions", "zh-TW": "發售與版本", "zh-CN": "发售与版本", es: "Lanzamiento y ediciones" } },
  { code: "pc", label: { en: "PC & performance", "zh-TW": "PC 與效能", "zh-CN": "PC 与性能", es: "PC y rendimiento" } },
  { code: "secrets", label: { en: "Secrets & easter eggs", "zh-TW": "彩蛋與秘密", "zh-CN": "彩蛋与秘密", es: "Secretos" } },
  { code: "tips", label: { en: "Beginner tips", "zh-TW": "新手技巧", "zh-CN": "新手技巧", es: "Consejos" } },
  { code: "music", label: { en: "Music & radio", "zh-TW": "音樂與電台", "zh-CN": "音乐与电台", es: "Música y radio" } },
];

const cat = (code: string) => {
  const c = CATEGORIES.find(item => item.code === code)!;
  return { code: c.code, label: c.label.en };
};

// Placeholder IDs (not GTA content) — see header comment.
const VIDEOS = [
  { videoId: "M7lc1UVf-VE", title: "[FAKE] Every story detail from the second trailer", author: "Placeholder Channel A", language: "en", summary: "Fake summary: walks through the two leads and how their story begins.", category: cat("story"), embeddable: true },
  { videoId: "aqz-KE-bpKQ", title: "[FAKE] Full map size compared to the last game", author: "Placeholder Channel B", language: "en", summary: "Fake summary: overlays the leaked map outline on the previous city.", category: cat("map"), embeddable: true },
  { videoId: "jNQXAC9IVRw", title: "[FAKE] Ten vehicles spotted in the trailers", author: "Placeholder Channel C", language: "en", summary: "Fake summary: boats, bikes and a swamp airboat, frame by frame.", category: cat("vehicles"), embeddable: true },
  { videoId: "eRsGyueVLvQ", title: "[FAKE] Weapon wheel changes explained", author: "Placeholder Channel D", language: "en", summary: "Fake summary: why the new carry limit matters for missions.", category: cat("weapons"), embeddable: true },
  { videoId: "R6MlUcmOul8", title: "[FAKE] Heist missions: what we know so far", author: "Placeholder Channel E", language: "en", summary: "Fake summary: rumoured heist structure and co-op roles.", category: cat("missions"), embeddable: true },
  { videoId: "YE7VzlLtp-4", title: "[FAKE] Will online launch on day one?", author: "Placeholder Channel F", language: "en", summary: "Fake summary: past launch patterns and what they suggest.", category: cat("online"), embeddable: true },
  { videoId: "dQw4w9WgXcQ", title: "[FAKE] How money works in the new economy", author: "Placeholder Channel G", language: "en", summary: "Fake summary: businesses, cash stashes and laundering rumours.", category: cat("money"), embeddable: false },
  { videoId: "9bZkp7q19f0", title: "[FAKE] 假影片：預告片逐格解析", author: "假頻道 H", language: "zh-TW", summary: "假摘要：逐格找出預告片裡的地標與角色。", category: cat("trailers"), embeddable: true },
  { videoId: "kJQP7kiw5Fk", title: "[FAKE] Release date and editions roundup", author: "Placeholder Channel I", language: "en", summary: "Fake summary: standard vs special editions and pre-order bonuses.", category: cat("release"), embeddable: true },
  { videoId: "OPf0YbXqDm0", title: "[FAKE] Will it come to PC? Performance guesses", author: "Placeholder Channel J", language: "en", summary: "Fake summary: console-first history and expected PC timing.", category: cat("pc"), embeddable: true },
  { videoId: "fJ9rUzIMcZQ", title: "[FAKE] Five easter eggs hidden in the trailer", author: "Placeholder Channel K", language: "es", summary: "Fake summary: references to older games in background signs.", category: cat("secrets"), embeddable: true },
  { videoId: "hT_nvWreIhg", title: "[FAKE] Beginner tips for your first hour", author: "Placeholder Channel L", language: "en", summary: "Fake summary: controls, saving and early money tips.", category: cat("tips"), embeddable: true },
];

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
    const results = ordered.slice((page - 1) * size, page * size);
    return json({ results, page, hasMore: page * size < ordered.length });
  }

  if (endpoint === "search" && req.method === "POST") {
    const body = await req.json().catch(() => ({})) as { q?: string };
    const words = String(body.q ?? "").toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(w => w.length > 1);
    const scored = VIDEOS.map(v => {
      const hay = `${v.title} ${v.summary} ${v.category.code} ${v.category.label}`.toLowerCase();
      return { v, score: words.reduce((n, w) => n + (hay.includes(w) ? 1 : 0), 0) };
    }).filter(s => s.score > 0).sort((a, b) => b.score - a.score);
    const results = (scored.length ? scored.map(s => s.v) : words.includes("zzz") ? [] : VIDEOS.slice(0, 4)).slice(0, 5);
    return json({ results, answer: null });
  }

  return json({ title: "Not Found" }, 404);
}

export { handle as GET, handle as POST };
