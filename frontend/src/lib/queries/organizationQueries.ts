/**
 * Organization-related data fetching functions
 */
import { supabase } from '../supabase'

export interface Organization {
  id: string
  name: string
  logo_url: string | null
  settings?: Record<string, any>
  stripe_customer_id?: string
  created_at?: string
}

export async function fetchOrganizationLogo(orgId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('organizations')
    .select('logo_url')
    .eq('id', orgId)
    .maybeSingle()

  if (error) {
    console.error('Error fetching organization logo:', error)
    return null
  }

  return data?.logo_url || null
}

export async function fetchOrganization(orgId: string): Promise<Organization | null> {
  const { data, error } = await supabase
    .from('organizations')
    .select('id, name, logo_url, settings, stripe_customer_id, created_at')
    .eq('id', orgId)
    .single()

  if (error) {
    console.error('Error fetching organization:', error)
    return null
  }

  return data
}

export async function updateOrganization(
  orgId: string,
  updates: Partial<Organization>
): Promise<boolean> {
  const { error } = await supabase
    .from('organizations')
    .update(updates)
    .eq('id', orgId)

  if (error) {
    console.error('Error updating organization:', error)
    return false
  }

  return true
}
