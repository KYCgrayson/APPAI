# Example Payloads

## Minimal viable page (dev tool)

```json
{
  "slug": "codeforge",
  "title": "CodeForge",
  "tagline": "AI code review that catches bugs before they ship",
  "template": "APP_LANDING",
  "category": "CODING",
  "themeColor": "#6366F1",
  "fontFamily": "Space Grotesk",
  "darkMode": true,
  "metaTitle": "CodeForge — AI Code Review for GitHub",
  "metaDescription": "Catch bugs before they ship. AI-powered code review that integrates with your GitHub workflow. Free for open source.",
  "content": {
    "sections": [
      { "type": "hero", "order": 1, "data": {
          "variant": "split",
          "headline": "Code review that never sleeps",
          "subheadline": "AI reviews every PR in seconds. Catch bugs, style issues, and security flaws before your teammates do.",
          "cta": { "text": "Install on GitHub", "url": "https://github.com/apps/codeforge" }
      }},
      { "type": "features", "order": 2, "data": {
          "title": "What it catches",
          "items": [
            { "icon": "bug", "title": "Logic bugs", "description": "Off-by-one, null derefs, race conditions." },
            { "icon": "shield", "title": "Security flaws", "description": "SQL injection, XSS, auth bypasses." },
            { "icon": "zap", "title": "Performance issues", "description": "N+1 queries, blocking I/O, memory leaks." }
          ]
      }},
      { "type": "how-it-works", "order": 3, "data": {
          "steps": [
            { "title": "Install", "description": "One click on GitHub Marketplace." },
            { "title": "Open a PR", "description": "CodeForge comments within 30 seconds." },
            { "title": "Merge with confidence", "description": "Ship faster, with fewer post-deploy surprises." }
          ]
      }},
      { "type": "faq", "order": 4, "data": {
          "items": [
            { "q": "Is it free?", "a": "Free for public repos, $19/mo per repo for private." },
            { "q": "Which languages?", "a": "Python, JavaScript, TypeScript, Go, Rust, Java, Ruby." }
          ]
      }},
      { "type": "cta", "order": 5, "data": {
          "headline": "Ready to ship better code?",
          "cta": { "text": "Install on GitHub", "url": "https://github.com/apps/codeforge" }
      }}
    ]
  },
  "privacyPolicy": "(generate 300-word markdown privacy policy covering: what data is collected, how it's used, third-party sharing, retention, user rights, contact email)",
  "termsOfService": "(generate 300-word markdown ToS covering: service description, user obligations, acceptable use, IP ownership, disclaimer of warranties, limitation of liability)",
  "isPublished": true
}
```

## Consumer product with locale variants

Publish 3 times with same `slug`, different `locale`:

```
POST /api/v1/pages  { slug: "quickvid", locale: "en", title: "QuickVid — Video Downloader", ... }
POST /api/v1/pages  { slug: "quickvid", locale: "ja", title: "QuickVid — 動画ダウンローダー", ... }
POST /api/v1/pages  { slug: "quickvid", locale: "zh-CN", title: "QuickVid — 视频下载器", ... }
```

All three live at the same URL; AppAI serves the right one by browser language.

## Company profile with canonical override

```json
{
  "slug": "acme-corp",
  "template": "COMPANY_PROFILE",
  "canonicalUrl": "https://acme.com",
  "title": "Acme Corp",
  ...
}
```

Page is live on AppAI as a template showcase, but SEO credit flows to `acme.com`.
