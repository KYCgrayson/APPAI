-- Remove the hand-inserted (non-standard) Subtitle Studio gallery card.
-- Keeps the proper one created via POST /api/v1/pages, which has
-- hostedPageSlug='subtitle'. The old SQL-inserted card has no
-- hostedPageSlug (it used a raw url), so this targets only that row.
DELETE FROM "App"
WHERE "name" = 'Subtitle Studio'
  AND "hostedPageSlug" IS NULL;
