// Catalog for the /games hub (#64). Each game is a static build served from
// public/games/<slug>/ on this origin, so room-code play can use the
// first-party appai.info session (Safari blocks third-party cookies).
// Copy lives here, not in src/messages, like directory-copy.ts: it is
// owner-written content in en / zh-TW / zh-CN, other locales fall back to en.

export type GameLocaleParam = { name: string; zh: string; en: string };

export type GameEntry = {
  slug: string;
  /** Cover art under public/games/covers/. */
  cover: string;
  /** Query parameter the game reads for its language. */
  localeParam: GameLocaleParam;
  /** Accent used for the card. */
  accent: string;
  /** live/beta: playable link. soon: card shown, no link, no files served. */
  status: "live" | "beta" | "soon";
};

export type GameCopy = {
  name: string;
  tagline: string;
  howToPlay: string[];
  players: string;
  ages: string;
};

type HubCopy = {
  metaTitle: string;
  metaDescription: string;
  label: string;
  title: string;
  intro: string[];
  notes: string[];
  play: string;
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
    cover: "/games/covers/river-crossing.svg",
    localeParam: { name: "locale", zh: "zh-TW", en: "en" },
    accent: "#10b981",
    status: "live",
  },
  {
    slug: "guess-duel",
    cover: "/games/covers/guess-duel.svg",
    localeParam: { name: "locale", zh: "zh-TW", en: "en" },
    accent: "#f59e0b",
    status: "soon",
  },
  {
    slug: "snack-sneak",
    cover: "/games/covers/snack-sneak.svg",
    localeParam: { name: "lang", zh: "zh", en: "en" },
    accent: "#ec4899",
    status: "soon",
  },
];

const COPY: Record<string, HubCopy> = {
  en: {
    metaTitle: "Games — play free original brain games on AppAI",
    metaDescription:
      "Original logic puzzles and family party games you can play in the browser on phone or desktop. No download, no ads, no sign-up needed to play.",
    label: "Games",
    title: "Games to play together",
    intro: [
      "Small original games made at AppAI: logic puzzles to solve alone, number duels for a parent and child, and party games for the whole family around one phone.",
      "Everything runs in your browser on a phone, tablet or computer. Nothing to install, and no sign-in needed to play.",
    ],
    notes: [
      "More games are on the way — cards marked Coming soon open once they pass testing.",
      "Online rooms (each player on their own phone with a room code) are coming soon.",
    ],
    play: "Play",
    howToPlay: "How to play",
    players: "Players",
    ages: "Ages",
    beta: "Beta",
    soon: "Coming soon",
    nav: "Games",
    games: {
      "river-crossing": {
        name: "River Crossing",
        tagline: "One small boat, a few passengers who can't be left alone together — get everyone safely across.",
        howToPlay: [
          "Tap passengers to put them in the boat, then tap the boat to cross.",
          "Don't leave a pair that will cause trouble alone together on either bank.",
          "Three levels, from 7 crossings to 13. Undo one step at a time.",
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
      "snack-sneak": {
        name: "Hidden-role party game",
        tagline: "A family-friendly whodunit for a group: everyone gets a secret role, then talks it over and votes.",
        howToPlay: [
          "Everyone secretly sees their own role.",
          "The app hosts each night and morning, so no one has to sit out as host.",
          "Discuss, vote, and see which side wins.",
        ],
        players: "5–12",
        ages: "8+",
      },
    },
  },
  "zh-TW": {
    metaTitle: "遊戲專區：在 AppAI 免費玩原創動腦遊戲",
    metaDescription: "原創益智謎題與親子派對遊戲，手機、電腦打開瀏覽器就能玩。免下載、沒有廣告，玩遊戲不用註冊。",
    label: "遊戲專區",
    title: "一起來動動腦",
    intro: [
      "這裡是 AppAI 自己做的原創小遊戲：一個人解的邏輯謎題、親子兩人的猜數字對決，還有全家圍著一支手機玩的派對遊戲。",
      "所有遊戲都在瀏覽器裡執行，手機、平板、電腦都能玩，不用安裝，玩遊戲也不用登入。",
    ],
    notes: ["更多遊戲準備中，標示「即將推出」的遊戲通過測試後就會開放。", "房號連線（每人用自己的手機輸入房號一起玩）即將推出。"],
    play: "開始玩",
    howToPlay: "怎麼玩",
    players: "人數",
    ages: "適合年齡",
    beta: "試玩版",
    soon: "即將推出",
    nav: "遊戲",
    games: {
      "river-crossing": {
        name: "過河謎題",
        tagline: "一艘小船、幾位不能單獨相處的乘客，排好順序，把大家平安送到對岸。",
        howToPlay: ["點乘客上船，再點小船過河。", "會出事的組合不能單獨留在同一邊岸上。", "三個關卡，最少 7 趟到 13 趟，可以一步一步悔棋。"],
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
      "snack-sneak": {
        name: "隱藏身分推理遊戲",
        tagline: "適合全家一起玩的多人推理遊戲：每個人拿到祕密身分，大家討論、投票，看哪一邊贏。",
        howToPlay: ["每個人偷偷看自己的身分。", "晚上和白天都由 app 主持，不用有人專門當主持人。", "大家討論、投票，看哪一邊先達成目標。"],
        players: "5–12 人",
        ages: "8 歲以上",
      },
    },
  },
  "zh-CN": {
    metaTitle: "游戏专区：在 AppAI 免费玩原创动脑游戏",
    metaDescription: "原创益智谜题与亲子派对游戏，手机、电脑打开浏览器就能玩。免下载、没有广告，玩游戏不用注册。",
    label: "游戏专区",
    title: "一起来动动脑",
    intro: [
      "这里是 AppAI 自己做的原创小游戏：一个人解的逻辑谜题、亲子两人的猜数字对决，还有全家围着一部手机玩的派对游戏。",
      "所有游戏都在浏览器里运行，手机、平板、电脑都能玩，不用安装，玩游戏也不用登录。",
    ],
    notes: ["更多游戏准备中，标示“即将推出”的游戏通过测试后就会开放。", "房号联机（每人用自己的手机输入房号一起玩）即将推出。"],
    play: "开始玩",
    howToPlay: "怎么玩",
    players: "人数",
    ages: "适合年龄",
    beta: "试玩版",
    soon: "即将推出",
    nav: "游戏",
    games: {
      "river-crossing": {
        name: "过河谜题",
        tagline: "一艘小船、几位不能单独相处的乘客，排好顺序，把大家平安送到对岸。",
        howToPlay: ["点乘客上船，再点小船过河。", "会出事的组合不能单独留在同一边岸上。", "三个关卡，最少 7 趟到 13 趟，可以一步一步悔棋。"],
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
      "snack-sneak": {
        name: "隐藏身份推理游戏",
        tagline: "适合全家一起玩的多人推理游戏：每个人拿到秘密身份，大家讨论、投票，看哪一边赢。",
        howToPlay: ["每个人偷偷看自己的身份。", "晚上和白天都由 app 主持，不用有人专门当主持人。", "大家讨论、投票，看哪一边先达成目标。"],
        players: "5–12 人",
        ages: "8 岁以上",
      },
    },
  },
};

export function getGamesCopy(locale: string): HubCopy {
  return COPY[locale] ?? COPY.en;
}

/** Same-origin play URL with the game's own language parameter. */
export function gamePlayHref(game: GameEntry, locale: string): string {
  const lang = locale.startsWith("zh") ? game.localeParam.zh : game.localeParam.en;
  return `/games/${game.slug}?${game.localeParam.name}=${encodeURIComponent(lang)}`;
}
