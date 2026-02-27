/**
 * User-related data fetching functions
 *
 * Handles all user profile, team, and preference queries.
 * Uses centralized error handling (lib/errors.ts) for consistent error logging.
 */
import { supabase } from '../supabase'
import { logApiError } from '../errors'
import type { User, TeamMember } from '../../types'

export type UserProfile = User
export type UserTeamInfo = Pick<User, 'role' | 'team_id'>

/**
 * Fetch user profile with preferences and org info
 */
export async function fetchUserProfile(userId: string): Promise<UserProfile | null> {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('display_name, email, org_id, preferences, role, team_id')
      .eq('id', userId)
      .maybeSingle()

    if (error) {
      logApiError('fetchUserProfile', error, { userId })
      return null
    }

    return data
  } catch (error) {
    logApiError('fetchUserProfile', error, { userId })
    return null
  }
}

/**
 * Fetch user role and team assignment
 */
export async function fetchUserTeamInfo(userId: string): Promise<UserTeamInfo | null> {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('role, team_id')
      .eq('id', userId)
      .single()

    if (error) {
      logApiError('fetchUserTeamInfo', error, { userId })
      return null
    }

    return data
  } catch (error) {
    logApiError('fetchUserTeamInfo', error, { userId })
    return null
  }
}

/**
 * Fetch team members for a given team
 */
export async function fetchTeamMembers(teamId: string, excludeUserId?: string): Promise<UserProfile[]> {
  try {
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
      logApiError('fetchTeamMembers', error, { teamId, excludeUserId })
      return []
    }

    return data || []
  } catch (error) {
    logApiError('fetchTeamMembers', error, { teamId, excludeUserId })
    return []
  }
}

/**
 * Update user preferences (sidebar, theme, etc.)
 */
export async function updateUserPreferences(
  userId: string,
  preferences: Partial<UserProfile['preferences']>
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('users')
      .update({ preferences })
      .eq('id', userId)

    if (error) {
      logApiError('updateUserPreferences', error, { userId, preferences })
      return false
    }

    return true
  } catch (error) {
    logApiError('updateUserPreferences', error, { userId, preferences })
    return false
  }
}
