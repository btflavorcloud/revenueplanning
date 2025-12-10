-- Add confidence column to gtm_groups table for Stretch plan confidence levels
ALTER TABLE gtm_groups ADD COLUMN IF NOT EXISTS confidence TEXT DEFAULT 'MED' CHECK (confidence IN ('HI', 'MED', 'LO'));

-- Update existing gtm_groups to have default 'MED' confidence
UPDATE gtm_groups SET confidence = 'MED' WHERE confidence IS NULL;
