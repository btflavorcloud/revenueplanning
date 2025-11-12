-- Disable RLS for shared password-protected access
-- Run this in your Supabase SQL Editor

-- Simply disable RLS on all tables
ALTER TABLE scenarios DISABLE ROW LEVEL SECURITY;
ALTER TABLE plans DISABLE ROW LEVEL SECURITY;
ALTER TABLE gtm_groups DISABLE ROW LEVEL SECURITY;
ALTER TABLE segments DISABLE ROW LEVEL SECURITY;
ALTER TABLE conversion_rates DISABLE ROW LEVEL SECURITY;
