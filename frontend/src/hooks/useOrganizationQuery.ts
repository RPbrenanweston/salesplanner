/** @id salesblock.hooks.org.use-organization-query */
// @crumb frontend-hook-use-organization-query
// DAT | org_metadata_caching | logo_retrieval | query_deduplication | cache_management
// why: React Query wrappers for org data — separates logo caching (10min stale) from metadata (5min stale), handles enabled state for conditional fetching
// in:orgId (string|undefined) out:Organization object,logo string|null,TanStack Query state (loading,error) err:fetch failure (network),Supabase read failure,orgId undefined disables query
// hazard: useOrganizationLogo caches for 10min but logo may change (avatar upload) — UI shows stale logo until cache expires or manual invalidation
// hazard: No error boundary in components using this hook — fetch failure on org data shows nothing, no error message to user
// edge:frontend/src/lib/queries/organizationQueries.ts -> CALLS
// edge:frontend/src/pages/ContactDetailPage.tsx -> CALLS
// edge:frontend/src/components/OrganizationCard.tsx -> CALLS
// edge:data-fetching#1 -> STEP_IN
// prompt: Add manual cache invalidation on org update (avatar upload, name change). Show error message if fetch fails. Consider sync with activity feed org filters.
/**
 * React Query hooks for organization data fetching
 */
import { useQuery } from '@tanstack/react-query'
import {
  fetchOrganizationLogo,
  fetchOrganization,
  Organization,
} from '../lib/queries/organizationQueries'

export function useOrganizationLogo(orgId: string | undefined) {
  return useQuery<string | null>({
    queryKey: ['org-logo', orgId],
    queryFn: () => (orgId ? fetchOrganizationLogo(orgId) : null),
    enabled: !!orgId,
    staleTime: 10 * 60 * 1000, // 10 minutes (logo doesn't change often)
  })
}

export function useOrganization(orgId: string | undefined) {
  return useQuery<Organization | null>({
    queryKey: ['organization', orgId],
    queryFn: () => (orgId ? fetchOrganization(orgId) : null),
    enabled: !!orgId,
    staleTime: 5 * 60 * 1000,
  })
}
