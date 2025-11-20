-- Comprehensive RLS Disable Script
-- This script drops all RLS policies and disables RLS on all tables
-- Run this in your Supabase SQL Editor to enable shared collaborative access

-- Drop all existing policies on scenarios table
DROP POLICY IF EXISTS "Users can view their own scenarios" ON scenarios;
DROP POLICY IF EXISTS "Users can create scenarios" ON scenarios;
DROP POLICY IF EXISTS "Users can update their own scenarios" ON scenarios;
DROP POLICY IF EXISTS "Users can delete their own scenarios" ON scenarios;

-- Drop all existing policies on plans table
DROP POLICY IF EXISTS "Users can view plans for their scenarios" ON plans;
DROP POLICY IF EXISTS "Users can insert plans for their scenarios" ON plans;
DROP POLICY IF EXISTS "Users can update plans for their scenarios" ON plans;
DROP POLICY IF EXISTS "Users can delete plans for their scenarios" ON plans;

-- Drop all existing policies on gtm_groups table
DROP POLICY IF EXISTS "Users can view GTM groups for their scenarios" ON gtm_groups;
DROP POLICY IF EXISTS "Users can insert GTM groups" ON gtm_groups;
DROP POLICY IF EXISTS "Users can update GTM groups for their scenarios" ON gtm_groups;
DROP POLICY IF EXISTS "Users can delete GTM groups for their scenarios" ON gtm_groups;

-- Drop all existing policies on segments table
DROP POLICY IF EXISTS "Users can view segments for their scenarios" ON segments;
DROP POLICY IF EXISTS "Users can insert segments" ON segments;
DROP POLICY IF EXISTS "Users can update segments for their scenarios" ON segments;
DROP POLICY IF EXISTS "Users can delete segments for their scenarios" ON segments;

-- Drop all existing policies on conversion_rates table (if any)
DROP POLICY IF EXISTS "Users can view conversion rates" ON conversion_rates;
DROP POLICY IF EXISTS "Users can insert conversion rates" ON conversion_rates;
DROP POLICY IF EXISTS "Users can update conversion rates" ON conversion_rates;
DROP POLICY IF EXISTS "Users can delete conversion rates" ON conversion_rates;

-- Drop all existing policies on gtm_execution_plans table (if any)
DROP POLICY IF EXISTS "Users can view execution plans" ON gtm_execution_plans;
DROP POLICY IF EXISTS "Users can insert execution plans" ON gtm_execution_plans;
DROP POLICY IF EXISTS "Users can update execution plans" ON gtm_execution_plans;
DROP POLICY IF EXISTS "Users can delete execution plans" ON gtm_execution_plans;

-- Now disable RLS on all tables
ALTER TABLE scenarios DISABLE ROW LEVEL SECURITY;
ALTER TABLE plans DISABLE ROW LEVEL SECURITY;
ALTER TABLE gtm_groups DISABLE ROW LEVEL SECURITY;
ALTER TABLE segments DISABLE ROW LEVEL SECURITY;
ALTER TABLE conversion_rates DISABLE ROW LEVEL SECURITY;
ALTER TABLE gtm_execution_plans DISABLE ROW LEVEL SECURITY;

-- Verify RLS is disabled (optional check - you can run this separately)
-- SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';
