-- Migration: Create cron job for processing inspection reminders
-- Prerequisites: pg_cron and pg_net extensions must be enabled first

-- IMPORTANT: Before running this migration:
-- 1. Enable pg_cron extension in Supabase Dashboard
-- 2. Enable pg_net extension in Supabase Dashboard
-- 3. Set the CRON_SECRET in one of these ways:
--    a) Supabase Vault: SELECT vault.create_secret('cron_secret', 'your-secret-here');
--    b) Database Settings: Add custom config app.cron_secret = 'your-secret'
-- 4. Replace YOUR_APP_URL with your actual Vercel deployment URL

-- Create the cron job to run daily at 8 AM UTC
-- Schedule format: minute hour day-of-month month day-of-week
-- '0 8 * * *' = Every day at 8:00 AM UTC

-- NOTE: Run this manually in the Supabase SQL Editor after setting up secrets
-- Do NOT run this in automated migrations as it requires manual URL configuration

/*
SELECT cron.schedule(
  'process-inspection-reminders',  -- unique job name
  '0 8 * * *',                      -- 8 AM UTC daily
  $$
  SELECT net.http_post(
    url := 'https://YOUR_APP_URL/api/cron/reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer YOUR_CRON_SECRET'
    ),
    body := '{}'::jsonb
  );
  $$
);
*/

-- Useful commands for managing cron jobs:

-- List all scheduled jobs:
-- SELECT * FROM cron.job;

-- View job run history:
-- SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 20;

-- Unschedule a job:
-- SELECT cron.unschedule('process-inspection-reminders');

-- Update job schedule (unschedule then reschedule):
-- SELECT cron.unschedule('process-inspection-reminders');
-- SELECT cron.schedule('process-inspection-reminders', '0 9 * * *', ...);
