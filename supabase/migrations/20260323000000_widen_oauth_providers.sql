-- Widen oauth_connections provider CHECK constraint to support additional CRM providers
-- Backwards-compatible: existing rows with gmail/outlook/google_calendar/outlook_calendar/salesforce are unaffected

ALTER TABLE oauth_connections
  DROP CONSTRAINT IF EXISTS oauth_connections_provider_check;

ALTER TABLE oauth_connections
  ADD CONSTRAINT oauth_connections_provider_check
  CHECK (provider IN ('gmail', 'outlook', 'google_calendar', 'outlook_calendar', 'salesforce', 'attio', 'hubspot', 'pipedrive', 'close'));
