-- Add signature and initials columns to profiles table
-- Allows users to store their signature image and default initials
-- for one-click signing across all log forms.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS signature_image TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS default_initials TEXT DEFAULT NULL;

COMMENT ON COLUMN profiles.signature_image IS 'Base64-encoded PNG of user signature for one-click signing';
COMMENT ON COLUMN profiles.default_initials IS 'Default initials (2-4 chars) for quick log form signing';
