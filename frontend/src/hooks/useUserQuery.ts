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
