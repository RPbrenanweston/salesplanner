/** @id salesblock.lib.queries.organization-queries */
/**
 * Organization-related data fetching functions
 *
 * Handles org profile, logo, and settings queries.
 * Uses centralized error handling (lib/errors.ts) for consistent error logging.
 */
import { supabase } from '../supabase'
import { logApiError } from '../errors'
import type { Organization } from '../../types'

export type { Organization }

/**
 * Fetch organization logo URL
 */
export async function fetchOrganizationLogo(orgId: string): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('organizations')
      .select('logo_url')
      .eq('id', orgId)
      .maybeSingle()

    if (error) {
      logApiError('fetchOrganizationLogo', error, { orgId })
      return null
    }

    return data?.logo_url || null
  } catch (error) {
    logApiError('fetchOrganizationLogo', error, { orgId })
    return null
  }
}

/**
 * Fetch complete organization profile
 */
export async function fetchOrganization(orgId: string): Promise<Organization | null> {
  try {
    const { data, error } = await supabase
      .from('organizations')
      .select('id, name, logo_url, settings, stripe_customer_id, created_at')
      .eq('id', orgId)
      .single()

    if (error) {
      logApiError('fetchOrganization', error, { orgId })
      return null
    }

    return data
  } catch (error) {
    logApiError('fetchOrganization', error, { orgId })
    return null
  }
}

/**
 * Update organization profile
 */
export async function updateOrganization(
  orgId: string,
  updates: Partial<Organization>
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('organizations')
      .update(updates)
      .eq('id', orgId)

    if (error) {
      logApiError('updateOrganization', error, { orgId, updates })
      return false
    }

    return true
  } catch (error) {
    logApiError('updateOrganization', error, { orgId, updates })
    return false
  }
}
