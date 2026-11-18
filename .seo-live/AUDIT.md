# APPAI ops #67 — SEO re-check（audit only）

2026-11-18（Asia/Taipei）；branch `claude/67-seo-recheck`，HEAD `3ddf782`。依提供的 production Googlebot 快照及目前程式碼稽核，對照 `previous-audit-2026-11-09.md`。未修改 tracked files、未連 DB、未做網路寫入。

**結論：未在提供的快照確認 P1 索引阻斷。包 A/B 的主要修正已出現在正式 HTML；仍有 9 項 P2，重點是 sitemap 完整性、等待場景首屏文案、缺少 description、目錄翻譯，以及索引／分享圖／schema 的殘留問題。不能據此宣稱全站沒有 404 或所有網址均可索引。**

證據範圍：12 份 HTML、5 份文字/XML 快照。HTML 解析涵蓋 30 個 JSON-LD script、161 個 img、514 個 a；沒有 JSON parse error、沒有缺少 alt 屬性的 img、沒有缺少 href 或 javascript: href 的 a。空 alt 多為重複封面、裝飾與品牌圖，不當成缺陷。沒有用 React hydration payload 中的字串充當可見內容。

限制：快照沒有 HTTP status/headers，沒有 hosted child、政策頁、中文遊戲詳情或 sitemap shard。`sitemap.xml.html` 只是索引，指向 `https://appai.info/sitemaps/sitemap/0.xml`；本輪 GET 因 DNS 失敗，web reader 也未取得。因此下文 **S=快照確認，C=程式碼／離線 fixture 確認**；C 不等於已驗證正式 HTTP 回應。未量測排名、搜尋量、Google 選定 canonical、圖片 HTTP 可用性或 Core Web Vitals。

## 各頁型核對

長度是 Unicode 字元數，供編輯參考，並非 Google 硬性長度門檻。短的中日文 description 不因字數少而判失敗。

| 快照／頁型 | title；title / description 字數 | H1／語言／canonical／hreflang | 社群／JSON-LD／結果 |
|---|---|---|---|
| `home.html` `/` | Host AI Apps Free for Developers & Agents \| AppAI；49 / 150 | 1 H1，H2→H3；`en`；self `https://appai.info/`；9 語+x-default | OG/Twitter 完整，PNG；Organization、WebSite、WebApplication、FAQPage。開發者／agent hosting 關鍵字明確。 |
| `zh-TW.html` `/zh-TW` | 免費託管 AI app — 為開發者與 agent 打造 \| AppAI；36 / 78 | 1 H1，H2→H3；`zh-TW`；self `/zh-TW`；同上，與英日互指 | title、description、H1 已翻譯；同上 schema。 |
| `ja.html` `/ja` | AIアプリを無料でホスティング — 開発者とエージェント向け \| AppAI；38 / 75 | 1 H1；`ja`；self `/ja`；同上，與英中互指 | metadata 已翻譯；目錄入口仍是 “Find what you need / Websites / Tools / Apps”（F5）。 |
| `websites.html` `/websites` | AI Websites, Portfolios & Landing Pages \| AppAI；47 / 101 | 1 H1 “Websites”，直接接 H3 卡片；`en`；self；9 語+x-default | OG/Twitter PNG；Organization、WebSite、WebApplication；無 ItemList／BreadcrumbList。 |
| `tools.html` `/tools` | AI Tools for Everyday Work \| AppAI；34 / 113 | 1 H1 “Tools”，直接接 H3；`en`；self；9 語+x-default | 同上；可爬卡片連結。 |
| `apps.html` `/apps` | Explore AI Apps & Projects \| AppAI；34 / 118 | 1 H1 “Explore AppAI”；H3 普通卡與 H2 個人卡混用；`en`；self；9 語+x-default | 同上。這個 URL 是全目錄，`?kind=apps` 才是 app 子集；目前 title 並非錯把所有內容當原生 App。 |
| `games.html` `/games` | Games — play free original brain games on AppAI；47 / 200 | 1 H1 “Games to play together”；H2 遊戲→H3 how-to；`en`；self；9 語+x-default | OG/Twitter PNG；Organization、WebSite、WebApplication、BreadcrumbList、FAQPage；無 hub ItemList。 |
| `zh-TW_games.html` `/zh-TW/games` | 遊戲專區：在 AppAI 免費玩原創動腦遊戲；22 / 70 | 1 H1 “一起來動動腦”；`zh-TW`；self；與英文同一組互指 | metadata／FAQ 已翻譯；schema 同上。 |
| `games_river-crossing.html` `/games/river-crossing` | River Crossing Puzzle — free logic game for families \| AppAI；60 / 150 | 1 H1 “River Crossing”，其後 H2；`en`；self；9 語+x-default | 可爬 intro、how-to、FAQ、其他遊戲 `<a>`；VideoGame、FAQPage、BreadcrumbList；分享圖是 SVG（F8）。 |
| `p_grayson.html` `/p/grayson` | Grayson；7 / 239 | 1 H1，H2→H3；`en`；self；en、zh-CN、zh-TW+x-default | OG/Twitter 有 JPG；Organization、WebSite、ProfilePage（Person）、BreadcrumbList、ItemList。title 太泛、description 可縮短（F12）。 |
| `p_grayson_zh-TW.html` `/p/grayson/zh-TW` | Grayson；7 / 77 | 1 H1，H2→H3；`zh-TW`；self；與英文 reciprocal | description 本地化；title 沿用姓名可接受但缺職業詞；schema 同上。zh-CN 目標沒有快照，未驗證其回應。 |
| `p_graysonviews.html` `/p/graysonviews` | Grayson Views；13 / **缺少** | 1 H1，45 個 H2；`zh-TW`；self；**只有 zh-TW+self x-default，沒有虛構 en** | OG/Twitter 有 JPG，但兩者 description 也缺；Organization、WebSite、WebPage、BreadcrumbList、ItemList。TW/CN UI switcher 不等於 hreflang（轉字版不應被列入）。 |
| `spec.html`、`spec_pages.html` | 純文字 Markdown，HTML title/meta/H1/OG 不適用 | locale-free；沒有 HTML canonical／hreflang，並非 HTML SEO 漏標 | 與 `docs/spec/overview.md`、`docs/spec/pages.md` **逐 byte 相同**；handlers 回 `text/plain`，不設 X-Robots-Tag。不要為補 HTML tags 破壞 agent 讀取合約。 |
| hosted child／policy／其他 locales（C） | 走共享 metadata；政策用獨立本地化標題與描述 | `page.tsx:67`、`:89` 與 `hosted-page-urls.ts:31`：依實際子頁 locale、獨立 default、parent 可達性建 URL；政策需要非空內容 | `app/layout.tsx:29` 以真正 child locale 設 html lang；schema 與 canonical 使用共享 URL builder。33 項測試含單語 root/child/policy、中文轉字與遊戲；無實際 child snapshot，不能填成 live PASS。 |

上表 self URL 均為 `https://appai.info` 絕對 URL；12 份公開 HTML 都沒有 noindex meta（公開頁無 robots meta 代表未在 HTML 禁止索引，不是漏標）。提供的首頁三語與 games 英中、Grayson 英中組別可確認 reciprocal；其他已宣告語系由路由／資料邏輯與 fixture 支持，未逐一抓正式頁。全部平台 9 語、4 種首頁／目錄 metadata 的 36 個 title 與各頁型 description 已由既有測試驗證不重複。

## Findings

P1＝已證實傷及索引／排名的高優先問題；P2＝應修；P3＝改善項。不以缺少任意 schema、字數偏短或未驗證的排名效果升級 P1。

| Finding | Page(s) | Evidence（repo 相對路徑:line 或 snapshot excerpt） | Severity | Proposed fix（files） | Affects external agents/docs? |
|---|---|---|---|---|---|
| **F1：sitemap URL coverage 仍不完整** | 平台非英語首頁／目錄／games／遊戲；public app details；spec；有外部主站的 hosted 政策 | **C** `src/lib/sitemap-entries.ts:51`、`:65`、`:99` 都只建立 en `<loc>`，其他語言僅 alternate；空 fixture 產生 11 筆、0 筆非英語 loc，每筆10個 alternate。`:100` 跳過所有有 hostedPageSlug 的 app，雖 `src/app/[locale]/apps/[id]/page.tsx:46` 仍給 detail self-canonical。沒有 `/spec` 或 topics。`:85` 在政策處理前直接跳過 external canonical root；fixture 的 `/p/audit-fixture/privacy` 有自有 canonical，但 sitemap 0 筆。 | **P2** | `sitemap-entries.ts`：每個現有 platform locale 各列一筆；納入仍 self-canonical 的公開 app detail（避免無條件跳過 bound apps）與 `/spec` 及有效 topic；只排除 external canonical 行銷頁，政策另依自身 identity 判斷。補 `tests/sitemap.test.ts` 的 locale loc／政策 fixture。不要列入 play、auto-converted、draft、404 alias。 | 是；`docs/spec/i18n.md`、`pages.md` 的 sitemap／canonical 說明同步。公開 spec 的 sitemap 收錄不改 text/plain。 |
| **F2：lastmod 從「每次重產」改成「永遠 11/10」，仍未反映內容更新** | 所有平台首頁／目錄／遊戲 | **C** `src/lib/sitemap-entries.ts:10` 明寫內容改動時更新，但 `:11` 仍是 `2026-11-10T00:00:00.000Z`；11/18 PR #79–82 已改卡片、頁面輸出。所有11個固定頁共用這一天；directory 新增／修改內容也不影響該值。hosted/app `updatedAt` 則有使用。 | **P2** | `sitemap-entries.ts`、`sitemap-data.ts`：靜態內容用真實維護日期，動態目錄以相關公開資料更新時間結合靜態修改日；無可信時間就省略 lastmod，勿改用請求時間。 | 否；維護／測試規則即可。 |
| **F3：#67 item 7 已落在 FAQ，但首屏與 metadata 定位仍弱** | `/games`、英中遊戲介紹頁 | **S** hub H1 是 “Games to play together”／「一起來動動腦」，description 英文200字且未提等待地點；river description 150字只談玩法／年齡。FAQ 已含餐廳、排隊、waiting room／候診，不可寫成全缺。**C** `src/lib/games-catalog.ts:127`、`:185`；`games-pages-copy.ts:202`；`tabletop-puzzles-copy.ts:10`、`:66`。 | **P2** | `games-catalog.ts`、`games-pages-copy.ts`、`tabletop-puzzles-copy.ts`：hub title/H1/intro/description 明確帶 free browser waiting games for kids/families、餐廳／候診與 small-group 選擇；各詳情保留遊戲主詞，補一個真實場景 intro。FAQ 補 doctor’s office、no-prep、10–15分鐘可中止的用法，不承諾固定通關時間。中英一致，保留 Werewolf 不適合安靜候診的界線。 | 是；`docs/spec/games.md` 加可重用文案／FAQ指引，`llms.txt` Games 摘要連回它；不增加遊戲、API 或包 C。 |
| **F4：有可見摘要卻完全沒有搜尋／社群 description** | `/p/graysonviews`；同樣未填 tagline/metaDescription 的 root/child | **S** `p_graysonviews.html` 沒有 `meta name="description"`、`og:description`、`twitter:description`；頁面可見「每支影片的重點、從哪裡開始看，以及影片裡的圖解。」。**C** `src/app/p/[...segments]/page.tsx:85` 與 `src/lib/hosted-page-seo.ts:52` 只讀 metaDescription/tagline；`page-preview.ts:15` 起沒有對有效 description 缺漏警告。 | **P2** | 不改 DB：在 `hosted-page-seo.ts` 建共享 description resolver，優先既有 metaDescription→tagline，再取已公開可見的 hero subheadline／profile intro／entries intro 等摘要（去 Markdown、空白處理、合理節句；不讀登入牆內文、不取任意第一張新聞卡）。供 `page.tsx` 的 HTML/OG/Twitter 和 primary JSON-LD 共用；preview 增非阻斷警告。 | 是；更新 `docs/spec/pages.md:207` fallback 合約、相關預覽指引及生成的 `AGENT_INSTRUCTIONS.md`；llms 指向此規則。 |
| **F5：六個平台語系的目錄自有文案仍英文 fallback** | ja/ko/de/fr/es/hi 的目錄與首頁分類入口 | **S** `ja.html` 的 “Find what you need” 和分類文字。**C** `src/lib/directory-copy.ts:21` 只有 en、zh-TW、zh-CN；`:81` 其餘直接 COPY.en；`PlatformDirectory.tsx:56` 用它輸出 H1／intro。metadata 翻譯不會翻譯這段正文。 | **P2** | `directory-copy.ts` 補六語的自有標題、描述、分類入口及空狀態；保留 publisher 未提供譯文時的內容 fallback。 | 否；不改 agent locale 合約。 |
| **F6：原始遊戲 index.html 仍是無索引政策的另一入口** | `/games/river-crossing/index.html`、`/games/guess-duel/index.html`、`/games/werewolf/index.html` | **C** 三個 `public/games/*/index.html:1` 均無 canonical／robots；`src/middleware.ts:226` matcher 排除含點路徑；`next.config.ts:113` 只 rewrite `/play`，`:123` 未給 raw HTML noindex。`src/app/games/[slug]/runtime/route.ts:19` 的 noindex 只保護 runtime/play，未保護直接 public 檔。未有 raw URL 正式快照，尚未證實 Google 收錄。 | **P2** | `next.config.ts` 對三個 raw index.html 加精準 `X-Robots-Tag: noindex, follow`；保留 assets 與舊玩法 query/hash。勿全擋 `/games`。這個小改即可封住重複入口，不必重建遊戲或更改 DB。 | 否；內部路由／回歸驗證。 |
| **F7：auth 表面只修了 login，device/logout 仍缺 noindex** | `/logout`、各 locale `/auth/device` 與 `/logout` | **C** `src/app/[locale]/logout/page.tsx:8` 無 metadata；`auth/device/page.tsx:1` 為 client page，沒有父層 noindex。`src/app/robots.ts:41` 的 `/auth/` 不匹配 `/ja/auth/device`。login 與 `/app/*` 已明確 noindex，這兩者沒有。未有正式快照。 | **P2** | logout 加 `robots: {index:false, follow:true}`；device 加 server layout metadata，避免改授權行為。`robots.ts` 的 `/auth/` crawl block 要與 noindex 可被讀到的政策一致（可移除公開 device shell 的廣泛封鎖，API 仍封鎖），不要只加 disallow 期待移除索引。 | 否；授權步驟／API 不變。 |
| **F8：遊戲 Twitter 分享圖是 SVG** | 所有自有 game detail／tabletop collection | **S** `games_river-crossing.html`：`twitter:image=https://appai.info/games/covers/river-crossing.svg`，OG 同圖。**C** `src/lib/games-page-seo.ts:13` 直接把 SVG cover 放進兩種 metadata。Twitter 不支援 SVG card 圖，屬相容性缺口，不等於圖片 URL 404。 | **P2** | 為既有封面輸出 PNG/JPEG 衍生圖至 `public/games/covers/`；`games-page-seo.ts` 分開 UI cover 與 social image，給正確尺寸。不要為修 SEO 改遊戲內容。 | 若只改自有遊戲，否；`docs/spec/games.md` 可補 social image 使用 raster 的指引。 |
| **F9：SoftwareApplication 仍無條件宣稱免費** | public app detail；有 download section 的 hosted page | **C** `src/app/[locale]/apps/[id]/page.tsx:90`、`src/lib/hosted-page-seo.ts:77` 固定 Offer price=0/USD，沒有讀已知價格。這是上一輪仍開著的生成邏輯問題；本次快照未包含一個已證實被標錯價格的付費 app。 | **P2** | 兩處移除未知產品價格的 Offer，僅在有明確可信價格時輸出；本輪不加 DB 欄位、不推測付費狀態。AppAI 自身的 free WebApplication 與自有免費遊戲不受此修正影響。 | 是；`docs/spec/pages.md`／相關 section SEO 說明不要暗示平台替第三方認證免費。 |
| **F10：目錄 heading level 不一致；preview 只數 H1，未檢查跳級** | `/websites`、`/tools`、`/apps`；publisher 任意排序 sections | **S** 上表 H1→H3；`src/components/AppCard.tsx:70` 固定 H3，但首頁已有 H2 容器，所以首頁 H3 正確。**C** `src/lib/section-field-warnings.ts:5` 只算 H1。12 份 HTML 都剛好1個 H1，沒有確認到多H1回歸。 | **P3** | AppCard 接受 headingLevel，directory 用 H2、首頁保留 H3；如擴充 preview，針對實際渲染順序給警告。 | preview 改動才需更新 agent 指引；純 heading 修正不改 API。 |
| **F11：目錄與 hub 的 list schema 尚未補齊** | 三個 directory；`/games` | **S** directory 只有全域 Organization/WebSite/WebApplication；games 另有 BreadcrumbList/FAQPage，無 ItemList。`PlatformDirectory.tsx:53` 有可見 breadcrumb，沒相對應 JSON-LD。 | **P3** | `PlatformDirectory.tsx`、`src/app/[locale]/games/page.tsx` 依同一份可見清單輸出 ItemList、directory breadcrumb；不要列出尚未開放的遊戲。 | 否。缺少這些型別不是索引阻斷，也不保證 rich result。 |
| **F12：個人／內容站 title 過於純品牌** | `/p/grayson` 及 locales、`/p/graysonviews` | **S** title 分別只有7字 “Grayson”、13字 “Grayson Views”；Grayson 英文 description 239字。姓名跨語相同不構成自動 duplicate penalty，但沒有職業／主題辨識詞。 | **P3** | 後續由內容擁有者更新既有 `metaTitle`／`metaDescription`（例如 APAC commercial development、AI 影片重點），不在本輪改資料；`docs/spec/pages.md` 可給具體例子。 | 是，屬 publisher 內容品質指引；**不列入無 DB 單 PR**。 |

Google 的 [hreflang sitemap 規則](https://developers.google.com/search/docs/specialty/international/localized-versions) 要求各語言有各自的 URL entry 與相同 alternates；目前 HTML 已提供正確訊號，所以 F1 不是「所有非英語不能索引」。[Sitemap lastmod 指引](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap) 強調可信的實際修改時間。分享圖格式參照部署平台的 [OG/Twitter metadata 文件](https://vercel.com/docs/deployments/og-preview)。

## #67 item 7：遊戲定位實際覆蓋

| 需求／候選詞 | 已有證據 | 尚缺什麼 |
|---|---|---|
| restaurant games for kids | 英文 hub FAQ “Which games can we play at a restaurant while waiting for food?”；river 同類 FAQ；中文「在餐廳等餐時可以和孩子玩什麼？」 | 語意已涵蓋，不必逐字塞詞。hub title／首屏缺親子等餐意圖；英中 metadata 都可更直接。 |
| games to play while waiting／waiting games | hub 與 river FAQ 都寫 waiting in line、quiet waiting room；中文明寫排隊／候診。FAQ 內容真的在 HTML `<details>` 中，不只藏在 schema。 | 首屏仍偏單人謎題／原創遊戲介紹；可把「等待時一起玩」放首段並連到適合的既有遊戲。 |
| doctor’s office | 英文只有 waiting room（語意接近）；中文 hub 與 river 有「候診」。 | 英文補明確 doctor’s office 情境，以及靜音／隨時放下。不要把 Werewolf 推成安靜候診遊戲。 |
| small group | 中文 hub FAQ 已說狼人殺適合「小團體」；英文有 group、全家、一台手機；Werewolf 人數明列 3–12／3–16。river FAQ 說兩人共用單人操作畫面。 | 英文沒有明確 small-group 導引；hub 可分「親子兩人共享謎題」與「可交談的小團體」。不能把 single-player schema 改成多人連線來追詞。 |
| no-prep games for families；10–15 分鐘等待 | no download／no sign-in 已在文案，FAQ 有餐點到就停、一次不必解完。 | 沒有明確 no-prep／不需道具／10–15分鐘空檔的介紹；可說選簡單題、隨時停，不承諾每關一定在時間內完成。 |

中文 river 的判斷依 `tabletop-puzzles-copy.ts:74`（C），不是中文詳情 live snapshot。其他現有遊戲與 collection 的 FAQ 依 `games-pages-copy.ts:65`、`:79`、`:93` 及 tabletop copy 核對；目前已區別桌上謎題、雙人猜數字和團體 Werewolf。**建議用 “games to play while waiting” 作 hub 的自然主題詞，遊戲詳情保留 river crossing puzzle 等具體詞。這是內容適配判斷，不是搜尋量研究或排名保證。**

6 組快照 FAQPage 的每個 Question／Answer 都能對回可見文字（首頁三語各9題、hub 英中各4題、river 5題）。保留同步生成即可；Google 的 [FAQ rich-result 限制](https://developers.google.com/search/blog/2023/08/howto-faq-changes) 不讓一般遊戲站因加入 FAQPage 就取得 FAQ 富結果，修文案的價值在可讀內容與意圖匹配。

## 最近四個 PR 的回歸結論

| Change | Re-check |
|---|---|
| #41／PR #79 dark chrome | diff 主要是背景／對比與 chrome；snapshot hosted H1、正文、server-rendered `<a href>` 仍在。未確認到新 SEO 回歸；本輪未做螢幕對比度或行動裝置視覺驗收。 |
| #32／PR #80 letter tiles + logo-first | `DirectoryLogo.tsx:10` 真圖片保留 `alt={name}`；`:13` 字母 tile aria-hidden 且旁邊仍有文字標題。`directory-logo.ts:24` 是完整清單的穩定分組，沒有因缺 logo 移除項目。H3 跳級是原有 AppCard 設計，不歸咎本 PR。 |
| #91／PR #81 headingColor／hero／favicon | `heading-color.ts:5` 只繼承 presentation 設定；HeroSection H1 仍存在，media warnings 不取代正文。child favicon fallback 改動未碰 canonical／description。`p_graysonviews.html` 有自訂 favicon；root layout 也保留平台 icon，瀏覽器選圖未實測，不報成已壞。OG fallback 與 favicon 是不同流程；F4 不是由 favicon 新邏輯造成。 |
| #91／PR #82 single locale | 單語 graysonviews 的 `html lang=zh-TW`、locale-free canonical、zh-TW+x-default 正確。只有儲存的 locale 進 hreflang；轉字 zh-CN 可出現在 switcher，但不應宣告為 indexable alternate。離線 root/child/policy fixture 通過。四語新發布政策在 `docs/spec/i18n.md:42` 明說不變；因此 llms 的四語要求並非與這個 PR 衝突。 |

## robots、llms 與前次未結項

`robots.txt.html` 允許 Googlebot、搜尋／AI／社群 crawler 爬公開站，並列絕對 sitemap URL；沒有全站 disallow。robots 並非 noindex，auth 殘留見 F7。程式碼確認 login、launcher、error/not-found、hosted fullscreen tool、中文轉字頁有索引限制；runtime/play 用 X-Robots-Tag。公開 snapshots 沒有 HTTP headers，不能排除其他 header 層限制。

`llms.txt.html` 已有 GAME／game section、`/spec/games`、自有遊戲 description/play 分流、房間 API 條件、包 C 尚未實作的界線，以及含更新日期／locales／影片項目的 hosted roots。它不是全站 sitemap，也不是完整子頁清單。`/spec` 與 `/spec/pages` 快照與 repo 完全一致；`llms-full.txt` handler 讀生成的 `AGENT_INSTRUCTIONS.md`，未取得其正式回應。llms 沒有逐項重述 headingColor 或單語 switcher，但有連向最新 style/i18n；不是因此判陳舊。剩下的 P3 discovery 改善是從 `GAMES` 產生具名遊戲／collection 絕對連結，目前主要是 `/games/{slug}` 泛用說明及 hub 連結。

| Previous audit item | Current status |
|---|---|
| 首頁／目錄共用英文 metadata、缺 canonical／social | **已修（S）**；正文目錄翻譯仍開著 F5。 |
| 遊戲空殼、無 H1／FAQ／VideoGame／detail sitemap | **主路徑已修（S+C）**；raw index.html duplicate 尚開 F6，locale sitemap F1。 |
| 舊遊戲 query、hash、index.html 多入口 | **部分修**：`game-play-compat.ts:36` 將 play-state 導往 `/play`，runtime noindex；raw index.html 未補。不能把舊分支全部 alias 問題標已結。 |
| Hosted child parent-locale 可達性、default 不同時 canonical/schema 不一致 | **程式碼與 fixture 已修**：共享 hosted URL builder／public visibility；未取得正式 child 回應。 |
| Hosted legal 繼承平台 metadata | **程式碼與 fixture 已修**：`page.tsx:83` 獨立 legal copy／canonical；政策 sitemap 排除過廣仍見 F1。 |
| Public app schema URL 錯、locale canonical 全指 en | **程式碼已修**：`apps/[id]/page.tsx:46`、`:79` 都用 localized `/apps/id`；免費 Offer 仍開 F9。 |
| Login／launcher／error indexing policy | **部分修**：login、app layout、error/not-found 已有 noindex；device/logout F7。 |
| Filter URL 沒 canonical | **已修（C）**：`platform-seo.ts:16` 去 query，route metadata 用 base path；過濾頁合併到基礎目錄是目前策略。無 query 快照，不宣稱 live HTTP 全驗。 |
| Sitemap 假 lastmod、無 size guard、external canonical 仍列 | **部分修**：45,000 URLs／1.8MB cache sharding、XML escaping、外部 marketing 排除已存在；日期維護／coverage 仍開 F1–F2。 |
| Hosted H1 不受限 | **已有非阻斷 preview H1 warning**；12份HTML均一個H1；跳級提示仍未實作（F10），不應改成強制阻擋發布。 |
| 外部 canonical 與本地 hreflang／schema 衝突 | **外部 origin case 已修（C）**：marketing 不宣告 alternates、不入 sitemap，primary schema 用 override URL；政策維持自己 URL。F1 是政策排除過廣的殘留。 |
| Schema 分類粗、免費價格；breadcrumb/list 不全 | VideoGame／ProfilePage／hosted ItemList／breadcrumb 已有；未知價格 F9、directory/hub list F11 尚開。沒有搜尋功能，因此不要求新增 SearchAction。 |
| Games/docs discovery、不完整翻譯 | Games 指引與九語自有遊戲 copy 已存在；directory 六語 F5、llms 具名遊戲清單 P3 仍可補。 |
| 舊 games branch 缺 main rooms API、native framing | 舊分支整合不是本次新缺陷；現在自有遊戲頂層 `/play` 不需要 iframe，因此不為 SEO 放寬 framing。外部遊戲審核／identity／房間能力屬包 C，依 D78 暫緩，不列此 PR。 |

## Proposed single PR scope（只含 P1/P2；無 DB change、無新遊戲）

1. **F1–F2 sitemap**：完整 locale `<loc>`、現有 self-canonical app details／spec topics、獨立 legal inclusion；真實 lastmod 或省略未知值。保留 sharding、現有非索引排除與 canonical 規則。
2. **F3+F5 copy**：中英 games hub／現有遊戲首屏與 metadata 對準等待／親子／小團體；補六語 directory 自有文案。FAQ 與 JSON-LD 共用同一份 copy。
3. **F4+F9 hosted metadata/schema**：共用公開內容 description fallback＋preview warning；移除未有來源的第三方免費 Offer。同步 `docs/spec/pages.md`、`games.md`、`i18n.md`（涉及段落）、llms 摘要與生成完整規格；不新增 schema／pricing DB 欄位，也不寫現有內容資料。
4. **F6–F8 indexing/social**：raw game index.html 精準 noindex、device/logout server metadata 及相容 robots 政策；既有遊戲封面增加 raster social derivatives。

驗收限定相關既有測試與新增缺口 fixture：locale loc 數／互指、external marketing+local legal、description 空值／公開與 gated content、未知價格、raw index/auth headers、raster share URL；正式 GET 重查所有 sitemap shards、代表 child/policy/zh-CN 轉字頁、九語 canonical cluster，確認無 noindex／404／redirect URL 被列入。不能用目前通過的舊斷言取代這些新驗收。

本輪已執行：`node --experimental-strip-types --test tests/platform-seo.test.ts tests/sitemap.test.ts tests/hosted-page-seo.test.ts tests/hosted-single-locale.test.ts tests/own-games-render.test.ts`，**33/33 pass**（fixture-only，未連 DB）。另用合成資料重現 sitemap locale 及外部 canonical 政策遺漏。測試只證明目前契約通過，不代表上述缺口不存在。

收尾紀錄：此次交付就是本檔。依本次更具體的「不得改 tracked files、不得網路寫入」限制，未執行 ops inbox/run log 寫入、pull/rebase、commit 或 push；不把它們宣稱完成。工具：Codex；僅解析快照、讀取程式碼／git history、執行離線 fixture，外部文件查詢為唯讀。
