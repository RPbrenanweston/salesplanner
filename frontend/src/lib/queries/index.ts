/**
 * Centralized data fetching queries
 *
 * Pattern: All Supabase queries are extracted here as pure functions.
 * This allows:
 * - Reusability across components
 * - Easy testing
 * - Single source of truth for data fetching
 * - Consistent error handling
 *
 * Usage:
 * 1. Import query function from specific file:
 *    import { fetchUserProfile } from '@/lib/queries/userQueries'
 *
 * 2. Use in hooks (preferred):
 *    import { useUserProfile } from '@/hooks/useUserQuery'
 *    const { data: user, isLoading } = useUserProfile(userId)
 *
 * 3. Use directly in components (only for non-async operations):
 *    import { fetchUserProfile } from '@/lib/queries/userQueries'
 *    const profile = await fetchUserProfile(userId)
 */

export * from './userQueries'
export * from './organizationQueries'
export * from './listQueries'
export * from './scriptQueries'
