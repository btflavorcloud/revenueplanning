-- GTM Execution Plans Table
-- This table stores RICE scoring and resource requirements for GTM motions

CREATE TABLE gtm_execution_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gtm_group_id UUID REFERENCES gtm_groups(id) ON DELETE CASCADE UNIQUE,

  -- RICE Scores
  reach INTEGER CHECK (reach IN (1, 10, 100, 1000)), -- Customer reach: 1, 10, 100, or 1000 customers
  confidence INTEGER CHECK (confidence IN (20, 50, 80)), -- Execution confidence: 20%, 50%, or 80%

  -- Resource Costing
  budget_usd INTEGER DEFAULT 0, -- Budget required in USD
  headcount_needed JSONB DEFAULT '[]'::jsonb, -- Array of roles: [{role: "Sales", count: 2}]

  -- Dependencies (free-form text for flexibility)
  partner_dependencies TEXT, -- 3rd party relationships needed
  product_requirements TEXT, -- Product build requirements
  carrier_requirements TEXT, -- Carrier network requirements

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Row Level Security
ALTER TABLE gtm_execution_plans ENABLE ROW LEVEL SECURITY;

-- Policies for gtm_execution_plans
CREATE POLICY "Users can view their execution plans"
  ON gtm_execution_plans FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM gtm_groups
      JOIN plans ON plans.id = gtm_groups.plan_id
      JOIN scenarios ON scenarios.id = plans.scenario_id
      WHERE gtm_groups.id = gtm_execution_plans.gtm_group_id
      AND scenarios.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert execution plans"
  ON gtm_execution_plans FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM gtm_groups
      JOIN plans ON plans.id = gtm_groups.plan_id
      JOIN scenarios ON scenarios.id = plans.scenario_id
      WHERE gtm_groups.id = gtm_execution_plans.gtm_group_id
      AND scenarios.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update execution plans"
  ON gtm_execution_plans FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM gtm_groups
      JOIN plans ON plans.id = gtm_groups.plan_id
      JOIN scenarios ON scenarios.id = plans.scenario_id
      WHERE gtm_groups.id = gtm_execution_plans.gtm_group_id
      AND scenarios.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete execution plans"
  ON gtm_execution_plans FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM gtm_groups
      JOIN plans ON plans.id = gtm_groups.plan_id
      JOIN scenarios ON scenarios.id = plans.scenario_id
      WHERE gtm_groups.id = gtm_execution_plans.gtm_group_id
      AND scenarios.user_id = auth.uid()
    )
  );

-- Indexes for performance
CREATE INDEX idx_gtm_execution_plans_gtm_group_id ON gtm_execution_plans(gtm_group_id);

-- Trigger for updated_at timestamp
CREATE TRIGGER update_gtm_execution_plans_updated_at
    BEFORE UPDATE ON gtm_execution_plans
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
