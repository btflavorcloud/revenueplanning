-- Shared Resources Table
-- Stores reusable resources (people) that can be assigned to multiple GTM motions

CREATE TABLE shared_resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id UUID REFERENCES scenarios(id) ON DELETE CASCADE,
  name TEXT NOT NULL, -- e.g., "Sarah - Event Manager", "John - GTM Engineer"
  role TEXT NOT NULL, -- e.g., "Event Manager", "GTM Engineer", "Sales"
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add resource_ids column to gtm_execution_plans (array of shared_resource IDs)
ALTER TABLE gtm_execution_plans
ADD COLUMN resource_ids JSONB DEFAULT '[]'::jsonb;

-- Disable RLS for shared_resources (matching the pattern of other tables)
ALTER TABLE shared_resources DISABLE ROW LEVEL SECURITY;

-- Indexes for performance
CREATE INDEX idx_shared_resources_scenario_id ON shared_resources(scenario_id);
