-- Cron job configuration for track-email-replies Edge Function
-- This file documents the cron setup (actual cron is configured via Supabase dashboard or CLI)

-- To enable via Supabase CLI:
-- supabase functions deploy track-email-replies
-- supabase functions schedule track-email-replies --cron "*/5 * * * *"

-- Cron expression: */5 * * * * (every 5 minutes)
--
-- This job will:
-- 1. Fetch all Gmail and Outlook OAuth connections
-- 2. For each connection, fetch sent email activities from last 30 days
-- 3. Search Gmail/Outlook API for replies from contacts
-- 4. Update activity records with reply timestamps
-- 5. Aggregate reply counts on email_templates table (future enhancement)

-- Note: Actual cron scheduling is done via:
-- - Supabase Dashboard: Database > Cron Jobs
-- - OR Supabase CLI: supabase functions schedule <name> --cron "<expression>"
