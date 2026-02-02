-- Migration: Add default_assignee_email to inspection_templates
-- Allows assigning inspectors by email before they have an account

ALTER TABLE inspection_templates
ADD COLUMN default_assignee_email TEXT;

-- Add comment for documentation
COMMENT ON COLUMN inspection_templates.default_assignee_email IS
  'Email of the default inspector to assign. Can be set before the inspector registers.';

-- Update the covering index to include the new column
DROP INDEX IF EXISTS idx_templates_location_active;
CREATE INDEX idx_templates_location_active
  ON inspection_templates(location_id)
  INCLUDE (task, frequency, default_assignee_profile_id, default_assignee_email)
  WHERE active = true;
