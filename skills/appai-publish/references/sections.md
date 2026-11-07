# Section judgment

Use [Sections](https://appai.info/spec/sections) and `GET /api/v1/sections` for current schemas and icons; use [Tools](https://appai.info/spec/tools) for interactive sections.

Give each section a distinct job. If two sections repeat the same promise, combine or remove one. Lead with what the visitor needs to understand before acting, and omit unsupported social proof rather than filling a template with invented claims.

YouTube/Vimeo/mp4 → `video` (iframe player); social posts from Instagram, Facebook, Threads, TikTok, X, YouTube Shorts → `embed`.

Menus/service price lists: put the price in `price` on `features.items`. Use `contact.hours` for structured weekly hours, `note` for holiday closures, and `map: true` with a supplied address for Google/Apple Maps links (no key). Optional video/embed goes after about sections and before contact. Instagram posts/reels use official sandboxed iframes; X uses a linked card.
