-- Add attio_record_id column to contacts for linking SalesBlock contacts to Attio People records
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS attio_record_id TEXT;

-- Unique per org to prevent duplicate Attio records within an organization
CREATE UNIQUE INDEX IF NOT EXISTS contacts_attio_record_id_org_idx
  ON contacts(org_id, attio_record_id)
  WHERE attio_record_id IS NOT NULL;
