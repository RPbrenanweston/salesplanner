/** @id salesblock.hooks.users.use-user-query */
// @crumb frontend-hook-use-user-query
// DAT | user_profile_caching | team_membership_loading | team_member_enumeration | user_context_aggregation
// why: React Query wrappers for user profiles, team membership, and team member lists — centralized user context data fetching with 5min stale time
// in:userId/teamId (string|undefined|null),excludeUserId (optional) out:UserProfile,UserTeamInfo,TeamMember[],TanStack Query state err:fetch failure,userId/teamId undefined disables query
// hazard: useTeamMembers doesn't exclude the current user by default (excludeUserId optional) — lists returned to selectors may include user selecting themselves for role assignment
// hazard: useUserProfile/useUserTeamInfo include all fields (permissions, roles, email) — no field-level filtering; components may receive data they shouldn't display or use
// edge:frontend/src/lib/queries/userQueries.ts -> CALLS
// edge:frontend/src/pages/TeamManagementPage.tsx -> CALLS
// edge:frontend/src/components/TeamMemberSelector.tsx -> CALLS
// edge:rbac#1 -> STEP_IN
// prompt: Default excludeUserId to current user ID in useTeamMembers. Filter sensitive fields (permissions) in useUserProfile based on component permissions. Test role-based visibility.
/**
 * React Query hooks for user data fetching
 */
import { useQuery } from '@tanstack/react-query'
import {
  fetchUserProfile,
  fetchUserTeamInfo,
  fetchTeamMembers,
  UserProfile,
  UserTeamInfo,
} from '../lib/queries/userQueries'
import type { TeamMember } from '../types'

export function useUserProfile(userId: string | undefined) {
  return useQuery<UserProfile | null>({
    queryKey: ['user-profile', userId],
    queryFn: () => (userId ? fetchUserProfile(userId) : null),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

export function useUserTeamInfo(userId: string | undefined) {
  return useQuery<UserTeamInfo | null>({
    queryKey: ['user-team-info', userId],
    queryFn: () => (userId ? fetchUserTeamInfo(userId) : null),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  })
}

export function useTeamMembers(teamId: string | undefined | null, excludeUserId?: string) {
  return useQuery<TeamMember[]>({
    queryKey: ['team-members', teamId, excludeUserId],
    queryFn: () => (teamId ? fetchTeamMembers(teamId, excludeUserId) : []),
    enabled: !!teamId,
    staleTime: 5 * 60 * 1000,
  })
}
