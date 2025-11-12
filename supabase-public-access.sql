-- Update RLS policies for universal shared access
-- Run this in your Supabase SQL Editor

-- Option 1: Allow all access (simple approach)
DROP POLICY IF EXISTS "Users can view their own scenarios" ON scenarios;
DROP POLICY IF EXISTS "Users can insert their own scenarios" ON scenarios;
DROP POLICY IF EXISTS "Users can update their own scenarios" ON scenarios;
DROP POLICY IF EXISTS "Users can delete their own scenarios" ON scenarios;

CREATE POLICY "Anyone can view scenarios"
  ON scenarios FOR SELECT
  USING (true);

CREATE POLICY "Anyone can insert scenarios"
  ON scenarios FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update scenarios"
  ON scenarios FOR UPDATE
  USING (true);

CREATE POLICY "Anyone can delete scenarios"
  ON scenarios FOR DELETE
  USING (true);

-- Update plans policies
DROP POLICY IF EXISTS "Users can view their plans" ON plans;
DROP POLICY IF EXISTS "Users can insert plans" ON plans;
DROP POLICY IF EXISTS "Users can update plans" ON plans;
DROP POLICY IF EXISTS "Users can delete plans" ON plans;

CREATE POLICY "Anyone can view plans"
  ON plans FOR SELECT
  USING (true);

CREATE POLICY "Anyone can insert plans"
  ON plans FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update plans"
  ON plans FOR UPDATE
  USING (true);

CREATE POLICY "Anyone can delete plans"
  ON plans FOR DELETE
  USING (true);

-- Update GTM groups policies
DROP POLICY IF EXISTS "Users can view their GTM groups" ON gtm_groups;
DROP POLICY IF EXISTS "Users can insert GTM groups" ON gtm_groups;
DROP POLICY IF EXISTS "Users can update GTM groups" ON gtm_groups;
DROP POLICY IF EXISTS "Users can delete GTM groups" ON gtm_groups;

CREATE POLICY "Anyone can view GTM groups"
  ON gtm_groups FOR SELECT
  USING (true);

CREATE POLICY "Anyone can insert GTM groups"
  ON gtm_groups FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update GTM groups"
  ON gtm_groups FOR UPDATE
  USING (true);

CREATE POLICY "Anyone can delete GTM groups"
  ON gtm_groups FOR DELETE
  USING (true);

-- Update segments policies
DROP POLICY IF EXISTS "Users can view their segments" ON segments;
DROP POLICY IF EXISTS "Users can insert segments" ON segments;
DROP POLICY IF EXISTS "Users can update segments" ON segments;
DROP POLICY IF EXISTS "Users can delete segments" ON segments;

CREATE POLICY "Anyone can view segments"
  ON segments FOR SELECT
  USING (true);

CREATE POLICY "Anyone can insert segments"
  ON segments FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update segments"
  ON segments FOR UPDATE
  USING (true);

CREATE POLICY "Anyone can delete segments"
  ON segments FOR DELETE
  USING (true);
