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
    metaTitle: "Free browser games to play with kids while waiting | AppAI",
    metaDescription: "Free browser games for kids and families waiting at a restaurant, in a queue or at the doctor’s office. Share a puzzle or find a game for a small group.",
    label: "Games",
    title: "Free games to play with kids while waiting",
    intro: ["Waiting for food, standing in a queue, or sitting at the doctor’s office? Share a free browser puzzle with your child and put it down when it’s your turn.", "Try River Crossing or Water Pouring for quiet play, or Guess Duel for two. For a small group with room to talk, choose Werewolf around a table. No download, sign-in or extra props needed."],
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
    metaTitle: "等餐、排隊、候診時和孩子玩的免費小遊戲｜AppAI",
    metaDescription: "餐廳等餐、排隊或候診時，和孩子共用手機玩免費瀏覽器小遊戲。一起解過河、量水謎題，或兩人猜數字；能聊天的小團體也有狼人殺可選。免下載、免登入。",
    label: "遊戲專區",
    title: "等待時，和孩子一起玩免費小遊戲",
    intro: ["在餐廳等餐、排隊或候診時，和孩子共用一支手機解謎，輪到自己就先放下。所有遊戲都能在瀏覽器免費玩。", "安靜的地方可選過河或量水，兩人對戰可試猜數字。能圍桌聊天的小團體則可選狼人殺。不用下載、登入，也不需要準備額外道具。"],
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
    metaTitle: "等餐、排队、候诊时和孩子玩的免费小游戏｜AppAI",
    metaDescription: "餐厅等餐、排队或候诊时，和孩子共用手机玩免费浏览器小游戏。一起解过河、量水谜题，或两人猜数字；能聊天的小团体也有狼人杀可选。免下载、免登录。",
    label: "游戏专区",
    title: "等待时，和孩子一起玩免费小游戏",
    intro: ["在餐厅等餐、排队或候诊时，和孩子共用一部手机解谜，轮到自己就先放下。所有游戏都能在浏览器免费玩。", "安静的地方可选过河或量水，两人对战可试猜数字。能围桌聊天的小团体则可选狼人杀。不用下载、登录，也不需要准备额外道具。"],
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
  const lang = gameLocaleValue(game, locale);
  return `${gamePageHref(game)}/play?${game.localeParam.name}=${encodeURIComponent(lang)}${game.puzzle ? `&game=${game.puzzle}` : ""}`;
}

export function gameLocaleValue(game: GameEntry, locale: string): string {
  return locale === "zh" || locale === "zh-TW" ? game.localeParam.zh : locale;
}
