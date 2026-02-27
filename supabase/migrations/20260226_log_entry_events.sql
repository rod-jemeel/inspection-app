-- Migration: Append-only audit trail for /logs log_entries mutations

CREATE TABLE IF NOT EXISTS log_entry_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  log_entry_id UUID NULL REFERENCES log_entries(id) ON DELETE SET NULL,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  log_type TEXT NOT NULL,
  log_key TEXT NOT NULL DEFAULT ''::text,
  log_date DATE NOT NULL,
  event_type TEXT NOT NULL CHECK (
    event_type IN ('created', 'updated', 'submitted_complete', 'reverted_draft', 'deleted')
  ),
  actor_profile_id UUID NULL REFERENCES profiles(id) ON DELETE SET NULL,
  event_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_log_entry_events_log_entry_id_event_at
  ON log_entry_events(log_entry_id, event_at DESC);

CREATE INDEX IF NOT EXISTS idx_log_entry_events_location_type_date
  ON log_entry_events(location_id, log_type, log_date DESC);

CREATE INDEX IF NOT EXISTS idx_log_entry_events_identity_event_at
  ON log_entry_events(location_id, log_type, log_key, log_date, event_at DESC);

CREATE OR REPLACE FUNCTION prevent_log_entry_events_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'log_entry_events is append-only';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_log_entry_events_mutation ON log_entry_events;
CREATE TRIGGER trg_prevent_log_entry_events_mutation
  BEFORE UPDATE OR DELETE ON log_entry_events
  FOR EACH ROW EXECUTE FUNCTION prevent_log_entry_events_mutation();

ALTER TABLE log_entry_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view log entry events for their locations" ON log_entry_events;
CREATE POLICY "Users can view log entry events for their locations" ON log_entry_events
  FOR SELECT USING (
    location_id IN (
      SELECT location_id
      FROM profile_locations
      WHERE profile_id = auth.uid()::uuid
    )
  );

DROP POLICY IF EXISTS "Users can insert log entry events for their locations" ON log_entry_events;
CREATE POLICY "Users can insert log entry events for their locations" ON log_entry_events
  FOR INSERT WITH CHECK (
    location_id IN (
      SELECT location_id
      FROM profile_locations
      WHERE profile_id = auth.uid()::uuid
    )
  );
