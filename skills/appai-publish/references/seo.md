# SEO

AppAI generates schema.org, sitemap.xml, robots.txt, hreflang alternates, and OG tags automatically. Your job is to give it good input.

## Canonical URL

By default, canonical = `https://appai.info/p/{slug}` (or locale variant path).

If the app already has its own domain and you want SEO credit on that main site, set `canonicalUrl` explicitly:

```json
{
  "slug": "myapp",
  "canonicalUrl": "https://myapp.com",
  ...
}
```

Use when:
- The app has an authoritative home page elsewhere
- AppAI is being used as a template host / secondary surface
- You want the main domain to accumulate backlinks

Do NOT set when the AppAI page IS the primary site — it will suppress indexing.

## Meta fields

| Field | Length | Tips |
|-------|--------|------|
| `metaTitle` | ≤60 chars | Include brand + 1 primary keyword |
| `metaDescription` | 120–155 chars | Action-oriented, include CTA verb |
| `ogImage` | 1200×630 px | Falls back to `heroImage` if unset |
| `tagline` | ≤120 chars | Used as fallback description |

## Structured data

Auto-generated schema.org types based on content:
- `SoftwareApplication` (app-landing template)
- `Organization` (company-profile template)
- `VideoObject` (hero video, video section)
- `FAQPage` (faq section)
- `BreadcrumbList` (child pages)

You don't configure these — just include the right sections.

## Sitemap behavior

All published pages auto-appear in `https://appai.info/sitemap.xml` including all locale variants with hreflang links. Unpublished pages (`isPublished: false`) are excluded.

## Robots / indexability

All published pages are indexable by default. There is currently no `noindex` flag — if you want a page hidden from search, either keep it unpublished or set a non-self `canonicalUrl`.
