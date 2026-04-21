// Regenerate against live schema:
// supabase gen types typescript --project-id gizjnytrcspwbshscmjb > lib/supabase/database.types.ts

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  public: {
    Tables: {
      planner_apps: {
        Row: { id: string; slug: string; name: string; created_at: string }
        Insert: { id?: string; slug: string; name: string; created_at?: string }
        Update: { id?: string; slug?: string; name?: string; created_at?: string }
        Relationships: []
      }
      app_memberships: {
        Row: { id: string; user_id: string; app_id: string; created_at: string }
        Insert: { id?: string; user_id: string; app_id: string; created_at?: string }
        Update: { id?: string; user_id?: string; app_id?: string; created_at?: string }
        Relationships: []
      }
      sp_plans: {
        Row: { id: string; user_id: string; app_id: string; date: string; created_at: string; updated_at: string }
        Insert: { id?: string; user_id: string; app_id: string; date: string; created_at?: string; updated_at?: string }
        Update: { id?: string; user_id?: string; app_id?: string; date?: string; created_at?: string; updated_at?: string }
        Relationships: []
      }
      sp_accounts: {
        Row: { id: string; user_id: string; app_id: string; name: string; created_at: string; updated_at: string }
        Insert: { id?: string; user_id: string; app_id: string; name: string; created_at?: string; updated_at?: string }
        Update: { id?: string; user_id?: string; app_id?: string; name?: string; created_at?: string; updated_at?: string }
        Relationships: []
      }
      sp_activities: {
        Row: { id: string; user_id: string; app_id: string; contact_id: string | null; account_id: string | null; type: string; notes: string | null; created_at: string }
        Insert: { id?: string; user_id: string; app_id: string; contact_id?: string | null; account_id?: string | null; type: string; notes?: string | null; created_at?: string }
        Update: { id?: string; user_id?: string; app_id?: string; contact_id?: string | null; account_id?: string | null; type?: string; notes?: string | null; created_at?: string }
        Relationships: []
      }
      sp_goals: {
        Row: { id: string; user_id: string; app_id: string; type: string; target: number; created_at: string }
        Insert: { id?: string; user_id: string; app_id: string; type: string; target: number; created_at?: string }
        Update: { id?: string; user_id?: string; app_id?: string; type?: string; target?: number; created_at?: string }
        Relationships: []
      }
      sp_wins: {
        Row: { id: string; user_id: string; app_id: string; description: string; created_at: string }
        Insert: { id?: string; user_id: string; app_id: string; description: string; created_at?: string }
        Update: { id?: string; user_id?: string; app_id?: string; description?: string; created_at?: string }
        Relationships: []
      }
      // Base-planner tables (used by planner hooks)
      salesblocks: {
        Row: { id: string; org_id: string; list_id: string; user_id: string; assigned_by: string | null; title: string; scheduled_start: string; scheduled_end: string; actual_start: string | null; actual_end: string | null; duration_minutes: number; status: string; calendar_event_id: string | null; notes: string | null; created_at: string | null; session_type: string | null }
        Insert: { id?: string; org_id: string; list_id: string; user_id: string; assigned_by?: string | null; title: string; scheduled_start: string; scheduled_end: string; actual_start?: string | null; actual_end?: string | null; duration_minutes: number; status: string; calendar_event_id?: string | null; notes?: string | null; created_at?: string | null; session_type?: string | null }
        Update: { id?: string; org_id?: string; list_id?: string; user_id?: string; assigned_by?: string | null; title?: string; scheduled_start?: string; scheduled_end?: string; actual_start?: string | null; actual_end?: string | null; duration_minutes?: number; status?: string; calendar_event_id?: string | null; notes?: string | null; created_at?: string | null; session_type?: string | null }
        Relationships: []
      }
      day_plans: {
        Row: { id: string; user_id: string; org_id: string; plan_date: string; block_order: string[]; notes: string | null; briefing_completed: boolean; debrief_completed: boolean; created_at: string; updated_at: string }
        Insert: { id?: string; user_id: string; org_id?: string; plan_date: string; block_order?: string[]; notes?: string | null; briefing_completed?: boolean; debrief_completed?: boolean; created_at?: string; updated_at?: string }
        Update: { id?: string; user_id?: string; org_id?: string; plan_date?: string; block_order?: string[]; notes?: string | null; briefing_completed?: boolean; debrief_completed?: boolean; created_at?: string; updated_at?: string }
        Relationships: []
      }
      session_debriefs: {
        Row: { id: string; user_id: string; org_id: string; debrief_date: string; blocks_planned: number; blocks_completed: number; blocks_skipped: number; total_focus_ms: number; total_break_ms: number; wins: string | null; improvements: string | null; tomorrow_priorities: string | null; created_at: string }
        Insert: { id?: string; user_id: string; org_id?: string; debrief_date: string; blocks_planned?: number; blocks_completed?: number; blocks_skipped?: number; total_focus_ms?: number; total_break_ms?: number; wins?: string | null; improvements?: string | null; tomorrow_priorities?: string | null; created_at?: string }
        Update: { id?: string; user_id?: string; org_id?: string; debrief_date?: string; blocks_planned?: number; blocks_completed?: number; blocks_skipped?: number; total_focus_ms?: number; total_break_ms?: number; wins?: string | null; improvements?: string | null; tomorrow_priorities?: string | null; created_at?: string }
        Relationships: []
      }
      activity_counters: {
        Row: { id: string; user_id: string; org_id: string; counter_date: string; dials: number; connects: number; emails_sent: number; linkedin_messages: number; meetings_booked: number; proposals_sent: number; created_at: string; updated_at: string }
        Insert: { id?: string; user_id: string; org_id?: string; counter_date: string; dials?: number; connects?: number; emails_sent?: number; linkedin_messages?: number; meetings_booked?: number; proposals_sent?: number; created_at?: string; updated_at?: string }
        Update: { id?: string; user_id?: string; org_id?: string; counter_date?: string; dials?: number; connects?: number; emails_sent?: number; linkedin_messages?: number; meetings_booked?: number; proposals_sent?: number; created_at?: string; updated_at?: string }
        Relationships: []
      }
      goals: {
        Row: { id: string; user_id: string; org_id: string; metric: string; target_value: number; period: string; custom_metric_name: string | null; value: number; created_at: string; updated_at: string }
        Insert: { id?: string; user_id: string; org_id?: string; metric: string; target_value?: number; period?: string; custom_metric_name?: string | null; value?: number; created_at?: string; updated_at?: string }
        Update: { id?: string; user_id?: string; org_id?: string; metric?: string; target_value?: number; period?: string; custom_metric_name?: string | null; value?: number; created_at?: string; updated_at?: string }
        Relationships: []
      }
      users: {
        Row: { id: string; email: string; display_name: string | null; org_id: string | null; preferences: Record<string, unknown> | null; role: string | null; team_id: string | null; created_at: string }
        Insert: { id: string; email: string; display_name?: string | null; org_id?: string | null; preferences?: Record<string, unknown> | null; role?: string | null; team_id?: string | null; created_at?: string }
        Update: { id?: string; email?: string; display_name?: string | null; org_id?: string | null; preferences?: Record<string, unknown> | null; role?: string | null; team_id?: string | null; created_at?: string }
        Relationships: []
      }
      lists: {
        Row: { id: string; org_id: string; name: string; created_at: string }
        Insert: { id?: string; org_id: string; name: string; created_at?: string }
        Update: { id?: string; org_id?: string; name?: string; created_at?: string }
        Relationships: []
      }
      focus_sessions: {
        Row: { id: string; user_id: string; org_id: string; sales_block_id: string | null; mode: string; state: string; duration_target_ms: number | null; duration_actual_ms: number; cycle_number: number; started_at: string | null; ended_at: string | null; break_count: number; break_time_ms: number; created_at: string }
        Insert: { id?: string; user_id: string; org_id: string; sales_block_id?: string | null; mode: string; state: string; duration_target_ms?: number | null; duration_actual_ms?: number; cycle_number?: number; started_at?: string | null; ended_at?: string | null; break_count?: number; break_time_ms?: number; created_at?: string }
        Update: { id?: string; user_id?: string; org_id?: string; sales_block_id?: string | null; mode?: string; state?: string; duration_target_ms?: number | null; duration_actual_ms?: number; cycle_number?: number; started_at?: string | null; ended_at?: string | null; break_count?: number; break_time_ms?: number; created_at?: string }
        Relationships: []
      }
      user_schedule_config: {
        Row: { id: string; user_id: string; org_id: string; work_start_hour: number; work_end_hour: number; lunch_start_hour: number; lunch_duration_min: number; sprint_duration_ms: number; break_duration_ms: number; pomodoro_work_ms: number; pomodoro_short_break_ms: number; pomodoro_long_break_ms: number; pomodoro_cycles_before_long: number; timezone: string; updated_at: string }
        Insert: { id?: string; user_id: string; org_id?: string; work_start_hour?: number; work_end_hour?: number; lunch_start_hour?: number; lunch_duration_min?: number; sprint_duration_ms?: number; break_duration_ms?: number; pomodoro_work_ms?: number; pomodoro_short_break_ms?: number; pomodoro_long_break_ms?: number; pomodoro_cycles_before_long?: number; timezone?: string; updated_at?: string }
        Update: { id?: string; user_id?: string; org_id?: string; work_start_hour?: number; work_end_hour?: number; lunch_start_hour?: number; lunch_duration_min?: number; sprint_duration_ms?: number; break_duration_ms?: number; pomodoro_work_ms?: number; pomodoro_short_break_ms?: number; pomodoro_long_break_ms?: number; pomodoro_cycles_before_long?: number; timezone?: string; updated_at?: string }
        Relationships: []
      }
      deals: {
        Row: { id: string; user_id: string; org_id: string; value: number | null; stage_id: string | null; created_at: string }
        Insert: { id?: string; user_id: string; org_id: string; value?: number | null; stage_id?: string | null; created_at?: string }
        Update: { id?: string; user_id?: string; org_id?: string; value?: number | null; stage_id?: string | null; created_at?: string }
        Relationships: []
      }
      calendar_events: {
        Row: { id: string; user_id: string; org_id: string; external_id: string | null; provider: string | null; title: string; start_time: string; end_time: string; is_all_day: boolean; is_blocking: boolean; synced_at: string; created_at: string }
        Insert: { id?: string; user_id: string; org_id?: string; external_id?: string | null; provider?: string | null; title: string; start_time: string; end_time: string; is_all_day?: boolean; is_blocking?: boolean; synced_at?: string; created_at?: string }
        Update: { id?: string; user_id?: string; org_id?: string; external_id?: string | null; provider?: string | null; title?: string; start_time?: string; end_time?: string; is_all_day?: boolean; is_blocking?: boolean; synced_at?: string; created_at?: string }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: {
      current_app_id: { Args: Record<PropertyKey, never>; Returns: string }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
