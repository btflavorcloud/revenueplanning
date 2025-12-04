-- Add version history support for scenarios
-- Run this in your Supabase SQL Editor

-- Create scenario_versions table
CREATE TABLE IF NOT EXISTS scenario_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id UUID REFERENCES scenarios(id) ON DELETE CASCADE,
  version_name TEXT,
  is_auto_snapshot BOOLEAN DEFAULT false,
  snapshot_data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_scenario_versions_scenario_id
  ON scenario_versions(scenario_id);
CREATE INDEX IF NOT EXISTS idx_scenario_versions_created_at
  ON scenario_versions(created_at DESC);

-- Add last_auto_snapshot_at to scenarios table
ALTER TABLE scenarios
  ADD COLUMN IF NOT EXISTS last_auto_snapshot_at TIMESTAMP WITH TIME ZONE;

-- No RLS needed since RLS is disabled for shared collaborative model
