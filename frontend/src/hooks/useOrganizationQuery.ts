/** @id salesblock.hooks.org.use-organization-query */
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
