# Inspection Instance Auto-Generation

## Overview

Automatically generate inspection instances from templates based on their frequency using pg_cron (runs directly in Postgres).

## Current State

- Templates define: task, frequency (weekly/monthly/yearly/every_3_years), default assignee
- Instances are created manually or need to be auto-generated
- Completed instances (passed/failed) are stored historically with timestamps

## Implementation Plan

### 1. Postgres Function

```sql
CREATE OR REPLACE FUNCTION generate_inspection_instances()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  tmpl RECORD;
  next_due TIMESTAMPTZ;
  existing_count INT;
BEGIN
  -- Loop through all active templates
  FOR tmpl IN
    SELECT id, location_id, frequency, default_assignee_profile_id, created_by
    FROM inspection_templates
    WHERE active = true
  LOOP
    -- Calculate next due date based on frequency
    next_due := CASE tmpl.frequency
      WHEN 'weekly' THEN
        -- Next Monday at 9 AM
        date_trunc('week', NOW()) + INTERVAL '1 week' + INTERVAL '9 hours'
      WHEN 'monthly' THEN
        -- 1st of next month at 9 AM
        date_trunc('month', NOW()) + INTERVAL '1 month' + INTERVAL '9 hours'
      WHEN 'yearly' THEN
        -- January 1st of next year at 9 AM
        date_trunc('year', NOW()) + INTERVAL '1 year' + INTERVAL '9 hours'
      WHEN 'every_3_years' THEN
        -- January 1st, 3 years from now at 9 AM
        date_trunc('year', NOW()) + INTERVAL '3 years' + INTERVAL '9 hours'
    END;

    -- Check if instance already exists for this period
    SELECT COUNT(*) INTO existing_count
    FROM inspection_instances
    WHERE template_id = tmpl.id
      AND due_at = next_due;

    -- Create instance if it doesn't exist
    IF existing_count = 0 THEN
      INSERT INTO inspection_instances (
        template_id,
        location_id,
        due_at,
        assigned_to_profile_id,
        status,
        created_by
      ) VALUES (
        tmpl.id,
        tmpl.location_id,
        next_due,
        tmpl.default_assignee_profile_id,
        'pending',
        tmpl.created_by
      );
    END IF;
  END LOOP;
END;
$$;
```

### 2. pg_cron Schedule

```sql
-- Enable pg_cron extension (if not already)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule daily at 1 AM UTC
SELECT cron.schedule(
  'generate-inspections',
  '0 1 * * *',
  $$SELECT generate_inspection_instances()$$
);

-- To view scheduled jobs:
SELECT * FROM cron.job;

-- To unschedule:
SELECT cron.unschedule('generate-inspections');
```

### 3. Frequency Logic

| Frequency | Due Date Calculation | Example |
|-----------|---------------------|---------|
| weekly | Next Monday 9 AM | Every week |
| monthly | 1st of month 9 AM | Every month |
| yearly | January 1st 9 AM | Every year |
| every_3_years | January 1st 9 AM | Every 3 years |

### 4. Edge Cases to Handle

1. **First-time setup**: When a template is created, should we immediately generate an instance?
   - Option A: Yes, create instance for current period
   - Option B: No, wait for cron to pick it up

2. **Template frequency change**: If a template's frequency changes, what happens to existing instances?
   - Keep existing instances as-is
   - New frequency applies to future generations

3. **Timezone handling**: Due dates should respect the location's timezone
   - Locations have a `timezone` field
   - Adjust `next_due` calculation accordingly

4. **Retroactive generation**: If cron was down, should we generate missed instances?
   - Probably not - just generate from current date forward

### 5. Alternative: Trigger-Based Generation

Instead of (or in addition to) cron, generate next instance when current one is completed:

```sql
CREATE OR REPLACE FUNCTION on_instance_completed()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status IN ('passed', 'void') AND OLD.status NOT IN ('passed', 'void') THEN
    -- Generate next instance for this template
    PERFORM generate_next_instance(NEW.template_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER instance_completed_trigger
  AFTER UPDATE ON inspection_instances
  FOR EACH ROW
  EXECUTE FUNCTION on_instance_completed();
```

### 6. Supabase Dashboard Setup

1. Go to **Database** → **Extensions**
2. Enable `pg_cron`
3. Go to **SQL Editor**
4. Run the function creation SQL
5. Run the cron.schedule SQL

### 7. Monitoring

```sql
-- View recent cron job runs
SELECT * FROM cron.job_run_details
ORDER BY start_time DESC
LIMIT 20;

-- Check for failed runs
SELECT * FROM cron.job_run_details
WHERE status = 'failed'
ORDER BY start_time DESC;
```

## Migration File

When ready to implement, create:
`supabase/migrations/008_instance_generation_cron.sql`

## Dependencies

- pg_cron extension enabled in Supabase
- Active templates with proper frequency values
- Location timezone data (for proper due date calculation)
