-- Close Supabase's auto-generated Data API (PostgREST) over AppAI's tables (#92-F).
-- Supabase exposes the `public` schema to the `anon` and `authenticated` roles with a
-- key that ships to browsers. AppAI never uses that API: it reaches Postgres only
-- through Prisma as the table owner, which RLS does not restrict. So: enable RLS with
-- no policies (deny all through the API) and drop the API roles' grants. This covers
-- tables that exist now; re-run it after every `prisma db push`. Turning the Data API
-- off in the Supabase dashboard is the primary protection. Safe to run more than once.
DO $$
DECLARE t record;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
  END LOOP;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON ALL TABLES    IN SCHEMA public FROM anon, authenticated;
    REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
    REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon, authenticated;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES    FROM anon, authenticated;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon, authenticated;
  END IF;
END $$;
