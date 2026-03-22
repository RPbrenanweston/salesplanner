-- Super Productivity Integration Schema
-- Phase 1A+1B: Timer, Day Planner, Focus Sessions, Briefing, Debrief
-- Ref: docs/salesblock-architecture.md
--
-- NOTE: This migration does NOT create a sales_blocks table.
-- Productivity hooks use the existing `salesblocks` table (created in
-- 20260223004050_create_salesblocks_activities_schema.sql). The frontend
-- adapter layer (salesblock-adapter.ts) handles field mapping.

-- =============================================================================
-- 1. DAY PLANS (date -> block[] mapping)
-- =============================================================================
CREATE TABLE IF NOT EXISTS day_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  plan_date DATE NOT NULL,
  block_order UUID[] DEFAULT '{}',
  notes TEXT,
  briefing_completed BOOLEAN DEFAULT FALSE,
  debrief_completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, plan_date)
);

CREATE INDEX idx_day_plans_user_date ON day_plans(user_id, plan_date);

-- =============================================================================
-- 3. FOCUS SESSIONS (timer session log)
-- =============================================================================
CREATE TABLE IF NOT EXISTS focus_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  sales_block_id UUID REFERENCES salesblocks(id) ON DELETE SET NULL,
  mode TEXT NOT NULL CHECK (mode IN ('pomodoro','flowtime','countdown','sprint')),
  state TEXT NOT NULL DEFAULT 'idle' CHECK (state IN ('idle','running','paused','break','completed')),
  duration_target_ms INT,
  duration_actual_ms INT DEFAULT 0,
  cycle_number INT DEFAULT 1,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  break_count INT DEFAULT 0,
  break_time_ms INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_focus_sessions_user ON focus_sessions(user_id);
CREATE INDEX idx_focus_sessions_block ON focus_sessions(sales_block_id);

-- =============================================================================
-- 4. USER SCHEDULE CONFIG (work hours, breaks, timer settings)
-- =============================================================================
CREATE TABLE IF NOT EXISTS user_schedule_config (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  work_start_hour INT DEFAULT 8,
  work_end_hour INT DEFAULT 18,
  lunch_start_hour INT DEFAULT 12,
  lunch_duration_min INT DEFAULT 60,
  sprint_duration_ms INT DEFAULT 5400000,       -- 90min
  break_duration_ms INT DEFAULT 900000,          -- 15min
  pomodoro_work_ms INT DEFAULT 1500000,          -- 25min
  pomodoro_short_break_ms INT DEFAULT 300000,    -- 5min
  pomodoro_long_break_ms INT DEFAULT 900000,     -- 15min
  pomodoro_cycles_before_long INT DEFAULT 4,
  timezone TEXT DEFAULT 'America/New_York',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- 5. CALENDAR EVENTS (external calendar integration)
-- =============================================================================
CREATE TABLE IF NOT EXISTS calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  external_id TEXT,
  provider TEXT CHECK (provider IN ('google','outlook','ical')),
  title TEXT NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  is_all_day BOOLEAN DEFAULT FALSE,
  is_blocking BOOLEAN DEFAULT TRUE,
  synced_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_calendar_events_user_time ON calendar_events(user_id, start_time, end_time);

-- =============================================================================
-- 6. SESSION DEBRIEFS (end-of-day review)
-- =============================================================================
CREATE TABLE IF NOT EXISTS session_debriefs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  debrief_date DATE NOT NULL,
  blocks_planned INT DEFAULT 0,
  blocks_completed INT DEFAULT 0,
  blocks_skipped INT DEFAULT 0,
  total_focus_ms INT DEFAULT 0,
  total_break_ms INT DEFAULT 0,
  wins TEXT,
  improvements TEXT,
  tomorrow_priorities TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, debrief_date)
);

-- =============================================================================
-- 7. ACTIVITY COUNTERS (daily disposition tracking)
-- =============================================================================
CREATE TABLE IF NOT EXISTS activity_counters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  counter_date DATE NOT NULL,
  dials INT DEFAULT 0,
  connects INT DEFAULT 0,
  emails_sent INT DEFAULT 0,
  linkedin_messages INT DEFAULT 0,
  meetings_booked INT DEFAULT 0,
  proposals_sent INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, counter_date)
);

CREATE INDEX idx_activity_counters_user_date ON activity_counters(user_id, counter_date);

-- =============================================================================
-- 8. ROW LEVEL SECURITY
-- =============================================================================

-- NOTE: RLS for `salesblocks` is already defined in the original migration.

ALTER TABLE day_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_day_plans" ON day_plans
  FOR ALL USING (auth.uid() = user_id);

ALTER TABLE focus_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_focus_sessions" ON focus_sessions
  FOR ALL USING (auth.uid() = user_id);

ALTER TABLE user_schedule_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_schedule_config" ON user_schedule_config
  FOR ALL USING (auth.uid() = user_id);

ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_calendar_events" ON calendar_events
  FOR ALL USING (auth.uid() = user_id);

ALTER TABLE session_debriefs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_session_debriefs" ON session_debriefs
  FOR ALL USING (auth.uid() = user_id);

ALTER TABLE activity_counters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_activity_counters" ON activity_counters
  FOR ALL USING (auth.uid() = user_id);

-- =============================================================================
-- 9. RPC: ATOMIC COMPLETE SALES BLOCK
-- =============================================================================
CREATE OR REPLACE FUNCTION complete_sales_block(
  p_block_id UUID,
  p_actual_ms INT,
  p_counter_field TEXT DEFAULT NULL
) RETURNS void AS $$
BEGIN
  -- Update the existing salesblocks table; map duration_actual_ms to duration_minutes
  UPDATE salesblocks
  SET status = 'completed',
      actual_end = NOW(),
      duration_minutes = GREATEST(1, p_actual_ms / 60000)
  WHERE id = p_block_id AND user_id = auth.uid();

  IF p_counter_field IS NOT NULL THEN
    INSERT INTO activity_counters (user_id, org_id, counter_date)
    SELECT user_id, org_id, COALESCE(scheduled_start::date, CURRENT_DATE)
    FROM salesblocks WHERE id = p_block_id
    ON CONFLICT (user_id, counter_date) DO NOTHING;

    EXECUTE format(
      'UPDATE activity_counters SET %I = %I + 1, updated_at = NOW()
       WHERE user_id = auth.uid()
       AND counter_date = (SELECT COALESCE(scheduled_start::date, CURRENT_DATE) FROM salesblocks WHERE id = $1)',
      p_counter_field, p_counter_field
    ) USING p_block_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- 10. RPC: UPSERT DAY PLAN BLOCK ORDER
-- =============================================================================
CREATE OR REPLACE FUNCTION upsert_day_plan(
  p_plan_date DATE,
  p_block_order UUID[],
  p_org_id UUID
) RETURNS UUID AS $$
DECLARE
  v_plan_id UUID;
BEGIN
  INSERT INTO day_plans (user_id, org_id, plan_date, block_order)
  VALUES (auth.uid(), p_org_id, p_plan_date, p_block_order)
  ON CONFLICT (user_id, plan_date)
  DO UPDATE SET block_order = p_block_order, updated_at = NOW()
  RETURNING id INTO v_plan_id;

  RETURN v_plan_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
