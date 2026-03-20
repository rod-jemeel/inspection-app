-- Migration: Add log_type to form_templates for custom UI routing
-- log_type links a form template to one of the built-in log UIs
-- (e.g. daily_narcotic_count, crash_cart_daily, controlled_substance_inventory)

ALTER TABLE form_templates
  ADD COLUMN IF NOT EXISTS log_type TEXT;

-- Seed log_type values for the standard Nursing Logs forms (all locations)
UPDATE form_templates
SET log_type = 'daily_narcotic_count'
WHERE name = 'Daily Narcotic Count';

UPDATE form_templates
SET log_type = 'crash_cart_daily'
WHERE name = 'Crash Cart Daily Checklist';

UPDATE form_templates
SET log_type = 'controlled_substance_inventory'
WHERE name IN (
  'Controlled Substances Perpetual Inventory - Ephedrine',
  'Controlled Substances Perpetual Inventory - Fentanyl',
  'Controlled Substances Perpetual Inventory - Versed'
);

UPDATE form_templates
SET log_type = 'narcotic_signout'
WHERE name = 'CRNA Narcotic Sign-Out Form';

UPDATE form_templates
SET log_type = 'crash_cart_checklist'
WHERE name = 'Crash Cart Monthly Checklist';

UPDATE form_templates
SET log_type = 'cardiac_arrest_record'
WHERE name = 'Cardiac Arrest Record';

-- Also backfill log_type on any existing pending/in_progress instances
-- so the trigger and routing work correctly
UPDATE inspection_instances ii
SET log_type = ft.log_type
FROM form_templates ft
WHERE ii.form_template_id = ft.id
  AND ft.log_type IS NOT NULL
  AND ii.log_type IS NULL
  AND ii.status IN ('pending', 'in_progress');
