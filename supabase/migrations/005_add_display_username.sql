-- Migration: 005_add_display_username
-- Add displayUsername column required by Better Auth username plugin

ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "displayUsername" TEXT;
