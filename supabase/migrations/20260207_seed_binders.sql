-- Seed migration for Summit Digestive binders and form templates
-- This migration creates 7 binders with representative form templates and fields
-- Uses a location-independent approach with DO block

DO $$
DECLARE
  v_location_id UUID;
  v_binder_id UUID;
  v_template_id UUID;
BEGIN
  -- Get first active location (works for any location)
  SELECT id INTO v_location_id FROM locations WHERE active = true LIMIT 1;
  IF v_location_id IS NULL THEN
    RAISE EXCEPTION 'No active location found. Cannot seed binders.';
  END IF;

  RAISE NOTICE 'Seeding binders for location: %', v_location_id;

  -- ============================================================
  -- BINDER 1: Forms Folder
  -- ============================================================
  INSERT INTO binders (location_id, name, description, color, icon, sort_order)
  VALUES (v_location_id, 'Forms Folder', 'General templates and master forms', '#3B82F6', 'folder', 0)
  RETURNING id INTO v_binder_id;

  -- Template 1: Eye Wash Station Test Sheet
  INSERT INTO form_templates (binder_id, location_id, name, description, frequency, sort_order)
  VALUES (v_binder_id, v_location_id, 'Eye Wash Station Test Sheet', 'Weekly eyewash station functionality testing', 'weekly', 0)
  RETURNING id INTO v_template_id;

  INSERT INTO form_fields (form_template_id, label, field_type, required, sort_order) VALUES
  (v_template_id, 'Date', 'date', true, 0),
  (v_template_id, 'Inspector Name', 'text', true, 1);

  INSERT INTO form_fields (form_template_id, label, field_type, required, options, sort_order) VALUES
  (v_template_id, 'Station Location', 'select', true, '["Generator Room", "Soil Room", "Main Hallway"]'::jsonb, 2);

  INSERT INTO form_fields (form_template_id, label, field_type, required, sort_order) VALUES
  (v_template_id, 'Water Flow Adequate', 'boolean', true, 3),
  (v_template_id, 'Temperature Comfortable', 'boolean', true, 4),
  (v_template_id, 'Area Clean and Clear', 'boolean', true, 5),
  (v_template_id, 'Corrective Action Needed', 'boolean', true, 6),
  (v_template_id, 'Notes', 'textarea', false, 7);

  -- Template 2: Fire Extinguisher Log
  INSERT INTO form_templates (binder_id, location_id, name, description, frequency, sort_order)
  VALUES (v_binder_id, v_location_id, 'Fire Extinguisher Log', 'Monthly fire extinguisher inspection', 'monthly', 1)
  RETURNING id INTO v_template_id;

  INSERT INTO form_fields (form_template_id, label, field_type, required, sort_order) VALUES
  (v_template_id, 'Date', 'date', true, 0),
  (v_template_id, 'Inspector Name', 'text', true, 1);

  INSERT INTO form_fields (form_template_id, label, field_type, required, options, sort_order) VALUES
  (v_template_id, 'Extinguisher Number', 'select', true, '["FE-1", "FE-2", "FE-3", "FE-4", "FE-5", "FE-6"]'::jsonb, 2);

  INSERT INTO form_fields (form_template_id, label, field_type, required, sort_order) VALUES
  (v_template_id, 'Pressure Gauge in Green', 'boolean', true, 3),
  (v_template_id, 'Pin and Seal Intact', 'boolean', true, 4),
  (v_template_id, 'No Visible Damage', 'boolean', true, 5),
  (v_template_id, 'Accessible and Visible', 'boolean', true, 6),
  (v_template_id, 'Last Service Date', 'date', false, 7),
  (v_template_id, 'Notes', 'textarea', false, 8);

  -- Template 3: Temperature Humidity Log
  INSERT INTO form_templates (binder_id, location_id, name, description, frequency, sort_order)
  VALUES (v_binder_id, v_location_id, 'Temperature Humidity Log', 'Daily temperature and humidity monitoring', 'daily', 2)
  RETURNING id INTO v_template_id;

  INSERT INTO form_fields (form_template_id, label, field_type, required, sort_order) VALUES
  (v_template_id, 'Date', 'date', true, 0),
  (v_template_id, 'Time', 'datetime', true, 1);

  INSERT INTO form_fields (form_template_id, label, field_type, required, options, sort_order) VALUES
  (v_template_id, 'Room', 'select', true, '["Procedure Room 1", "Procedure Room 2", "Recovery", "Scope Storage", "Clean Room"]'::jsonb, 2);

  INSERT INTO form_fields (form_template_id, label, field_type, required, validation_rules, sort_order) VALUES
  (v_template_id, 'Temperature', 'temperature', true, '{"min": 60, "max": 80, "unit": "F"}'::jsonb, 3),
  (v_template_id, 'Humidity Percent', 'number', true, '{"min": 20, "max": 60}'::jsonb, 4);

  INSERT INTO form_fields (form_template_id, label, field_type, required, sort_order) VALUES
  (v_template_id, 'Within Range', 'boolean', true, 5),
  (v_template_id, 'Corrective Action', 'textarea', false, 6);

  -- ============================================================
  -- BINDER 2: Hand Hygiene
  -- ============================================================
  INSERT INTO binders (location_id, name, description, color, icon, sort_order)
  VALUES (v_location_id, 'Hand Hygiene', 'Hand hygiene compliance monitoring', '#10B981', 'hand', 1)
  RETURNING id INTO v_binder_id;

  -- Template 4: Handwashing Compliance Observation
  INSERT INTO form_templates (binder_id, location_id, name, description, frequency, sort_order)
  VALUES (v_binder_id, v_location_id, 'Handwashing Compliance Observation', 'Weekly hand hygiene compliance observations', 'weekly', 0)
  RETURNING id INTO v_template_id;

  INSERT INTO form_fields (form_template_id, label, field_type, required, sort_order) VALUES
  (v_template_id, 'Date', 'date', true, 0),
  (v_template_id, 'Observer Name', 'text', true, 1);

  INSERT INTO form_fields (form_template_id, label, field_type, required, options, sort_order) VALUES
  (v_template_id, 'Department', 'select', true, '["Pre-Op", "Procedure Room", "Recovery", "Front Desk"]'::jsonb, 2),
  (v_template_id, 'Staff Role Observed', 'select', true, '["Physician", "CRNA", "Nurse", "Tech", "Other"]'::jsonb, 3),
  (v_template_id, 'Moment Observed', 'select', true, '["Before Patient Contact", "Before Procedure", "After Body Fluid Exposure", "After Patient Contact", "After Touching Surroundings"]'::jsonb, 4);

  INSERT INTO form_fields (form_template_id, label, field_type, required, sort_order) VALUES
  (v_template_id, 'Hand Hygiene Performed', 'boolean', true, 5);

  INSERT INTO form_fields (form_template_id, label, field_type, required, options, sort_order) VALUES
  (v_template_id, 'Method Used', 'select', true, '["Soap and Water", "Alcohol Rub", "None"]'::jsonb, 6);

  INSERT INTO form_fields (form_template_id, label, field_type, required, sort_order) VALUES
  (v_template_id, 'Notes', 'textarea', false, 7);

  -- ============================================================
  -- BINDER 3: Montero (Technical/Safety)
  -- ============================================================
  INSERT INTO binders (location_id, name, description, color, icon, sort_order)
  VALUES (v_location_id, 'Montero', 'Technical and safety inspections', '#F59E0B', 'shield', 2)
  RETURNING id INTO v_binder_id;

  -- Template 8: Emergency Lights Inspection
  INSERT INTO form_templates (binder_id, location_id, name, description, frequency, sort_order)
  VALUES (v_binder_id, v_location_id, 'Emergency Lights Inspection', 'Monthly emergency lighting system test', 'monthly', 0)
  RETURNING id INTO v_template_id;

  INSERT INTO form_fields (form_template_id, label, field_type, required, sort_order) VALUES
  (v_template_id, 'Date', 'date', true, 0),
  (v_template_id, 'Inspector Name', 'text', true, 1);

  INSERT INTO form_fields (form_template_id, label, field_type, required, options, sort_order) VALUES
  (v_template_id, 'Building Area', 'select', true, '["Main Hallway", "Procedure Wing", "Recovery Area", "Storage", "Exit Routes"]'::jsonb, 2);

  INSERT INTO form_fields (form_template_id, label, field_type, required, sort_order) VALUES
  (v_template_id, '30-Second Test Passed', 'boolean', true, 3),
  (v_template_id, 'Light Output Adequate', 'boolean', true, 4),
  (v_template_id, 'Battery Indicator Green', 'boolean', true, 5),
  (v_template_id, 'Physical Damage', 'boolean', true, 6),
  (v_template_id, 'Corrective Action Needed', 'boolean', true, 7),
  (v_template_id, 'Notes', 'textarea', false, 8);

  -- ============================================================
  -- BINDER 4: Nursing Logs
  -- ============================================================
  INSERT INTO binders (location_id, name, description, color, icon, sort_order)
  VALUES (v_location_id, 'Nursing Logs', 'Daily nursing documentation and checks', '#8B5CF6', 'heart-pulse', 3)
  RETURNING id INTO v_binder_id;

  -- Template 5: Daily Narcotic Count
  INSERT INTO form_templates (binder_id, location_id, name, description, frequency, sort_order)
  VALUES (v_binder_id, v_location_id, 'Daily Narcotic Count', 'Daily controlled substance inventory count', 'daily', 0)
  RETURNING id INTO v_template_id;

  INSERT INTO form_fields (form_template_id, label, field_type, required, sort_order) VALUES
  (v_template_id, 'Date', 'date', true, 0),
  (v_template_id, 'AM Count By', 'text', true, 1),
  (v_template_id, 'AM Witness', 'text', true, 2),
  (v_template_id, 'PM Count By', 'text', true, 3),
  (v_template_id, 'PM Witness', 'text', true, 4),
  (v_template_id, 'Fentanyl Count Correct', 'boolean', true, 5),
  (v_template_id, 'Versed Count Correct', 'boolean', true, 6),
  (v_template_id, 'Ephedrine Count Correct', 'boolean', true, 7),
  (v_template_id, 'Discrepancy Found', 'boolean', true, 8),
  (v_template_id, 'Discrepancy Details', 'textarea', false, 9);

  -- Template 6: Crash Cart Daily Checklist
  INSERT INTO form_templates (binder_id, location_id, name, description, frequency, sort_order)
  VALUES (v_binder_id, v_location_id, 'Crash Cart Daily Checklist', 'Daily emergency cart readiness verification', 'daily', 1)
  RETURNING id INTO v_template_id;

  INSERT INTO form_fields (form_template_id, label, field_type, required, sort_order) VALUES
  (v_template_id, 'Date', 'date', true, 0),
  (v_template_id, 'Checked By', 'text', true, 1),
  (v_template_id, 'Defibrillator Functional', 'boolean', true, 2);

  INSERT INTO form_fields (form_template_id, label, field_type, required, options, sort_order) VALUES
  (v_template_id, 'Defibrillator Battery Level', 'select', true, '["Full", "75%", "50%", "25%", "Low"]'::jsonb, 3);

  INSERT INTO form_fields (form_template_id, label, field_type, required, sort_order) VALUES
  (v_template_id, 'Suction Equipment Ready', 'boolean', true, 4);

  INSERT INTO form_fields (form_template_id, label, field_type, required, options, sort_order) VALUES
  (v_template_id, 'Oxygen Tank Level', 'select', true, '["Full", "3/4", "1/2", "1/4", "Empty"]'::jsonb, 5);

  INSERT INTO form_fields (form_template_id, label, field_type, required, sort_order) VALUES
  (v_template_id, 'All Medications Present', 'boolean', true, 6),
  (v_template_id, 'Lock Number Intact', 'boolean', true, 7),
  (v_template_id, 'Lock Number', 'text', true, 8),
  (v_template_id, 'Expiring Medications', 'textarea', false, 9);

  -- ============================================================
  -- BINDER 5: Procedure Logs
  -- ============================================================
  INSERT INTO binders (location_id, name, description, color, icon, sort_order)
  VALUES (v_location_id, 'Procedure Logs', 'Procedure room documentation', '#EC4899', 'clipboard-list', 4)
  RETURNING id INTO v_binder_id;

  -- ============================================================
  -- BINDER 6: Scope Logs
  -- ============================================================
  INSERT INTO binders (location_id, name, description, color, icon, sort_order)
  VALUES (v_location_id, 'Scope Logs', 'Endoscope reprocessing and maintenance', '#06B6D4', 'microscope', 5)
  RETURNING id INTO v_binder_id;

  -- Template 7: Scope Daily Cleaning Log
  INSERT INTO form_templates (binder_id, location_id, name, description, frequency, sort_order)
  VALUES (v_binder_id, v_location_id, 'Scope Daily Cleaning Log', 'Daily endoscope cleaning and reprocessing documentation', 'daily', 0)
  RETURNING id INTO v_template_id;

  INSERT INTO form_fields (form_template_id, label, field_type, required, sort_order) VALUES
  (v_template_id, 'Date', 'date', true, 0),
  (v_template_id, 'Technician', 'text', true, 1),
  (v_template_id, 'Scope Serial Number', 'text', true, 2);

  INSERT INTO form_fields (form_template_id, label, field_type, required, options, sort_order) VALUES
  (v_template_id, 'Scope Type', 'select', true, '["Colonoscope", "Gastroscope", "Duodenoscope", "Bronchoscope"]'::jsonb, 3);

  INSERT INTO form_fields (form_template_id, label, field_type, required, sort_order) VALUES
  (v_template_id, 'Manual Cleaning Complete', 'boolean', true, 4),
  (v_template_id, 'Leak Test Passed', 'boolean', true, 5);

  INSERT INTO form_fields (form_template_id, label, field_type, required, options, sort_order) VALUES
  (v_template_id, 'RESI-TEST Result', 'select', true, '["Pass", "Fail"]'::jsonb, 6),
  (v_template_id, 'Reprocessor Used', 'select', true, '["DSD Edge 1", "DSD Edge 2"]'::jsonb, 7);

  INSERT INTO form_fields (form_template_id, label, field_type, required, sort_order) VALUES
  (v_template_id, 'Reprocessor Cycle Complete', 'boolean', true, 8),
  (v_template_id, 'Disinfectant MEC Verified', 'boolean', true, 9),
  (v_template_id, 'Storage Location', 'text', false, 10),
  (v_template_id, 'Notes', 'textarea', false, 11);

  -- ============================================================
  -- BINDER 7: Yanling (Clinical/Quality)
  -- ============================================================
  INSERT INTO binders (location_id, name, description, color, icon, sort_order)
  VALUES (v_location_id, 'Yanling', 'Clinical quality and regulatory compliance', '#F97316', 'stethoscope', 6)
  RETURNING id INTO v_binder_id;

  -- Template 9: Refrigerator Temperature Log
  INSERT INTO form_templates (binder_id, location_id, name, description, frequency, sort_order)
  VALUES (v_binder_id, v_location_id, 'Refrigerator Temperature Log', 'Daily refrigeration equipment monitoring', 'daily', 0)
  RETURNING id INTO v_template_id;

  INSERT INTO form_fields (form_template_id, label, field_type, required, sort_order) VALUES
  (v_template_id, 'Date', 'date', true, 0),
  (v_template_id, 'Time', 'datetime', true, 1),
  (v_template_id, 'Checked By', 'text', true, 2);

  INSERT INTO form_fields (form_template_id, label, field_type, required, options, sort_order) VALUES
  (v_template_id, 'Refrigerator', 'select', true, '["Medication Fridge", "Specimen Fridge", "Vaccine Fridge"]'::jsonb, 3);

  INSERT INTO form_fields (form_template_id, label, field_type, required, validation_rules, sort_order) VALUES
  (v_template_id, 'Temperature Reading', 'temperature', true, '{"min": 35, "max": 46, "unit": "F"}'::jsonb, 4);

  INSERT INTO form_fields (form_template_id, label, field_type, required, sort_order) VALUES
  (v_template_id, 'Within Acceptable Range', 'boolean', true, 5),
  (v_template_id, 'Corrective Action Taken', 'textarea', false, 6);

  RAISE NOTICE 'Successfully seeded 7 binders with 9 form templates for location: %', v_location_id;

END $$;
