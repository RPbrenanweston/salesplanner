/**
 * Domain types - Core business entities
 */

export interface Organization {
  id: string
  name: string
  logo_url: string | null
  settings?: Record<string, any>
  stripe_customer_id?: string
  created_at?: string
}

export interface User {
  id: string
  email: string
  display_name: string
  org_id: string
  team_id?: string
  role: 'sdr' | 'ae' | 'manager'
  preferences?: {
    sidebarCollapsed?: boolean
    theme?: 'light' | 'dark'
  }
  created_at?: string
}

export interface Contact {
  id: string
  org_id: string
  first_name: string
  last_name: string
  email?: string
  phone?: string
  company?: string
  title?: string
  source?: 'csv' | 'salesforce' | 'manual'
  custom_fields?: Record<string, any>
  created_by?: string
  created_at?: string
  updated_at?: string
}

export interface ContactList {
  id: string
  org_id: string
  name: string
  description?: string
  owner_id: string
  is_shared: boolean
  filter_criteria?: Record<string, any>
  created_at?: string
  updated_at?: string
}

export interface SalesBlock {
  id: string
  org_id: string
  list_id: string
  user_id: string
  assigned_by?: string
  title: string
  scheduled_start: string
  scheduled_end: string
  actual_start?: string
  actual_end?: string
  duration_minutes: number
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled'
  calendar_event_id?: string
  notes?: string
  list?: { name: string }
  contact_count?: number
  created_at?: string
}

export interface Activity {
  id: string
  org_id: string
  contact_id: string
  user_id: string
  salesblock_id?: string
  type: 'call' | 'email' | 'social' | 'meeting' | 'note'
  outcome: 'no_answer' | 'voicemail' | 'connect' | 'conversation' | 'meeting_booked' | 'not_interested' | 'follow_up' | 'other'
  notes?: string
  duration_seconds?: number
  contact?: {
    first_name: string
    last_name: string
  }
  created_at?: string
}

export interface Goal {
  id: string
  org_id: string
  user_id: string
  metric: 'calls' | 'emails' | 'social_touches' | 'meetings_booked' | 'pipeline_value' | 'custom'
  target_value: number
  period: 'daily' | 'weekly' | 'monthly'
  custom_metric_name: string | null
  created_at?: string
}

export interface GoalProgress {
  metric: string
  label: string
  current: number
  target: number
}

export interface Deal {
  id: string
  org_id: string
  contact_id: string
  user_id: string
  stage_id: string
  title: string
  value: number
  currency: string
  close_date?: string
  custom_fields?: Record<string, any>
  notes?: string
  created_at?: string
  updated_at?: string
}

export interface PipelineStage {
  id: string
  org_id: string
  name: string
  position: number
  color?: string
  probability: number
  is_default: boolean
  created_at?: string
}

export interface CallScript {
  id: string
  org_id: string
  name: string
  content: string
  owner_id: string
  is_shared: boolean
  created_at?: string
  updated_at?: string
}

export interface EmailTemplate {
  id: string
  org_id: string
  name: string
  subject: string
  body: string
  owner_id: string
  is_shared: boolean
  times_used?: number
  reply_count?: number
  created_at?: string
  updated_at?: string
}

export interface CustomKPI {
  id: string
  org_id: string
  user_id: string
  name: string
  formula_type: 'count' | 'ratio' | 'sum'
  numerator_metric: string
  denominator_metric?: string
  period: 'daily' | 'weekly' | 'monthly'
  created_at?: string
}

export interface TeamMember {
  id: string
  email: string
  display_name: string
  role: 'sdr' | 'ae' | 'manager'
}
