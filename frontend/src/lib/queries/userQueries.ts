/**
 * User-related data fetching functions
 */
import { supabase } from '../supabase'

export interface UserProfile {
  id?: string
  display_name: string
  email?: string
  org_id: string
  preferences?: {
    sidebarCollapsed?: boolean
    theme?: 'light' | 'dark'
  }
  role?: 'sdr' | 'ae' | 'manager'
  team_id?: string
}

export interface UserTeamInfo {
  role: 'sdr' | 'ae' | 'manager'
  team_id: string | null
}

export async function fetchUserProfile(userId: string): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from('users')
    .select('display_name, email, org_id, preferences, role, team_id')
    .eq('id', userId)
    .maybeSingle()

  if (error) {
    console.error('Error fetching user profile:', error)
    return null
  }

  return data
}

export async function fetchUserTeamInfo(userId: string): Promise<UserTeamInfo | null> {
  const { data, error } = await supabase
    .from('users')
    .select('role, team_id')
    .eq('id', userId)
    .single()

  if (error) {
    console.error('Error fetching user team info:', error)
    return null
  }

  return data
}

export async function fetchTeamMembers(teamId: string, excludeUserId?: string): Promise<UserProfile[]> {
  let query = supabase
    .from('users')
    .select('id, display_name, email, role')
    .eq('team_id', teamId)
    .order('display_name')

  if (excludeUserId) {
    query = query.neq('id', excludeUserId)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching team members:', error)
    return []
  }

  return data || []
}

export async function updateUserPreferences(
  userId: string,
  preferences: Partial<UserProfile['preferences']>
): Promise<boolean> {
  const { error } = await supabase
    .from('users')
    .update({ preferences })
    .eq('id', userId)

  if (error) {
    console.error('Error updating user preferences:', error)
    return false
  }

  return true
}
