-- Migration: 001_initial_schema
-- Complete database schema for inspection PWA app

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- TABLES (in FK dependency order)
-- ============================================================================

-- 1. locations
CREATE TABLE locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'America/New_York',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. profiles
CREATE TABLE profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  role TEXT NOT NULL DEFAULT 'inspector'
    CHECK (role IN ('owner', 'admin', 'nurse', 'inspector')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);

-- 3. profile_locations (junction table)
CREATE TABLE profile_locations (
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  PRIMARY KEY (profile_id, location_id)
);

-- 4. inspection_templates
CREATE TABLE inspection_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  task TEXT NOT NULL,
  description TEXT,
  frequency TEXT NOT NULL
    CHECK (frequency IN ('weekly', 'monthly', 'yearly', 'every_3_years')),
  default_assignee_profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  default_due_rule JSONB,
  active BOOLEAN NOT NULL DEFAULT true,
  created_by TEXT NOT NULL REFERENCES "user"(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. inspection_instances
CREATE TABLE inspection_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES inspection_templates(id) ON DELETE RESTRICT,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  due_at TIMESTAMPTZ NOT NULL,
  assigned_to_profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  assigned_to_email TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'in_progress', 'failed', 'passed', 'void')),
  remarks TEXT,
  inspected_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  passed_at TIMESTAMPTZ,
  created_by TEXT NOT NULL REFERENCES "user"(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. inspection_signatures
CREATE TABLE inspection_signatures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_instance_id UUID NOT NULL REFERENCES inspection_instances(id) ON DELETE CASCADE,
  signed_by_profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  signed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  signature_image_path TEXT NOT NULL,
  signature_points JSONB,
  device_meta JSONB
);

-- 7. inspection_events (immutable audit log)
CREATE TABLE inspection_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_instance_id UUID NOT NULL REFERENCES inspection_instances(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL
    CHECK (event_type IN (
      'created', 'assigned', 'started', 'failed', 'passed',
      'signed', 'comment', 'reminder_sent', 'escalated'
    )),
  event_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actor_profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  payload JSONB
);

-- 8. invite_codes
CREATE TABLE invite_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  max_uses INT NOT NULL DEFAULT 1,
  uses INT NOT NULL DEFAULT 0,
  role_grant TEXT NOT NULL DEFAULT 'inspector'
    CHECK (role_grant IN ('owner', 'admin', 'nurse', 'inspector')),
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  assigned_email TEXT,
  created_by TEXT NOT NULL REFERENCES "user"(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  consumed_at TIMESTAMPTZ
);

-- 9. notification_outbox
CREATE TABLE notification_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('reminder', 'overdue', 'escalation')),
  to_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'sent', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  error TEXT
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Composite index for the most common query: instances by location + status + due date
CREATE INDEX idx_instances_location_status_due
  ON inspection_instances(location_id, status, due_at);

-- Partial index: only pending/in_progress instances (hot data)
CREATE INDEX idx_instances_pending
  ON inspection_instances(location_id, due_at)
  WHERE status IN ('pending', 'in_progress');

-- Partial index: only queued notifications (cron job query)
CREATE INDEX idx_outbox_queued
  ON notification_outbox(created_at)
  WHERE status = 'queued';

-- Covering index for template list (avoids heap fetch)
CREATE INDEX idx_templates_location_active
  ON inspection_templates(location_id)
  INCLUDE (task, frequency, default_assignee_profile_id)
  WHERE active = true;

-- FK indexes (Postgres does NOT auto-index foreign keys)
CREATE INDEX idx_signatures_instance ON inspection_signatures(inspection_instance_id);
CREATE INDEX idx_events_instance ON inspection_events(inspection_instance_id);
CREATE INDEX idx_instances_template ON inspection_instances(template_id);
CREATE INDEX idx_instances_assigned ON inspection_instances(assigned_to_profile_id);
CREATE INDEX idx_templates_location ON inspection_templates(location_id);
CREATE INDEX idx_profile_locations_location ON profile_locations(location_id);
CREATE INDEX idx_profile_locations_profile ON profile_locations(profile_id);
CREATE INDEX idx_invite_codes_location ON invite_codes(location_id);

-- Additional useful indexes
CREATE INDEX idx_profiles_user_id ON profiles(user_id);
CREATE INDEX idx_events_instance_type ON inspection_events(inspection_instance_id, event_type);

-- ============================================================================
-- SECURITY DEFINER FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION has_location_access(loc_id UUID)
RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profile_locations pl
    JOIN public.profiles p ON p.id = pl.profile_id
    WHERE pl.location_id = loc_id
      AND p.user_id = (SELECT auth.uid())
  );
$$;

-- ============================================================================
-- IMMUTABILITY TRIGGER
-- ============================================================================

CREATE OR REPLACE FUNCTION prevent_event_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'inspection_events is append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER no_event_update
  BEFORE UPDATE OR DELETE ON inspection_events
  FOR EACH ROW EXECUTE FUNCTION prevent_event_mutation();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE profile_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspection_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspection_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspection_signatures ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspection_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE invite_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_outbox ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

-- locations: users can read locations they have access to
CREATE POLICY locations_select ON locations
  FOR SELECT
  USING (has_location_access(id));

-- locations: admins/owners can insert/update (via server logic typically)
-- For MVP, we'll allow authenticated users to manage locations they have access to
CREATE POLICY locations_insert ON locations
  FOR INSERT
  WITH CHECK (true); -- Server will handle via service key typically

CREATE POLICY locations_update ON locations
  FOR UPDATE
  USING (has_location_access(id))
  WITH CHECK (has_location_access(id));

-- profiles: users can read their own profile
CREATE POLICY profiles_select ON profiles
  FOR SELECT
  USING (user_id = (SELECT auth.uid()));

-- profiles: users can update their own profile
CREATE POLICY profiles_update ON profiles
  FOR UPDATE
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

-- profiles: insert via server/signup logic
CREATE POLICY profiles_insert ON profiles
  FOR INSERT
  WITH CHECK (user_id = (SELECT auth.uid()));

-- profile_locations: users can read their own location assignments
CREATE POLICY profile_locations_select ON profile_locations
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = profile_id
        AND p.user_id = (SELECT auth.uid())
    )
  );

-- profile_locations: insert/delete via server logic (admin operations)
CREATE POLICY profile_locations_insert ON profile_locations
  FOR INSERT
  WITH CHECK (true); -- Server-controlled via service key

CREATE POLICY profile_locations_delete ON profile_locations
  FOR DELETE
  USING (true); -- Server-controlled via service key

-- inspection_templates: users can read templates for their locations
CREATE POLICY templates_select ON inspection_templates
  FOR SELECT
  USING (has_location_access(location_id));

-- inspection_templates: users can insert/update templates for their locations
CREATE POLICY templates_insert ON inspection_templates
  FOR INSERT
  WITH CHECK (
    has_location_access(location_id)
    AND created_by = (SELECT auth.uid())
  );

CREATE POLICY templates_update ON inspection_templates
  FOR UPDATE
  USING (has_location_access(location_id))
  WITH CHECK (has_location_access(location_id));

-- inspection_instances: users can read instances for their locations
CREATE POLICY instances_select ON inspection_instances
  FOR SELECT
  USING (has_location_access(location_id));

-- inspection_instances: users can insert instances for their locations
CREATE POLICY instances_insert ON inspection_instances
  FOR INSERT
  WITH CHECK (
    has_location_access(location_id)
    AND created_by = (SELECT auth.uid())
  );

-- inspection_instances: users can update instances for their locations
CREATE POLICY instances_update ON inspection_instances
  FOR UPDATE
  USING (has_location_access(location_id))
  WITH CHECK (has_location_access(location_id));

-- inspection_signatures: users can read signatures for instances in their locations
CREATE POLICY signatures_select ON inspection_signatures
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM inspection_instances ii
      WHERE ii.id = inspection_instance_id
        AND has_location_access(ii.location_id)
    )
  );

-- inspection_signatures: users can insert signatures for instances in their locations
CREATE POLICY signatures_insert ON inspection_signatures
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM inspection_instances ii
      WHERE ii.id = inspection_instance_id
        AND has_location_access(ii.location_id)
    )
    AND EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = signed_by_profile_id
        AND p.user_id = (SELECT auth.uid())
    )
  );

-- inspection_events: users can read events for instances in their locations
CREATE POLICY events_select ON inspection_events
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM inspection_instances ii
      WHERE ii.id = inspection_instance_id
        AND has_location_access(ii.location_id)
    )
  );

-- inspection_events: users can insert events for instances in their locations
CREATE POLICY events_insert ON inspection_events
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM inspection_instances ii
      WHERE ii.id = inspection_instance_id
        AND has_location_access(ii.location_id)
    )
  );

-- invite_codes: users can read invite codes for their locations
CREATE POLICY invite_codes_select ON invite_codes
  FOR SELECT
  USING (has_location_access(location_id));

-- invite_codes: users can insert invite codes for their locations
CREATE POLICY invite_codes_insert ON invite_codes
  FOR INSERT
  WITH CHECK (
    has_location_access(location_id)
    AND created_by = (SELECT auth.uid())
  );

-- invite_codes: users can update invite codes for their locations
CREATE POLICY invite_codes_update ON invite_codes
  FOR UPDATE
  USING (has_location_access(location_id))
  WITH CHECK (has_location_access(location_id));

-- notification_outbox: NO user access (server-only via service key)
-- No policies needed - RLS blocks all user access by default
