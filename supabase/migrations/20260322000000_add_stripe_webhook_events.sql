-- FIX-012: Add idempotency table for Stripe webhook events
-- Prevents duplicate processing when Stripe retries the same event

CREATE TABLE IF NOT EXISTS stripe_webhook_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    TEXT NOT NULL UNIQUE,
  event_type  TEXT NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast lookup by event_id
CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_event_id ON stripe_webhook_events(event_id);

-- RLS: only service role can read/write (webhook function uses service role key)
ALTER TABLE stripe_webhook_events ENABLE ROW LEVEL SECURITY;
