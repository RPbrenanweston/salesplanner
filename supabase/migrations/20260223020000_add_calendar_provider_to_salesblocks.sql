-- Add calendar_provider column to salesblocks table to track which calendar service created the event
ALTER TABLE salesblocks ADD COLUMN calendar_provider TEXT CHECK (calendar_provider IN ('google_calendar', 'outlook_calendar'));

-- Add comment for documentation
COMMENT ON COLUMN salesblocks.calendar_provider IS 'Calendar service that created the synced event (google_calendar or outlook_calendar)';
