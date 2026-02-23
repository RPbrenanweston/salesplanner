-- Add salesforce_id column to contacts table for syncing with Salesforce
ALTER TABLE contacts
ADD COLUMN salesforce_id TEXT;

-- Create index for fast lookup by Salesforce ID
CREATE INDEX idx_contacts_salesforce_id ON contacts(salesforce_id);

-- Add unique constraint to prevent duplicate Salesforce records
ALTER TABLE contacts
ADD CONSTRAINT unique_salesforce_id UNIQUE (org_id, salesforce_id);
