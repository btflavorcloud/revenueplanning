-- Add scenario settings JSON column for storing segment-level configuration
ALTER TABLE scenarios
ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}'::jsonb;

-- Populate defaults for existing rows so the UI starts with sensible values
UPDATE scenarios
SET settings = jsonb_build_object(
  'seasonality', jsonb_build_object(
    'SMB', jsonb_build_object('november', 0, 'december', 0),
    'MM', jsonb_build_object('november', 10, 'december', 10),
    'ENT', jsonb_build_object('november', 20, 'december', 20),
    'ENT+', jsonb_build_object('november', 20, 'december', 20),
    'Flagship', jsonb_build_object('november', 20, 'december', 20)
  ),
  'integrationTimelineDays', jsonb_build_object(
    'SMB', 0,
    'MM', 0,
    'ENT', 0,
    'ENT+', 0,
    'Flagship', 0
  )
)
WHERE settings IS NULL OR settings = '{}'::jsonb;
