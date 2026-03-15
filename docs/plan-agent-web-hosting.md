# AIGA — Agent Web Hosting Plan

## 產品定位

**一句話描述：AI 時代的 Product Hunt + 免費託管。用 AI 做了 App，30 秒擁有官網。**

AIGA 是一個讓 AI Agent 自動發布 App 官網的平台。目標用戶是用 Codex、Claude、Cursor 等 AI 工具做了 App，但沒有自己網站的開發者或小團隊。

### 核心價值

1. **零門檻託管** — 不需要買域名、不需要架站，直接 Host 在 AIGA 的子目錄下
2. **AI 自動完成** — 用戶的 AI Agent 讀取 AIGA 的 Spec，自動建立頁面，用戶什麼都不用學
3. **剛需頁面** — 隱私權政策、使用條款等 App Store 強制要求的頁面，一鍵生成
4. **展示平台** — 首頁有 Featured Products、排行榜，類似 Product Hunt 讓 App 被發現

### 市場缺口

用 AI 寫 App 的人爆炸性成長，但這些人不是傳統開發者，不懂也不想搞 hosting。

| 現有選項 | 問題 |
|----------|------|
| Product Hunt | 只是曝光，不幫你 host |
| Vercel / Netlify | 對非技術人有門檻，只是 hosting 不是展示平台 |
| Linktree / Carrd | 太簡陋，沒有針對 App 的結構 |
| 自架網站 | 這些人不會也不想學 |

**沒有一個地方是：用 AI 做了東西 → 一鍵有官網 + 法律頁面 + 被人發現。AIGA 把這三件事合在一起。**

### 用戶只需要做的事

```
對 AI 說：「幫我在 AIGA 上建一個頁面」
    ↓
AI 讀 AIGA 的 Spec → 自動收集資訊 → 自動呼叫 API
    ↓
用戶得到 aiga.tw/p/my-app（含首頁、隱私政策、使用條款）
```

---

## 架構設計

### 系統架構圖

```
┌───────────────────────────────────────────────────────┐
│                     AIGA Platform                      │
│                                                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────────┐        │
│  │  主站首頁  │  │ 管理後台  │  │ 託管頁面渲染  │        │
│  │  /        │  │ /dashboard│  │ /p/[slug]    │        │
│  │ Featured  │  │ OAuth登入 │  │ 獨立無AIGA框 │        │
│  │ 排行榜    │  │ API Key  │  │              │        │
│  └──────────┘  └──────────┘  └──────────────┘        │
│                      │                │                │
│               ┌──────┴────────┐       │                │
│               │   API Layer   │       │                │
│               │  /api/v1/*    │───────┘                │
│               └──────┬────────┘                        │
│                      │                                 │
│          ┌───────────┼───────────┐                     │
│          │           │           │                     │
│   ┌──────┴──────┐ ┌──┴───┐ ┌────┴─────┐              │
│   │  Database   │ │ Auth │ │  Storage  │              │
│   │ Neon (PgSQL)│ │NextAuth│ │Vercel Blob│              │
│   └─────────────┘ └──────┘ └──────────┘              │
│                                                        │
└───────────────────────────────────────────────────────┘
        ▲               ▲               ▲
        │               │               │
   ┌────┴────┐   ┌──────┴──────┐  ┌────┴────────┐
   │ 一般使用者│   │  AI Agent   │  │ MCP Client  │
   │ (瀏覽器) │   │ (REST API) │  │(Claude/Cursor)│
   │ 看首頁   │   │ API Key認證 │  │ OAuth 2.0   │
   └─────────┘   └─────────────┘  └─────────────┘
```

### URL 結構

| 路徑 | 用途 |
|------|------|
| `/` | AIGA 主站首頁 — Featured Products、最新上架、排行榜 |
| `/p/[slug]` | 託管頁面區 — 用戶的 App 官網（獨立頁面，無 AIGA 框架） |
| `/p/[slug]/privacy` | 託管的隱私權政策頁面 |
| `/p/[slug]/terms` | 託管的使用條款頁面 |
| `/apps` | 應用瀏覽列表（分類、搜尋） |
| `/apps/[id]` | 應用詳細介紹（AIGA 平台樣式） |
| `/dashboard` | 管理後台（OAuth 登入後管理自己的頁面 + API Key） |
| `/api/v1/*` | Agent API 端點 |
| `/api/auth/*` | NextAuth.js 認證端點 |

### 為什麼用子目錄 `/p/` 而不是子域名

| | 子目錄 `/p/xxx` | 子域名 `xxx.aiga.tw` |
|--|--|--|
| SEO | 共享主域名權重，對平台和用戶都好 | 每個子域名獨立計算 |
| 技術 | 單一應用就能處理 | 需要 wildcard DNS + 額外路由 |
| SSL | 一張憑證搞定 | 需要 wildcard SSL |
| 感覺 | 像是平台的一部分 | 像是獨立站 |

**先用子目錄，簡單有效。子域名和自訂域名作為未來付費功能。**

### `/p/[slug]` vs `/apps/[id]` 的差異

- **`/apps/[id]`** — AIGA 平台統一風格的應用介紹頁，嵌在 AIGA 的 layout 裡
- **`/p/[slug]`** — 獨立的託管頁面，**沒有 AIGA 的 header/footer**，看起來像是用戶自己的網站

---

## 認證與權限設計

### 設計原則

- **人是用戶，Agent 是工具** — 身份認證綁在人身上（OAuth），不是綁在 Agent 或 Key 上
- **權限隔離** — 每筆資料都綁 organizationId，每個查詢都過濾 organizationId，用戶只能動自己的內容
- **全自動流程** — 用戶可以完全透過 AI Agent 完成所有操作，不需要打開 AIGA 網站

### 兩種認證方式

#### 1. 人類用戶：OAuth 2.0（NextAuth.js）

用於 Dashboard 管理後台登入、MCP Client 授權。

```
用戶點「用 Google 登入」
    → Google OAuth 授權
    → 自動建立 Organization
    → 進入 Dashboard 管理頁面和 API Key
```

- 使用 NextAuth.js（免費、開源、Next.js 原生整合）
- 支援 Google OAuth（最通用，每個人都有）
- 未來可加 GitHub OAuth（開發者友善）
- 不使用 Clerk（避免額外費用）

#### 2. AI Agent：API Key

用於 AI Agent 透過 REST API 自動操作。

```
Authorization: Bearer aiga_sk_xxxxxxxxxxxxxxxx
```

- API Key 由用戶在 Dashboard 生成
- Key 綁定到 Organization，只能操作該 Organization 的資料
- Key 只在生成時顯示一次完整內容（跟 OpenAI 一樣）
- 丟了就回 Dashboard 重新生成，舊 Key 可保留或撤銷
- 資料不受 Key 更換影響（資料綁在 Organization，不是 Key）

#### Agent 全自動註冊流程

用戶第一次使用時，AI Agent 可以透過 Email 驗證碼自動完成註冊：

```
步驟 1：AI 問用戶 email
步驟 2：AI 呼叫 POST /api/v1/auth/register { "email": "abc@gmail.com" }
步驟 3：AIGA 寄驗證碼到用戶信箱
步驟 4：用戶告訴 AI 驗證碼
步驟 5：AI 呼叫 POST /api/v1/auth/verify { "email": "...", "code": "837291" }
步驟 6：AIGA 回傳 API Key + Organization ID
步驟 7：AI 記住 Key，之後都用它操作
```

如果 Key 丟了，同樣流程再跑一次。AIGA 發現 email 已註冊 → 驗證通過 → 發新 Key → 資料不受影響。

### 權限隔離實作

```typescript
// 核心原則：每個查詢都帶 organizationId
async function getPages(organizationId: string) {
  return db.hostedPage.findMany({
    where: { organizationId }  // 只拿自己的
  });
}

async function updatePage(slug: string, organizationId: string, data: any) {
  const page = await db.hostedPage.findFirst({
    where: { slug, organizationId }  // 兩個條件都要符合
  });
  if (!page) throw new Error('Not found');
  // 才能更新
}
```

不管是 OAuth 登入還是 API Key，流程一致：

```
請求進來 → 驗證身份 → 解析 organizationId → 所有查詢帶此 ID → 只能動自己的
```

---

## 資料模型（Database Schema）

### 使用：Prisma + Neon (Serverless PostgreSQL)

選擇 Neon 而非 Supabase 的原因：
- 免費額度 0.5GB，不像 Supabase 每個 project $10/月
- Vercel 原生整合，一鍵建立，環境變數自動設好
- 就是 PostgreSQL，乾淨不綁定

```prisma
// prisma/schema.prisma

// ===== 認證相關 =====

model User {
  id             String        @id @default(cuid())
  email          String        @unique
  name           String?
  image          String?

  // NextAuth.js 需要的欄位
  accounts       Account[]
  sessions       Session[]

  // 關聯到 Organization
  organizationId String?
  organization   Organization? @relation(fields: [organizationId], references: [id])

  createdAt      DateTime      @default(now())
  updatedAt      DateTime      @updatedAt
}

// NextAuth.js 需要的 models
model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text
  session_state     String?
  user              User    @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime

  @@unique([identifier, token])
}

// ===== 業務資料 =====

model Organization {
  id          String   @id @default(cuid())
  name        String
  slug        String   @unique    // URL 路徑，如 "my-company"
  description String?  @db.Text
  logoUrl     String?
  website     String?
  email       String?

  // 關聯
  users       User[]
  apiKeys     ApiKey[]
  pages       HostedPage[]
  apps        App[]

  // 用量限制
  plan        PlanType @default(FREE)

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model ApiKey {
  id             String       @id @default(cuid())
  keyHash        String       @unique        // 存 hash，不存明文
  keyPrefix      String                      // "aiga_sk_xxxx" 前幾碼，用於識別
  name           String                      // 描述用途
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id])

  lastUsedAt     DateTime?
  expiresAt      DateTime?
  isActive       Boolean      @default(true)

  createdAt      DateTime     @default(now())
}

model HostedPage {
  id             String       @id @default(cuid())
  slug           String       @unique        // /p/[slug] 的路徑
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id])

  // 頁面內容
  template       PageTemplate @default(APP_LANDING)
  title          String
  tagline        String?                     // 副標題
  heroImage      String?                     // 主圖
  content        Json                        // 結構化內容（見下方說明）

  // 法律頁面（App Store 剛需）
  privacyPolicy  String?      @db.Text       // Markdown — 隱私權政策
  termsOfService String?      @db.Text       // Markdown — 使用條款

  // SEO
  metaTitle       String?
  metaDescription String?
  ogImage         String?

  // 設定
  customCss       String?     @db.Text       // 允許自訂 CSS
  themeColor      String?     @default("#000000")
  isPublished     Boolean     @default(false)

  // 自訂域名（付費功能，未來擴充）
  customDomain    String?     @unique

  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt
}

model App {
  id             String       @id @default(cuid())
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id])

  name           String
  tagline        String                     // 一句話介紹
  description    String       @db.Text      // Markdown
  category       AppCategory
  tags           String[]

  // 連結
  url            String?
  repoUrl        String?
  iosUrl         String?                    // App Store 連結
  androidUrl     String?                    // Google Play 連結

  // 圖片
  logoUrl        String?
  screenshots    String[]

  // 關聯到託管頁面
  hostedPageId   String?      @unique

  // 狀態
  isApproved     Boolean      @default(false)
  isFeatured     Boolean      @default(false)

  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt
}

enum PlanType {
  FREE            // 最多 3 個頁面、1 個 App
  PRO             // 無限頁面、多個 App、自訂域名
}

enum PageTemplate {
  APP_LANDING       // App 下載頁面
  COMPANY_PROFILE   // 公司介紹
  PRODUCT_SHOWCASE  // 產品展示
  PORTFOLIO         // 作品集
  LINK_IN_BIO       // 連結彙整（類似 Linktree）
}

enum AppCategory {
  WRITING
  CODING
  DESIGN
  AUTOMATION
  PRODUCTIVITY
  SOCIAL
  FINANCE
  HEALTH
  EDUCATION
  OTHER
}
```

### API Key 安全性

- 資料庫只存 **hash**（`keyHash`），不存明文
- 保留前幾碼（`keyPrefix`）供用戶在 Dashboard 識別是哪把 Key
- Key 只在生成時顯示一次完整明文，之後無法再取得

### `HostedPage.content` JSON 結構

每種 template 有不同的 content schema：

```typescript
// APP_LANDING template
interface AppLandingContent {
  sections: Array<{
    type: 'hero' | 'features' | 'screenshots' | 'testimonials' | 'download' | 'faq' | 'custom';
    data: Record<string, any>;
    order: number;
  }>;
  appStoreUrl?: string;
  playStoreUrl?: string;
  features?: Array<{
    icon: string;
    title: string;
    description: string;
  }>;
  screenshots?: string[];
  testimonials?: Array<{
    name: string;
    role: string;
    quote: string;
    avatar?: string;
  }>;
}

// COMPANY_PROFILE template
interface CompanyProfileContent {
  sections: Array<{
    type: 'hero' | 'about' | 'team' | 'products' | 'contact' | 'custom';
    data: Record<string, any>;
    order: number;
  }>;
  about?: string;        // Markdown
  team?: Array<{
    name: string;
    role: string;
    bio: string;
    photo?: string;
  }>;
  contactEmail?: string;
  socialLinks?: Record<string, string>;
}
```

---

## 資料保留政策

### 不自動刪除的資料

- 用戶已發布的頁面內容（landing page、privacy、terms）— 因為 App Store 連結可能指向這裡
- App 資訊
- Organization 資料

### 可考慮清理的情境

| 情境 | 處理方式 |
|------|----------|
| 註冊後 30 天都沒建任何頁面 | 發 email 提醒，60 天後刪帳號 |
| 頁面建了但從未發布 | 90 天後提醒，不自動刪 |
| 已撤銷的 API Key | 保留記錄但標記失效 |

### 核心原則

> **永遠不自動刪用戶已發布的內容。** 因為他的 App 可能正在用這個 URL。

### 用量限制（代替刪除）

| | 免費方案 | Pro 方案 |
|--|--|--|
| 託管頁面數 | 最多 3 個 | 無限 |
| App 數量 | 最多 1 個 | 無限 |
| 自訂域名 | 不支援 | 支援 |
| 自訂 CSS | 基本 | 完整 |

---

## Agent API 設計

### 認證方式

所有 API 請求需帶 API Key：

```
Authorization: Bearer aiga_sk_xxxxxxxxxxxxxxxx
```

### API 端點

#### 1. Agent 自動註冊

```
POST   /api/v1/auth/register        # 發送驗證碼到 email
POST   /api/v1/auth/verify           # 驗證碼驗證，回傳 API Key
```

#### 2. 組織管理

```
POST   /api/v1/organizations          # 建立組織
GET    /api/v1/organizations/:id       # 取得組織資訊
PUT    /api/v1/organizations/:id       # 更新組織資訊
```

#### 3. 託管頁面 CRUD

```
POST   /api/v1/pages                   # 建立新頁面
GET    /api/v1/pages                   # 列出自己的所有頁面
GET    /api/v1/pages/:slug             # 取得單一頁面
PUT    /api/v1/pages/:slug             # 更新頁面（整體）
PATCH  /api/v1/pages/:slug             # 部分更新頁面
DELETE /api/v1/pages/:slug             # 刪除頁面
POST   /api/v1/pages/:slug/publish     # 發布頁面
POST   /api/v1/pages/:slug/unpublish   # 取消發布
```

#### 4. App 提交

```
POST   /api/v1/apps                    # 提交新 App
GET    /api/v1/apps                    # 列出自己的 App
GET    /api/v1/apps/:id                # 取得單一 App
PUT    /api/v1/apps/:id                # 更新 App
DELETE /api/v1/apps/:id                # 刪除 App
```

#### 5. 圖片上傳

```
POST   /api/v1/upload                  # 上傳圖片（logo, screenshots）
```

### Agent 完整使用流程

```bash
# === 第一次：自動註冊 ===

# Step 1: 發送驗證碼
curl -X POST https://aiga.tw/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{ "email": "user@gmail.com" }'
# → { "message": "驗證碼已寄出" }

# Step 2: 用戶告訴 AI 驗證碼，AI 驗證
curl -X POST https://aiga.tw/api/v1/auth/verify \
  -H "Content-Type: application/json" \
  -d '{ "email": "user@gmail.com", "code": "837291" }'
# → { "apiKey": "aiga_sk_xxxx", "organizationId": "..." }

# === 之後：用 API Key 操作 ===

# Step 3: 建立頁面
curl -X POST https://aiga.tw/api/v1/pages \
  -H "Authorization: Bearer aiga_sk_xxxx" \
  -H "Content-Type: application/json" \
  -d '{
    "slug": "awesome-app",
    "template": "APP_LANDING",
    "title": "Awesome App",
    "tagline": "讓生活更簡單的 AI 助手",
    "content": {
      "sections": [
        {
          "type": "hero",
          "data": {
            "headline": "你的 AI 生活助手",
            "subheadline": "用 AI 幫你處理日常瑣事",
            "ctaText": "立即下載"
          },
          "order": 0
        },
        {
          "type": "features",
          "data": {
            "items": [
              {"icon": "brain", "title": "智慧推薦", "description": "AI 學習你的習慣"},
              {"icon": "zap", "title": "快速回應", "description": "毫秒級反應速度"},
              {"icon": "shield", "title": "隱私安全", "description": "端對端加密保護"}
            ]
          },
          "order": 1
        },
        {
          "type": "download",
          "data": {
            "appStoreUrl": "https://apps.apple.com/...",
            "playStoreUrl": "https://play.google.com/..."
          },
          "order": 2
        }
      ]
    },
    "privacyPolicy": "# Privacy Policy\n\nYour privacy is important to us...",
    "termsOfService": "# Terms of Service\n\nBy using this app...",
    "themeColor": "#6366f1",
    "isPublished": true
  }'

# → 頁面上線：
#   https://aiga.tw/p/awesome-app          （首頁）
#   https://aiga.tw/p/awesome-app/privacy  （隱私政策）
#   https://aiga.tw/p/awesome-app/terms    （使用條款）

# Step 4: 後續更新
curl -X PATCH https://aiga.tw/api/v1/pages/awesome-app \
  -H "Authorization: Bearer aiga_sk_xxxx" \
  -d '{ "content": { "sections": [...] } }'
```

---

## LLM-Readable Spec（核心差異化）

AIGA 不只是 API — 它是一個 **AI Agent 看得懂的發布協議**。

放在公開 URL（如 `https://aiga.tw/spec`）的一份文件，任何 LLM 讀了就知道：

1. 要跟用戶收集什麼資訊（App 名稱、描述、截圖、連結...）
2. 資料格式是什麼（JSON schema）
3. 怎麼註冊和取得 API Key
4. 怎麼呼叫 AIGA API 建立頁面
5. 可以生成哪些頁面類型（首頁、隱私政策、使用條款...）

**用戶不需要學任何東西。他的 AI 就是介面。**

這代表：
- 不需要建複雜的前端編輯器 — AI 是 UI
- 跨平台 — Claude、GPT、Codex、Cursor 都能用
- 不綁定任何一家 AI 平台

---

## 頁面模板系統

### 模板架構

```
src/
  templates/
    app-landing/
      AppLandingPage.tsx       # 主元件
      sections/
        HeroSection.tsx        # Hero 區塊
        FeaturesSection.tsx    # 功能介紹
        ScreenshotsSection.tsx # 截圖輪播
        DownloadSection.tsx    # 下載按鈕
        TestimonialsSection.tsx# 使用者評價
        FaqSection.tsx         # 常見問題
        CustomSection.tsx      # 自訂 HTML/Markdown
    company-profile/
      CompanyProfilePage.tsx
      sections/
        ...
    product-showcase/
      ProductShowcasePage.tsx
      sections/
        ...
    link-in-bio/
      LinkInBioPage.tsx
    shared/
      PageRenderer.tsx         # 根據 template 選擇元件
      SectionRenderer.tsx      # 根據 section type 渲染
      ThemeProvider.tsx         # 處理 themeColor 等設定
```

### 頁面渲染流程

```
使用者瀏覽 /p/awesome-app
  → Next.js dynamic route: src/app/p/[slug]/page.tsx
  → 從 DB 查詢 HostedPage（by slug）
  → PageRenderer 根據 template 選擇模板元件
  → 模板元件根據 content JSON 渲染各 section
  → 套用 themeColor + customCss
  → 回傳完整 HTML（SSR/ISR）

使用者瀏覽 /p/awesome-app/privacy
  → 從 DB 查詢 HostedPage.privacyPolicy
  → 渲染 Markdown → HTML
  → 套用簡潔法律頁面樣式
```

### 渲染策略

- **ISR（Incremental Static Regeneration）**：預設策略
  - 首次請求時 SSR，之後快取
  - `revalidate: 60` — 每 60 秒重新驗證
  - Agent 更新頁面時觸發 `revalidatePath('/p/[slug]')`
- **好處**：速度快、SEO 友善、低伺服器負擔

---

## 實作分期

### Phase 1：基礎建設 + 認證

**目標**：讓 AIGA 有 DB、有認證、可以登入

- [ ] 設定 Prisma + Neon (Serverless PostgreSQL)
- [ ] 建立 DB Schema（User, Organization, HostedPage, App, ApiKey）
- [ ] 設定 NextAuth.js + Google OAuth
- [ ] OAuth 登入後自動建立 Organization
- [ ] Dashboard 頁面：生成/管理 API Key
- [ ] API Key 認證 middleware

**新增依賴**：`prisma`, `@prisma/client`, `next-auth`

### Phase 2：託管頁面系統

**目標**：讓 `/p/[slug]` 可以渲染託管頁面

- [ ] 建立 `/p/[slug]` dynamic route
- [ ] 實作 `PageRenderer` — 根據 template 渲染
- [ ] 實作 `APP_LANDING` 模板（Hero, Features, Screenshots, Download）
- [ ] 實作 `COMPANY_PROFILE` 模板（About, Team, Contact）
- [ ] 實作 `LINK_IN_BIO` 模板
- [ ] 實作 `/p/[slug]/privacy` 和 `/p/[slug]/terms` 法律頁面
- [ ] 加入 themeColor 支援
- [ ] 加入 SEO meta tags（Open Graph, Twitter Card）
- [ ] 設定 ISR 快取策略

### Phase 3：Agent API + LLM Spec

**目標**：讓 AI Agent 可以自動註冊、建立/更新頁面

- [ ] `POST /api/v1/auth/register` — Email 驗證碼註冊
- [ ] `POST /api/v1/auth/verify` — 驗證碼驗證 + 回傳 API Key
- [ ] `POST /api/v1/pages` — 建立頁面
- [ ] `GET/PUT/PATCH/DELETE /api/v1/pages/:slug` — 頁面 CRUD
- [ ] `POST /api/v1/apps` — 提交 App
- [ ] `GET/PUT/DELETE /api/v1/apps/:id` — App CRUD
- [ ] 圖片上傳端點（Vercel Blob）
- [ ] 更新時觸發 ISR revalidation
- [ ] API Rate limiting（Upstash Redis）
- [ ] Request validation（Zod schema）
- [ ] 撰寫 LLM-Readable Spec 文件（`/spec`）

**新增依賴**：`zod`

### Phase 4：主站首頁 + 展示平台

**目標**：讓 AIGA 首頁成為 AI App 的 Product Hunt

- [ ] 建立 AIGA 主站首頁（Featured Products、最新上架、分類）
- [ ] 建立 `/apps` 應用列表頁（搜尋、篩選）
- [ ] 建立 `/apps/[id]` 應用詳細頁
- [ ] Featured / 排行榜機制
- [ ] 基本 Analytics（PageView 計數）

### Phase 5：MCP Server + 自訂域名（付費功能）

**目標**：讓 Claude/Cursor 用自然語言操作 + 付費升級

- [ ] MCP Server 實作（包裝 REST API）
- [ ] OAuth 2.0 for MCP（讓 Claude/Cursor 直接授權）
- [ ] 自訂域名支援（Middleware + DNS 驗證 + SSL）
- [ ] Pro 方案付費整合（Stripe）

---

## 自訂域名支援（Phase 5 付費功能）

### 實作方式

使用 Next.js Middleware 做域名路由：

```typescript
// src/middleware.ts
import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') || '';

  // 如果不是主域名，查找 custom domain 對應的 page
  if (!hostname.includes('aiga.tw') && !hostname.includes('localhost')) {
    return NextResponse.rewrite(
      new URL(`/p/_custom/${hostname}${request.nextUrl.pathname}`, request.url)
    );
  }

  return NextResponse.next();
}
```

### 使用者設定流程

1. 在 Dashboard 輸入自訂域名（如 `www.myapp.com`）
2. AIGA 提供 CNAME 記錄：`www.myapp.com → custom.aiga.tw`
3. 使用者在 DNS 設定 CNAME
4. AIGA 驗證 DNS 設定後啟用

---

## 技術選型

| 類別 | 選擇 | 原因 |
|------|------|------|
| **Framework** | Next.js 16 + React 19 | 已建好，SSR/ISR 支援佳 |
| **Database** | Neon (Serverless PostgreSQL) | 免費額度 0.5GB、Vercel 原生整合、不像 Supabase 每 project $10 |
| **ORM** | Prisma | Next.js 生態系最佳搭配 |
| **認證** | NextAuth.js | 免費開源、支援 OAuth、Next.js 原生整合 |
| **Agent 認證** | API Key（hash 存儲） | 簡單安全、業界標準 |
| **圖片儲存** | Vercel Blob | 與 Vercel 部署配合好 |
| **Validation** | Zod | TypeScript-first、Next.js 原生支援 |
| **Rate Limiting** | Upstash Redis | Serverless Redis、適合 Vercel |
| **部署** | Vercel（已有付費方案） | 已在使用 |
| **UI** | Tailwind CSS + shadcn/ui | 已建好 |

---

## 對比：為什麼用 AIGA 而不是自架網站？

| | 自架網站 | AIGA 託管 |
|---|---------|-----------|
| **建站成本** | 需要工程師 | AI Agent 自動完成 |
| **維護成本** | 持續維運 | AIGA 負責 |
| **更新方式** | 人工修改 | Agent API 自動更新 |
| **SEO** | 需要自己優化 | AIGA 內建最佳化 |
| **流量曝光** | 自己導流 | AIGA 平台自帶流量 |
| **費用** | 域名 + 主機 | 免費（基本方案） |
| **隱私政策頁** | 自己寫或用產生器 | 自動生成 + 託管 |
| **上線速度** | 數天 | 30 秒 |

---

## 檔案結構規劃（完整）

```
src/
├── app/
│   ├── layout.tsx                       # 主站 layout
│   ├── page.tsx                         # 首頁（Featured, 排行榜）
│   ├── spec/
│   │   └── page.tsx                     # LLM-Readable Spec 頁面
│   ├── apps/
│   │   ├── page.tsx                     # 應用列表
│   │   └── [id]/
│   │       └── page.tsx                 # 應用詳情
│   ├── p/
│   │   └── [slug]/
│   │       ├── page.tsx                 # 託管首頁（獨立 layout）
│   │       ├── privacy/page.tsx         # 隱私權政策頁面
│   │       ├── terms/page.tsx           # 使用條款頁面
│   │       └── layout.tsx               # 無 AIGA header/footer
│   ├── dashboard/
│   │   ├── layout.tsx                   # Dashboard layout（需登入）
│   │   ├── page.tsx                     # Dashboard 首頁
│   │   ├── pages/
│   │   │   ├── page.tsx                 # 頁面管理列表
│   │   │   ├── new/page.tsx             # 新增頁面
│   │   │   └── [slug]/edit/page.tsx     # 編輯頁面
│   │   ├── apps/
│   │   │   └── page.tsx                 # App 管理
│   │   └── settings/
│   │       └── page.tsx                 # API Key 管理
│   └── api/
│       ├── auth/
│       │   └── [...nextauth]/route.ts   # NextAuth.js 端點
│       └── v1/
│           ├── auth/
│           │   ├── register/route.ts    # POST（寄驗證碼）
│           │   └── verify/route.ts      # POST（驗證 + 回傳 Key）
│           ├── pages/
│           │   ├── route.ts             # POST (create), GET (list)
│           │   └── [slug]/
│           │       ├── route.ts         # GET, PUT, PATCH, DELETE
│           │       ├── publish/route.ts # POST
│           │       └── unpublish/route.ts # POST
│           ├── apps/
│           │   ├── route.ts             # POST, GET
│           │   └── [id]/route.ts        # GET, PUT, DELETE
│           ├── organizations/
│           │   └── route.ts             # POST, GET
│           └── upload/
│               └── route.ts             # POST（圖片上傳）
├── templates/
│   ├── app-landing/
│   │   ├── AppLandingPage.tsx
│   │   └── sections/
│   │       ├── HeroSection.tsx
│   │       ├── FeaturesSection.tsx
│   │       ├── ScreenshotsSection.tsx
│   │       ├── DownloadSection.tsx
│   │       └── FaqSection.tsx
│   ├── company-profile/
│   │   ├── CompanyProfilePage.tsx
│   │   └── sections/
│   │       ├── AboutSection.tsx
│   │       ├── TeamSection.tsx
│   │       └── ContactSection.tsx
│   ├── link-in-bio/
│   │   └── LinkInBioPage.tsx
│   └── shared/
│       ├── PageRenderer.tsx
│       ├── SectionRenderer.tsx
│       └── ThemeProvider.tsx
├── lib/
│   ├── utils.ts                         # 現有工具函數
│   ├── db.ts                            # Prisma client instance
│   ├── auth.ts                          # NextAuth.js 設定 + API Key 驗證
│   └── validations/
│       ├── page.ts                      # 頁面相關 Zod schema
│       └── app.ts                       # App 相關 Zod schema
└── middleware.ts                         # 自訂域名路由（Phase 5）
```

---

## 下一步行動

從 **Phase 1** 開始：

1. 在 Vercel Dashboard 建立 Neon Database
2. 安裝 Prisma，設定連線
3. 定義 Schema，執行 migration
4. 設定 NextAuth.js + Google OAuth
5. 建立 Dashboard 基本框架 + API Key 管理
6. 確認認證流程可運作後，進入 Phase 2
