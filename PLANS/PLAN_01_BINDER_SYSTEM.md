# PLAN_01: Binder System Implementation

## Overview

Transform the flat `inspection_templates` model into a hierarchical Binder/Form/Field system that matches Summit Digestive Health Center's physical documentation system.

## 1. New Data Model

### 1.1 Schema Design

```sql
-- ============================================================================
-- BINDERS: Top-level organizational units
-- ============================================================================
CREATE TABLE binders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,

  -- Binder metadata
  name TEXT NOT NULL,
  description TEXT,
  color TEXT, -- For UI categorization (e.g., "#3B82F6")
  icon TEXT, -- Lucide icon name
  sort_order INTEGER NOT NULL DEFAULT 0,

  -- Status
  active BOOLEAN NOT NULL DEFAULT true,

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by_profile_id UUID REFERENCES profiles(id),

  UNIQUE(location_id, name)
);

CREATE INDEX idx_binders_location ON binders(location_id);
CREATE INDEX idx_binders_active ON binders(active) WHERE active = true;

-- ============================================================================
-- FORM_TEMPLATES: Individual forms within a binder
-- ============================================================================
CREATE TABLE form_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  binder_id UUID NOT NULL REFERENCES binders(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,

  -- Form metadata
  name TEXT NOT NULL,
  description TEXT,
  instructions TEXT, -- Multi-line guidance for completing the form

  -- Scheduling
  frequency TEXT, -- 'daily', 'weekly', 'monthly', 'quarterly', 'annual', 'as_needed'
  default_assignee_profile_id UUID REFERENCES profiles(id),

  -- Compliance
  regulatory_reference TEXT, -- e.g., "CMS Tag A-0724", "WHO 5 Moments"
  retention_years INTEGER, -- How long to keep responses

  -- Display
  sort_order INTEGER NOT NULL DEFAULT 0,

  -- Status
  active BOOLEAN NOT NULL DEFAULT true,

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by_profile_id UUID REFERENCES profiles(id),

  UNIQUE(binder_id, name)
);

CREATE INDEX idx_form_templates_binder ON form_templates(binder_id);
CREATE INDEX idx_form_templates_location ON form_templates(location_id);
CREATE INDEX idx_form_templates_frequency ON form_templates(frequency);
CREATE INDEX idx_form_templates_active ON form_templates(active) WHERE active = true;

-- ============================================================================
-- FORM_FIELDS: Individual checklist items/questions within a form
-- ============================================================================
CREATE TABLE form_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_template_id UUID NOT NULL REFERENCES form_templates(id) ON DELETE CASCADE,

  -- Field definition
  label TEXT NOT NULL, -- e.g., "Water Flow Test"
  field_type TEXT NOT NULL, -- 'text', 'number', 'date', 'datetime', 'boolean', 'select', 'multi_select', 'signature', 'photo', 'temperature', 'pressure'

  -- Validation
  required BOOLEAN NOT NULL DEFAULT true,
  options JSONB, -- For select/multi_select: ["Option 1", "Option 2"]
  validation_rules JSONB, -- { "min": 0, "max": 100, "pattern": "regex" }

  -- Metadata
  help_text TEXT,
  placeholder TEXT,
  default_value TEXT,

  -- Display
  sort_order INTEGER NOT NULL DEFAULT 0,

  -- Status
  active BOOLEAN NOT NULL DEFAULT true,

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_form_fields_template ON form_fields(form_template_id);
CREATE INDEX idx_form_fields_sort ON form_fields(form_template_id, sort_order);

-- ============================================================================
-- FORM_RESPONSES: Completed form submissions
-- ============================================================================
CREATE TABLE form_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_template_id UUID NOT NULL REFERENCES form_templates(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,

  -- Assignment (can link to inspection_instance if migrating)
  inspection_instance_id UUID REFERENCES inspection_instances(id) ON DELETE SET NULL,

  -- Response metadata
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  submitted_by_profile_id UUID NOT NULL REFERENCES profiles(id),

  -- Overall status
  status TEXT NOT NULL DEFAULT 'complete', -- 'draft', 'complete', 'flagged'
  overall_pass BOOLEAN, -- Computed from field responses

  -- Notes
  remarks TEXT,
  corrective_action TEXT, -- If issues found

  -- Audit trail
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_form_responses_template ON form_responses(form_template_id);
CREATE INDEX idx_form_responses_location ON form_responses(location_id);
CREATE INDEX idx_form_responses_submitted_at ON form_responses(submitted_at DESC);
CREATE INDEX idx_form_responses_submitted_by ON form_responses(submitted_by_profile_id);
CREATE INDEX idx_form_responses_status ON form_responses(status);
CREATE INDEX idx_form_responses_instance ON form_responses(inspection_instance_id) WHERE inspection_instance_id IS NOT NULL;

-- ============================================================================
-- FORM_FIELD_RESPONSES: Individual field values within a response
-- ============================================================================
CREATE TABLE form_field_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_response_id UUID NOT NULL REFERENCES form_responses(id) ON DELETE CASCADE,
  form_field_id UUID NOT NULL REFERENCES form_fields(id) ON DELETE CASCADE,

  -- Response value (polymorphic)
  value_text TEXT,
  value_number NUMERIC,
  value_boolean BOOLEAN,
  value_date DATE,
  value_datetime TIMESTAMPTZ,
  value_json JSONB, -- For multi_select, signature data, etc.

  -- File attachments (photos, signatures)
  attachment_url TEXT, -- Supabase Storage path

  -- Pass/fail for this field
  pass BOOLEAN,

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(form_response_id, form_field_id)
);

CREATE INDEX idx_field_responses_response ON form_field_responses(form_response_id);
CREATE INDEX idx_field_responses_field ON form_field_responses(form_field_id);

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

-- Binders: org-scoped access
ALTER TABLE binders ENABLE ROW LEVEL SECURITY;

CREATE POLICY binders_org_isolation ON binders
  USING (
    location_id IN (
      SELECT id FROM locations WHERE org_id = current_setting('app.current_org_id')::uuid
    )
  );

CREATE POLICY binders_insert ON binders
  FOR INSERT WITH CHECK (
    location_id IN (
      SELECT id FROM locations WHERE org_id = current_setting('app.current_org_id')::uuid
    )
  );

-- Form Templates: org-scoped access
ALTER TABLE form_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY form_templates_org_isolation ON form_templates
  USING (
    location_id IN (
      SELECT id FROM locations WHERE org_id = current_setting('app.current_org_id')::uuid
    )
  );

CREATE POLICY form_templates_insert ON form_templates
  FOR INSERT WITH CHECK (
    location_id IN (
      SELECT id FROM locations WHERE org_id = current_setting('app.current_org_id')::uuid
    )
  );

-- Form Fields: inherit from template
ALTER TABLE form_fields ENABLE ROW LEVEL SECURITY;

CREATE POLICY form_fields_org_isolation ON form_fields
  USING (
    form_template_id IN (
      SELECT id FROM form_templates WHERE location_id IN (
        SELECT id FROM locations WHERE org_id = current_setting('app.current_org_id')::uuid
      )
    )
  );

CREATE POLICY form_fields_insert ON form_fields
  FOR INSERT WITH CHECK (
    form_template_id IN (
      SELECT id FROM form_templates WHERE location_id IN (
        SELECT id FROM locations WHERE org_id = current_setting('app.current_org_id')::uuid
      )
    )
  );

-- Form Responses: org-scoped access
ALTER TABLE form_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY form_responses_org_isolation ON form_responses
  USING (
    location_id IN (
      SELECT id FROM locations WHERE org_id = current_setting('app.current_org_id')::uuid
    )
  );

CREATE POLICY form_responses_insert ON form_responses
  FOR INSERT WITH CHECK (
    location_id IN (
      SELECT id FROM locations WHERE org_id = current_setting('app.current_org_id')::uuid
    )
  );

-- Form Field Responses: inherit from response
ALTER TABLE form_field_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY field_responses_org_isolation ON form_field_responses
  USING (
    form_response_id IN (
      SELECT id FROM form_responses WHERE location_id IN (
        SELECT id FROM locations WHERE org_id = current_setting('app.current_org_id')::uuid
      )
    )
  );

CREATE POLICY field_responses_insert ON form_field_responses
  FOR INSERT WITH CHECK (
    form_response_id IN (
      SELECT id FROM form_responses WHERE location_id IN (
        SELECT id FROM locations WHERE org_id = current_setting('app.current_org_id')::uuid
      )
    )
  );

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Updated_at triggers
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
```

### 1.2 Migration Strategy

```sql
-- ============================================================================
-- MIGRATION: inspection_templates → form_templates
-- ============================================================================

-- Step 1: Create default binder for existing templates
INSERT INTO binders (location_id, name, description, color, sort_order, active)
SELECT DISTINCT
  location_id,
  'Legacy Inspections',
  'Migrated from original inspection_templates table',
  '#6B7280', -- gray
  999, -- sort last
  true
FROM inspection_templates
ON CONFLICT (location_id, name) DO NOTHING;

-- Step 2: Migrate inspection_templates to form_templates
INSERT INTO form_templates (
  binder_id,
  location_id,
  name,
  description,
  frequency,
  default_assignee_profile_id,
  sort_order,
  active,
  created_at
)
SELECT
  b.id AS binder_id,
  it.location_id,
  it.task AS name,
  it.description,
  it.frequency,
  it.default_assignee_profile_id,
  it.sort_order,
  it.active,
  it.created_at
FROM inspection_templates it
JOIN binders b ON b.location_id = it.location_id AND b.name = 'Legacy Inspections';

-- Step 3: Create basic pass/fail field for legacy forms
INSERT INTO form_fields (form_template_id, label, field_type, required, sort_order)
SELECT
  ft.id AS form_template_id,
  'Pass/Fail',
  'boolean',
  true,
  0
FROM form_templates ft
JOIN binders b ON b.id = ft.binder_id
WHERE b.name = 'Legacy Inspections';

-- Step 4: Link existing inspection_instances to form_responses (optional)
-- This preserves historical data linkage but doesn't migrate actual responses
-- since the old model didn't store field-level data
```

## 2. Relationship to Existing Templates

### 2.1 Mapping

**Old Model:**
```
inspection_templates (flat list)
  ↓
inspection_instances (pass/fail + remarks)
```

**New Model:**
```
binders (organizational unit)
  ↓
form_templates (individual forms)
  ↓
form_fields (checklist items)
  ↓
form_responses (submissions)
  ↓
form_field_responses (field values)
```

### 2.2 Backward Compatibility

**Approach: Dual-track with feature flag**

1. **Keep both models temporarily**
   - `inspection_templates` table remains for existing scheduled tasks
   - New `form_templates` gradually replace them
   - Feature flag: `ENABLE_BINDER_SYSTEM=true`

2. **Unified interface**
   ```typescript
   // Service layer abstracts both models
   async function getInspectionsForLocation(locationId: string) {
     if (featureFlags.binderSystem) {
       return getFormTemplatesForLocation(locationId)
     }
     return getLegacyInspectionTemplates(locationId)
   }
   ```

3. **Migration path**
   - Phase 1: Deploy new tables, seed binders, migration script
   - Phase 2: Admin UI to review/categorize legacy templates into binders
   - Phase 3: Toggle feature flag per location
   - Phase 4: Deprecate `inspection_templates` after 6 months

## 3. Form Field Types

### 3.1 Type Definitions

```typescript
export type FormFieldType =
  | 'text'           // Short text input
  | 'textarea'       // Multi-line text
  | 'number'         // Numeric input
  | 'date'           // Date picker
  | 'datetime'       // Date + time picker
  | 'boolean'        // Yes/No/N/A radio buttons
  | 'select'         // Single-select dropdown
  | 'multi_select'   // Multi-select checkboxes
  | 'signature'      // Canvas signature capture
  | 'photo'          // Camera/upload photo
  | 'temperature'    // Numeric with °F/°C unit
  | 'pressure'       // Numeric with PSI/bar unit

export interface FormFieldValidation {
  min?: number
  max?: number
  pattern?: string
  minLength?: number
  maxLength?: number
  required?: boolean
  allowNA?: boolean  // For boolean fields
}

export interface FormField {
  id: string
  formTemplateId: string
  label: string
  fieldType: FormFieldType
  required: boolean
  options?: string[]  // For select/multi_select
  validationRules?: FormFieldValidation
  helpText?: string
  placeholder?: string
  defaultValue?: string
  sortOrder: number
  active: boolean
}
```

### 3.2 Field Type Examples

```sql
-- Example: Eyewash Station Test form fields
-- Binder: Montero (Safety Equipment)

-- Field 1: Test Date
INSERT INTO form_fields (form_template_id, label, field_type, required, sort_order)
VALUES (
  '{form_template_id}',
  'Test Date',
  'date',
  true,
  0
);

-- Field 2: Station Location
INSERT INTO form_fields (form_template_id, label, field_type, required, options, sort_order)
VALUES (
  '{form_template_id}',
  'Station Location',
  'select',
  true,
  '["Procedure Room 1", "Procedure Room 2", "Decontamination Room", "Utility Room"]'::jsonb,
  1
);

-- Field 3: Water Flow Test
INSERT INTO form_fields (form_template_id, label, field_type, required, help_text, sort_order)
VALUES (
  '{form_template_id}',
  'Water Flow Test',
  'boolean',
  true,
  'Water should flow immediately when activated',
  2
);

-- Field 4: Water Clarity
INSERT INTO form_fields (form_template_id, label, field_type, required, options, sort_order)
VALUES (
  '{form_template_id}',
  'Water Clarity',
  'select',
  true,
  '["Clear", "Slightly Discolored", "Discolored", "Debris Present"]'::jsonb,
  3
);

-- Field 5: Temperature
INSERT INTO form_fields (form_template_id, label, field_type, required, validation_rules, sort_order)
VALUES (
  '{form_template_id}',
  'Water Temperature (°F)',
  'temperature',
  true,
  '{"min": 60, "max": 100}'::jsonb,
  4
);

-- Field 6: Accessible
INSERT INTO form_fields (form_template_id, label, field_type, required, help_text, sort_order)
VALUES (
  '{form_template_id}',
  'Accessible / Unobstructed',
  'boolean',
  true,
  'Station must be free of obstructions within 10 feet',
  5
);

-- Field 7: Photo (if issues found)
INSERT INTO form_fields (form_template_id, label, field_type, required, help_text, sort_order)
VALUES (
  '{form_template_id}',
  'Photo of Issue (if applicable)',
  'photo',
  false,
  'Upload photo if any deficiencies noted',
  6
);

-- Field 8: Technician Signature
INSERT INTO form_fields (form_template_id, label, field_type, required, sort_order)
VALUES (
  '{form_template_id}',
  'Technician Signature',
  'signature',
  true,
  7
);
```

## 4. Binder Categories

### 4.1 Seed Data

```sql
-- ============================================================================
-- SEED: Summit Digestive Health Center Binders
-- ============================================================================
-- Assumes location_id from profiles table for Summit location

-- Variable for location (replace with actual UUID)
-- In actual migration, use: SELECT id FROM locations WHERE name = 'Summit Digestive Health Center'

-- Binder 1: Forms Folder (Master Templates)
INSERT INTO binders (location_id, name, description, color, icon, sort_order)
VALUES (
  '{location_id}',
  'Forms Folder',
  'Master template forms organized by regulatory category (40 forms across 7 categories)',
  '#3B82F6', -- blue
  'FolderOpen',
  1
);

-- Binder 2: Hand Hygiene
INSERT INTO binders (location_id, name, description, color, icon, sort_order)
VALUES (
  '{location_id}',
  'Hand Hygiene Binder',
  'WHO 5 Moments hand hygiene compliance monitoring',
  '#10B981', -- green
  'Hand',
  2
);

-- Binder 3: Montero (Technical/Safety)
INSERT INTO binders (location_id, name, description, color, icon, sort_order)
VALUES (
  '{location_id}',
  'Montero Binder',
  'Technical and safety equipment maintenance logs (daily, weekly, monthly, quarterly, annual)',
  '#F59E0B', -- amber
  'Wrench',
  3
);

-- Binder 4: Nursing Logs
INSERT INTO binders (location_id, name, description, color, icon, sort_order)
VALUES (
  '{location_id}',
  'Nursing Logs Binder',
  'Controlled substances, crash cart, emergency equipment, CLIA-waived lab testing',
  '#EF4444', -- red
  'Syringe',
  4
);

-- Binder 5: Procedure Logs
INSERT INTO binders (location_id, name, description, color, icon, sort_order)
VALUES (
  '{location_id}',
  'Procedure Logs Binder',
  'Room cleaning verification and oxygen supply checks',
  '#8B5CF6', -- violet
  'ClipboardCheck',
  5
);

-- Binder 6: Scope Logs
INSERT INTO binders (location_id, name, description, color, icon, sort_order)
VALUES (
  '{location_id}',
  'Scope Logs Binder',
  'Endoscope reprocessing compliance and tracking',
  '#06B6D4', -- cyan
  'Microscope',
  6
);

-- Binder 7: Yanling (Clinical Quality)
INSERT INTO binders (location_id, name, description, color, icon, sort_order)
VALUES (
  '{location_id}',
  'Yanling Binder',
  'Clinical quality assurance, environmental monitoring, peer review',
  '#EC4899', -- pink
  'ClipboardList',
  7
);
```

### 4.2 Example Form Templates (3 per binder)

```sql
-- ============================================================================
-- FORMS FOLDER: Master Templates
-- ============================================================================
-- Retrieve binder_id
-- SET @forms_binder_id = (SELECT id FROM binders WHERE name = 'Forms Folder' AND location_id = '{location_id}');

-- Form 1: Fire Extinguisher Inspection
INSERT INTO form_templates (binder_id, location_id, name, description, frequency, regulatory_reference, retention_years, sort_order)
VALUES (
  '{forms_binder_id}',
  '{location_id}',
  'Fire Extinguisher Inspection',
  'Monthly inspection of all fire extinguishers per NFPA 10 requirements',
  'monthly',
  'NFPA 10, CMS Life Safety Code',
  7,
  1
);

-- Form 2: DEA Controlled Substance Inventory
INSERT INTO form_templates (binder_id, location_id, name, description, frequency, regulatory_reference, retention_years, sort_order)
VALUES (
  '{forms_binder_id}',
  '{location_id}',
  'DEA Controlled Substance Inventory',
  'Biennial inventory of all Schedule II-V controlled substances',
  'as_needed',
  '21 CFR 1304.11',
  7,
  2
);

-- Form 3: Infection Control Risk Assessment
INSERT INTO form_templates (binder_id, location_id, name, description, frequency, regulatory_reference, retention_years, sort_order)
VALUES (
  '{forms_binder_id}',
  '{location_id}',
  'Infection Control Risk Assessment',
  'Annual facility-wide infection control risk assessment',
  'annual',
  'CDC Guidelines, CMS Tag A-0749',
  10,
  3
);

-- ============================================================================
-- HAND HYGIENE BINDER
-- ============================================================================

-- Form 1: WHO 5 Moments Observation
INSERT INTO form_templates (binder_id, location_id, name, description, instructions, frequency, regulatory_reference, retention_years, sort_order)
VALUES (
  '{hand_hygiene_binder_id}',
  '{location_id}',
  'WHO 5 Moments Hand Hygiene Observation',
  'Direct observation of hand hygiene compliance using WHO 5 Moments framework',
  'Observe healthcare workers during patient care activities. Record compliance for each of the 5 moments: 1) Before patient contact, 2) Before aseptic task, 3) After body fluid exposure risk, 4) After patient contact, 5) After contact with patient surroundings.',
  'weekly',
  'WHO Hand Hygiene Guidelines, CMS Tag A-0747',
  3,
  1
);

-- Form 2: Hand Hygiene Station Audit
INSERT INTO form_templates (binder_id, location_id, name, description, frequency, retention_years, sort_order)
VALUES (
  '{hand_hygiene_binder_id}',
  '{location_id}',
  'Hand Hygiene Station Audit',
  'Verify hand hygiene stations are stocked and functional',
  'daily',
  3,
  2
);

-- Form 3: Hand Hygiene Product Evaluation
INSERT INTO form_templates (binder_id, location_id, name, description, frequency, retention_years, sort_order)
VALUES (
  '{hand_hygiene_binder_id}',
  '{location_id}',
  'Hand Hygiene Product Evaluation',
  'Staff feedback on hand hygiene product efficacy and skin tolerance',
  'quarterly',
  5,
  3
);

-- ============================================================================
-- MONTERO BINDER: Technical/Safety
-- ============================================================================

-- Form 1: Eyewash Station Test (already detailed above)
INSERT INTO form_templates (binder_id, location_id, name, description, frequency, regulatory_reference, retention_years, sort_order)
VALUES (
  '{montero_binder_id}',
  '{location_id}',
  'Eyewash Station Test',
  'Weekly functional test of emergency eyewash stations per ANSI Z358.1',
  'weekly',
  'ANSI Z358.1, OSHA 1910.151(c)',
  3,
  1
);

-- Form 2: Emergency Generator Test
INSERT INTO form_templates (binder_id, location_id, name, description, frequency, regulatory_reference, retention_years, sort_order)
VALUES (
  '{montero_binder_id}',
  '{location_id}',
  'Emergency Generator Test',
  'Monthly 30-minute load test of emergency power generator',
  'monthly',
  'NFPA 110, CMS Life Safety Code',
  7,
  2
);

-- Form 3: HVAC Filter Replacement
INSERT INTO form_templates (binder_id, location_id, name, description, frequency, retention_years, sort_order)
VALUES (
  '{montero_binder_id}',
  '{location_id}',
  'HVAC Filter Replacement',
  'Quarterly replacement and inspection of HVAC system filters',
  'quarterly',
  3,
  3
);

-- ============================================================================
-- NURSING LOGS BINDER
-- ============================================================================

-- Form 1: Controlled Substance Count
INSERT INTO form_templates (binder_id, location_id, name, description, frequency, regulatory_reference, retention_years, sort_order)
VALUES (
  '{nursing_binder_id}',
  '{location_id}',
  'Controlled Substance Count',
  'Daily count and reconciliation of all Schedule II-V medications',
  'daily',
  '21 CFR 1304.04, 21 CFR 1304.11',
  7,
  1
);

-- Form 2: Crash Cart Check
INSERT INTO form_templates (binder_id, location_id, name, description, frequency, retention_years, sort_order)
VALUES (
  '{nursing_binder_id}',
  '{location_id}',
  'Crash Cart Check',
  'Daily verification of crash cart contents, medication expiration dates, and equipment functionality',
  'daily',
  3,
  2
);

-- Form 3: CLIA-Waived Lab QC
INSERT INTO form_templates (binder_id, location_id, name, description, frequency, regulatory_reference, retention_years, sort_order)
VALUES (
  '{nursing_binder_id}',
  '{location_id}',
  'CLIA-Waived Lab Quality Control',
  'Quality control testing for CLIA-waived point-of-care devices (glucometer, hemoglobin, etc.)',
  'daily',
  'CLIA 42 CFR 493.1256',
  2,
  3
);

-- ============================================================================
-- PROCEDURE LOGS BINDER
-- ============================================================================

-- Form 1: Procedure Room Cleaning Verification
INSERT INTO form_templates (binder_id, location_id, name, description, frequency, retention_years, sort_order)
VALUES (
  '{procedure_binder_id}',
  '{location_id}',
  'Procedure Room Cleaning Verification',
  'Post-procedure terminal cleaning checklist for endoscopy rooms',
  'as_needed',
  1,
  1
);

-- Form 2: Oxygen Supply Check
INSERT INTO form_templates (binder_id, location_id, name, description, frequency, retention_years, sort_order)
VALUES (
  '{procedure_binder_id}',
  '{location_id}',
  'Oxygen Supply Check',
  'Daily verification of medical oxygen supply levels and equipment',
  'daily',
  1,
  2
);

-- Form 3: Suction Equipment Test
INSERT INTO form_templates (binder_id, location_id, name, description, frequency, retention_years, sort_order)
VALUES (
  '{procedure_binder_id}',
  '{location_id}',
  'Suction Equipment Test',
  'Daily functional test of medical suction equipment',
  'daily',
  1,
  3
);

-- ============================================================================
-- SCOPE LOGS BINDER: Endoscope Reprocessing
-- ============================================================================

-- Form 1: Manual Cleaning Log
INSERT INTO form_templates (binder_id, location_id, name, description, frequency, regulatory_reference, retention_years, sort_order)
VALUES (
  '{scope_binder_id}',
  '{location_id}',
  'Endoscope Manual Cleaning Log',
  'Documentation of manual cleaning process for each endoscope',
  'as_needed',
  'AAMI ST91, CMS Tag A-0726',
  3,
  1
);

-- Form 2: AER Cycle Log (Automated Endoscope Reprocessor)
INSERT INTO form_templates (binder_id, location_id, name, description, frequency, regulatory_reference, retention_years, sort_order)
VALUES (
  '{scope_binder_id}',
  '{location_id}',
  'AER Cycle Log',
  'Automated endoscope reprocessor cycle documentation',
  'as_needed',
  'AAMI ST91',
  3,
  2
);

-- Form 3: Scope Storage and Hanging Log
INSERT INTO form_templates (binder_id, location_id, name, description, frequency, retention_years, sort_order)
VALUES (
  '{scope_binder_id}',
  '{location_id}',
  'Scope Storage and Hanging Log',
  'Daily verification of proper endoscope storage conditions',
  'daily',
  1,
  3
);

-- ============================================================================
-- YANLING BINDER: Clinical Quality
-- ============================================================================

-- Form 1: Adverse Event Report
INSERT INTO form_templates (binder_id, location_id, name, description, frequency, regulatory_reference, retention_years, sort_order)
VALUES (
  '{yanling_binder_id}',
  '{location_id}',
  'Adverse Event Report',
  'Documentation of any adverse patient event or near-miss',
  'as_needed',
  'CMS Conditions for Coverage',
  7,
  1
);

-- Form 2: Environmental Monitoring Round
INSERT INTO form_templates (binder_id, location_id, name, description, frequency, retention_years, sort_order)
VALUES (
  '{yanling_binder_id}',
  '{location_id}',
  'Environmental Monitoring Round',
  'Weekly facility walkthrough to identify environmental hazards and maintenance needs',
  'weekly',
  3,
  2
);

-- Form 3: Peer Review Case Evaluation
INSERT INTO form_templates (binder_id, location_id, name, description, frequency, retention_years, sort_order)
VALUES (
  '{yanling_binder_id}',
  '{location_id}',
  'Peer Review Case Evaluation',
  'Quarterly peer review of selected procedure cases for quality assurance',
  'quarterly',
  7,
  3
);
```

### 4.3 Example Form Fields (Eyewash Station Test)

```sql
-- Fields already detailed in section 3.2
-- Additional example: Fire Extinguisher Inspection

-- Retrieve form_template_id for Fire Extinguisher Inspection
-- SET @fire_ext_form_id = (SELECT id FROM form_templates WHERE name = 'Fire Extinguisher Inspection');

INSERT INTO form_fields (form_template_id, label, field_type, required, sort_order) VALUES
('{fire_ext_form_id}', 'Inspection Date', 'date', true, 0),
('{fire_ext_form_id}', 'Extinguisher Location', 'select', true, 1),
('{fire_ext_form_id}', 'Extinguisher ID Number', 'text', true, 2),
('{fire_ext_form_id}', 'Pressure Gauge in Green Zone', 'boolean', true, 3),
('{fire_ext_form_id}', 'Safety Pin and Tamper Seal Intact', 'boolean', true, 4),
('{fire_ext_form_id}', 'Hose and Nozzle Clear', 'boolean', true, 5),
('{fire_ext_form_id}', 'Extinguisher Accessible (not obstructed)', 'boolean', true, 6),
('{fire_ext_form_id}', 'Signage Visible', 'boolean', true, 7),
('{fire_ext_form_id}', 'Physical Damage Present', 'boolean', true, 8),
('{fire_ext_form_id}', 'Photo of Damage (if applicable)', 'photo', false, 9),
('{fire_ext_form_id}', 'Inspector Signature', 'signature', true, 10);

-- Update options for Extinguisher Location field
UPDATE form_fields
SET options = '[
  "Main Entrance Hallway",
  "Procedure Room 1",
  "Procedure Room 2",
  "Decontamination Room",
  "Kitchen/Break Room",
  "Utility Room",
  "Storage Area"
]'::jsonb
WHERE form_template_id = '{fire_ext_form_id}' AND label = 'Extinguisher Location';
```

## 5. API Endpoints

### 5.1 Binders

```
GET    /api/orgs/:orgId/locations/:locationId/binders
GET    /api/orgs/:orgId/locations/:locationId/binders/:binderId
POST   /api/orgs/:orgId/locations/:locationId/binders
PATCH  /api/orgs/:orgId/locations/:locationId/binders/:binderId
DELETE /api/orgs/:orgId/locations/:locationId/binders/:binderId
```

**Example Response:**
```json
{
  "id": "uuid",
  "locationId": "uuid",
  "name": "Montero Binder",
  "description": "Technical and safety equipment maintenance logs",
  "color": "#F59E0B",
  "icon": "Wrench",
  "sortOrder": 3,
  "active": true,
  "createdAt": "2025-01-15T10:00:00Z",
  "formCount": 16
}
```

### 5.2 Form Templates

```
GET    /api/orgs/:orgId/locations/:locationId/binders/:binderId/forms
GET    /api/orgs/:orgId/locations/:locationId/forms/:formId
POST   /api/orgs/:orgId/locations/:locationId/binders/:binderId/forms
PATCH  /api/orgs/:orgId/locations/:locationId/forms/:formId
DELETE /api/orgs/:orgId/locations/:locationId/forms/:formId

# Bulk operations
POST   /api/orgs/:orgId/locations/:locationId/forms/duplicate
```

**Example Response:**
```json
{
  "id": "uuid",
  "binderId": "uuid",
  "locationId": "uuid",
  "name": "Eyewash Station Test",
  "description": "Weekly functional test of emergency eyewash stations",
  "instructions": "Test all eyewash stations per ANSI Z358.1 guidelines...",
  "frequency": "weekly",
  "defaultAssigneeProfileId": "uuid",
  "regulatoryReference": "ANSI Z358.1, OSHA 1910.151(c)",
  "retentionYears": 3,
  "sortOrder": 1,
  "active": true,
  "fieldCount": 8,
  "createdAt": "2025-01-15T10:00:00Z"
}
```

### 5.3 Form Fields

```
GET    /api/orgs/:orgId/locations/:locationId/forms/:formId/fields
GET    /api/orgs/:orgId/locations/:locationId/forms/:formId/fields/:fieldId
POST   /api/orgs/:orgId/locations/:locationId/forms/:formId/fields
PATCH  /api/orgs/:orgId/locations/:locationId/forms/:formId/fields/:fieldId
DELETE /api/orgs/:orgId/locations/:locationId/forms/:formId/fields/:fieldId

# Bulk reordering
PATCH  /api/orgs/:orgId/locations/:locationId/forms/:formId/fields/reorder
```

**Example Response:**
```json
{
  "id": "uuid",
  "formTemplateId": "uuid",
  "label": "Water Flow Test",
  "fieldType": "boolean",
  "required": true,
  "options": null,
  "validationRules": { "allowNA": true },
  "helpText": "Water should flow immediately when activated",
  "placeholder": null,
  "defaultValue": null,
  "sortOrder": 2,
  "active": true
}
```

### 5.4 Form Responses

```
POST   /api/orgs/:orgId/locations/:locationId/forms/:formId/responses
GET    /api/orgs/:orgId/locations/:locationId/forms/:formId/responses
GET    /api/orgs/:orgId/locations/:locationId/responses/:responseId
PATCH  /api/orgs/:orgId/locations/:locationId/responses/:responseId
DELETE /api/orgs/:orgId/locations/:locationId/responses/:responseId

# Filtering
GET    /api/orgs/:orgId/locations/:locationId/responses?status=complete&from=2025-01-01&to=2025-01-31
GET    /api/orgs/:orgId/locations/:locationId/responses?submittedBy=uuid
GET    /api/orgs/:orgId/locations/:locationId/responses?binderId=uuid
```

**Submit Request:**
```json
{
  "formTemplateId": "uuid",
  "status": "complete",
  "remarks": "All stations passed inspection",
  "fieldResponses": [
    {
      "formFieldId": "uuid",
      "value": "2025-01-15",
      "valueType": "date"
    },
    {
      "formFieldId": "uuid",
      "value": "Procedure Room 1",
      "valueType": "text"
    },
    {
      "formFieldId": "uuid",
      "value": true,
      "pass": true,
      "valueType": "boolean"
    },
    {
      "formFieldId": "uuid",
      "value": 78,
      "pass": true,
      "valueType": "number"
    },
    {
      "formFieldId": "uuid",
      "attachmentUrl": "attachments/signatures/abc123.png",
      "valueType": "signature"
    }
  ]
}
```

**Response:**
```json
{
  "id": "uuid",
  "formTemplateId": "uuid",
  "locationId": "uuid",
  "submittedAt": "2025-01-15T14:30:00Z",
  "submittedByProfileId": "uuid",
  "submittedByName": "Jane Smith",
  "status": "complete",
  "overallPass": true,
  "remarks": "All stations passed inspection",
  "fieldResponses": [
    {
      "id": "uuid",
      "formFieldId": "uuid",
      "label": "Water Flow Test",
      "valueBoolean": true,
      "pass": true
    }
  ]
}
```

### 5.5 Attachments

```
POST   /api/orgs/:orgId/locations/:locationId/responses/:responseId/attachments
GET    /api/orgs/:orgId/locations/:locationId/responses/:responseId/attachments/:attachmentId
DELETE /api/orgs/:orgId/locations/:locationId/responses/:responseId/attachments/:attachmentId
```

## 6. Zod Validation Schemas

```typescript
// ============================================================================
// lib/validations/binder.ts
// ============================================================================
import { z } from "zod"

export const createBinderSchema = z.object({
  locationId: z.string().uuid(),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  icon: z.string().max(50).optional(),
  sortOrder: z.number().int().min(0).default(0),
})

export const updateBinderSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  icon: z.string().max(50).optional(),
  sortOrder: z.number().int().min(0).optional(),
  active: z.boolean().optional(),
})

// ============================================================================
// lib/validations/form-template.ts
// ============================================================================
export const frequencyEnum = z.enum([
  "daily",
  "weekly",
  "monthly",
  "quarterly",
  "annual",
  "as_needed",
])

export const createFormTemplateSchema = z.object({
  binderId: z.string().uuid(),
  locationId: z.string().uuid(),
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  instructions: z.string().max(5000).optional(),
  frequency: frequencyEnum,
  defaultAssigneeProfileId: z.string().uuid().optional(),
  regulatoryReference: z.string().max(500).optional(),
  retentionYears: z.number().int().min(1).max(99).optional(),
  sortOrder: z.number().int().min(0).default(0),
})

export const updateFormTemplateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  instructions: z.string().max(5000).optional(),
  frequency: frequencyEnum.optional(),
  defaultAssigneeProfileId: z.string().uuid().nullable().optional(),
  regulatoryReference: z.string().max(500).optional(),
  retentionYears: z.number().int().min(1).max(99).optional(),
  sortOrder: z.number().int().min(0).optional(),
  active: z.boolean().optional(),
})

export const duplicateFormTemplateSchema = z.object({
  sourceFormId: z.string().uuid(),
  newName: z.string().min(1).max(200),
  targetBinderId: z.string().uuid().optional(), // If not provided, duplicate in same binder
  copyFields: z.boolean().default(true),
})

// ============================================================================
// lib/validations/form-field.ts
// ============================================================================
export const fieldTypeEnum = z.enum([
  "text",
  "textarea",
  "number",
  "date",
  "datetime",
  "boolean",
  "select",
  "multi_select",
  "signature",
  "photo",
  "temperature",
  "pressure",
])

export const validationRulesSchema = z.object({
  min: z.number().optional(),
  max: z.number().optional(),
  pattern: z.string().optional(),
  minLength: z.number().int().optional(),
  maxLength: z.number().int().optional(),
  required: z.boolean().optional(),
  allowNA: z.boolean().optional(),
}).optional()

export const createFormFieldSchema = z.object({
  formTemplateId: z.string().uuid(),
  label: z.string().min(1).max(200),
  fieldType: fieldTypeEnum,
  required: z.boolean().default(true),
  options: z.array(z.string()).optional(),
  validationRules: validationRulesSchema,
  helpText: z.string().max(1000).optional(),
  placeholder: z.string().max(200).optional(),
  defaultValue: z.string().max(500).optional(),
  sortOrder: z.number().int().min(0).default(0),
})

export const updateFormFieldSchema = createFormFieldSchema.partial().omit({ formTemplateId: true })

export const reorderFieldsSchema = z.object({
  fieldIds: z.array(z.string().uuid()),
})

// ============================================================================
// lib/validations/form-response.ts
// ============================================================================
export const fieldResponseSchema = z.object({
  formFieldId: z.string().uuid(),

  // Polymorphic value - only one should be provided based on field type
  valueText: z.string().optional(),
  valueNumber: z.number().optional(),
  valueBoolean: z.boolean().optional(),
  valueDate: z.string().date().optional(),
  valueDatetime: z.string().datetime().optional(),
  valueJson: z.record(z.any()).optional(),

  // File attachment
  attachmentUrl: z.string().url().optional(),

  // Pass/fail for this field
  pass: z.boolean().optional(),
})

export const submitFormResponseSchema = z.object({
  formTemplateId: z.string().uuid(),
  locationId: z.string().uuid(),
  inspectionInstanceId: z.string().uuid().optional(), // Link to scheduled task if applicable
  status: z.enum(["draft", "complete", "flagged"]).default("complete"),
  remarks: z.string().max(5000).optional(),
  correctiveAction: z.string().max(5000).optional(),
  fieldResponses: z.array(fieldResponseSchema).min(1),
})

export const updateFormResponseSchema = z.object({
  status: z.enum(["draft", "complete", "flagged"]).optional(),
  remarks: z.string().max(5000).optional(),
  correctiveAction: z.string().max(5000).optional(),
  fieldResponses: z.array(fieldResponseSchema).optional(),
})

export const filterResponsesSchema = z.object({
  binderId: z.string().uuid().optional(),
  formTemplateId: z.string().uuid().optional(),
  submittedByProfileId: z.string().uuid().optional(),
  status: z.enum(["draft", "complete", "flagged"]).optional(),
  overallPass: z.boolean().optional(),
  from: z.string().date().optional(),
  to: z.string().date().optional(),
  limit: z.number().int().min(1).max(100).default(50),
  offset: z.number().int().min(0).default(0),
})
```

## 7. Service Layer Functions

```typescript
// ============================================================================
// lib/services/binder-service.ts
// ============================================================================

export interface BinderService {
  // CRUD operations
  listBinders(orgId: string, locationId: string): Promise<Binder[]>
  getBinder(orgId: string, binderId: string): Promise<Binder | null>
  createBinder(orgId: string, data: CreateBinderInput): Promise<Binder>
  updateBinder(orgId: string, binderId: string, data: UpdateBinderInput): Promise<Binder>
  deleteBinder(orgId: string, binderId: string): Promise<void>

  // Stats
  getBinderStats(orgId: string, binderId: string): Promise<{
    totalForms: number
    activeForms: number
    totalResponses: number
    responsesByMonth: Array<{ month: string; count: number }>
  }>
}

// ============================================================================
// lib/services/form-template-service.ts
// ============================================================================

export interface FormTemplateService {
  // CRUD operations
  listFormTemplates(orgId: string, binderId: string): Promise<FormTemplate[]>
  getFormTemplate(orgId: string, formId: string, includeFields?: boolean): Promise<FormTemplate | null>
  createFormTemplate(orgId: string, data: CreateFormTemplateInput): Promise<FormTemplate>
  updateFormTemplate(orgId: string, formId: string, data: UpdateFormTemplateInput): Promise<FormTemplate>
  deleteFormTemplate(orgId: string, formId: string): Promise<void>

  // Duplication
  duplicateFormTemplate(orgId: string, data: DuplicateFormTemplateInput): Promise<FormTemplate>

  // Bulk operations
  bulkUpdateSortOrder(orgId: string, binderId: string, sortedIds: string[]): Promise<void>

  // Stats
  getFormStats(orgId: string, formId: string): Promise<{
    totalResponses: number
    passRate: number
    avgCompletionTime: number
    lastSubmittedAt: string | null
  }>
}

// ============================================================================
// lib/services/form-field-service.ts
// ============================================================================

export interface FormFieldService {
  // CRUD operations
  listFormFields(orgId: string, formId: string): Promise<FormField[]>
  getFormField(orgId: string, fieldId: string): Promise<FormField | null>
  createFormField(orgId: string, data: CreateFormFieldInput): Promise<FormField>
  updateFormField(orgId: string, fieldId: string, data: UpdateFormFieldInput): Promise<FormField>
  deleteFormField(orgId: string, fieldId: string): Promise<void>

  // Reordering
  reorderFields(orgId: string, formId: string, sortedFieldIds: string[]): Promise<void>

  // Validation
  validateFieldResponse(field: FormField, response: FieldResponse): Promise<{
    valid: boolean
    errors: string[]
  }>
}

// ============================================================================
// lib/services/form-response-service.ts
// ============================================================================

export interface FormResponseService {
  // Submit and retrieve
  submitFormResponse(orgId: string, data: SubmitFormResponseInput, profileId: string): Promise<FormResponse>
  getFormResponse(orgId: string, responseId: string): Promise<FormResponse | null>
  listFormResponses(orgId: string, filters: FilterResponsesInput): Promise<{
    responses: FormResponse[]
    total: number
  }>

  // Update and delete
  updateFormResponse(orgId: string, responseId: string, data: UpdateFormResponseInput): Promise<FormResponse>
  deleteFormResponse(orgId: string, responseId: string): Promise<void>

  // Draft operations
  saveDraft(orgId: string, data: SubmitFormResponseInput, profileId: string): Promise<FormResponse>
  completeDraft(orgId: string, responseId: string): Promise<FormResponse>

  // Attachments
  uploadAttachment(orgId: string, responseId: string, file: File): Promise<{ url: string }>
  deleteAttachment(orgId: string, attachmentUrl: string): Promise<void>

  // Analytics
  getResponseAnalytics(orgId: string, formId: string, dateRange: { from: string; to: string }): Promise<{
    totalResponses: number
    passRate: number
    failuresByField: Array<{ fieldLabel: string; failureCount: number }>
    completionTrend: Array<{ date: string; count: number }>
  }>

  // Exports
  exportResponsesToCSV(orgId: string, filters: FilterResponsesInput): Promise<string>
  exportResponseToPDF(orgId: string, responseId: string): Promise<Buffer>
}

// ============================================================================
// lib/services/migration-service.ts
// ============================================================================

export interface MigrationService {
  // Migration helpers
  migrateLegacyTemplates(orgId: string, locationId: string): Promise<{
    migratedCount: number
    errors: string[]
  }>

  createDefaultBinders(orgId: string, locationId: string): Promise<Binder[]>

  linkInstanceToResponse(instanceId: string, responseId: string): Promise<void>

  // Feature flag check
  isBinderSystemEnabled(locationId: string): Promise<boolean>
}
```

## 8. Migration Plan

### 8.1 Pre-Migration Checklist

```
[ ] Backup production database
[ ] Review all active inspection_templates
[ ] Identify custom templates that need manual categorization
[ ] Communicate migration timeline to users
[ ] Prepare rollback plan
```

### 8.2 Step-by-Step Migration

**Phase 1: Schema Deployment (Week 1)**

1. Deploy new tables to production (via Supabase migration)
2. Seed Summit Digestive Health binders
3. Run automated migration script for legacy templates
4. Verify data integrity

```sql
-- Migration script: 001_create_binder_system.sql
-- Run via Supabase CLI: supabase db push
-- Or in Supabase Studio SQL Editor

-- (Include all CREATE TABLE statements from Section 1.1)

-- Run migration from inspection_templates (Section 1.2)

-- Verify migration
SELECT
  b.name AS binder,
  COUNT(ft.id) AS form_count
FROM binders b
LEFT JOIN form_templates ft ON ft.binder_id = b.id
GROUP BY b.id, b.name
ORDER BY b.sort_order;
```

**Phase 2: Admin UI (Week 2)**

1. Build binder management UI (`/admin/binders`)
2. Build form template editor with field builder
3. Add migration review dashboard for admins to re-categorize legacy forms
4. Test with internal team

**Phase 3: Form Filling UI (Week 3)**

1. Build form response submission UI
2. Add camera/signature capture components
3. Build response history viewer
4. Test end-to-end workflow

**Phase 4: Gradual Rollout (Week 4)**

1. Enable binder system for Summit Digestive Health (feature flag)
2. Monitor for 1 week
3. Collect user feedback
4. Enable for remaining locations

**Phase 5: Deprecation (Month 3+)**

1. Mark `inspection_templates` as deprecated in codebase
2. Migrate any remaining locations
3. Remove old table after 6 months (retain in archive)

### 8.3 Data Migration SQL

```sql
-- ============================================================================
-- FULL MIGRATION SCRIPT
-- ============================================================================
-- Run this after new tables are created

BEGIN;

-- Step 1: Create default binders for all locations
INSERT INTO binders (location_id, name, description, color, icon, sort_order, active)
SELECT
  l.id AS location_id,
  'Legacy Inspections' AS name,
  'Migrated from original inspection_templates table' AS description,
  '#6B7280' AS color,
  'Archive' AS icon,
  999 AS sort_order,
  true AS active
FROM locations l
WHERE NOT EXISTS (
  SELECT 1 FROM binders WHERE location_id = l.id AND name = 'Legacy Inspections'
);

-- Step 2: Migrate inspection_templates to form_templates
INSERT INTO form_templates (
  binder_id,
  location_id,
  name,
  description,
  frequency,
  default_assignee_profile_id,
  sort_order,
  active,
  created_at
)
SELECT
  b.id AS binder_id,
  it.location_id,
  it.task AS name,
  it.description,
  COALESCE(it.frequency, 'as_needed') AS frequency,
  it.default_assignee_profile_id,
  it.sort_order,
  it.active,
  it.created_at
FROM inspection_templates it
JOIN binders b ON b.location_id = it.location_id AND b.name = 'Legacy Inspections'
WHERE NOT EXISTS (
  SELECT 1 FROM form_templates WHERE location_id = it.location_id AND name = it.task
);

-- Step 3: Create default pass/fail field for all migrated forms
INSERT INTO form_fields (form_template_id, label, field_type, required, sort_order, help_text)
SELECT
  ft.id AS form_template_id,
  'Pass/Fail' AS label,
  'boolean' AS field_type,
  true AS required,
  0 AS sort_order,
  'Indicate whether this inspection passed or failed' AS help_text
FROM form_templates ft
JOIN binders b ON b.id = ft.binder_id
WHERE b.name = 'Legacy Inspections'
AND NOT EXISTS (
  SELECT 1 FROM form_fields WHERE form_template_id = ft.id
);

-- Step 4: Add remarks field
INSERT INTO form_fields (form_template_id, label, field_type, required, sort_order, help_text)
SELECT
  ft.id AS form_template_id,
  'Remarks' AS label,
  'textarea' AS field_type,
  false AS required,
  1 AS sort_order,
  'Additional notes or observations' AS help_text
FROM form_templates ft
JOIN binders b ON b.id = ft.binder_id
WHERE b.name = 'Legacy Inspections';

-- Step 5: Create Summit-specific binders (only for Summit location)
DO $$
DECLARE
  summit_location_id UUID;
BEGIN
  SELECT id INTO summit_location_id FROM locations WHERE name ILIKE '%summit%' LIMIT 1;

  IF summit_location_id IS NOT NULL THEN
    -- Insert all Summit binders from Section 4.1
    -- (Hand Hygiene, Montero, Nursing Logs, etc.)
    INSERT INTO binders (location_id, name, description, color, icon, sort_order)
    VALUES
      (summit_location_id, 'Hand Hygiene Binder', 'WHO 5 Moments hand hygiene compliance monitoring', '#10B981', 'Hand', 2),
      (summit_location_id, 'Montero Binder', 'Technical and safety equipment maintenance logs', '#F59E0B', 'Wrench', 3),
      (summit_location_id, 'Nursing Logs Binder', 'Controlled substances, crash cart, emergency equipment', '#EF4444', 'Syringe', 4),
      (summit_location_id, 'Procedure Logs Binder', 'Room cleaning verification and oxygen supply checks', '#8B5CF6', 'ClipboardCheck', 5),
      (summit_location_id, 'Scope Logs Binder', 'Endoscope reprocessing compliance and tracking', '#06B6D4', 'Microscope', 6),
      (summit_location_id, 'Yanling Binder', 'Clinical quality assurance and environmental monitoring', '#EC4899', 'ClipboardList', 7)
    ON CONFLICT (location_id, name) DO NOTHING;
  END IF;
END $$;

COMMIT;

-- Verification query
SELECT
  l.name AS location,
  b.name AS binder,
  COUNT(ft.id) AS form_count,
  SUM((SELECT COUNT(*) FROM form_fields WHERE form_template_id = ft.id)) AS total_fields
FROM locations l
JOIN binders b ON b.location_id = l.id
LEFT JOIN form_templates ft ON ft.binder_id = b.id
GROUP BY l.id, l.name, b.id, b.name
ORDER BY l.name, b.sort_order;
```

### 8.4 Feature Flag Implementation

```typescript
// lib/feature-flags.ts
export const FEATURE_FLAGS = {
  BINDER_SYSTEM: 'binder_system_enabled',
} as const

// Check at location level
export async function isFeatureEnabled(
  locationId: string,
  flag: string
): Promise<boolean> {
  const result = await supabase
    .from('feature_flags')
    .select('enabled')
    .eq('location_id', locationId)
    .eq('flag_name', flag)
    .single()

  return result.data?.enabled ?? false
}

// Enable for specific location
export async function enableFeature(
  locationId: string,
  flag: string
): Promise<void> {
  await supabase
    .from('feature_flags')
    .upsert({
      location_id: locationId,
      flag_name: flag,
      enabled: true,
      updated_at: new Date().toISOString(),
    })
}
```

```sql
-- Feature flags table
CREATE TABLE feature_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  flag_name TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(location_id, flag_name)
);

CREATE INDEX idx_feature_flags_location ON feature_flags(location_id);
```

### 8.5 Rollback Plan

If issues arise during migration:

```sql
-- Emergency rollback script
BEGIN;

-- Step 1: Disable feature flag for all locations
UPDATE feature_flags
SET enabled = false
WHERE flag_name = 'binder_system_enabled';

-- Step 2: Preserve new data (do NOT drop tables)
-- Form responses submitted via new system remain intact

-- Step 3: Verify old inspection_templates still functional
SELECT COUNT(*) FROM inspection_templates WHERE active = true;

-- Step 4: Re-enable old UI routes via feature flag

COMMIT;

-- Note: Only drop new tables if absolutely necessary (data loss)
-- Prefer keeping both systems running in parallel until stable
```

### 8.6 Post-Migration Tasks

```
[ ] Monitor error logs for 1 week
[ ] Collect user feedback on new form builder
[ ] Document any custom form templates created
[ ] Train staff on new system
[ ] Update user documentation
[ ] Archive old inspection_templates table (do not drop)
[ ] Celebrate successful migration
```

---

## Summary

This plan transforms the flat inspection system into a rich, hierarchical binder structure that:

1. **Mirrors physical workflow** - 7 binders match Summit's actual documentation system
2. **Enables granular data capture** - Field-level responses vs. simple pass/fail
3. **Supports regulatory compliance** - Retention policies, regulatory references, detailed audit trails
4. **Maintains backward compatibility** - Gradual migration with feature flags
5. **Scales across locations** - Org-scoped RLS, multi-tenant design

**Next Steps:**
1. Review and approve plan
2. Create Supabase migration file (`001_create_binder_system.sql`)
3. Build admin UI for binder/form management
4. Build form response submission UI
5. Run migration script for Summit location
6. User acceptance testing
7. Gradual rollout to remaining locations
