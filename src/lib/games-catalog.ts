import { TABLETOP_PUZZLE_COPY } from "./tabletop-puzzles-copy.ts";
import { LOCALIZED_HUB_COPY } from "./games-localized-copy.ts";
import type { GamePageLocale } from "./games-pages-copy.ts";

// Catalog for the /games hub. Multiple pages may share a static build under
// public/games/<buildSlug>/ on this origin, so room-code play can use the
// first-party appai.info session (Safari blocks third-party cookies).
// Copy is authored in all nine platform locales; only unknown locales use en.

export type GameLocaleParam = { name: string; zh: string; en: string };

export type GameEntry = {
  slug: string;
  /** Existing static build directory; the three puzzles share one build. */
  buildSlug: string;
  puzzle?: "river" | "bridge" | "water";
  /** Cover art under public/games/covers/. */
  cover: string;
  /** Query parameter the game reads for its language. */
  localeParam: GameLocaleParam;
  /** Accent used for the card. */
  accent: string;
  /** live/beta: playable link. soon: card shown, no link, no files served. */
  status: "live" | "beta" | "soon";
  playerRange: { min: number; max: number };
  minAge: number;
};

export type GameCopy = {
  name: string;
  tagline: string;
  howToPlay: string[];
  players: string;
  ages: string;
};

export type HubCopy = {
  metaTitle: string;
  metaDescription: string;
  label: string;
  title: string;
  intro: string[];
  notes: string[];
  play: string;
  details: string;
  howToPlay: string;
  players: string;
  ages: string;
  beta: string;
  soon: string;
  nav: string;
  games: Record<string, GameCopy>;
};

export const GAMES: GameEntry[] = [
  {
    slug: "river-crossing",
    buildSlug: "river-crossing",
    puzzle: "river",
    cover: "/games/covers/river-crossing.svg",
    localeParam: { name: "locale", zh: "zh-TW", en: "en" },
    accent: "#10b981",
    status: "live",
    playerRange: { min: 1, max: 1 },
    minAge: 6,
  },
  {
    slug: "night-bridge",
    buildSlug: "river-crossing",
    puzzle: "bridge",
    cover: "/games/covers/night-bridge.svg",
    localeParam: { name: "locale", zh: "zh-TW", en: "en" },
    accent: "#a5b4fc",
    status: "live",
    playerRange: { min: 1, max: 1 },
    minAge: 6,
  },
  {
    slug: "water-pouring",
    buildSlug: "river-crossing",
    puzzle: "water",
    cover: "/games/covers/water-pouring.svg",
    localeParam: { name: "locale", zh: "zh-TW", en: "en" },
    accent: "#67e8f9",
    status: "live",
    playerRange: { min: 1, max: 1 },
    minAge: 6,
  },
  {
    slug: "guess-duel",
    buildSlug: "guess-duel",
    cover: "/games/covers/guess-duel.svg",
    localeParam: { name: "locale", zh: "zh-TW", en: "en" },
    accent: "#f59e0b",
    status: "beta",
    playerRange: { min: 1, max: 2 },
    minAge: 8,
  },
  {
    slug: "werewolf",
    buildSlug: "werewolf",
    cover: "/games/covers/werewolf.svg",
    localeParam: { name: "lang", zh: "zh", en: "en" },
    accent: "#a78bfa",
    status: "beta",
    playerRange: { min: 3, max: 16 },
    minAge: 8,
  },
];

// Page-only collection: never treated as a playable game or static directory.
export const TABLETOP_COLLECTION = { slug: "tabletop-puzzles", cover: "/games/covers/tabletop-puzzles.svg" };
export const GAME_PAGE_SLUGS: readonly string[] = [...GAMES.map((game) => game.slug), TABLETOP_COLLECTION.slug];

export const OWN_GAME_SLUGS: readonly string[] = GAMES.map((g) => g.slug);

export const STATIC_GAME_PATH_SEGMENTS: readonly string[] = [...OWN_GAME_SLUGS, "covers"];

// covers is the public/games/covers folder; profile and boards are reserved
// for #68 leaderboard pages.
// #67 uses this list to block user games from taking these slugs.
export const RESERVED_GAME_SLUGS: readonly string[] = [...STATIC_GAME_PATH_SEGMENTS, TABLETOP_COLLECTION.slug, "profile", "boards"];

const COPY: Record<GamePageLocale, HubCopy> = {
  ...LOCALIZED_HUB_COPY,
  en: {
    metaTitle: "Games — play free original brain games on AppAI",
    metaDescription:
      "Original brain games from AppAI, played in the browser on phone or desktop: three 3D logic puzzles, a number duel for two and a party game for the whole family. No download, no sign-up needed to play.",
    label: "Games",
    title: "Games to play together",
    intro: [
      "Small original games made at AppAI: three logic puzzles to solve on your own, a number duel for a parent and child, and a party game for the whole family around one phone.",
      "Everything runs in your browser on a phone, tablet or computer. Nothing to install, and no sign-in needed to play.",
    ],
    notes: [
      "Games marked Beta are new — tell us what you think through Feedback.",
      "Online rooms (each player on their own phone with a room code) are coming soon.",
    ],
    play: "Play",
    details: "Details / Play",
    howToPlay: "How to play",
    players: "Players",
    ages: "Ages",
    beta: "Beta",
    soon: "Coming soon",
    nav: "Games",
    games: {
      ...TABLETOP_PUZZLE_COPY["en"],
      "tabletop-puzzles": {
        name: "Tabletop Puzzles",
        tagline: "Three 3D logic puzzles: River Crossing, Night Bridge and Water Pouring.",
        howToPlay: [
          "Pick a puzzle and one of three difficulty levels.",
          "Select who crosses, then tap the boat or lantern; tap two jugs to pour water.",
          "Get everyone across or measure the target amount of water in the fewest moves or minutes.",
        ],
        players: "1",
        ages: "6+",
      },
      "guess-duel": {
        name: "Guess Duel",
        tagline: "Hide a secret number, take turns guessing, and deduce your opponent's code from the A/B clues.",
        howToPlay: [
          "Pick 3 or 4 different digits as your secret.",
          "Take turns guessing. A = right digit, right place. B = right digit, wrong place.",
          "Play on one device, against the computer, or pass a link between two phones.",
        ],
        players: "2 (or 1 vs computer)",
        ages: "8+ (3 digits for kids, 4 for a challenge)",
      },
      "werewolf": {
        name: "Werewolf",
        tagline: "One phone, with the app or a person as host",
        howToPlay: [
          "Pick a host: pass the phone with the app as host, or let one adult read the script.",
          "At night the werewolves choose someone, the seer checks a player, and the witch can save or poison.",
          "By day everyone talks and votes to find the werewolves.",
        ],
        players: "3–16 players (3–12 with the app as host)",
        ages: "8+ (6–7 with family wording and a grown-up)",
      },
    },
  },
  "zh-TW": {
    metaTitle: "遊戲專區：在 AppAI 免費玩原創動腦遊戲",
    metaDescription: "AppAI 原創動腦小遊戲，手機、電腦打開瀏覽器就能玩：三個 3D 邏輯謎題、兩人猜數字對決、全家一起玩的派對遊戲。免下載，玩遊戲不用註冊。",
    label: "遊戲專區",
    title: "一起來動動腦",
    intro: [
      "這裡是 AppAI 自己做的原創小遊戲：三個適合一個人解的邏輯謎題、親子兩人的猜數字對決，還有全家圍著一支手機玩的派對遊戲。",
      "所有遊戲都在瀏覽器裡執行，手機、平板、電腦都能玩，不用安裝，玩遊戲也不用登入。",
    ],
    notes: ["標示「試玩版」的是新遊戲，玩完歡迎到「意見回饋」告訴我們。", "房號連線（每人用自己的手機輸入房號一起玩）即將推出。"],
    play: "開始玩",
    details: "遊戲介紹／開始玩",
    howToPlay: "怎麼玩",
    players: "人數",
    ages: "適合年齡",
    beta: "試玩版",
    soon: "即將推出",
    nav: "遊戲",
    games: {
      ...TABLETOP_PUZZLE_COPY["zh-TW"],
      "tabletop-puzzles": {
        name: "桌上謎題合集",
        tagline: "過河、夜過橋、量水，三個 3D 邏輯謎題等你來解。",
        howToPlay: ["選一個謎題，再選入門、進階或挑戰難度。", "選好旅伴，再點船或燈出發；量水時依序點兩個水壺互倒。", "把大家送到對岸或量出指定水量，挑戰最少趟數、最少步數或最短過橋時間。"],
        players: "1 人",
        ages: "6 歲以上",
      },
      "guess-duel": {
        name: "猜數字對決",
        tagline: "各自藏一組數字，輪流猜、看「幾A幾B」推理出對方的答案。",
        howToPlay: ["選 3 或 4 個不重複的數字當祕密。", "輪流猜：A 是數字和位置都對，B 是數字對、位置不對。", "可以在同一台裝置對戰、跟電腦玩，或用連結在兩支手機之間傳。"],
        players: "2 人（或 1 人對電腦）",
        ages: "8 歲以上（3 位數是兒童模式）",
      },
      "werewolf": {
        name: "狼人殺",
        tagline: "一支手機就能玩，App 或真人當主持人",
        howToPlay: ["選誰當主持人：App 主持就傳手機，真人主持就由一位大人照著台詞念。", "晚上狼人選人，預言家查人，女巫救人或毒人。", "白天大家討論、投票，抓出所有狼人。"],
        players: "3–16 人（App 主持 3–12 人）",
        ages: "8 歲以上（6–7 歲請開親子用語、大人陪看身分）",
      },
    },
  },
  "zh-CN": {
    metaTitle: "游戏专区：在 AppAI 免费玩原创动脑游戏",
    metaDescription: "AppAI 原创动脑小游戏，手机、电脑打开浏览器就能玩：三个 3D 逻辑谜题、两人猜数字对决、全家一起玩的派对游戏。免下载，玩游戏不用注册。",
    label: "游戏专区",
    title: "一起来动动脑",
    intro: [
      "这里是 AppAI 自己做的原创小游戏：三个适合一个人解的逻辑谜题、亲子两人的猜数字对决，还有全家围着一部手机玩的派对游戏。",
      "所有游戏都在浏览器里运行，手机、平板、电脑都能玩，不用安装，玩游戏也不用登录。",
    ],
    notes: ["标示“试玩版”的是新游戏，玩完欢迎到“意见反馈”告诉我们。", "房号联机（每人用自己的手机输入房号一起玩）即将推出。"],
    play: "开始玩",
    details: "游戏介绍／开始玩",
    howToPlay: "怎么玩",
    players: "人数",
    ages: "适合年龄",
    beta: "试玩版",
    soon: "即将推出",
    nav: "游戏",
    games: {
      ...TABLETOP_PUZZLE_COPY["zh-CN"],
      "tabletop-puzzles": {
        name: "桌上谜题合集",
        tagline: "过河、夜过桥、量水，三个 3D 逻辑谜题等你来解。",
        howToPlay: ["选一个谜题，再选入门、进阶或挑战难度。", "选好同伴，再点船或灯出发；量水时依次点两个水壶互相倒水。", "把大家送到对岸或量出指定水量，挑战最少趟数、最少步数或最短过桥时间。"],
        players: "1 人",
        ages: "6 岁以上",
      },
      "guess-duel": {
        name: "猜数字对决",
        tagline: "各自藏一组数字，轮流猜、看“几A几B”推理出对方的答案。",
        howToPlay: ["选 3 或 4 个不重复的数字当秘密。", "轮流猜：A 是数字和位置都对，B 是数字对、位置不对。", "可以在同一台设备对战、跟电脑玩，或用链接在两部手机之间传。"],
        players: "2 人（或 1 人对电脑）",
        ages: "8 岁以上（3 位数是儿童模式）",
      },
      "werewolf": {
        name: "狼人杀",
        tagline: "一部手机就能玩，App 或真人当主持人",
        howToPlay: ["选谁当主持人：App 主持就传手机，真人主持就由一位大人照着台词念。", "晚上狼人选人，预言家查人，女巫救人或毒人。", "白天大家讨论、投票，抓出所有狼人。"],
        players: "3–16 人（App 主持 3–12 人）",
        ages: "8 岁以上（6–7 岁请开亲子用语、大人陪看身份）",
      },
    },
  },
};

export function getGamesCopy(locale: string): HubCopy {
  return Object.hasOwn(COPY, locale) ? COPY[locale as GamePageLocale] : COPY.en;
}

export function getOwnGame(slug: string): GameEntry | undefined {
  return GAMES.find((game) => game.slug === slug);
}

export function isPlayableGame(game: GameEntry): boolean {
  return game.status === "live" || game.status === "beta";
}

/** App-router path; use the platform Link to add the visitor's locale prefix. */
export function gamePageHref(game: { slug: string }): string {
  return `/games/${game.slug}`;
}

/** Locale-free play/runtime and assets bypass next-intl; detail pages do not. */
export function isStaticGamePath(pathname: string): boolean {
  const segments = pathname.split("/").filter(Boolean);
  return segments[0] === "games" && (
    segments[1] === "covers" ||
    (segments.length >= 3 && OWN_GAME_SLUGS.includes(segments[1]))
  );
}

/** Same-origin play URL with the game's own language parameter. */
export function gamePlayHref(game: GameEntry, locale: string): string {
  // The game falls back for languages it does not implement; the platform bar
  // reads this locale independently. Preserve Werewolf's old lang=zh links.
  const lang = locale === "zh" || locale === "zh-TW" ? game.localeParam.zh : locale;
  return `${gamePageHref(game)}/play?${game.localeParam.name}=${encodeURIComponent(lang)}${game.puzzle ? `&game=${game.puzzle}` : ""}`;
}
