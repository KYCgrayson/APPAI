# AIGA — Agent Web Hosting Plan

## 概念總覽

AIGA 不只是一個 AI 應用展示平台，更是一個 **Agent 驅動的網頁託管服務**。

核心場景：一家公司做了 App（iOS / Android），但沒有網頁。透過 AIGA：
1. 公司的 AI Agent 呼叫 API，提交 App 資訊
2. AIGA 自動產生一個專屬的 Landing Page
3. 頁面直接 Host 在 AIGA 的網域上（例如 `aiga.tw/p/company-name`）
4. Agent 可以隨時更新頁面內容，不需要人工操作

類似 **Linktree + Product Hunt + Vercel**：給你一個頁面、幫你 Host、讓 AI 幫你維護。

---

## 架構設計

### 系統架構圖

```
┌─────────────────────────────────────────────────┐
│                   AIGA Platform                  │
│                                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────────┐  │
│  │  主站首頁  │  │ 管理後台  │  │ 託管頁面渲染  │  │
│  │  /        │  │ /dashboard│  │ /p/[slug]    │  │
│  └──────────┘  └──────────┘  └──────────────┘  │
│                      │                │          │
│               ┌──────┴────────┐       │          │
│               │   API Layer   │       │          │
│               │  /api/v1/*    │───────┘          │
│               └──────┬────────┘                  │
│                      │                           │
│               ┌──────┴────────┐                  │
│               │   Database    │                  │
│               │  (PostgreSQL) │                  │
│               └───────────────┘                  │
│                                                  │
└─────────────────────────────────────────────────┘
        ▲               ▲               ▲
        │               │               │
   ┌────┴────┐   ┌──────┴──────┐  ┌────┴────────┐
   │ 一般使用者│   │  AI Agent   │  │ MCP Client  │
   │ (瀏覽器) │   │ (REST API) │  │(Claude/Cursor)│
   └─────────┘   └─────────────┘  └─────────────┘
```

### URL 結構

| 路徑 | 用途 |
|------|------|
| `/` | AIGA 主站首頁，展示所有已上架應用 |
| `/p/[slug]` | 託管頁面（公司/App 的 Landing Page） |
| `/apps` | 應用瀏覽列表（分類、搜尋） |
| `/apps/[id]` | 應用詳細介紹（AIGA 平台樣式） |
| `/dashboard` | 管理後台（登入後管理自己的頁面） |
| `/api/v1/*` | Agent API 端點 |

### `/p/[slug]` vs `/apps/[id]` 的差異

- **`/apps/[id]`** — AIGA 平台統一風格的應用介紹頁，嵌在 AIGA 的 layout 裡
- **`/p/[slug]`** — 獨立的託管頁面，**沒有 AIGA 的 header/footer**，看起來像是公司自己的網站。這就是「幫你 Host 網頁」的核心

---

## 資料模型（Database Schema）

### 建議使用：Prisma + PostgreSQL（或 Neon serverless）

```prisma
// prisma/schema.prisma

model Organization {
  id          String   @id @default(cuid())
  name        String
  slug        String   @unique    // URL 路徑，如 "my-company"
  description String?  @db.Text
  logoUrl     String?
  website     String?
  email       String?

  // 認證
  apiKeys     ApiKey[]

  // 關聯
  pages       HostedPage[]
  apps        App[]

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model ApiKey {
  id             String       @id @default(cuid())
  key            String       @unique        // "aiga_sk_xxxx" 格式
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

  // SEO
  metaTitle       String?
  metaDescription String?
  ogImage         String?

  // 設定
  customCss       String?     @db.Text       // 允許自訂 CSS
  themeColor      String?     @default("#000000")
  isPublished     Boolean     @default(false)

  // 自訂域名（Phase 3）
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

## Agent API 設計

### 認證方式

所有 API 請求需帶 API Key：

```
Authorization: Bearer aiga_sk_xxxxxxxxxxxxxxxx
```

### API 端點

#### 1. 組織管理

```
POST   /api/v1/organizations          # 建立組織（需 admin 或自助註冊）
GET    /api/v1/organizations/:id       # 取得組織資訊
PUT    /api/v1/organizations/:id       # 更新組織資訊
```

#### 2. 託管頁面 CRUD

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

#### 3. App 提交

```
POST   /api/v1/apps                    # 提交新 App
GET    /api/v1/apps                    # 列出自己的 App
GET    /api/v1/apps/:id                # 取得單一 App
PUT    /api/v1/apps/:id                # 更新 App
DELETE /api/v1/apps/:id                # 刪除 App
```

#### 4. 圖片上傳

```
POST   /api/v1/upload                  # 上傳圖片（logo, screenshots）
```

### Agent 使用範例

一個 AI Agent 要幫公司建立 Landing Page 的完整流程：

```bash
# Step 1: 建立頁面
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
            "ctaText": "立即下載",
            "backgroundImage": "https://..."
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
    "themeColor": "#6366f1",
    "isPublished": true
  }'

# Step 2: 頁面就上線了 → https://aiga.tw/p/awesome-app

# Step 3: Agent 後續可以自動更新
curl -X PATCH https://aiga.tw/api/v1/pages/awesome-app \
  -H "Authorization: Bearer aiga_sk_xxxx" \
  -d '{
    "content": {
      "sections": [...]
    }
  }'
```

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
```

### 渲染策略

- **ISR（Incremental Static Regeneration）**：預設策略
  - 首次請求時 SSR，之後快取
  - `revalidate: 60` — 每 60 秒重新驗證
  - Agent 更新頁面時觸發 `revalidatePath('/p/[slug]')`
- **好處**：速度快、SEO 友善、低伺服器負擔

---

## 自訂域名支援（Phase 3 延伸功能）

### 實作方式

使用 Next.js Middleware 做域名路由：

```typescript
// src/middleware.ts
import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') || '';

  // 如果不是主域名，查找 custom domain 對應的 page
  if (!hostname.includes('aiga.tw') && !hostname.includes('localhost')) {
    // 改寫 URL 到 /p/[slug]
    // 需要查 DB 或 cache 找到 domain → slug 的映射
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

## 實作分期

### Phase 1：基礎建設（基本頁面 + DB）

**目標**：讓 AIGA 可以存儲和顯示頁面

- [ ] 設定 Prisma + PostgreSQL（或 Neon）
- [ ] 建立 DB Schema（Organization, HostedPage, App）
- [ ] 建立 AIGA 主站首頁
- [ ] 建立 `/apps` 應用列表頁
- [ ] 建立 `/apps/[id]` 應用詳細頁
- [ ] 手動 seed 一些範例資料

**新增依賴**：`prisma`, `@prisma/client`

### Phase 2：託管頁面系統

**目標**：讓 `/p/[slug]` 可以渲染託管頁面

- [ ] 建立 `/p/[slug]` dynamic route
- [ ] 實作 `PageRenderer` — 根據 template 渲染
- [ ] 實作 `APP_LANDING` 模板（Hero, Features, Screenshots, Download）
- [ ] 實作 `COMPANY_PROFILE` 模板（About, Team, Contact）
- [ ] 實作 `LINK_IN_BIO` 模板
- [ ] 加入 themeColor 支援
- [ ] 加入 SEO meta tags（Open Graph, Twitter Card）
- [ ] 設定 ISR 快取策略

### Phase 3：Agent API

**目標**：讓 AI Agent 可以透過 API 自動建立/更新頁面

- [ ] 實作 API Key 認證 middleware
- [ ] `POST /api/v1/pages` — 建立頁面
- [ ] `GET/PUT/PATCH/DELETE /api/v1/pages/:slug` — 頁面 CRUD
- [ ] `POST /api/v1/apps` — 提交 App
- [ ] `GET/PUT/DELETE /api/v1/apps/:id` — App CRUD
- [ ] 圖片上傳端點（整合 Vercel Blob 或 Cloudflare R2）
- [ ] 更新時觸發 ISR revalidation
- [ ] API Rate limiting
- [ ] Request validation（Zod schema）

**新增依賴**：`zod`

### Phase 4：Dashboard 管理後台

**目標**：讓組織可以透過 UI 管理頁面

- [ ] 使用者認證（NextAuth.js 或 Clerk）
- [ ] Dashboard 首頁（概覽）
- [ ] 頁面管理（CRUD、預覽）
- [ ] App 管理
- [ ] API Key 管理（生成、撤銷）
- [ ] 基本 Analytics（PageView 計數）

**新增依賴**：`next-auth` 或 `@clerk/nextjs`

### Phase 5：MCP Server + 自訂域名

**目標**：讓 Claude/Cursor 可以用自然語言操作

- [ ] MCP Server 實作（包裝 REST API）
- [ ] 自然語言 → API 呼叫的 mapping
- [ ] 自訂域名支援（Middleware + DNS 驗證）
- [ ] SSL 自動配置（Vercel 自動處理 或 Cloudflare）

---

## 技術選型建議

| 類別 | 推薦 | 原因 |
|------|------|------|
| **Database** | Neon (Serverless PostgreSQL) | 免費額度充足、Vercel 原生整合 |
| **ORM** | Prisma | Next.js 生態系最佳搭配 |
| **認證** | Clerk | 開發速度快、免費額度足夠 |
| **圖片儲存** | Vercel Blob / Cloudflare R2 | 與 Vercel 部署配合好 |
| **Validation** | Zod | TypeScript-first、Next.js 原生支援 |
| **Rate Limiting** | Upstash Redis | Serverless Redis、適合 Vercel |
| **Analytics** | 自建 + Vercel Analytics | 輕量、不影響效能 |

---

## 對比：為什麼用 AIGA 而不是自架網站？

| | 自架網站 | AIGA 託管 |
|---|---------|-----------|
| **建站成本** | 需要工程師 | AI Agent 自動完成 |
| **維護成本** | 持續維運 | AIGA 負責 |
| **更新方式** | 人工修改 | Agent API 自動更新 |
| **SEO** | 需要自己優化 | AIGA 內建最佳化 |
| **流量曝光** | 自己導流 | AIGA 平台自帶流量 |
| **費用** | 域名 + 主機 | 免費或低月費 |

---

## 檔案結構規劃（完整）

```
src/
├── app/
│   ├── layout.tsx                       # 主站 layout
│   ├── page.tsx                         # 首頁
│   ├── apps/
│   │   ├── page.tsx                     # 應用列表
│   │   └── [id]/
│   │       └── page.tsx                 # 應用詳情
│   ├── p/
│   │   └── [slug]/
│   │       ├── page.tsx                 # 託管頁面（獨立 layout）
│   │       └── layout.tsx               # 無 AIGA header/footer
│   ├── dashboard/
│   │   ├── layout.tsx                   # Dashboard layout
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
│       └── v1/
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
│               └── route.ts             # POST (圖片上傳)
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
│   ├── auth.ts                          # API Key 驗證
│   └── validations/
│       ├── page.ts                      # 頁面相關 Zod schema
│       └── app.ts                       # App 相關 Zod schema
└── middleware.ts                         # 自訂域名路由（Phase 5）
```

---

## 下一步行動

建議從 **Phase 1** 開始：

1. 安裝 Prisma，設定 Database
2. 定義 Schema，執行 migration
3. 建立 AIGA 主站首頁 UI
4. Seed 範例資料
5. 確認基礎架構可運作後，進入 Phase 2 建立託管頁面系統
