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
    }
    Views: Record<string, never>
    Functions: {
      current_app_id: { Args: Record<PropertyKey, never>; Returns: string }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
