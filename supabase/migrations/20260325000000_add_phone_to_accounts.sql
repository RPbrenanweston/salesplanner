-- Add phone column to accounts table
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS phone TEXT;
