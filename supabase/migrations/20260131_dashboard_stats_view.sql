-- Dashboard stats view for efficient single-query aggregation
-- This replaces 13+ individual queries with one optimized query

CREATE OR REPLACE FUNCTION get_dashboard_stats(
  p_location_id UUID,
  p_inspector_email TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSON;
  v_now TIMESTAMP WITH TIME ZONE := NOW();
  v_week_from_now TIMESTAMP WITH TIME ZONE := NOW() + INTERVAL '7 days';
  v_thirty_days_ago TIMESTAMP WITH TIME ZONE := NOW() - INTERVAL '30 days';
  v_four_weeks_ago TIMESTAMP WITH TIME ZONE := NOW() - INTERVAL '28 days';
  v_six_months_ago TIMESTAMP WITH TIME ZONE := NOW() - INTERVAL '6 months';
  v_three_months_ago TIMESTAMP WITH TIME ZONE := NOW() - INTERVAL '3 months';
  v_three_months_ahead TIMESTAMP WITH TIME ZONE := NOW() + INTERVAL '3 months';
BEGIN
  SELECT json_build_object(
    'stats', (
      SELECT json_build_object(
        'pending', COUNT(*) FILTER (WHERE status IN ('pending', 'in_progress')),
        'overdue', COUNT(*) FILTER (WHERE status IN ('pending', 'in_progress') AND due_at < v_now),
        'passed', COUNT(*) FILTER (WHERE status = 'passed'),
        'failed', COUNT(*) FILTER (WHERE status = 'failed'),
        'dueThisWeek', COUNT(*) FILTER (WHERE status IN ('pending', 'in_progress') AND due_at >= v_now AND due_at <= v_week_from_now),
        'completedLast30Days', COUNT(*) FILTER (WHERE status = 'passed' AND passed_at >= v_thirty_days_ago),
        'totalDueLast30Days', COUNT(*) FILTER (WHERE status != 'void' AND due_at >= v_thirty_days_ago AND due_at <= v_now)
      )
      FROM inspection_instances
      WHERE location_id = p_location_id
        AND (p_inspector_email IS NULL OR assigned_to_email = p_inspector_email)
    ),
    'statusBreakdown', (
      SELECT json_build_object(
        'passed', COUNT(*) FILTER (WHERE status = 'passed'),
        'failed', COUNT(*) FILTER (WHERE status = 'failed'),
        'pending', COUNT(*) FILTER (WHERE status = 'pending'),
        'in_progress', COUNT(*) FILTER (WHERE status = 'in_progress')
      )
      FROM inspection_instances
      WHERE location_id = p_location_id
        AND status != 'void'
        AND (p_inspector_email IS NULL OR assigned_to_email = p_inspector_email)
    )
  ) INTO result;

  RETURN result;
END;
$$;

-- Function to get events for a specific date (for calendar modal)
CREATE OR REPLACE FUNCTION get_events_for_date(
  p_location_id UUID,
  p_date DATE,
  p_inspector_email TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN (
    SELECT COALESCE(json_agg(
      json_build_object(
        'id', i.id,
        'task', t.task,
        'dueAt', i.due_at,
        'status', i.status,
        'assignee', i.assigned_to_email,
        'frequency', t.frequency,
        'passedAt', i.passed_at,
        'failedAt', i.failed_at
      ) ORDER BY i.due_at
    ), '[]'::json)
    FROM inspection_instances i
    JOIN inspection_templates t ON i.template_id = t.id
    WHERE i.location_id = p_location_id
      AND DATE(i.due_at) = p_date
      AND i.status != 'void'
      AND (p_inspector_email IS NULL OR i.assigned_to_email = p_inspector_email)
  );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_dashboard_stats(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_events_for_date(UUID, DATE, TEXT) TO authenticated;
