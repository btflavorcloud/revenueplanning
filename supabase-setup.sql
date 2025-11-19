-- GTM Revenue Planner Database Schema
-- Run this in your Supabase SQL Editor

-- Scenarios table (master groups)
CREATE TABLE scenarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL, -- 'Baseline', 'Stretch', 'Custom'
  target_shipments INTEGER DEFAULT 400000,
  rps DECIMAL(10,2) DEFAULT 40.00,
  collapsed BOOLEAN DEFAULT false,
  settings JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- GTM Groups table (sales, marketing, partnerships)
CREATE TABLE gtm_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id UUID REFERENCES scenarios(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL, -- 'Sales', 'Marketing', 'Partnerships', 'Custom'
  collapsed BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Segments table (SMB, MM, ENT, etc.)
CREATE TABLE segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gtm_group_id UUID REFERENCES gtm_groups(id) ON DELETE CASCADE,
  segment_type TEXT NOT NULL, -- 'SMB', 'MM', 'ENT', 'ENT+', 'Flagship'
  spm INTEGER NOT NULL,
  launches JSONB DEFAULT '[]'::jsonb, -- Array of 12 months
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Conversion rates table (per segment type)
CREATE TABLE conversion_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  segment_type TEXT UNIQUE NOT NULL,
  opp_to_close_pct DECIMAL(5,2) NOT NULL,
  avg_days_to_close INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Default conversion rates
INSERT INTO conversion_rates (user_id, segment_type, opp_to_close_pct, avg_days_to_close) VALUES
  (NULL, 'SMB', 25, 60),
  (NULL, 'MM', 20, 90),
  (NULL, 'ENT', 20, 120),
  (NULL, 'ENT+', 10, 180),
  (NULL, 'Flagship', 10, 180);

-- Row Level Security (RLS)
ALTER TABLE scenarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE gtm_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversion_rates ENABLE ROW LEVEL SECURITY;

-- Policies for scenarios
CREATE POLICY "Users can view their own scenarios"
  ON scenarios FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own scenarios"
  ON scenarios FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own scenarios"
  ON scenarios FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own scenarios"
  ON scenarios FOR DELETE
  USING (auth.uid() = user_id);

-- Policies for gtm_groups
CREATE POLICY "Users can view their GTM groups"
  ON gtm_groups FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM scenarios
      WHERE scenarios.id = gtm_groups.scenario_id
      AND scenarios.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert GTM groups"
  ON gtm_groups FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM scenarios
      WHERE scenarios.id = gtm_groups.scenario_id
      AND scenarios.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update GTM groups"
  ON gtm_groups FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM scenarios
      WHERE scenarios.id = gtm_groups.scenario_id
      AND scenarios.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete GTM groups"
  ON gtm_groups FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM scenarios
      WHERE scenarios.id = gtm_groups.scenario_id
      AND scenarios.user_id = auth.uid()
    )
  );

-- Policies for segments
CREATE POLICY "Users can view their segments"
  ON segments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM gtm_groups
      JOIN scenarios ON scenarios.id = gtm_groups.scenario_id
      WHERE gtm_groups.id = segments.gtm_group_id
      AND scenarios.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert segments"
  ON segments FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM gtm_groups
      JOIN scenarios ON scenarios.id = gtm_groups.scenario_id
      WHERE gtm_groups.id = segments.gtm_group_id
      AND scenarios.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update segments"
  ON segments FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM gtm_groups
      JOIN scenarios ON scenarios.id = gtm_groups.scenario_id
      WHERE gtm_groups.id = segments.gtm_group_id
      AND scenarios.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete segments"
  ON segments FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM gtm_groups
      JOIN scenarios ON scenarios.id = gtm_groups.scenario_id
      WHERE gtm_groups.id = segments.gtm_group_id
      AND scenarios.user_id = auth.uid()
    )
  );

-- Conversion rates policies
CREATE POLICY "Users can view default conversion rates"
  ON conversion_rates FOR SELECT
  USING (user_id IS NULL OR user_id = auth.uid());

CREATE POLICY "Users can insert their own conversion rates"
  ON conversion_rates FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own conversion rates"
  ON conversion_rates FOR UPDATE
  USING (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX idx_scenarios_user_id ON scenarios(user_id);
CREATE INDEX idx_gtm_groups_scenario_id ON gtm_groups(scenario_id);
CREATE INDEX idx_segments_gtm_group_id ON segments(gtm_group_id);
CREATE INDEX idx_conversion_rates_user_id ON conversion_rates(user_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for scenarios updated_at
CREATE TRIGGER update_scenarios_updated_at
    BEFORE UPDATE ON scenarios
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
