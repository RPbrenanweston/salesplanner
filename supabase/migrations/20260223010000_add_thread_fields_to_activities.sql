-- Add thread/conversation ID fields to activities table for reply tracking
-- This enables matching replies to sent emails via Gmail thread ID or Outlook conversation ID

ALTER TABLE activities
ADD COLUMN thread_id TEXT, -- Gmail thread ID for email activities
ADD COLUMN conversation_id TEXT, -- Outlook conversation ID for email activities
ADD COLUMN replied_at TIMESTAMPTZ; -- Timestamp when reply was received (tracked by background job)

-- Create index for fast lookup by thread/conversation ID
CREATE INDEX idx_activities_thread_id ON activities(thread_id) WHERE thread_id IS NOT NULL;
CREATE INDEX idx_activities_conversation_id ON activities(conversation_id) WHERE conversation_id IS NOT NULL;

COMMENT ON COLUMN activities.thread_id IS 'Gmail thread ID for email activities (enables reply tracking)';
COMMENT ON COLUMN activities.conversation_id IS 'Outlook conversation ID for email activities (enables reply tracking)';
COMMENT ON COLUMN activities.replied_at IS 'Timestamp when reply was received (populated by track-email-replies Edge Function)';
