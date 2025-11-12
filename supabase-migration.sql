-- Migration to add Plans table between Scenarios and GTM Groups
-- Run this in your Supabase SQL Editor

-- Create plans table
CREATE TABLE IF NOT EXISTS plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id UUID REFERENCES scenarios(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- 'Baseline' or 'Stretch'
  collapsed BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Update gtm_groups to reference plans instead of scenarios
ALTER TABLE gtm_groups
  ADD COLUMN IF NOT EXISTS plan_id UUID REFERENCES plans(id) ON DELETE CASCADE;

-- Migrate existing data
-- For each scenario, create Baseline and Stretch plans
INSERT INTO plans (scenario_id, type, collapsed)
SELECT id, 'Baseline', false FROM scenarios
WHERE NOT EXISTS (SELECT 1 FROM plans WHERE scenario_id = scenarios.id AND type = 'Baseline');

INSERT INTO plans (scenario_id, type, collapsed)
SELECT id, 'Stretch', false FROM scenarios
WHERE NOT EXISTS (SELECT 1 FROM plans WHERE scenario_id = scenarios.id AND type = 'Stretch');

-- Update existing gtm_groups to link to plans
-- Assign gtm_groups to Baseline plan by default (you can manually reassign in the UI)
UPDATE gtm_groups g
SET plan_id = (
  SELECT p.id
  FROM plans p
  WHERE p.scenario_id = g.scenario_id
  AND p.type = 'Baseline'
  LIMIT 1
)
WHERE plan_id IS NULL;

-- Make plan_id NOT NULL after migration
ALTER TABLE gtm_groups ALTER COLUMN plan_id SET NOT NULL;

-- Add RLS policies for plans
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their plans"
  ON plans FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM scenarios
      WHERE scenarios.id = plans.scenario_id
      AND scenarios.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert plans"
  ON plans FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM scenarios
      WHERE scenarios.id = plans.scenario_id
      AND scenarios.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update plans"
  ON plans FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM scenarios
      WHERE scenarios.id = plans.scenario_id
      AND scenarios.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete plans"
  ON plans FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM scenarios
      WHERE scenarios.id = plans.scenario_id
      AND scenarios.user_id = auth.uid()
    )
  );

-- Update GTM groups policies to use plans
DROP POLICY IF EXISTS "Users can view their GTM groups" ON gtm_groups;
DROP POLICY IF EXISTS "Users can insert GTM groups" ON gtm_groups;
DROP POLICY IF EXISTS "Users can update GTM groups" ON gtm_groups;
DROP POLICY IF EXISTS "Users can delete GTM groups" ON gtm_groups;

CREATE POLICY "Users can view their GTM groups"
  ON gtm_groups FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM plans
      JOIN scenarios ON scenarios.id = plans.scenario_id
      WHERE plans.id = gtm_groups.plan_id
      AND scenarios.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert GTM groups"
  ON gtm_groups FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM plans
      JOIN scenarios ON scenarios.id = plans.scenario_id
      WHERE plans.id = gtm_groups.plan_id
      AND scenarios.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update GTM groups"
  ON gtm_groups FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM plans
      JOIN scenarios ON scenarios.id = plans.scenario_id
      WHERE plans.id = gtm_groups.plan_id
      AND scenarios.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete GTM groups"
  ON gtm_groups FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM plans
      JOIN scenarios ON scenarios.id = plans.scenario_id
      WHERE plans.id = gtm_groups.plan_id
      AND scenarios.user_id = auth.uid()
    )
  );

-- Add index
CREATE INDEX IF NOT EXISTS idx_plans_scenario_id ON plans(scenario_id);
CREATE INDEX IF NOT EXISTS idx_gtm_groups_plan_id ON gtm_groups(plan_id);

-- Remove old scenario_id column from gtm_groups (optional - can keep for backwards compatibility)
-- ALTER TABLE gtm_groups DROP COLUMN IF EXISTS scenario_id;
