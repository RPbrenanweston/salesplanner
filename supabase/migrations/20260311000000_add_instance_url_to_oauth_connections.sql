-- Add instance_url column for Salesforce OAuth connections
-- Salesforce requires the instance URL to make API calls to the correct org endpoint

ALTER TABLE oauth_connections
  ADD COLUMN IF NOT EXISTS instance_url TEXT;

COMMENT ON COLUMN oauth_connections.instance_url IS 'Salesforce instance URL (e.g. https://na1.salesforce.com). Required for Salesforce API calls.';
