-- Fix list_type constraint: drop the 'prospect'/'account' check from cranky-swirles branch
-- and align with the codebase expectation of 'contacts' / 'accounts'

-- Drop old constraint if it exists
ALTER TABLE lists DROP CONSTRAINT IF EXISTS lists_list_type_check;

-- Migrate any rows that used the old enum values
UPDATE lists SET list_type = 'contacts' WHERE list_type = 'prospect';
UPDATE lists SET list_type = 'accounts' WHERE list_type = 'account';

-- Set the correct default
ALTER TABLE lists ALTER COLUMN list_type SET DEFAULT 'contacts';
