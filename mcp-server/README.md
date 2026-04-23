# AppAI MCP Server

[![npm version](https://img.shields.io/npm/v/@appai/mcp-server.svg)](https://www.npmjs.com/package/@appai/mcp-server)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](./LICENSE)

MCP (Model Context Protocol) server for [AppAI](https://appai.info) — create and manage hosted landing pages, privacy policies, and terms of service directly from AI coding agents.

One `npx` install, one Google sign-in, and your agent can ship a live, multi-language landing page at `appai.info/p/{slug}` in under a minute. No hosting, no CMS, no frontend build.

---

## Why this exists

Ship-blockers like "I need a privacy policy URL to submit to the App Store" or "the user wants a landing page for this weekend project" used to be a 2-hour detour. With this MCP the agent handles the whole thing end-to-end:

1. Authenticates you via device flow (opens browser, Google sign-in)
2. Picks a preset (app landing / SaaS / profile / portfolio / link-in-bio / event)
3. Calls `create-page` with title, sections, theme color, privacy policy, ToS
4. Gives you back live URLs — including `/privacy` and `/terms` variants

---

## Quick Setup

### Claude Code

```bash
claude mcp add appai -- npx -y @appai/mcp-server
```

### Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "appai": {
      "command": "npx",
      "args": ["-y", "@appai/mcp-server"]
    }
  }
}
```

### Cursor

Add to `.cursor/mcp.json` in your project:

```json
{
  "mcpServers": {
    "appai": {
      "command": "npx",
      "args": ["-y", "@appai/mcp-server"]
    }
  }
}
```

Requires Node.js 18+.

---

## Authentication Flow

AppAI uses OAuth Device Authorization — the MCP never handles your password.

1. Agent calls `start-auth` → gets a `verification_uri_complete` and `device_code`
2. Agent opens the URL in your browser (or prints it for you to open)
3. You sign in with Google on appai.info
4. Agent polls `poll-auth` with `device_code` every ~5 seconds
5. On approval, agent receives an API key (`appai_sk_...`) and uses it for every subsequent call

The API key is scoped to your AppAI account and can be revoked anytime from the dashboard at `appai.info/dashboard`.

---

## Available Tools

| Tool | Description |
|------|-------------|
| `start-auth` | Start device authorization flow to get an API key |
| `poll-auth` | Poll for auth completion after `start-auth` |
| `list-presets` | List page templates (app landing, SaaS, profile, link-in-bio, portfolio, event) |
| `list-sections` | List all 22 section types with full JSON schemas |
| `create-page` | Create a hosted page with landing content, privacy policy, and ToS |
| `list-pages` | List all pages owned by the authenticated user |
| `get-page` | Fetch a page by slug (optionally a specific locale or variants list) |
| `update-page` | Partial (PATCH) or full (PUT) update of an existing page |
| `delete-page` | Delete a page (or just one locale variant) |
| `set-default-locale` | Change which locale loads by default at `/p/{slug}` |

## Available Prompts

| Prompt | What it does |
|--------|--------------|
| `create-app-page` | Guided flow from auth to live landing page |
| `setup-privacy-policy` | Fastest path to a privacy policy URL for App Store / Play Store submission |

## Available Resources

| URI | Content |
|-----|---------|
| `appai://spec` | Full API specification (same as [appai.info/spec](https://appai.info/spec)) |
| `appai://llms.txt` | LLM-friendly service overview |

---

## Section Types (22 total)

AppAI pages are built from composable sections. Ask the agent to call `list-sections` for full JSON schemas — this table is just the overview:

| Category | Types |
|---|---|
| Hero & narrative | `hero`, `about`, `stats`, `cta` |
| Product | `features`, `screenshots`, `gallery`, `video`, `pricing`, `pdf-viewer` |
| Social proof | `testimonials`, `team`, `sponsors` |
| Interactive | `form`, `action`, `tool`, `media-downloader`, `embed` |
| Info & utility | `faq`, `contact`, `links`, `downloads`, `schedule` |

Each section supports a `backgroundColor` and optional anchor `id` for in-page linking. The `hero` section supports `centered` / `split` / `minimal` variants and four heights.

### Contact pages

A typical "Contact Us" page combines two sections:

- `contact` — static email / phone / address / external form URL
- `form` — real form with text, email, tel, textarea, and **select** (dropdown with agent-defined options) fields. Submits via `mailto:` or an `https://` webhook (server-side proxied, so the target URL is hidden from the browser).

---

## Usage Example

Once installed, tell your agent:

> "Create a landing page for my app 'Foocal' on AppAI. It's a Pomodoro timer. Use the app-landing preset, brand color #8B5CF6, and include a privacy policy."

The agent will:

1. Run `start-auth`, open the verification URL
2. Wait for you to sign in, poll with `poll-auth`
3. Call `list-presets` to grab the app-landing template
4. Call `create-page` with the filled-out content
5. Return the live URL, e.g. `https://appai.info/p/foocal`

### Minimal `create-page` payload

```json
{
  "api_key": "appai_sk_...",
  "slug": "foocal",
  "title": "Foocal — Pomodoro timer",
  "tagline": "25 minutes of focus, one tap away.",
  "themeColor": "#8B5CF6",
  "content": {
    "sections": [
      {
        "type": "hero",
        "order": 0,
        "data": {
          "headline": "Focus, one tap away.",
          "subheadline": "A minimalist Pomodoro timer for iOS.",
          "ctaText": "Download on the App Store",
          "ctaUrl": "https://apps.apple.com/..."
        }
      },
      {
        "type": "features",
        "order": 1,
        "data": {
          "items": [
            { "title": "Simple", "description": "One button. That's it." },
            { "title": "Private", "description": "No accounts, no tracking." },
            { "title": "Beautiful", "description": "Designed for focus." }
          ]
        }
      }
    ]
  },
  "privacyPolicy": "# Privacy Policy\n\nFoocal does not collect personal data...",
  "termsOfService": "# Terms of Service\n\nBy using Foocal, you agree...",
  "isPublished": true,
  "category": "PRODUCTIVITY"
}
```

Result: `https://appai.info/p/foocal` (landing), `/privacy`, `/terms` — all live instantly.

---

## Troubleshooting

**"The user must open the verification URL"** — `start-auth` returns a `verification_uri_complete`. Open it manually if your agent can't open browsers on your behalf.

**`poll-auth` returns `authorization_pending`** — normal. Keep polling every 5 seconds. The device code expires after ~15 minutes; re-run `start-auth` if so.

**401 Unauthorized on `create-page`** — API key expired or revoked. Re-run `start-auth`.

**`slug` conflict** — slugs are globally unique. Either pick a new one, or pass `upsert: true` to overwrite a page you own.

**Want to edit a hosted page in the web UI?** — go to [appai.info/dashboard](https://appai.info/dashboard).

---

## Links

- Main site: [appai.info](https://appai.info)
- Full agent spec: [AGENT_INSTRUCTIONS.md](https://github.com/KYCgrayson/APPAI/blob/main/AGENT_INSTRUCTIONS.md)
- API spec: [appai.info/spec](https://appai.info/spec)
- Source & issues: [github.com/KYCgrayson/APPAI](https://github.com/KYCgrayson/APPAI)

## License

MIT — see [LICENSE](./LICENSE).
