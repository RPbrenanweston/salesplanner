/**
 * Centralized hooks for data fetching with React Query caching
 *
 * Pattern: Each data type has a dedicated hook file with useQuery wrappers.
 * This provides:
 * - Automatic caching and deduplication
 * - Background refetching
 * - Stale state management
 * - Easy invalidation for mutations
 *
 * Usage:
 *   import { useUserProfile } from '@/hooks/useUserQuery'
 *   const { data: user, isLoading, error } = useUserProfile(userId)
 */

export { useAuth } from './useAuth'
export { useTheme } from './useTheme'
export { useDashboardData } from './useDashboardData'
export { useGoalProgress } from './useGoalProgress'
export { useUserProfile, useUserTeamInfo, useTeamMembers } from './useUserQuery'
export { useOrganizationLogo, useOrganization } from './useOrganizationQuery'
export { useUserLists, useList, useListContacts, useListContactCount } from './useListQuery'
export { useCallScripts, useCallScript, useEmailTemplates, useEmailTemplate } from './useScriptQuery'
