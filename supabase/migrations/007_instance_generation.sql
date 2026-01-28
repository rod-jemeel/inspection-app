-- Instance Generation: Triggers and Cron
-- Automatically spawn inspection instances from templates

-- ============================================
-- 1. Helper function to calculate next due date
-- ============================================
CREATE OR REPLACE FUNCTION calculate_next_due_date(
  freq TEXT,
  from_date TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN CASE freq
    WHEN 'weekly' THEN
      -- Next Monday at 9 AM
      date_trunc('week', from_date) + INTERVAL '1 week' + INTERVAL '9 hours'
    WHEN 'monthly' THEN
      -- 1st of next month at 9 AM
      date_trunc('month', from_date) + INTERVAL '1 month' + INTERVAL '9 hours'
    WHEN 'yearly' THEN
      -- January 1st of next year at 9 AM
      date_trunc('year', from_date) + INTERVAL '1 year' + INTERVAL '9 hours'
    WHEN 'every_3_years' THEN
      -- January 1st, 3 years from now at 9 AM
      date_trunc('year', from_date) + INTERVAL '3 years' + INTERVAL '9 hours'
    ELSE
      -- Default to next month
      date_trunc('month', from_date) + INTERVAL '1 month' + INTERVAL '9 hours'
  END;
END;
$$;

-- ============================================
-- 2. Helper function to calculate current period due date
-- ============================================
CREATE OR REPLACE FUNCTION calculate_current_due_date(freq TEXT)
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql
AS $$
DECLARE
  now_ts TIMESTAMPTZ := NOW();
BEGIN
  RETURN CASE freq
    WHEN 'weekly' THEN
      -- This week's Monday at 9 AM, or next Monday if already past
      CASE
        WHEN EXTRACT(DOW FROM now_ts) = 1 AND now_ts::TIME < '09:00' THEN
          date_trunc('day', now_ts) + INTERVAL '9 hours'
        WHEN EXTRACT(DOW FROM now_ts) < 1 OR (EXTRACT(DOW FROM now_ts) = 1 AND now_ts::TIME >= '09:00') THEN
          date_trunc('week', now_ts) + INTERVAL '1 week' + INTERVAL '9 hours'
        ELSE
          date_trunc('week', now_ts) + INTERVAL '9 hours'
      END
    WHEN 'monthly' THEN
      -- This month's 1st at 9 AM, or next month if already past
      CASE
        WHEN EXTRACT(DAY FROM now_ts) = 1 AND now_ts::TIME < '09:00' THEN
          date_trunc('day', now_ts) + INTERVAL '9 hours'
        ELSE
          date_trunc('month', now_ts) + INTERVAL '1 month' + INTERVAL '9 hours'
      END
    WHEN 'yearly' THEN
      -- This year's Jan 1 at 9 AM, or next year if already past
      CASE
        WHEN EXTRACT(DOY FROM now_ts) = 1 AND now_ts::TIME < '09:00' THEN
          date_trunc('day', now_ts) + INTERVAL '9 hours'
        ELSE
          date_trunc('year', now_ts) + INTERVAL '1 year' + INTERVAL '9 hours'
      END
    WHEN 'every_3_years' THEN
      -- 3 years from now (no "current period" concept)
      date_trunc('year', now_ts) + INTERVAL '3 years' + INTERVAL '9 hours'
    ELSE
      date_trunc('month', now_ts) + INTERVAL '1 month' + INTERVAL '9 hours'
  END;
END;
$$;

-- ============================================
-- 3. Trigger: Spawn instance on template creation
-- ============================================
CREATE OR REPLACE FUNCTION on_template_created()
RETURNS TRIGGER AS $$
DECLARE
  current_due TIMESTAMPTZ;
  assignee_email TEXT;
BEGIN
  -- Only create instance if template is active
  IF NEW.active = false THEN
    RETURN NEW;
  END IF;

  -- Calculate due date for current/next period
  current_due := calculate_current_due_date(NEW.frequency);

  -- Get assignee email if profile is set
  IF NEW.default_assignee_profile_id IS NOT NULL THEN
    SELECT email INTO assignee_email
    FROM profiles
    WHERE id = NEW.default_assignee_profile_id;
  END IF;

  -- Create the first instance
  INSERT INTO inspection_instances (
    template_id,
    location_id,
    due_at,
    assigned_to_profile_id,
    assigned_to_email,
    status,
    created_by
  ) VALUES (
    NEW.id,
    NEW.location_id,
    current_due,
    NEW.default_assignee_profile_id,
    assignee_email,
    'pending',
    NEW.created_by
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger
DROP TRIGGER IF EXISTS template_created_trigger ON inspection_templates;
CREATE TRIGGER template_created_trigger
  AFTER INSERT ON inspection_templates
  FOR EACH ROW
  EXECUTE FUNCTION on_template_created();

-- ============================================
-- 4. Trigger: Spawn next instance on completion
-- ============================================
CREATE OR REPLACE FUNCTION on_instance_completed()
RETURNS TRIGGER AS $$
DECLARE
  tmpl RECORD;
  next_due TIMESTAMPTZ;
  assignee_email TEXT;
  existing_count INT;
BEGIN
  -- Only trigger on status change to passed or void
  IF NEW.status NOT IN ('passed', 'void') THEN
    RETURN NEW;
  END IF;

  IF OLD.status IN ('passed', 'void') THEN
    RETURN NEW;
  END IF;

  -- Get the template
  SELECT * INTO tmpl
  FROM inspection_templates
  WHERE id = NEW.template_id AND active = true;

  -- Exit if template not found or inactive
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  -- Calculate next due date from current instance's due date
  next_due := calculate_next_due_date(tmpl.frequency, NEW.due_at);

  -- Check if instance already exists for next period
  SELECT COUNT(*) INTO existing_count
  FROM inspection_instances
  WHERE template_id = tmpl.id
    AND due_at = next_due
    AND status != 'void';

  -- Only create if doesn't exist
  IF existing_count = 0 THEN
    -- Get assignee email
    IF tmpl.default_assignee_profile_id IS NOT NULL THEN
      SELECT email INTO assignee_email
      FROM profiles
      WHERE id = tmpl.default_assignee_profile_id;
    END IF;

    INSERT INTO inspection_instances (
      template_id,
      location_id,
      due_at,
      assigned_to_profile_id,
      assigned_to_email,
      status,
      created_by
    ) VALUES (
      tmpl.id,
      tmpl.location_id,
      next_due,
      tmpl.default_assignee_profile_id,
      assignee_email,
      'pending',
      tmpl.created_by
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger
DROP TRIGGER IF EXISTS instance_completed_trigger ON inspection_instances;
CREATE TRIGGER instance_completed_trigger
  AFTER UPDATE ON inspection_instances
  FOR EACH ROW
  EXECUTE FUNCTION on_instance_completed();

-- ============================================
-- 5. Cron function: Generate missing instances
-- ============================================
CREATE OR REPLACE FUNCTION generate_inspection_instances()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  tmpl RECORD;
  next_due TIMESTAMPTZ;
  existing_count INT;
  assignee_email TEXT;
BEGIN
  -- Loop through all active templates
  FOR tmpl IN
    SELECT id, location_id, frequency, default_assignee_profile_id, created_by
    FROM inspection_templates
    WHERE active = true
  LOOP
    -- Calculate next due date
    next_due := calculate_current_due_date(tmpl.frequency);

    -- Check if instance already exists for this period
    SELECT COUNT(*) INTO existing_count
    FROM inspection_instances
    WHERE template_id = tmpl.id
      AND due_at = next_due
      AND status != 'void';

    -- Create instance if it doesn't exist
    IF existing_count = 0 THEN
      -- Get assignee email
      IF tmpl.default_assignee_profile_id IS NOT NULL THEN
        SELECT email INTO assignee_email
        FROM profiles
        WHERE id = tmpl.default_assignee_profile_id;
      ELSE
        assignee_email := NULL;
      END IF;

      INSERT INTO inspection_instances (
        template_id,
        location_id,
        due_at,
        assigned_to_profile_id,
        assigned_to_email,
        status,
        created_by
      ) VALUES (
        tmpl.id,
        tmpl.location_id,
        next_due,
        tmpl.default_assignee_profile_id,
        assignee_email,
        'pending',
        tmpl.created_by
      );
    END IF;
  END LOOP;
END;
$$;

-- ============================================
-- 6. Schedule the cron job (daily at 1 AM UTC)
-- ============================================
-- OPTIONAL: Run this ONLY if pg_cron is enabled:
-- SELECT cron.schedule(
--   'generate-inspections',
--   '0 1 * * *',
--   $$SELECT generate_inspection_instances()$$
-- );
--
-- To enable pg_cron:
-- 1. Supabase Dashboard → Database → Extensions → Enable pg_cron
-- 2. Then run the cron.schedule command above

-- ============================================
-- 7. Grant permissions
-- ============================================
GRANT EXECUTE ON FUNCTION calculate_next_due_date TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_current_due_date TO authenticated;
GRANT EXECUTE ON FUNCTION generate_inspection_instances TO service_role;
