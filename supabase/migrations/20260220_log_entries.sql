-- Migration: Create log_entries table
-- This table stores all form data for the /logs system

CREATE TABLE IF NOT EXISTS log_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  log_type TEXT NOT NULL,
  log_date DATE NOT NULL,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  submitted_by_profile_id UUID NOT NULL REFERENCES profiles(id),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'complete')),
  log_key TEXT NOT NULL DEFAULT ''::text,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unique constraint for upsert
ALTER TABLE log_entries 
ADD CONSTRAINT log_entries_unique UNIQUE (location_id, log_type, log_key, log_date);

-- Indexes for common queries
CREATE INDEX idx_log_entries_location ON log_entries(location_id);
CREATE INDEX idx_log_entries_type ON log_entries(log_type);
CREATE INDEX idx_log_entries_date ON log_entries(log_date DESC);
CREATE INDEX idx_log_entries_location_type ON log_entries(location_id, log_type);

-- Row Level Security
ALTER TABLE log_entries ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only access logs for their locations
CREATE POLICY "Users can view logs for their locations" ON log_entries
  FOR SELECT USING (
    location_id IN (
      SELECT location_id 
      FROM profile_locations 
      WHERE profile_id = auth.uid()::uuid
    )
  );

-- Policy: Users can insert logs for their locations
CREATE POLICY "Users can insert logs for their locations" ON log_entries
  FOR INSERT WITH CHECK (
    location_id IN (
      SELECT location_id 
      FROM profile_locations 
      WHERE profile_id = auth.uid()::uuid
    )
  );

-- Policy: Users can update logs for their locations
CREATE POLICY "Users can update logs for their locations" ON log_entries
  FOR UPDATE USING (
    location_id IN (
      SELECT location_id 
      FROM profile_locations 
      WHERE profile_id = auth.uid()::uuid
    )
  );

-- Policy: Users can delete logs for their locations  
CREATE POLICY "Users can delete logs for their locations" ON log_entries
  FOR DELETE USING (
    location_id IN (
      SELECT location_id 
      FROM profile_locations 
      WHERE profile_id = auth.uid()::uuid
    )
  );
