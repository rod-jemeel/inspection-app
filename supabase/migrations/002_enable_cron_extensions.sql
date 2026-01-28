-- Migration: Enable pg_cron and pg_net extensions
-- Note: These extensions must ALSO be enabled via Supabase Dashboard:
-- Database > Extensions > Search "pg_cron" and "pg_net" > Enable

-- pg_cron: Allows scheduling of recurring jobs within Postgres
-- pg_net: Allows making HTTP requests from Postgres

-- Verify extensions are available (this will show them after enabling in Dashboard)
-- SELECT * FROM pg_extension WHERE extname IN ('pg_cron', 'pg_net');

-- After enabling extensions in Dashboard, run this to verify:
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE NOTICE 'pg_cron extension not enabled. Please enable it in Supabase Dashboard > Database > Extensions';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    RAISE NOTICE 'pg_net extension not enabled. Please enable it in Supabase Dashboard > Database > Extensions';
  END IF;
END $$;
