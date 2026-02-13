-- Migration: Security fixes, performance improvements, and schema cleanup
-- Applied via Supabase MCP on 2026-02-12
-- This file documents changes already applied to the remote DB.

-- ============================================================
-- 1. SECURITY: Enable RLS on reminder_settings
-- ============================================================
ALTER TABLE reminder_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reminder_settings_select" ON reminder_settings
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "reminder_settings_update" ON reminder_settings
  FOR UPDATE USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- ============================================================
-- 2. SECURITY: Fix overly permissive RLS policies
-- ============================================================
DROP POLICY IF EXISTS "locations_insert" ON locations;
CREATE POLICY "locations_insert" ON locations
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "profile_locations_delete" ON profile_locations;
CREATE POLICY "profile_locations_delete" ON profile_locations
  FOR DELETE USING (has_location_access(location_id));

DROP POLICY IF EXISTS "profile_locations_insert" ON profile_locations;
CREATE POLICY "profile_locations_insert" ON profile_locations
  FOR INSERT WITH CHECK (has_location_access(location_id));

-- ============================================================
-- 3. SECURITY: Fix has_location_access search_path
-- ============================================================
CREATE OR REPLACE FUNCTION has_location_access(loc_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profile_locations pl
    JOIN public.profiles p ON p.id = pl.profile_id
    WHERE pl.location_id = loc_id
      AND p.user_id = (SELECT auth.uid()::TEXT)
  );
$$;

-- ============================================================
-- 4. SECURITY: Fix inspection_instances_detailed view
-- ============================================================
DROP VIEW IF EXISTS inspection_instances_detailed;
CREATE VIEW inspection_instances_detailed
WITH (security_invoker = true)
AS
SELECT i.id, i.template_id, i.location_id, i.due_at,
    i.assigned_to_profile_id, i.assigned_to_email,
    i.status, i.remarks, i.inspected_at, i.failed_at, i.passed_at,
    i.created_by, i.created_at,
    t.task AS template_task, t.description AS template_description,
    t.frequency AS template_frequency,
    CASE
        WHEN ((i.status = ANY (ARRAY['pending'::text, 'in_progress'::text])) AND (i.due_at < now())) THEN true
        ELSE false
    END AS is_overdue,
    COALESCE(sig.signature_count, 0::bigint) AS signature_count,
    sig.latest_signature_at,
    COALESCE(evt.event_count, 0::bigint) AS event_count
FROM inspection_instances i
    LEFT JOIN inspection_templates t ON i.template_id = t.id
    LEFT JOIN LATERAL (
        SELECT count(*) AS signature_count, max(signed_at) AS latest_signature_at
        FROM inspection_signatures WHERE inspection_instance_id = i.id
    ) sig ON true
    LEFT JOIN LATERAL (
        SELECT count(*) AS event_count
        FROM inspection_events WHERE inspection_instance_id = i.id
    ) evt ON true;

-- ============================================================
-- 5. SECURITY: Fix all function search_paths
-- ============================================================
-- (Functions recreated with SET search_path = '' and schema-qualified tables)
-- Affected: update_updated_at_column, generate_inspection_instances,
--   on_instance_completed, on_template_created, send_inspection_reminders,
--   calculate_current_due_date, calculate_next_due_date,
--   generate_instance_id, generate_template_id

-- ============================================================
-- 6. PERFORMANCE: Drop duplicate indexes
-- ============================================================
DROP INDEX IF EXISTS idx_events_instance;      -- duplicated by idx_inspection_events_instance
DROP INDEX IF EXISTS idx_signatures_instance;  -- duplicated by idx_inspection_signatures_instance

-- ============================================================
-- 7. SCHEMA: Drop deprecated default_assignee_email column
-- ============================================================
DROP INDEX IF EXISTS idx_templates_location_active;
CREATE INDEX idx_templates_location_active
  ON inspection_templates (location_id)
  INCLUDE (task, frequency, default_assignee_profile_id)
  WHERE (active = true);

ALTER TABLE inspection_templates DROP COLUMN IF EXISTS default_assignee_email;

-- ============================================================
-- 8. SCHEMA: Add completion signature/selfie to form_responses
-- ============================================================
ALTER TABLE form_responses
  ADD COLUMN IF NOT EXISTS completion_signature TEXT,
  ADD COLUMN IF NOT EXISTS completion_selfie TEXT;

COMMENT ON COLUMN form_responses.completion_signature IS 'Base64 data URL of the completion signature captured at form submission';
COMMENT ON COLUMN form_responses.completion_selfie IS 'Base64 data URL of the selfie photo captured at form submission';
