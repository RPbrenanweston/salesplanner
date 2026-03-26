-- Add 'paused' and 'abandoned' to salesblocks status constraint
-- Paused: user temporarily left session, can resume later
-- Abandoned: user explicitly left without completing

ALTER TABLE salesblocks
DROP CONSTRAINT IF EXISTS salesblocks_status_check;

ALTER TABLE salesblocks
ADD CONSTRAINT salesblocks_status_check
CHECK (status IN ('scheduled', 'in_progress', 'paused', 'abandoned', 'completed', 'cancelled'));
