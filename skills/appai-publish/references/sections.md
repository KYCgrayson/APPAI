# Section Library

24 section types. Pick 4–8 per page. Order them via `order` field (ascending).

## Hero variants

| `type` | `data.variant` | Use when |
|--------|----------------|----------|
| `hero` | `centered` | Default; strong headline products |
| `hero` | `split` | Product with a screenshot worth showing |
| `hero` | `minimal` | Premium brand aesthetic |

Fields: `headline`, `subheadline`, `cta` ({text, url}), `secondaryCta`, `heroImage`, `logo`, `variant`.

## Content sections

| `type` | Purpose |
|--------|---------|
| `features` | 3–6 benefit cards with icon/title/description |
| `stats` | Numbers that build credibility |
| `how-it-works` | Numbered steps |
| `testimonials` | Social proof quotes |
| `pricing` | Plan cards with features + CTA |
| `faq` | Expandable Q&A |
| `cta` | Big mid/bottom-of-page conversion block |
| `logos` | "As seen on" logo wall |
| `gallery` | Image grid / screenshots |
| `video` | YouTube or Vimeo embed (auto-detects URL) |
| `team` | Staff cards with photo + bio |
| `contact` | Email/phone/address block |
| `form` | Lead capture form (see form.md) |
| `download` | App store buttons (iOS/Android/web) |
| `prose` | Long-form markdown content |
| `timeline` | Chronological milestones |
| `comparison` | Feature matrix vs competitors |
| `newsletter` | Email signup |
| `divider` | Visual break |
| `media-downloader` | Video downloader widget (for media tools) |
| `embed` | TikTok / Loom / YouTube / Vimeo / Spotify / CodePen / Figma / X / Instagram (auto-detects provider from URL) |

## Per-section styling

Every section accepts `data.backgroundColor` (hex) to create visual rhythm across the page. Alternate light/dark in consumer pages; stay consistent in minimal brands.

## Link rel (SEO)

`links` and `cta` sections accept an optional `rel` string on each link. Use `"nofollow"` for affiliate/sponsored/user-submitted links, `"sponsored"` for paid placements. Default (unset) = standard external dofollow (`rel="noopener noreferrer"`). This matters for Google's link spam policy — mark affiliate links or Google will.

## Minimum viable page

Hero → Features → How-it-works → FAQ → CTA → (implicit footer with privacy/terms)
