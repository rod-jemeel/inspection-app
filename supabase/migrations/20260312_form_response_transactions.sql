-- Migration: 20260312_form_response_transactions
-- Make form response submit/update writes transactional.

CREATE OR REPLACE FUNCTION submit_form_response_with_history(
  p_form_template_id UUID,
  p_location_id UUID,
  p_inspection_instance_id TEXT,
  p_submitted_by_profile_id UUID,
  p_submitted_at TIMESTAMPTZ,
  p_status TEXT,
  p_overall_pass BOOLEAN,
  p_remarks TEXT,
  p_corrective_action TEXT,
  p_completion_signature TEXT,
  p_completion_selfie TEXT,
  p_template_snapshot JSONB,
  p_field_responses JSONB
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_response_id UUID;
BEGIN
  INSERT INTO form_responses (
    form_template_id,
    location_id,
    inspection_instance_id,
    submitted_by_profile_id,
    submitted_at,
    original_submitted_at,
    status,
    overall_pass,
    remarks,
    corrective_action,
    completion_signature,
    completion_selfie,
    template_snapshot,
    current_revision_number
  )
  VALUES (
    p_form_template_id,
    p_location_id,
    p_inspection_instance_id,
    p_submitted_by_profile_id,
    p_submitted_at,
    p_submitted_at,
    p_status,
    p_overall_pass,
    p_remarks,
    p_corrective_action,
    p_completion_signature,
    p_completion_selfie,
    p_template_snapshot,
    1
  )
  RETURNING id INTO v_response_id;

  INSERT INTO form_field_responses (
    form_response_id,
    form_field_id,
    value_text,
    value_number,
    value_boolean,
    value_date,
    value_datetime,
    value_json,
    attachment_url,
    pass
  )
  SELECT
    v_response_id,
    field.form_field_id,
    field.value_text,
    field.value_number,
    field.value_boolean,
    field.value_date,
    field.value_datetime,
    field.value_json,
    field.attachment_url,
    field.pass
  FROM jsonb_to_recordset(COALESCE(p_field_responses, '[]'::jsonb)) AS field(
    form_field_id UUID,
    value_text TEXT,
    value_number NUMERIC,
    value_boolean BOOLEAN,
    value_date DATE,
    value_datetime TIMESTAMPTZ,
    value_json JSONB,
    attachment_url TEXT,
    pass BOOLEAN
  );

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
  VALUES (
    v_response_id,
    1,
    'submitted',
    p_submitted_at,
    p_submitted_by_profile_id,
    p_status,
    p_overall_pass,
    p_remarks,
    p_corrective_action,
    p_completion_signature,
    p_completion_selfie,
    p_template_snapshot,
    COALESCE(p_field_responses, '[]'::jsonb)
  );

  RETURN v_response_id;
END;
$$;

CREATE OR REPLACE FUNCTION update_form_response_with_history(
  p_response_id UUID,
  p_location_id UUID,
  p_editor_profile_id UUID,
  p_edited_at TIMESTAMPTZ,
  p_status TEXT,
  p_overall_pass BOOLEAN,
  p_remarks TEXT,
  p_corrective_action TEXT,
  p_completion_signature TEXT,
  p_completion_selfie TEXT,
  p_template_snapshot JSONB,
  p_field_responses JSONB
)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_current_revision INTEGER;
  v_next_revision INTEGER;
BEGIN
  SELECT current_revision_number
  INTO v_current_revision
  FROM form_responses
  WHERE id = p_response_id
    AND location_id = p_location_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Form response not found';
  END IF;

  v_next_revision := COALESCE(v_current_revision, 1) + 1;

  UPDATE form_responses
  SET
    status = p_status,
    remarks = p_remarks,
    corrective_action = p_corrective_action,
    completion_signature = p_completion_signature,
    completion_selfie = p_completion_selfie,
    overall_pass = p_overall_pass,
    current_revision_number = v_next_revision,
    last_edited_at = p_edited_at,
    last_edited_by_profile_id = p_editor_profile_id,
    template_snapshot = p_template_snapshot
  WHERE id = p_response_id
    AND location_id = p_location_id;

  INSERT INTO form_field_responses (
    form_response_id,
    form_field_id,
    value_text,
    value_number,
    value_boolean,
    value_date,
    value_datetime,
    value_json,
    attachment_url,
    pass
  )
  SELECT
    p_response_id,
    field.form_field_id,
    field.value_text,
    field.value_number,
    field.value_boolean,
    field.value_date,
    field.value_datetime,
    field.value_json,
    field.attachment_url,
    field.pass
  FROM jsonb_to_recordset(COALESCE(p_field_responses, '[]'::jsonb)) AS field(
    form_field_id UUID,
    value_text TEXT,
    value_number NUMERIC,
    value_boolean BOOLEAN,
    value_date DATE,
    value_datetime TIMESTAMPTZ,
    value_json JSONB,
    attachment_url TEXT,
    pass BOOLEAN
  )
  ON CONFLICT (form_response_id, form_field_id)
  DO UPDATE SET
    value_text = EXCLUDED.value_text,
    value_number = EXCLUDED.value_number,
    value_boolean = EXCLUDED.value_boolean,
    value_date = EXCLUDED.value_date,
    value_datetime = EXCLUDED.value_datetime,
    value_json = EXCLUDED.value_json,
    attachment_url = EXCLUDED.attachment_url,
    pass = EXCLUDED.pass,
    updated_at = NOW();

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
  VALUES (
    p_response_id,
    v_next_revision,
    'corrected',
    p_edited_at,
    p_editor_profile_id,
    p_status,
    p_overall_pass,
    p_remarks,
    p_corrective_action,
    p_completion_signature,
    p_completion_selfie,
    p_template_snapshot,
    COALESCE(p_field_responses, '[]'::jsonb)
  );

  RETURN v_next_revision;
END;
$$;
