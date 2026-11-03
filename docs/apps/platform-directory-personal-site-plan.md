# Hosted personal websites — D30

Personal websites are a Hosted Page capability: any organization's agent publishes template `PERSON` through the existing Pages API at `/p/{slug}`. No person data, new tables or schema changes belong in the repository.

- `profile-header`: name as h1, avatar or initials, Markdown intro, contact/social links and anchor navigation.
- `project-cards`: responsive editorial grid, app icons or monograms, optional phone/web screenshots and product links.
- `entries`: reusable focus, experience and contact blocks.
- Editorial sections default to off-white, serif headings, teal text and readable page-theme accents; motion respects reduced-motion preferences and content is visible without JavaScript.
- Websites lists published root PERSON variants only when the linked App is approved. A single batched hosted-page query supplies localized name/tagline using `pickByLocale`; links use hosted locale suffixes when available.
- New PERSON listings start unapproved; changing an App-owning default root from another template to PERSON resets approval. Existing PERSON edits preserve approval. Pages are live immediately at `/p/{slug}`; directory inclusion requires the existing admin approve action.
- Child creation is exempt from root slug ownership checks.
- Root slug ownership is checked across all locales before POST conflict/upsert handling. Another organization's root slug returns 403; the owner can add locales.

The `profile` preset suggests the three editorial sections. Agents upload images first and link each project to its own hosted page or product site; they must not invent experience, metrics or contact details.

No source-coded personal routes/assets remain. Existing hosted-page sitemap generation covers PERSON pages.
