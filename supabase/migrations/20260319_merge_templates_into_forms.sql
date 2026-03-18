-- Migration: Merge inspection templates into form templates
-- Forms now own scheduling (default_due_rule, scheduling_active).
-- inspection_instances gains form_template_id; template_id becomes nullable.

-- 1. Extend form_templates with scheduling fields
ALTER TABLE form_templates
  ADD COLUMN IF NOT EXISTS default_due_rule JSONB,
  ADD COLUMN IF NOT EXISTS scheduling_active BOOLEAN NOT NULL DEFAULT false;

-- 2. Make inspection_instances.template_id nullable (new instances won't have one)
ALTER TABLE inspection_instances
  ALTER COLUMN template_id DROP NOT NULL;

-- 3. Add form_template_id to inspection_instances
ALTER TABLE inspection_instances
  ADD COLUMN IF NOT EXISTS form_template_id UUID REFERENCES form_templates(id) ON DELETE RESTRICT;

-- 4. Back-fill form_template_id on existing instances via linked inspection_templates
UPDATE inspection_instances ii
SET form_template_id = it.form_template_id
FROM inspection_templates it
WHERE ii.template_id = it.id
  AND it.form_template_id IS NOT NULL;

-- 5. Back-fill form_templates.default_due_rule and scheduling_active from linked inspection_templates
UPDATE form_templates ft
SET
  default_due_rule = it.default_due_rule,
  scheduling_active = it.active
FROM inspection_templates it
WHERE it.form_template_id = ft.id;

-- 6. Index for common lookups
CREATE INDEX IF NOT EXISTS idx_inspection_instances_form_template
  ON inspection_instances(form_template_id) WHERE form_template_id IS NOT NULL;

-- 7. Update the inspection_instances_detailed view to include form_template data
CREATE OR REPLACE VIEW inspection_instances_detailed AS
SELECT
  i.id,
  i.template_id,
  i.form_template_id,
  i.location_id,
  i.due_at,
  i.assigned_to_profile_id,
  i.assigned_to_email,
  i.status,
  i.remarks,
  i.inspected_at,
  i.failed_at,
  i.passed_at,
  i.created_by,
  i.created_at,
  -- Prefer form_template fields; fall back to legacy inspection_template fields
  COALESCE(ft.name, t.task)              AS template_task,
  COALESCE(ft.description, t.description) AS template_description,
  COALESCE(ft.frequency, t.frequency)   AS template_frequency,
  ft.binder_id                           AS form_binder_id,
  -- Computed fields
  CASE
    WHEN i.status IN ('pending', 'in_progress') AND i.due_at < NOW()
    THEN TRUE
    ELSE FALSE
  END AS is_overdue,
  -- Signature info
  COALESCE(sig.signature_count, 0) AS signature_count,
  sig.latest_signature_at,
  -- Event count
  COALESCE(evt.event_count, 0) AS event_count
FROM inspection_instances i
LEFT JOIN form_templates ft ON i.form_template_id = ft.id
LEFT JOIN inspection_templates t ON i.template_id = t.id
LEFT JOIN LATERAL (
  SELECT
    COUNT(*) AS signature_count,
    MAX(signed_at) AS latest_signature_at
  FROM inspection_signatures
  WHERE inspection_instance_id = i.id
) sig ON TRUE
LEFT JOIN LATERAL (
  SELECT COUNT(*) AS event_count
  FROM inspection_events
  WHERE inspection_instance_id = i.id
) evt ON TRUE;

GRANT SELECT ON inspection_instances_detailed TO authenticated;
