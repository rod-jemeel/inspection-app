-- Restore log_type on Crash Cart Monthly Checklist so it routes to /logs/crash-cart
-- (Reverses part of migration 20260326 that cleared it)
UPDATE form_templates
SET log_type = 'crash_cart_checklist'
WHERE name = 'Crash Cart Monthly Checklist'
  AND binder_id IS NOT NULL
  AND log_type IS NULL;

-- Restore log_type on corresponding instances
UPDATE inspection_instances ii
SET log_type = 'crash_cart_checklist'
FROM form_templates ft
WHERE ii.form_template_id = ft.id
  AND ft.name = 'Crash Cart Monthly Checklist'
  AND ft.binder_id IS NOT NULL
  AND (ii.log_type IS NULL OR ii.log_type = '')
  AND ii.status IN ('pending', 'in_progress');
