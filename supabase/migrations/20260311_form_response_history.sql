-- Migration: 20260311_form_response_history
-- Add immutable response history, template snapshots, and controlled correction metadata

-- ============================================================================
-- FORM FIELD TYPES: allow section headers used by the binder form builder
-- ============================================================================

ALTER TABLE form_fields
  DROP CONSTRAINT IF EXISTS form_fields_field_type_check;

ALTER TABLE form_fields
  ADD CONSTRAINT form_fields_field_type_check
  CHECK (field_type IN (
    'text', 'textarea', 'number', 'date', 'datetime',
    'boolean', 'select', 'multi_select', 'signature',
    'photo', 'temperature', 'pressure', 'section_header'
  ));

-- ============================================================================
-- FORM RESPONSES: snapshot + correction metadata
-- ============================================================================

ALTER TABLE form_responses
  ADD COLUMN IF NOT EXISTS template_snapshot JSONB,
  ADD COLUMN IF NOT EXISTS original_submitted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_edited_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_edited_by_profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS current_revision_number INTEGER NOT NULL DEFAULT 1;

CREATE INDEX IF NOT EXISTS idx_form_responses_last_edited_by
  ON form_responses(last_edited_by_profile_id)
  WHERE last_edited_by_profile_id IS NOT NULL;

-- ============================================================================
-- TABLE: form_response_revisions
-- ============================================================================

CREATE TABLE IF NOT EXISTS form_response_revisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_response_id UUID NOT NULL REFERENCES form_responses(id) ON DELETE CASCADE,
  revision_number INTEGER NOT NULL,
  change_type TEXT NOT NULL CHECK (change_type IN ('submitted', 'corrected')),
  edited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  edited_by_profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  status TEXT NOT NULL CHECK (status IN ('draft', 'complete', 'flagged')),
  overall_pass BOOLEAN,
  remarks TEXT,
  corrective_action TEXT,
  completion_signature TEXT,
  completion_selfie TEXT,
  template_snapshot JSONB NOT NULL,
  field_responses_snapshot JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(form_response_id, revision_number)
);

CREATE INDEX IF NOT EXISTS idx_form_response_revisions_response
  ON form_response_revisions(form_response_id, revision_number DESC);

CREATE INDEX IF NOT EXISTS idx_form_response_revisions_editor
  ON form_response_revisions(edited_by_profile_id)
  WHERE edited_by_profile_id IS NOT NULL;

-- ============================================================================
-- RLS: inherit access from the parent response
-- ============================================================================

ALTER TABLE form_response_revisions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS form_response_revisions_select ON form_response_revisions;
CREATE POLICY form_response_revisions_select ON form_response_revisions
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM form_responses fr
      WHERE fr.id = form_response_id
        AND has_location_access(fr.location_id)
    )
  );

DROP POLICY IF EXISTS form_response_revisions_insert ON form_response_revisions;
CREATE POLICY form_response_revisions_insert ON form_response_revisions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1
      FROM form_responses fr
      WHERE fr.id = form_response_id
        AND has_location_access(fr.location_id)
    )
  );

-- ============================================================================
-- APPEND-ONLY PROTECTION
-- ============================================================================

CREATE OR REPLACE FUNCTION prevent_form_response_revision_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'form_response_revisions is append-only';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS prevent_form_response_revision_updates ON form_response_revisions;
CREATE TRIGGER prevent_form_response_revision_updates
  BEFORE UPDATE OR DELETE ON form_response_revisions
  FOR EACH ROW EXECUTE FUNCTION prevent_form_response_revision_mutation();

-- ============================================================================
-- BACKFILL: preserve the current template structure on every existing response
-- ============================================================================

UPDATE form_responses fr
SET
  original_submitted_at = COALESCE(fr.original_submitted_at, fr.submitted_at),
  current_revision_number = COALESCE(fr.current_revision_number, 1),
  template_snapshot = snapshot_data.template_snapshot
FROM (
  SELECT
    existing.id AS response_id,
    jsonb_build_object(
      'id', ft.id,
      'binder_id', ft.binder_id,
      'location_id', ft.location_id,
      'name', ft.name,
      'description', ft.description,
      'instructions', ft.instructions,
      'frequency', ft.frequency,
      'regulatory_reference', ft.regulatory_reference,
      'retention_years', ft.retention_years,
      'fields', COALESCE(field_snapshot.fields, '[]'::jsonb)
    ) AS template_snapshot
  FROM form_responses existing
  INNER JOIN form_templates ft ON ft.id = existing.form_template_id
  LEFT JOIN LATERAL (
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', ff.id,
        'form_template_id', ff.form_template_id,
        'label', ff.label,
        'field_type', ff.field_type,
        'required', ff.required,
        'options', ff.options,
        'validation_rules', ff.validation_rules,
        'help_text', ff.help_text,
        'placeholder', ff.placeholder,
        'default_value', ff.default_value,
        'sort_order', ff.sort_order,
        'active', ff.active
      )
      ORDER BY ff.sort_order ASC, ff.created_at ASC
    ) AS fields
    FROM form_fields ff
    WHERE ff.form_template_id = ft.id
  ) field_snapshot ON TRUE
) AS snapshot_data
WHERE fr.id = snapshot_data.response_id
  AND fr.template_snapshot IS NULL;

ALTER TABLE form_responses
  ALTER COLUMN original_submitted_at SET NOT NULL,
  ALTER COLUMN template_snapshot SET NOT NULL;

-- ============================================================================
-- BACKFILL: seed revision 1 from the current stored response state
-- ============================================================================

INSERT INTO form_response_revisions (
  form_response_id,
  revision_number,
  change_type,
  edited_at,
  edited_by_profile_id,
  status,
  overall_pass,
  remarks,
  corrective_action,
  completion_signature,
  completion_selfie,
  template_snapshot,
  field_responses_snapshot
)
SELECT
  fr.id,
  1,
  'submitted',
  COALESCE(fr.original_submitted_at, fr.submitted_at),
  fr.submitted_by_profile_id,
  fr.status,
  fr.overall_pass,
  fr.remarks,
  fr.corrective_action,
  fr.completion_signature,
  fr.completion_selfie,
  fr.template_snapshot,
  COALESCE(field_snapshot.field_responses_snapshot, '[]'::jsonb)
FROM form_responses fr
LEFT JOIN LATERAL (
  SELECT jsonb_agg(
    jsonb_build_object(
      'form_field_id', ffr.form_field_id,
      'value_text', ffr.value_text,
      'value_number', ffr.value_number,
      'value_boolean', ffr.value_boolean,
      'value_date', ffr.value_date,
      'value_datetime', ffr.value_datetime,
      'value_json', ffr.value_json,
      'attachment_url', ffr.attachment_url,
      'pass', ffr.pass
    )
    ORDER BY ffr.created_at ASC, ffr.id ASC
  ) AS field_responses_snapshot
  FROM form_field_responses ffr
  WHERE ffr.form_response_id = fr.id
) field_snapshot ON TRUE
WHERE NOT EXISTS (
  SELECT 1
  FROM form_response_revisions rev
  WHERE rev.form_response_id = fr.id
    AND rev.revision_number = 1
);
