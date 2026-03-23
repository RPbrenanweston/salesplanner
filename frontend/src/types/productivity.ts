/** @id salesblock.types.productivity */
/**
 * Productivity module types — matches Supabase schema from
 * 20260320000000_super_productivity_schema.sql
 */

export type BlockType = 'call' | 'email' | 'linkedin' | 'meeting' | 'research' | 'admin' | 'break'
export type BlockStatus = 'planned' | 'active' | 'paused' | 'completed' | 'skipped'
export type FocusMode = 'pomodoro' | 'flowtime' | 'countdown' | 'sprint'
export type FocusState = 'idle' | 'running' | 'paused' | 'break' | 'completed'
export type CalendarProvider = 'google' | 'outlook' | 'ical'

export interface ProductivityBlock {
  id: string
  user_id: string
  org_id: string
  block_type: BlockType
  title: string
  description?: string | null
  contact_id?: string | null
  deal_id?: string | null
  duration_estimate_ms: number
  duration_actual_ms: number
  status: BlockStatus
  scheduled_date?: string | null
  start_time?: string | null
  end_time?: string | null
  sort_order: number
  completed_at?: string | null
  created_at: string
  updated_at: string
}

export interface DayPlan {
  id: string
  user_id: string
  org_id: string
  plan_date: string
  block_order: string[]
  notes?: string | null
  briefing_completed: boolean
  debrief_completed: boolean
  created_at: string
  updated_at: string
}

export interface FocusSession {
  id: string
  user_id: string
  org_id: string
  sales_block_id?: string | null
  mode: FocusMode
  state: FocusState
  duration_target_ms?: number | null
  duration_actual_ms: number
  cycle_number: number
  started_at?: string | null
  ended_at?: string | null
  break_count: number
  break_time_ms: number
  created_at: string
}

export interface UserScheduleConfig {
  user_id: string
  org_id: string
  work_start_hour: number
  work_end_hour: number
  lunch_start_hour: number
  lunch_duration_min: number
  sprint_duration_ms: number
  break_duration_ms: number
  pomodoro_work_ms: number
  pomodoro_short_break_ms: number
  pomodoro_long_break_ms: number
  pomodoro_cycles_before_long: number
  timezone: string
  updated_at: string
}

export interface CalendarEvent {
  id: string
  user_id: string
  org_id: string
  external_id?: string | null
  provider?: CalendarProvider | null
  title: string
  start_time: string
  end_time: string
  is_all_day: boolean
  is_blocking: boolean
  synced_at: string
}

export interface SessionDebrief {
  id: string
  user_id: string
  org_id: string
  debrief_date: string
  blocks_planned: number
  blocks_completed: number
  blocks_skipped: number
  total_focus_ms: number
  total_break_ms: number
  wins?: string | null
  improvements?: string | null
  tomorrow_priorities?: string | null
  created_at: string
}

export interface ActivityCounter {
  id: string
  user_id: string
  org_id: string
  counter_date: string
  dials: number
  connects: number
  emails_sent: number
  linkedin_messages: number
  meetings_booked: number
  proposals_sent: number
  created_at: string
  updated_at: string
}

/** Default schedule config for new users */
export const DEFAULT_SCHEDULE_CONFIG: Omit<UserScheduleConfig, 'user_id' | 'org_id' | 'updated_at'> = {
  work_start_hour: 8,
  work_end_hour: 18,
  lunch_start_hour: 12,
  lunch_duration_min: 60,
  sprint_duration_ms: 5_400_000,      // 90 minutes
  break_duration_ms: 900_000,          // 15 minutes
  pomodoro_work_ms: 1_500_000,         // 25 minutes
  pomodoro_short_break_ms: 300_000,    // 5 minutes
  pomodoro_long_break_ms: 900_000,     // 15 minutes
  pomodoro_cycles_before_long: 4,
  timezone: 'America/New_York',
}

/** Mode-specific default durations in milliseconds */
export const MODE_DEFAULTS: Record<FocusMode, { work: number; break: number }> = {
  pomodoro: { work: 1_500_000, break: 300_000 },
  flowtime: { work: 0, break: 300_000 },            // 0 = no target (count up)
  countdown: { work: 1_800_000, break: 300_000 },   // 30 min default
  sprint: { work: 5_400_000, break: 900_000 },       // 90 min work, 15 min break
}
