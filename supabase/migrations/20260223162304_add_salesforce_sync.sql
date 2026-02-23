-- US-033: Push activities to Salesforce
-- Adds sync queue table and settings for Salesforce activity push

-- Add SF sync settings to organizations
ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS sf_auto_push_activities BOOLEAN DEFAULT false;

COMMENT ON COLUMN organizations.sf_auto_push_activities IS 'When true, automatically push activities to Salesforce as Tasks';

-- Add sync tracking fields to activities
ALTER TABLE activities
ADD COLUMN IF NOT EXISTS salesforce_task_id TEXT,
ADD COLUMN IF NOT EXISTS sync_status TEXT CHECK (sync_status IN ('pending', 'synced', 'failed')),
ADD COLUMN IF NOT EXISTS sync_error TEXT,
ADD COLUMN IF NOT EXISTS synced_at TIMESTAMPTZ;

COMMENT ON COLUMN activities.salesforce_task_id IS 'Salesforce Task ID after successful sync';
COMMENT ON COLUMN activities.sync_status IS 'Status of Salesforce sync: pending, synced, failed';
COMMENT ON COLUMN activities.sync_error IS 'Error message if sync failed (for manual retry)';
COMMENT ON COLUMN activities.synced_at IS 'Timestamp when activity was successfully synced to SF';

-- Create index for pending sync queries
CREATE INDEX IF NOT EXISTS idx_activities_sync_pending
ON activities(org_id, sync_status)
WHERE sync_status = 'pending';

-- Create index for salesforce_task_id lookups
CREATE INDEX IF NOT EXISTS idx_activities_salesforce_task_id
ON activities(salesforce_task_id)
WHERE salesforce_task_id IS NOT NULL;
