# Inspection Instance Auto-Generation

## Overview

Automatically generate inspection instances from templates based on their frequency using Postgres triggers and pg_cron.

## How It Works

| Event | What Happens |
|-------|--------------|
| **Template created** | Trigger immediately spawns first instance for current/next period |
| **Instance passed/void** | Trigger spawns next instance for the template |
| **Daily cron (1 AM)** | Catches any missed instances, ensures coverage |

## Current State

- Templates define: task, frequency (weekly/monthly/yearly/every_3_years), default assignee
- **Migration ready:** `supabase/migrations/007_instance_generation.sql`
- Apply migration to enable automatic instance generation
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

1. **First-time setup**: When a template is created, immediately generate an instance for the current period.
   - **Decision: Option A (immediate spawning)**
   - Users expect to see their inspection right away
   - The cron handles future regeneration
   - Implemented via: Postgres trigger on `inspection_templates` INSERT

2. **Template frequency change**: If a template's frequency changes, what happens to existing instances?
   - Keep existing instances as-is
   - New frequency applies to future generations

3. **Timezone handling**: Due dates should respect the location's timezone
   - Locations have a `timezone` field
   - Adjust `next_due` calculation accordingly

4. **Retroactive generation**: If cron was down, should we generate missed instances?
   - Probably not - just generate from current date forward

### 5. Trigger: Spawn on Template Creation

When a new template is created, immediately spawn an instance for the current period:

```sql
CREATE OR REPLACE FUNCTION on_template_created()
RETURNS TRIGGER AS $$
DECLARE
  current_due TIMESTAMPTZ;
  assignee_email TEXT;
BEGIN
  -- Calculate due date for current period
  current_due := CASE NEW.frequency
    WHEN 'weekly' THEN
      -- This week's Monday at 9 AM (or next Monday if past)
      CASE
        WHEN EXTRACT(DOW FROM NOW()) = 1 AND NOW()::TIME < '09:00' THEN
          date_trunc('day', NOW()) + INTERVAL '9 hours'
        ELSE
          date_trunc('week', NOW()) + INTERVAL '1 week' + INTERVAL '9 hours'
      END
    WHEN 'monthly' THEN
      -- This month's 1st at 9 AM (or next month if past)
      CASE
        WHEN EXTRACT(DAY FROM NOW()) = 1 AND NOW()::TIME < '09:00' THEN
          date_trunc('day', NOW()) + INTERVAL '9 hours'
        ELSE
          date_trunc('month', NOW()) + INTERVAL '1 month' + INTERVAL '9 hours'
      END
    WHEN 'yearly' THEN
      -- This year's Jan 1 at 9 AM (or next year if past)
      CASE
        WHEN EXTRACT(DOY FROM NOW()) = 1 AND NOW()::TIME < '09:00' THEN
          date_trunc('day', NOW()) + INTERVAL '9 hours'
        ELSE
          date_trunc('year', NOW()) + INTERVAL '1 year' + INTERVAL '9 hours'
      END
    WHEN 'every_3_years' THEN
      -- 3 years from now
      date_trunc('year', NOW()) + INTERVAL '3 years' + INTERVAL '9 hours'
  END;

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

CREATE TRIGGER template_created_trigger
  AFTER INSERT ON inspection_templates
  FOR EACH ROW
  WHEN (NEW.active = true)
  EXECUTE FUNCTION on_template_created();
```

### 6. Trigger: Spawn on Instance Completion

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

### 7. Supabase Dashboard Setup

1. Go to **Database** → **Extensions**
2. Enable `pg_cron`
3. Go to **SQL Editor**
4. Run the function creation SQL
5. Run the cron.schedule SQL

### 8. Cron Job Schedule

All cron jobs run at **4 AM UTC** (before working hours):

| Job Name | Schedule | Cron Expression | Purpose |
|----------|----------|-----------------|---------|
| `generate-inspections-daily` | Every day at 4 AM | `0 4 * * *` | Daily catchall for any missed instances |
| `generate-inspections-weekly` | Monday at 4 AM | `0 4 * * 1` | Weekly template instances |
| `generate-inspections-monthly` | 1st of month at 4 AM | `0 4 1 * *` | Monthly template instances |
| `generate-inspections-yearly` | Jan 1st at 4 AM | `0 4 1 1 *` | Yearly template instances |

**Note:** All jobs call the same `generate_inspection_instances()` function which is idempotent - it only creates instances if they don't already exist.

### 9. Monitoring

```sql
-- View all scheduled cron jobs
SELECT jobid, jobname, schedule, command FROM cron.job;

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

**Created:** `supabase/migrations/007_instance_generation.sql`

Apply with:
```bash
# Via Supabase CLI
supabase db push

# Or via Supabase Dashboard SQL Editor
# Copy and paste the migration file contents
```

## Dependencies

- pg_cron extension enabled in Supabase
- Active templates with proper frequency values
- Location timezone data (for proper due date calculation)
