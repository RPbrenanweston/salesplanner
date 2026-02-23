-- Add enrichment columns to contacts table
-- Adds domain, LinkedIn URLs, and Twitter handles for both company and prospect

ALTER TABLE contacts ADD COLUMN IF NOT EXISTS domain TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS linkedin_url TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS company_linkedin_url TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS twitter_handle TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS company_twitter TEXT;

-- Indexes for the new columns (domain is commonly used for filtering/grouping)
CREATE INDEX IF NOT EXISTS idx_contacts_domain ON contacts(domain);
