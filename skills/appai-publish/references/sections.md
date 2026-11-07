# Section judgment

Use only the supplied contact in contact sections, privacyPolicy and termsOfService. With only LINE/phone, write “Contact us via LINE: {id/link}” or “Contact us by phone: {phone}”; never invent an email. `contact` has no LINE field: use `links` or a hero CTA for LINE, and `contact.phone` for phone. LINE URLs use `https://line.me/R/ti/p/@{id}` (id without a leading @); in `links.items[].url` or hero `ctaUrl` this is a normal HTTPS URL. Use `simple-order` only for an order + payment flow with a supplied `notificationEmail`; for orders taken by message, use a plain LINE/message link.

Use [Sections](https://appai.info/spec/sections) and `GET /api/v1/sections` for current schemas and icons; use [Tools](https://appai.info/spec/tools) for interactive sections.

Give each section a distinct job. If two sections repeat the same promise, combine or remove one. Lead with what the visitor needs to understand before acting, and omit unsupported social proof rather than filling a template with invented claims.
