-- Add script_id to salesblocks table

ALTER TABLE salesblocks
ADD COLUMN script_id UUID REFERENCES call_scripts(id) ON DELETE SET NULL;

CREATE INDEX idx_salesblocks_script_id ON salesblocks(script_id);
