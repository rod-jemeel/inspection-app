-- seed.sql
-- Development seed data for inspection PWA
--
-- IMPORTANT: Better Auth users must be created FIRST before running this seed.
-- Run `pnpm db:migrate` to create Better Auth tables, then create users via the app.
-- After users exist, replace the placeholder user_ids below with real user IDs from the "user" table.
--
-- Placeholder user_ids used:
--   'user_owner_001'     -> Replace with actual owner user.id
--   'user_admin_001'     -> Replace with actual admin user.id
--   'user_inspector_001' -> Replace with actual inspector user.id

-- Clear existing data (in reverse order of dependencies)
TRUNCATE TABLE notification_outbox CASCADE;
TRUNCATE TABLE invite_codes CASCADE;
TRUNCATE TABLE inspection_events CASCADE;
TRUNCATE TABLE inspection_signatures CASCADE;
TRUNCATE TABLE inspection_instances CASCADE;
TRUNCATE TABLE inspection_templates CASCADE;
TRUNCATE TABLE profile_locations CASCADE;
TRUNCATE TABLE profiles CASCADE;
TRUNCATE TABLE locations CASCADE;

-- =====================================================
-- LOCATIONS (2 locations with different timezones)
-- =====================================================
INSERT INTO locations (id, name, timezone, active, created_at, updated_at)
VALUES
  (
    '11111111-1111-1111-1111-111111111111',
    'Downtown Clinic',
    'America/New_York',
    true,
    NOW(),
    NOW()
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    'Eastside Office',
    'America/Chicago',
    true,
    NOW(),
    NOW()
  );

-- =====================================================
-- PROFILES (3 profiles with different roles)
-- =====================================================
INSERT INTO profiles (id, user_id, full_name, email, phone, role, created_at, updated_at)
VALUES
  (
    '33333333-3333-3333-3333-333333333333',
    'user_owner_001',
    'Jane Owner',
    'jane@example.com',
    '+1-555-0100',
    'owner',
    NOW(),
    NOW()
  ),
  (
    '44444444-4444-4444-4444-444444444444',
    'user_admin_001',
    'Bob Admin',
    'bob@example.com',
    '+1-555-0200',
    'admin',
    NOW(),
    NOW()
  ),
  (
    '55555555-5555-5555-5555-555555555555',
    'user_inspector_001',
    'Sam Inspector',
    'sam@example.com',
    '+1-555-0300',
    'inspector',
    NOW(),
    NOW()
  );

-- =====================================================
-- PROFILE_LOCATIONS (all 3 profiles linked to both locations)
-- =====================================================
INSERT INTO profile_locations (profile_id, location_id)
VALUES
  -- Owner has access to both locations
  ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111'),
  ('33333333-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222'),

  -- Admin has access to both locations
  ('44444444-4444-4444-4444-444444444444', '11111111-1111-1111-1111-111111111111'),
  ('44444444-4444-4444-4444-444444444444', '22222222-2222-2222-2222-222222222222'),

  -- Inspector has access to both locations
  ('55555555-5555-5555-5555-555555555555', '11111111-1111-1111-1111-111111111111'),
  ('55555555-5555-5555-5555-555555555555', '22222222-2222-2222-2222-222222222222');

-- =====================================================
-- INSPECTION_TEMPLATES (3 templates per location = 6 total)
-- =====================================================
INSERT INTO inspection_templates (
  id,
  location_id,
  task,
  description,
  frequency,
  default_assignee_profile_id,
  active,
  created_by,
  created_at,
  updated_at
)
VALUES
  -- Location 1 (Downtown Clinic) templates
  (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '11111111-1111-1111-1111-111111111111',
    'Weekly Fire Extinguisher Check',
    'Verify all fire extinguishers are accessible, properly charged, and have valid inspection tags.',
    'weekly',
    '55555555-5555-5555-5555-555555555555',
    true,
    'user_owner_001',
    NOW(),
    NOW()
  ),
  (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa02',
    '11111111-1111-1111-1111-111111111111',
    'Monthly Elevator Inspection',
    'Complete safety inspection of elevator systems including emergency stops, doors, and load capacity.',
    'monthly',
    '55555555-5555-5555-5555-555555555555',
    true,
    'user_owner_001',
    NOW(),
    NOW()
  ),
  (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa03',
    '11111111-1111-1111-1111-111111111111',
    'Yearly HVAC Assessment',
    'Comprehensive HVAC system evaluation including filters, ducts, and climate control accuracy.',
    'yearly',
    '44444444-4444-4444-4444-444444444444',
    true,
    'user_owner_001',
    NOW(),
    NOW()
  ),

  -- Location 2 (Eastside Office) templates
  (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa04',
    '22222222-2222-2222-2222-222222222222',
    'Weekly Safety Walk',
    'Walk-through inspection for hazards, blocked exits, proper signage, and general safety compliance.',
    'weekly',
    '55555555-5555-5555-5555-555555555555',
    true,
    'user_admin_001',
    NOW(),
    NOW()
  ),
  (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa05',
    '22222222-2222-2222-2222-222222222222',
    'Monthly Equipment Calibration',
    'Calibrate and verify accuracy of all measurement and testing equipment.',
    'monthly',
    '44444444-4444-4444-4444-444444444444',
    true,
    'user_admin_001',
    NOW(),
    NOW()
  ),
  (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa06',
    '22222222-2222-2222-2222-222222222222',
    'Yearly Building Structural Review',
    'Annual structural integrity assessment including foundation, walls, roof, and load-bearing elements.',
    'yearly',
    '44444444-4444-4444-4444-444444444444',
    true,
    'user_admin_001',
    NOW(),
    NOW()
  );

-- =====================================================
-- INSPECTION_INSTANCES (5 instances across various statuses)
-- =====================================================
INSERT INTO inspection_instances (
  id,
  template_id,
  location_id,
  due_at,
  assigned_to_profile_id,
  assigned_to_email,
  status,
  remarks,
  created_by,
  created_at
)
VALUES
  -- Instance 1: Pending (Downtown Clinic, Weekly Fire Extinguisher, scheduled for tomorrow)
  (
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb01',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '11111111-1111-1111-1111-111111111111',
    (CURRENT_DATE + INTERVAL '1 day') + TIME '09:00:00',
    '55555555-5555-5555-5555-555555555555',
    'sam@example.com',
    'pending',
    NULL,
    'user_owner_001',
    NOW()
  ),

  -- Instance 2: In Progress (Eastside Office, Weekly Safety Walk, scheduled for today)
  (
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb02',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa04',
    '22222222-2222-2222-2222-222222222222',
    CURRENT_DATE + TIME '10:00:00',
    '55555555-5555-5555-5555-555555555555',
    'sam@example.com',
    'in_progress',
    'Currently performing safety walk-through',
    'user_admin_001',
    NOW()
  ),

  -- Instance 3: Failed (Downtown Clinic, Monthly Elevator, scheduled yesterday, failed yesterday)
  (
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb03',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa02',
    '11111111-1111-1111-1111-111111111111',
    (CURRENT_DATE - INTERVAL '1 day') + TIME '08:00:00',
    '55555555-5555-5555-5555-555555555555',
    'sam@example.com',
    'failed',
    'Emergency stop button stuck - requires immediate repair',
    'user_owner_001',
    NOW() - INTERVAL '1 day'
  ),

  -- Instance 4: Passed (Eastside Office, Monthly Equipment Calibration, scheduled 2 days ago, passed 2 days ago)
  (
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb04',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa05',
    '22222222-2222-2222-2222-222222222222',
    (CURRENT_DATE - INTERVAL '2 days') + TIME '14:00:00',
    '44444444-4444-4444-4444-444444444444',
    'bob@example.com',
    'passed',
    'All equipment within calibration tolerance',
    'user_admin_001',
    NOW() - INTERVAL '2 days'
  ),

  -- Instance 5: Void (Downtown Clinic, Yearly HVAC, scheduled 3 days ago, voided)
  (
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb05',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa03',
    '11111111-1111-1111-1111-111111111111',
    (CURRENT_DATE - INTERVAL '3 days') + TIME '07:00:00',
    '44444444-4444-4444-4444-444444444444',
    'bob@example.com',
    'void',
    'Cancelled due to building closure for renovation',
    'user_owner_001',
    NOW() - INTERVAL '3 days'
  );

-- Update timestamps for completed/failed instances
UPDATE inspection_instances
SET
  inspected_at = created_at + INTERVAL '2 hours',
  failed_at = created_at + INTERVAL '2 hours'
WHERE id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb03';

UPDATE inspection_instances
SET
  inspected_at = created_at + INTERVAL '1 hour',
  passed_at = created_at + INTERVAL '1 hour'
WHERE id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb04';

-- =====================================================
-- INSPECTION_SIGNATURES (for completed instances)
-- =====================================================
INSERT INTO inspection_signatures (
  id,
  inspection_instance_id,
  signed_by_profile_id,
  signed_at,
  signature_image_path,
  signature_points,
  device_meta
)
VALUES
  -- Signature for failed inspection (inspector signature)
  (
    'cccccccc-cccc-cccc-cccc-cccccccccc01',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb03',
    '55555555-5555-5555-5555-555555555555',
    (NOW() - INTERVAL '1 day') + INTERVAL '2 hours',
    'signatures/failed-elevator-inspector.png',
    '{"points": [{"x": 10, "y": 20}, {"x": 30, "y": 40}]}',
    '{"device": "iPad Pro", "os": "iOS 17", "browser": "Safari"}'
  ),

  -- Signatures for passed inspection (inspector + owner)
  (
    'cccccccc-cccc-cccc-cccc-cccccccccc02',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb04',
    '44444444-4444-4444-4444-444444444444',
    (NOW() - INTERVAL '2 days') + INTERVAL '1 hour',
    'signatures/passed-calibration-admin.png',
    '{"points": [{"x": 15, "y": 25}, {"x": 35, "y": 45}]}',
    '{"device": "iPhone 15", "os": "iOS 17", "browser": "Safari"}'
  ),
  (
    'cccccccc-cccc-cccc-cccc-cccccccccc03',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb04',
    '33333333-3333-3333-3333-333333333333',
    (NOW() - INTERVAL '2 days') + INTERVAL '2 hours',
    'signatures/passed-calibration-owner.png',
    '{"points": [{"x": 12, "y": 22}, {"x": 32, "y": 42}]}',
    '{"device": "Desktop", "os": "macOS", "browser": "Chrome"}'
  );

-- =====================================================
-- INSPECTION_EVENTS (audit trail for completed instances)
-- =====================================================
INSERT INTO inspection_events (
  id,
  inspection_instance_id,
  event_type,
  event_at,
  actor_profile_id,
  payload
)
VALUES
  -- Events for Instance 1 (pending)
  (
    'dddddddd-dddd-dddd-dddd-dddddddddd01',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb01',
    'created',
    NOW(),
    '33333333-3333-3333-3333-333333333333',
    '{"note": "Auto-generated from template"}'
  ),
  (
    'dddddddd-dddd-dddd-dddd-dddddddddd02',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb01',
    'assigned',
    NOW(),
    '33333333-3333-3333-3333-333333333333',
    '{"assigned_to": "Sam Inspector", "assigned_email": "sam@example.com"}'
  ),

  -- Events for Instance 2 (in_progress)
  (
    'dddddddd-dddd-dddd-dddd-dddddddddd03',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb02',
    'created',
    NOW(),
    '44444444-4444-4444-4444-444444444444',
    '{"note": "Auto-generated from template"}'
  ),
  (
    'dddddddd-dddd-dddd-dddd-dddddddddd04',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb02',
    'assigned',
    NOW(),
    '44444444-4444-4444-4444-444444444444',
    '{"assigned_to": "Sam Inspector", "assigned_email": "sam@example.com"}'
  ),
  (
    'dddddddd-dddd-dddd-dddd-dddddddddd05',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb02',
    'started',
    NOW() + INTERVAL '10 minutes',
    '55555555-5555-5555-5555-555555555555',
    '{"note": "Inspection started"}'
  ),

  -- Events for Instance 3 (failed)
  (
    'dddddddd-dddd-dddd-dddd-dddddddddd06',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb03',
    'created',
    NOW() - INTERVAL '1 day',
    '33333333-3333-3333-3333-333333333333',
    '{"note": "Auto-generated from template"}'
  ),
  (
    'dddddddd-dddd-dddd-dddd-dddddddddd07',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb03',
    'assigned',
    NOW() - INTERVAL '1 day',
    '33333333-3333-3333-3333-333333333333',
    '{"assigned_to": "Sam Inspector", "assigned_email": "sam@example.com"}'
  ),
  (
    'dddddddd-dddd-dddd-dddd-dddddddddd08',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb03',
    'started',
    (NOW() - INTERVAL '1 day') + INTERVAL '30 minutes',
    '55555555-5555-5555-5555-555555555555',
    '{"note": "Inspection started"}'
  ),
  (
    'dddddddd-dddd-dddd-dddd-dddddddddd09',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb03',
    'failed',
    (NOW() - INTERVAL '1 day') + INTERVAL '2 hours',
    '55555555-5555-5555-5555-555555555555',
    '{"reason": "Emergency stop button stuck - requires immediate repair"}'
  ),
  (
    'dddddddd-dddd-dddd-dddd-dddddddddd10',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb03',
    'signed',
    (NOW() - INTERVAL '1 day') + INTERVAL '2 hours',
    '55555555-5555-5555-5555-555555555555',
    '{"signer": "Sam Inspector", "signature_id": "cccccccc-cccc-cccc-cccc-cccccccccc01"}'
  ),

  -- Events for Instance 4 (passed)
  (
    'dddddddd-dddd-dddd-dddd-dddddddddd11',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb04',
    'created',
    NOW() - INTERVAL '2 days',
    '44444444-4444-4444-4444-444444444444',
    '{"note": "Auto-generated from template"}'
  ),
  (
    'dddddddd-dddd-dddd-dddd-dddddddddd12',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb04',
    'assigned',
    NOW() - INTERVAL '2 days',
    '44444444-4444-4444-4444-444444444444',
    '{"assigned_to": "Bob Admin", "assigned_email": "bob@example.com"}'
  ),
  (
    'dddddddd-dddd-dddd-dddd-dddddddddd13',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb04',
    'started',
    (NOW() - INTERVAL '2 days') + INTERVAL '15 minutes',
    '44444444-4444-4444-4444-444444444444',
    '{"note": "Inspection started"}'
  ),
  (
    'dddddddd-dddd-dddd-dddd-dddddddddd14',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb04',
    'passed',
    (NOW() - INTERVAL '2 days') + INTERVAL '1 hour',
    '44444444-4444-4444-4444-444444444444',
    '{"note": "All equipment within calibration tolerance"}'
  ),
  (
    'dddddddd-dddd-dddd-dddd-dddddddddd15',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb04',
    'signed',
    (NOW() - INTERVAL '2 days') + INTERVAL '1 hour',
    '44444444-4444-4444-4444-444444444444',
    '{"signer": "Bob Admin", "signature_id": "cccccccc-cccc-cccc-cccc-cccccccccc02"}'
  ),
  (
    'dddddddd-dddd-dddd-dddd-dddddddddd16',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb04',
    'signed',
    (NOW() - INTERVAL '2 days') + INTERVAL '2 hours',
    '33333333-3333-3333-3333-333333333333',
    '{"signer": "Jane Owner", "signature_id": "cccccccc-cccc-cccc-cccc-cccccccccc03"}'
  ),

  -- Events for Instance 5 (void)
  (
    'dddddddd-dddd-dddd-dddd-dddddddddd17',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb05',
    'created',
    NOW() - INTERVAL '3 days',
    '33333333-3333-3333-3333-333333333333',
    '{"note": "Auto-generated from template"}'
  ),
  (
    'dddddddd-dddd-dddd-dddd-dddddddddd18',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb05',
    'assigned',
    NOW() - INTERVAL '3 days',
    '33333333-3333-3333-3333-333333333333',
    '{"assigned_to": "Bob Admin", "assigned_email": "bob@example.com"}'
  ),
  (
    'dddddddd-dddd-dddd-dddd-dddddddddd19',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb05',
    'comment',
    (NOW() - INTERVAL '3 days') + INTERVAL '1 hour',
    '33333333-3333-3333-3333-333333333333',
    '{"comment": "Voiding inspection due to building closure for renovation"}'
  );

-- =====================================================
-- Verification queries
-- =====================================================
-- Uncomment to verify seed data after running:

-- SELECT 'Locations' AS table_name, COUNT(*) AS count FROM locations
-- UNION ALL
-- SELECT 'Profiles', COUNT(*) FROM profiles
-- UNION ALL
-- SELECT 'Profile_Locations', COUNT(*) FROM profile_locations
-- UNION ALL
-- SELECT 'Inspection_Templates', COUNT(*) FROM inspection_templates
-- UNION ALL
-- SELECT 'Inspection_Instances', COUNT(*) FROM inspection_instances
-- UNION ALL
-- SELECT 'Inspection_Signatures', COUNT(*) FROM inspection_signatures
-- UNION ALL
-- SELECT 'Inspection_Events', COUNT(*) FROM inspection_events;
