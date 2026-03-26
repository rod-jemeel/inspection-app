-- 1. Clear log_type on Crash Cart Monthly Checklist so it uses generic form renderer
-- The admin created 28 form_fields for this template; the old JSONB page is for the yearly
-- Crash Cart Checklist (different template, binder_id: null).
UPDATE form_templates
SET log_type = NULL
WHERE name = 'Crash Cart Monthly Checklist'
  AND log_type = 'crash_cart_checklist'
  AND binder_id IS NOT NULL;

-- 2. Clear log_type on corresponding instances so inspection-detail
-- routes to generic form (not custom log page)
UPDATE inspection_instances
SET log_type = NULL
WHERE form_template_id IN (
  SELECT id FROM form_templates
  WHERE name = 'Crash Cart Monthly Checklist'
    AND binder_id IS NOT NULL
)
AND log_type = 'crash_cart_checklist';

-- 3. Deactivate orphaned seeded templates (binder_id IS NULL)
-- These were created by seedNursingLogTemplates() before templates were
-- moved into binders. They duplicate the binder-based templates.
UPDATE form_templates
SET scheduling_active = false, active = false
WHERE binder_id IS NULL
  AND log_type IS NOT NULL;

-- 4. Void duplicate instances for same form+due_at
-- Keep the one with the lowest id, void the rest
WITH ranked AS (
  SELECT id, form_template_id, due_at, status,
    ROW_NUMBER() OVER (
      PARTITION BY form_template_id, due_at
      ORDER BY id
    ) AS rn
  FROM inspection_instances
  WHERE status IN ('pending', 'in_progress')
)
UPDATE inspection_instances
SET status = 'void'
WHERE id IN (
  SELECT id FROM ranked WHERE rn > 1
);

-- 5. Add unique partial index to prevent future duplicate instances
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_instance_per_form_due
  ON inspection_instances (form_template_id, due_at)
  WHERE status IN ('pending', 'in_progress')
    AND form_template_id IS NOT NULL;
