import { TABLETOP_PUZZLE_COPY } from "./tabletop-puzzles-copy.ts";
import { LOCALIZED_GAMES, LOCALIZED_GAME_LABELS, LOCALIZED_HUB_FAQ } from "./games-localized-copy.ts";

// All platform locales have authored copy. Unknown locales use English.
export const GAME_PAGE_LOCALES = ["en", "es", "zh-TW", "zh-CN", "ja", "ko", "de", "fr", "hi"] as const;
export type GamePageLocale = (typeof GAME_PAGE_LOCALES)[number];
export type GameFaq = { question: string; answer: string };
export type GamePageCopy = {
  metaTitle: string;
  description: string;
  intro: string;
  background: string;
  genre: string;
  faq: GameFaq[];
};

export function gameContentLocale(locale: string): GamePageLocale {
  return GAME_PAGE_LOCALES.find((value) => value === locale) ?? "en";
}

const COMMON_FAQ: Record<"en" | "zh-TW" | "zh-CN", GameFaq[]> = {
  en: [
    { question: "Is it free to play?", answer: "Yes. These AppAI games are free to play in your browser." },
    { question: "Do I need to install an app or sign in?", answer: "No download or sign-in is needed for the play modes described on this page. Open the game in your browser on a phone, tablet or computer." },
  ],
  "zh-TW": [
    { question: "玩遊戲需要付費嗎？", answer: "不用，這些 AppAI 小遊戲都能在瀏覽器裡免費玩。" },
    { question: "需要安裝 App 或登入嗎？", answer: "這一頁介紹的玩法不用下載，也不用登入。在手機、平板或電腦的瀏覽器裡打開就能玩。" },
  ],
  "zh-CN": [
    { question: "玩游戏需要付费吗？", answer: "不用，这些 AppAI 小游戏都能在浏览器里免费玩。" },
    { question: "需要安装 App 或登录吗？", answer: "这一页介绍的玩法不用下载，也不用登录。在手机、平板或电脑的浏览器里打开就能玩。" },
  ],
};

const LABELS = {
  ...LOCALIZED_GAME_LABELS,
  en: {
    background: "About this game", faq: "Questions parents ask", moreGames: "More games",
    back: "Back to all games", betaNotice: "Beta: this is a new game. Tell us what you think through Feedback.",
    home: "Home", allGames: "All games", docs: "Docs", faqLink: "FAQ", gameInfo: "← Game info", appaiHome: "AppAI home", breadcrumb: "Breadcrumb",
  },
  "zh-TW": {
    background: "遊戲背景", faq: "家長常問的問題", moreGames: "更多遊戲",
    back: "回到遊戲專區", betaNotice: "試玩版（Beta）：這是新遊戲，玩完歡迎到「意見回饋」告訴我們。",
    home: "首頁", allGames: "全部遊戲", docs: "說明", faqLink: "常見問題", gameInfo: "← 遊戲介紹", appaiHome: "AppAI 首頁", breadcrumb: "導覽路徑",
  },
  "zh-CN": {
    background: "游戏背景", faq: "家长常问的问题", moreGames: "更多游戏",
    back: "回到游戏专区", betaNotice: "试玩版（Beta）：这是新游戏，玩完欢迎到“意见反馈”告诉我们。",
    home: "首页", allGames: "全部游戏", docs: "说明", faqLink: "常见问题", gameInfo: "← 游戏介绍", appaiHome: "AppAI 首页", breadcrumb: "导航路径",
  },
};

const COPY: Record<GamePageLocale, Record<string, GamePageCopy>> = {
  ...LOCALIZED_GAMES,
  en: {
    ...TABLETOP_PUZZLE_COPY["en"],
    "tabletop-puzzles": {
      metaTitle: "Tabletop Puzzles — free logic games for kids and parents | AppAI",
      description: "Play River Crossing, Night Bridge and Water Pouring in your browser. Three free 3D logic puzzles for ages 6+, with no download or sign-in.",
      intro: "Three tabletop logic puzzles to think through on your own or talk through with your child.",
      background: "We put three familiar logic challenges on a small 3D tabletop: carry everyone across a river, share a lantern on a night bridge, or measure water with jugs. Each puzzle asks you to plan a move and see what changes. Choose a difficulty that leaves room to experiment; a grown-up can ask questions while the child controls the next move.",
      genre: "Logic puzzle",
      faq: [
        { question: "Is this a game to play while waiting in line or at a restaurant?", answer: "You can try a puzzle together while seated and waiting for food. There is no need to finish before the food arrives. In a moving line, put the phone away when you need to watch where you are going; choose River Crossing or Water Pouring if you want to think without a time constraint." },
        { question: "What ages are Tabletop Puzzles for?", answer: "We suggest ages 6 and up. Start with the easiest difficulty and help read the rules. The harder puzzles can also give older children and adults something to work through." },
        { question: "Can a parent and child play together on one phone?", answer: "Yes. It is a single-player puzzle, but you can share one screen: one person suggests a move and the other taps it. There is no separate multiplayer room to set up for this." },
        { question: "Can this be a short screen-time activity for kids?", answer: "It can be a shared problem to discuss instead of just watching a screen. Agree on one puzzle or a stopping point together. It still uses a screen, and we do not claim it replaces off-screen play or improves learning outcomes." },
        ...COMMON_FAQ.en,
      ],
    },
    "guess-duel": {
      metaTitle: "Guess Duel Beta — a free number game for two | AppAI",
      description: "Hide a number and use A/B clues to guess the other code. A free browser game for parents and kids ages 8+, on one phone or against the computer. Beta.",
      intro: "A turn-taking number duel: hide your code and use each clue to narrow down the other one.",
      background: "Guess Duel is our Beta take on the familiar A/B number deduction game. A correct digit in the correct place earns an A; a correct digit elsewhere earns a B. You decide what to try next from those clues. Start with three digits for a gentler game, or use four when both players want more to keep track of.",
      genre: "Number deduction",
      faq: [
        { question: "Can we play Guess Duel while waiting for food at a restaurant?", answer: "Yes, if you have time to take turns and keep each secret number hidden. You can stop guessing when the meal arrives. For a moving queue, wait until you can safely look at the phone." },
        { question: "What age can children start playing?", answer: "We suggest ages 8 and up. Use three different digits first and explain the A/B clues together. Reading the clues and keeping a secret may still need an adult's help." },
        { question: "Can two people play on one phone?", answer: "Yes. Take turns with the same device and let the other person look away when you enter a secret. A solo player can also choose the computer opponent. Link-based play between two phones is another option; room-code play is coming soon." },
        { question: "Is this a way to spend screen time together with my child?", answer: "You can talk about why a guess fits the clues and agree to stop after a duel. It is still a screen activity. There is no promise of educational results, and Beta means the game is still being refined." },
        ...COMMON_FAQ.en,
      ],
    },
    werewolf: {
      metaTitle: "Werewolf Beta — a free family party game on one phone | AppAI",
      description: "Play Werewolf together with one phone, using the app or an adult as host. A free browser party game for ages 8+, with family wording available. Beta.",
      intro: "Gather a group, pass one phone, and talk your way through a game of hidden roles.",
      background: "Our Beta Werewolf game helps a group run the familiar night-and-day social deduction game. The app can guide a pass-the-phone game, or an adult can read the host script. Players keep their roles secret and discuss who might be a werewolf. The theme includes deception and players being removed from play, so read the roles together before deciding whether it suits your family.",
      genre: "Social deduction party game",
      faq: [
        { question: "Is Werewolf a game to play at a restaurant or while waiting in line?", answer: "It works better around a table where everyone can hear the host and take part in the discussion. It is not a good fit for a moving line or a quiet waiting room. At a restaurant, consider the people nearby and leave enough time for the group to finish or agree to stop." },
        { question: "What ages is this family Werewolf game for?", answer: "We suggest ages 8 and up. Ages 6–7 may join with family wording turned on and a grown-up helping with roles. Hidden identities, bluffing and being voted out can be upsetting for some children; decide together whether to play." },
        { question: "How many people can play together on one phone?", answer: "With the app as host, 3–12 players share one phone. With a person reading the host script, the game supports 3–16 players. Keep the screen private when a player checks a role." },
        { question: "Does this keep everyone looking at a screen?", answer: "The phone guides roles and the host's steps; the discussion happens among the people at the table. There is still some screen use. Agree on a stopping point and let anyone sit out if the theme or bluffing is uncomfortable." },
        ...COMMON_FAQ.en,
      ],
    },
  },
  "zh-TW": {
    ...TABLETOP_PUZZLE_COPY["zh-TW"],
    "tabletop-puzzles": {
      metaTitle: "桌上謎題合集：親子免費邏輯小遊戲｜AppAI",
      description: "在瀏覽器裡玩過河、夜過橋、量水，三個適合 6 歲以上的免費 3D 邏輯謎題。免下載、免登入，和孩子一起想下一步。",
      intro: "三個桌上邏輯謎題，可以自己想，也可以和孩子一起討論下一步。",
      background: "我們把三種熟悉的邏輯挑戰放上 3D 小桌面：帶大家過河、共用一盞燈過夜橋，或用水壺量出指定水量。每走一步，都能看看條件怎麼改變。先選一個能慢慢試的難度，大人負責提問，孩子決定下一步怎麼走。",
      genre: "邏輯謎題",
      faq: [
        { question: "適合排隊或在餐廳等餐時和孩子玩嗎？", answer: "坐著等餐時，可以一起試一道謎題，餐點來了就先放下。移動中的隊伍要先注意腳步；想慢慢討論、不受時間條件影響，可以先選過河或量水。" },
        { question: "桌上謎題適合幾歲？", answer: "建議 6 歲以上，先從入門難度開始，大人可以陪讀規則。較難的關卡也適合大孩子和成人一起想。" },
        { question: "親子可以共用一支手機玩嗎？", answer: "可以。這是單人解謎，但能一起看同一個畫面：一個人提議走法，另一個人操作，不用另外建立多人房間。" },
        { question: "想安排一小段螢幕時間，可以怎麼玩？", answer: "可以把它當成一起討論的題目，先約好解一題或到哪裡就停。它仍然需要看螢幕，我們不把它當成戶外活動的替代品，也不保證學習成效。" },
        ...COMMON_FAQ["zh-TW"],
      ],
    },
    "guess-duel": {
      metaTitle: "猜數字對決 Beta：親子兩人免費推理遊戲｜AppAI",
      description: "各自藏一組數字，用幾 A 幾 B 的線索猜出答案。適合 8 歲以上，在同一支手機對戰或跟電腦玩，免下載、免登入。試玩版。",
      intro: "藏好你的數字，輪流猜，用每一條線索慢慢縮小答案範圍。",
      background: "猜數字對決是我們做的 A/B 數字推理試玩版（Beta）。數字和位置都對是 A，數字對但位置不對是 B，再根據線索決定下一次要猜什麼。先用三位數熟悉規則，雙方都想多想一點時，再選四位數。",
      genre: "數字推理",
      faq: [
        { question: "可以在餐廳等餐時玩猜數字對決嗎？", answer: "可以，找個能輪流操作、也能藏好祕密數字的位置，餐點來了就先停。排隊時若需要往前移動，請先收好手機、注意腳步。" },
        { question: "孩子幾歲可以開始玩？", answer: "建議 8 歲以上，先用三個不重複的數字，一起弄懂 A/B 線索。讀線索和保守祕密的部分，可能還需要大人幫忙。" },
        { question: "兩個人能用同一支手機玩嗎？", answer: "可以，輪流操作，輸入祕密時請對方先別看。也能一個人跟電腦對戰，或用連結在兩支手機之間傳；輸入房號的連線玩法還在準備中。" },
        { question: "想和孩子一起用螢幕，可以怎麼安排？", answer: "一起說說為什麼這次猜法符合線索，先約好一場結束就休息。它仍然是螢幕活動，不保證教育效果；試玩版也表示遊戲還在調整，歡迎告訴我們哪裡不順。" },
        ...COMMON_FAQ["zh-TW"],
      ],
    },
    werewolf: {
      metaTitle: "狼人殺 Beta：一支手機玩的免費親子派對遊戲｜AppAI",
      description: "全家共用一支手機玩狼人殺，由 App 或大人當主持人。適合 8 歲以上，可開親子用語，瀏覽器免費玩、免下載。試玩版。",
      intro: "找幾個人圍坐，傳一支手機，從討論中找出藏起來的身分。",
      background: "這個狼人殺試玩版（Beta）幫大家跑熟悉的黑夜、白天推理流程：可以讓 App 帶著傳手機，也可以由大人照台詞主持。每個人藏好身分，討論誰可能是狼人。主題包含說謊和出局，開始前先一起讀角色，看看適不適合自己家。",
      genre: "社交推理派對遊戲",
      faq: [
        { question: "狼人殺適合餐廳等餐、排隊或候診時玩嗎？", answer: "比較適合圍桌坐好、大家都能聽見主持人並參與討論的場合，不適合移動中的隊伍或需要安靜的候診室。在餐廳要顧及附近客人，也要留出一起結束或約好停下來的時間。" },
        { question: "親子狼人殺適合幾歲？", answer: "建議 8 歲以上；6–7 歲可以開啟親子用語，由大人陪看身分。隱藏身分、說謊和被投票出局可能讓部分孩子不舒服，先一起決定要不要玩。" },
        { question: "一支手機可以讓幾個人一起玩？", answer: "App 主持可供 3–12 人傳手機，真人照台詞主持可供 3–16 人玩。查看身分時，要讓其他人先別看畫面。" },
        { question: "大家會一直盯著螢幕嗎？", answer: "手機負責顯示身分和主持步驟，討論則是桌邊的人彼此說話，仍然有一部分螢幕時間。先約好停下來的時機，任何人覺得主題或說謊不舒服，都可以不參加。" },
        ...COMMON_FAQ["zh-TW"],
      ],
    },
  },
  "zh-CN": {
    ...TABLETOP_PUZZLE_COPY["zh-CN"],
    "tabletop-puzzles": {
      metaTitle: "桌上谜题合集：亲子免费逻辑小游戏｜AppAI",
      description: "在浏览器里玩过河、夜过桥、量水，三个适合 6 岁以上的免费 3D 逻辑谜题。免下载、免登录，和孩子一起想下一步。",
      intro: "三个桌上逻辑谜题，可以自己想，也可以和孩子一起讨论下一步。",
      background: "我们把三种熟悉的逻辑挑战放上 3D 小桌面：带大家过河、共用一盏灯过夜桥，或用水壶量出指定水量。每走一步，都能看看条件怎么改变。先选一个能慢慢试的难度，大人负责提问，孩子决定下一步怎么走。",
      genre: "逻辑谜题",
      faq: [
        { question: "适合排队或在餐厅等餐时和孩子玩吗？", answer: "坐着等餐时，可以一起试一道谜题，餐点来了就先放下。移动中的队伍要先注意脚步；想慢慢讨论、不受时间条件影响，可以先选过河或量水。" },
        { question: "桌上谜题适合几岁？", answer: "建议 6 岁以上，先从入门难度开始，大人可以陪读规则。较难的关卡也适合大孩子和成人一起想。" },
        { question: "亲子可以共用一部手机玩吗？", answer: "可以。这是单人解谜，但能一起看同一个画面：一个人提议走法，另一个人操作，不用另外创建多人房间。" },
        { question: "想安排一小段屏幕时间，可以怎么玩？", answer: "可以把它当成一起讨论的题目，先约好解一题或到哪里就停。它仍然需要看屏幕，我们不把它当成户外活动的替代品，也不保证学习成效。" },
        ...COMMON_FAQ["zh-CN"],
      ],
    },
    "guess-duel": {
      metaTitle: "猜数字对决 Beta：亲子两人免费推理游戏｜AppAI",
      description: "各自藏一组数字，用几 A 几 B 的线索猜出答案。适合 8 岁以上，在同一部手机对战或跟电脑玩，免下载、免登录。试玩版。",
      intro: "藏好你的数字，轮流猜，用每一条线索慢慢缩小答案范围。",
      background: "猜数字对决是我们做的 A/B 数字推理试玩版（Beta）。数字和位置都对是 A，数字对但位置不对是 B，再根据线索决定下一次要猜什么。先用三位数熟悉规则，双方都想多想一点时，再选四位数。",
      genre: "数字推理",
      faq: [
        { question: "可以在餐厅等餐时玩猜数字对决吗？", answer: "可以，找个能轮流操作、也能藏好秘密数字的位置，餐点来了就先停。排队时若需要往前移动，请先收好手机、注意脚步。" },
        { question: "孩子几岁可以开始玩？", answer: "建议 8 岁以上，先用三个不重复的数字，一起弄懂 A/B 线索。读线索和保守秘密的部分，可能还需要大人帮忙。" },
        { question: "两个人能用同一部手机玩吗？", answer: "可以，轮流操作，输入秘密时请对方先别看。也能一个人跟电脑对战，或用链接在两部手机之间传；输入房号的联机玩法还在准备中。" },
        { question: "想和孩子一起用屏幕，可以怎么安排？", answer: "一起说说为什么这次猜法符合线索，先约好一场结束就休息。它仍然是屏幕活动，不保证教育效果；试玩版也表示游戏还在调整，欢迎告诉我们哪里不顺。" },
        ...COMMON_FAQ["zh-CN"],
      ],
    },
    werewolf: {
      metaTitle: "狼人杀 Beta：一部手机玩的免费亲子派对游戏｜AppAI",
      description: "全家共用一部手机玩狼人杀，由 App 或大人当主持人。适合 8 岁以上，可开亲子用语，浏览器免费玩、免下载。试玩版。",
      intro: "找几个人围坐，传一部手机，从讨论中找出藏起来的身份。",
      background: "这个狼人杀试玩版（Beta）帮大家跑熟悉的黑夜、白天推理流程：可以让 App 带着传手机，也可以由大人照台词主持。每个人藏好身份，讨论谁可能是狼人。主题包含说谎和出局，开始前先一起读角色，看看适不适合自己家。",
      genre: "社交推理派对游戏",
      faq: [
        { question: "狼人杀适合餐厅等餐、排队或候诊时玩吗？", answer: "比较适合围桌坐好、大家都能听见主持人并参与讨论的场合，不适合移动中的队伍或需要安静的候诊室。在餐厅要顾及附近客人，也要留出一起结束或约好停下来的时间。" },
        { question: "亲子狼人杀适合几岁？", answer: "建议 8 岁以上；6–7 岁可以开启亲子用语，由大人陪看身份。隐藏身份、说谎和被投票出局可能让部分孩子不舒服，先一起决定要不要玩。" },
        { question: "一部手机可以让几个人一起玩？", answer: "App 主持可供 3–12 人传手机，真人照台词主持可供 3–16 人玩。查看身份时，要让其他人先别看画面。" },
        { question: "大家会一直盯着屏幕吗？", answer: "手机负责显示身份和主持步骤，讨论则是桌边的人彼此说话，仍然有一部分屏幕时间。先约好停下来的时机，任何人觉得主题或说谎不舒服，都可以不参加。" },
        ...COMMON_FAQ["zh-CN"],
      ],
    },
  },
};

export function getGamePageCopy(locale: string, slug: string): GamePageCopy {
  return COPY[gameContentLocale(locale)][slug];
}

export function getGamePageLabels(locale: string) {
  return LABELS[gameContentLocale(locale)];
}

const HUB_FAQ: Record<GamePageLocale, GameFaq[]> = {
  ...LOCALIZED_HUB_FAQ,
  en: [
    { question: "Which games can we play at a restaurant while waiting for food?", answer: "Try a river crossing, bridge and torch, or water jug puzzle together on one phone. Guess Duel lets two people take turns. Stop when the meal arrives; Werewolf is better when your group has time and space to talk." },
    { question: "Are these free online games for kids?", answer: "The games are free in your browser with no download. Check each game's age guidance and rules with a grown-up. Sign-in is needed to upload a leaderboard score, not to play." },
    { question: "Which are quiet waiting room games?", answer: "The three tabletop puzzles work well for quiet discussion with sound and music off. Werewolf needs group discussion and is better suited to a table away from a quiet waiting room." },
    { question: "Can we play while waiting in line?", answer: "Try a puzzle while the queue is stationary. Put the phone away when the line moves, and agree on a stopping point together." },
  ],
  "zh-TW": [
    { question: "在餐廳等餐時可以和孩子玩什麼？", answer: "可以共用一支手機解過河、夜過橋或量水謎題，也能兩人輪流玩猜數字對決。餐點來了就先停；狼人殺則適合有時間和空間討論的小團體。" },
    { question: "這些是免下載的免費親子線上遊戲嗎？", answer: "是，開瀏覽器就能免費玩。先和大人看每款遊戲的年齡建議與規則；玩遊戲不用登入，上傳排行榜成績才要登入。" },
    { question: "候診時有哪些能安靜玩的遊戲？", answer: "三款桌上謎題都能關掉音效與音樂，小聲討論。狼人殺需要團體討論，比較適合能聊天的桌邊。" },
    { question: "排隊等待時能玩嗎？", answer: "隊伍停著時可以試幾步，開始移動就先收好手機，也可以事先約好停下來的時機。" },
  ],
  "zh-CN": [
    { question: "在餐厅等餐时可以和孩子玩什么？", answer: "可以共用一部手机解过河、夜过桥或量水谜题，也能两人轮流玩猜数字对决。餐点来了就先停；狼人杀则适合有时间和空间讨论的小团体。" },
    { question: "这些是免下载的免费亲子在线游戏吗？", answer: "是，打开浏览器就能免费玩。先和大人看每款游戏的年龄建议与规则；玩游戏不用登录，上传排行榜成绩才要登录。" },
    { question: "候诊时有哪些能安静玩的游戏？", answer: "三款桌上谜题都能关掉音效与音乐，小声讨论。狼人杀需要团体讨论，比较适合能聊天的桌边。" },
    { question: "排队等待时能玩吗？", answer: "队伍停着时可以试几步，开始移动就先收好手机，也可以事先约好停下来的时机。" },
  ],
};

export function getGamesHubFaq(locale: string) {
  return HUB_FAQ[gameContentLocale(locale)];
}
