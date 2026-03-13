-- Add notes column to contacts table
-- Required by ContactDetailPage (editable notes field) and SalesBlockSessionPage (display notes on contact card)
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS notes TEXT;
