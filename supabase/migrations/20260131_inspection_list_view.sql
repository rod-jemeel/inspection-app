-- Optimized VIEW for inspection list with pre-joined template data and computed fields
-- This eliminates the need for separate API calls when viewing inspection details

CREATE OR REPLACE VIEW inspection_instances_detailed AS
SELECT
  i.id,
  i.template_id,
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
  -- Template fields (pre-joined)
  t.task AS template_task,
  t.description AS template_description,
  t.frequency AS template_frequency,
  -- Computed fields
  CASE
    WHEN i.status IN ('pending', 'in_progress') AND i.due_at < NOW()
    THEN TRUE
    ELSE FALSE
  END AS is_overdue,
  -- Signature info (subquery for count and latest)
  COALESCE(sig.signature_count, 0) AS signature_count,
  sig.latest_signature_at,
  -- Event count
  COALESCE(evt.event_count, 0) AS event_count
FROM inspection_instances i
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

-- Grant access
GRANT SELECT ON inspection_instances_detailed TO authenticated;

-- Create index for common queries if not exists
CREATE INDEX IF NOT EXISTS idx_inspection_instances_location_status
  ON inspection_instances(location_id, status);

CREATE INDEX IF NOT EXISTS idx_inspection_instances_due_at
  ON inspection_instances(due_at);

CREATE INDEX IF NOT EXISTS idx_inspection_signatures_instance
  ON inspection_signatures(inspection_instance_id);

CREATE INDEX IF NOT EXISTS idx_inspection_events_instance
  ON inspection_events(inspection_instance_id);

-- Function to get instance with full details (for modal)
-- Note: instance_id is TEXT type in this schema
CREATE OR REPLACE FUNCTION get_instance_details(
  p_location_id UUID,
  p_instance_id TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'instance', (
      SELECT row_to_json(d.*)
      FROM inspection_instances_detailed d
      WHERE d.id = p_instance_id AND d.location_id = p_location_id
    ),
    'events', (
      SELECT COALESCE(json_agg(
        json_build_object(
          'id', e.id,
          'event_type', e.event_type,
          'event_at', e.event_at,
          'payload', e.payload
        ) ORDER BY e.event_at DESC
      ), '[]'::json)
      FROM inspection_events e
      WHERE e.inspection_instance_id = p_instance_id
      LIMIT 10
    ),
    'signatures', (
      SELECT COALESCE(json_agg(
        json_build_object(
          'id', s.id,
          'signed_at', s.signed_at,
          'signed_by_profile_id', s.signed_by_profile_id,
          'signature_image_path', s.signature_image_path
        ) ORDER BY s.signed_at DESC
      ), '[]'::json)
      FROM inspection_signatures s
      WHERE s.inspection_instance_id = p_instance_id
    )
  ) INTO result;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION get_instance_details(UUID, TEXT) TO authenticated;
