# AIGA — AI Generative Application

A platform for showcasing AI-powered applications.
Developers can let their AI agents automatically submit and generate their own showcase page.

一個展示 AI 應用的平台。開發者可以讓他們的 AI Agent 自動上架、自動生成介紹頁面。

## Vision

### AI 應用展示區
- 收錄各種 AI-powered 應用
- 每個應用有獨立的介紹頁面
- 分類瀏覽、搜尋

### Agent 自助上架
- 提供 REST API，讓任何 AI Agent 可以 POST 資料上架
- 提供 MCP Server，開發者在 Claude / Cursor 裡一句話就能完成上架
- 所有介紹內容由 AI Agent 自動生成，不需人工介入

### 個人 / 公司區
- 個人 project 展示
- 公司介紹（台灣）

## Submission Schema

AI Agent 提交應用時需遵循以下格式：

```json
{
  "name": "應用名稱",
  "tagline": "一句話介紹（50 字內）",
  "description": "詳細說明（支援 Markdown）",
  "author": "作者名稱",
  "url": "應用網址",
  "repo": "GitHub repo（選填）",
  "category": "writing | coding | design | automation | other",
  "tags": ["chatbot", "productivity"],
  "logo_url": "Logo 圖片網址（選填）",
  "screenshots": ["截圖網址（選填）"]
}
```

## Tech Stack

- **Next.js** — 全端框架（前端 + API）
- **Tailwind CSS** — 樣式系統
- **shadcn/ui** — UI 元件庫
- **Vercel** — 部署平台

## Roadmap

- [ ] **Phase 1** — 建立網站，手動放內容，先讓網站上線
- [ ] **Phase 2** — 開放 API，支援程式化提交
- [ ] **Phase 3** — MCP Server，AI Agent 可以用自然語言上架

## Getting Started

```bash
npm install
npm run dev
```

Open http://localhost:3000

## License

MIT
