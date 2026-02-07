-- Migration: 20260207_binder_system
-- Binder/Form system + access control enhancements
-- Dependencies: 001_initial_schema.sql

-- ============================================================================
-- UTILITY: updated_at trigger function (reusable)
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- ACCESS CONTROL: Expand roles + add permission flags
-- ============================================================================

-- Expand role check constraint to include new roles
ALTER TABLE profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check,
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('owner', 'admin', 'nurse', 'inspector'));

-- Add permission flag columns
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS can_manage_binders BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS can_manage_forms BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS can_view_all_responses BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS can_export_reports BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS can_configure_integrations BOOLEAN NOT NULL DEFAULT FALSE;

-- Set defaults for existing users based on role
UPDATE profiles SET
  can_manage_binders = (role IN ('owner', 'admin')),
  can_manage_forms = (role IN ('owner', 'admin')),
  can_view_all_responses = (role IN ('owner', 'admin')),
  can_export_reports = (role IN ('owner', 'admin')),
  can_configure_integrations = (role = 'owner');

-- ============================================================================
-- TABLE: binders
-- ============================================================================
CREATE TABLE binders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT,
  icon TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by_profile_id UUID REFERENCES profiles(id),
  UNIQUE(location_id, name)
);

CREATE INDEX idx_binders_location ON binders(location_id);
CREATE INDEX idx_binders_active ON binders(active) WHERE active = true;

-- ============================================================================
-- TABLE: form_templates
-- ============================================================================
CREATE TABLE form_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  binder_id UUID NOT NULL REFERENCES binders(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  instructions TEXT,
  frequency TEXT CHECK (frequency IN ('daily', 'weekly', 'monthly', 'quarterly', 'annual', 'yearly', 'every_3_years', 'as_needed')),
  default_assignee_profile_id UUID REFERENCES profiles(id),
  regulatory_reference TEXT,
  retention_years INTEGER,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by_profile_id UUID REFERENCES profiles(id),
  UNIQUE(binder_id, name)
);

CREATE INDEX idx_form_templates_binder ON form_templates(binder_id);
CREATE INDEX idx_form_templates_location ON form_templates(location_id);
CREATE INDEX idx_form_templates_frequency ON form_templates(frequency);
CREATE INDEX idx_form_templates_active ON form_templates(active) WHERE active = true;

-- ============================================================================
-- TABLE: form_fields
-- ============================================================================
CREATE TABLE form_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_template_id UUID NOT NULL REFERENCES form_templates(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  field_type TEXT NOT NULL CHECK (field_type IN (
    'text', 'textarea', 'number', 'date', 'datetime',
    'boolean', 'select', 'multi_select', 'signature',
    'photo', 'temperature', 'pressure'
  )),
  required BOOLEAN NOT NULL DEFAULT true,
  options JSONB,
  validation_rules JSONB,
  help_text TEXT,
  placeholder TEXT,
  default_value TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_form_fields_template ON form_fields(form_template_id);
CREATE INDEX idx_form_fields_sort ON form_fields(form_template_id, sort_order);

-- ============================================================================
-- TABLE: form_responses
-- ============================================================================
CREATE TABLE form_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_template_id UUID NOT NULL REFERENCES form_templates(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  inspection_instance_id TEXT REFERENCES inspection_instances(id) ON DELETE SET NULL,
  submitted_by_profile_id UUID NOT NULL REFERENCES profiles(id),
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'complete' CHECK (status IN ('draft', 'complete', 'flagged')),
  overall_pass BOOLEAN,
  remarks TEXT,
  corrective_action TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_form_responses_template ON form_responses(form_template_id);
CREATE INDEX idx_form_responses_location ON form_responses(location_id);
CREATE INDEX idx_form_responses_submitted_at ON form_responses(submitted_at DESC);
CREATE INDEX idx_form_responses_submitted_by ON form_responses(submitted_by_profile_id);
CREATE INDEX idx_form_responses_status ON form_responses(status);
CREATE INDEX idx_form_responses_instance ON form_responses(inspection_instance_id) WHERE inspection_instance_id IS NOT NULL;

-- ============================================================================
-- TABLE: form_field_responses
-- ============================================================================
CREATE TABLE form_field_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_response_id UUID NOT NULL REFERENCES form_responses(id) ON DELETE CASCADE,
  form_field_id UUID NOT NULL REFERENCES form_fields(id) ON DELETE CASCADE,
  value_text TEXT,
  value_number NUMERIC,
  value_boolean BOOLEAN,
  value_date DATE,
  value_datetime TIMESTAMPTZ,
  value_json JSONB,
  attachment_url TEXT,
  pass BOOLEAN,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(form_response_id, form_field_id)
);

CREATE INDEX idx_field_responses_response ON form_field_responses(form_response_id);
CREATE INDEX idx_field_responses_field ON form_field_responses(form_field_id);

-- ============================================================================
-- TABLE: binder_assignments (inspector-to-binder scoping)
-- ============================================================================
CREATE TABLE binder_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  binder_id UUID NOT NULL REFERENCES binders(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  assigned_by_profile_id UUID REFERENCES profiles(id),
  UNIQUE(binder_id, profile_id)
);

CREATE INDEX idx_binder_assignments_profile ON binder_assignments(profile_id);
CREATE INDEX idx_binder_assignments_binder ON binder_assignments(binder_id);

-- ============================================================================
-- TABLE: feature_flags (location-level feature toggles)
-- ============================================================================
CREATE TABLE feature_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  flag_name TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(location_id, flag_name)
);

CREATE INDEX idx_feature_flags_location ON feature_flags(location_id);

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

-- Binders
ALTER TABLE binders ENABLE ROW LEVEL SECURITY;

CREATE POLICY binders_select ON binders
  FOR SELECT USING (has_location_access(location_id));

CREATE POLICY binders_insert ON binders
  FOR INSERT WITH CHECK (has_location_access(location_id));

CREATE POLICY binders_update ON binders
  FOR UPDATE USING (has_location_access(location_id))
  WITH CHECK (has_location_access(location_id));

CREATE POLICY binders_delete ON binders
  FOR DELETE USING (has_location_access(location_id));

-- Form Templates
ALTER TABLE form_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY form_templates_select ON form_templates
  FOR SELECT USING (has_location_access(location_id));

CREATE POLICY form_templates_insert ON form_templates
  FOR INSERT WITH CHECK (has_location_access(location_id));

CREATE POLICY form_templates_update ON form_templates
  FOR UPDATE USING (has_location_access(location_id))
  WITH CHECK (has_location_access(location_id));

CREATE POLICY form_templates_delete ON form_templates
  FOR DELETE USING (has_location_access(location_id));

-- Form Fields (inherit via form_template)
ALTER TABLE form_fields ENABLE ROW LEVEL SECURITY;

CREATE POLICY form_fields_select ON form_fields
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM form_templates ft WHERE ft.id = form_template_id AND has_location_access(ft.location_id))
  );

CREATE POLICY form_fields_insert ON form_fields
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM form_templates ft WHERE ft.id = form_template_id AND has_location_access(ft.location_id))
  );

CREATE POLICY form_fields_update ON form_fields
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM form_templates ft WHERE ft.id = form_template_id AND has_location_access(ft.location_id))
  );

CREATE POLICY form_fields_delete ON form_fields
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM form_templates ft WHERE ft.id = form_template_id AND has_location_access(ft.location_id))
  );

-- Form Responses
ALTER TABLE form_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY form_responses_select ON form_responses
  FOR SELECT USING (has_location_access(location_id));

CREATE POLICY form_responses_insert ON form_responses
  FOR INSERT WITH CHECK (has_location_access(location_id));

CREATE POLICY form_responses_update ON form_responses
  FOR UPDATE USING (has_location_access(location_id))
  WITH CHECK (has_location_access(location_id));

-- Form Field Responses (inherit via form_response)
ALTER TABLE form_field_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY field_responses_select ON form_field_responses
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM form_responses fr WHERE fr.id = form_response_id AND has_location_access(fr.location_id))
  );

CREATE POLICY field_responses_insert ON form_field_responses
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM form_responses fr WHERE fr.id = form_response_id AND has_location_access(fr.location_id))
  );

CREATE POLICY field_responses_update ON form_field_responses
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM form_responses fr WHERE fr.id = form_response_id AND has_location_access(fr.location_id))
  );

-- Binder Assignments
ALTER TABLE binder_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY binder_assignments_select ON binder_assignments
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM binders b WHERE b.id = binder_id AND has_location_access(b.location_id))
  );

CREATE POLICY binder_assignments_insert ON binder_assignments
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM binders b WHERE b.id = binder_id AND has_location_access(b.location_id))
  );

CREATE POLICY binder_assignments_delete ON binder_assignments
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM binders b WHERE b.id = binder_id AND has_location_access(b.location_id))
  );

-- Feature Flags
ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY feature_flags_select ON feature_flags
  FOR SELECT USING (has_location_access(location_id));

-- ============================================================================
-- TRIGGERS: auto-update updated_at
-- ============================================================================

CREATE TRIGGER update_binders_updated_at
  BEFORE UPDATE ON binders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_form_templates_updated_at
  BEFORE UPDATE ON form_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_form_fields_updated_at
  BEFORE UPDATE ON form_fields
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_form_responses_updated_at
  BEFORE UPDATE ON form_responses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_field_responses_updated_at
  BEFORE UPDATE ON form_field_responses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_feature_flags_updated_at
  BEFORE UPDATE ON feature_flags
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
