-- Migration: 20260207_revert_roles_add_editor
-- Revert to 4 original roles (remove compliance_officer, charge_nurse)
-- Add can_edit flag to binder_assignments for viewer/editor permission model

-- ============================================================================
-- REVERT ROLES: Back to 4 original roles
-- ============================================================================

-- Remove any profiles that might have the new roles (safety net)
UPDATE profiles SET role = 'admin' WHERE role IN ('compliance_officer', 'charge_nurse');

-- Revert role constraint to 4 original roles
ALTER TABLE profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check,
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('owner', 'admin', 'nurse', 'inspector'));

-- ============================================================================
-- EDITOR PERMISSION: Add can_edit to binder_assignments
-- ============================================================================

-- Add can_edit column to binder_assignments (default false = viewer only)
ALTER TABLE binder_assignments
  ADD COLUMN IF NOT EXISTS can_edit BOOLEAN NOT NULL DEFAULT FALSE;

-- Owner and admin always have implicit edit rights (handled in app logic),
-- so we don't need to set can_edit for them in the DB.
