/**
 * Salesforce CRM Adapter — implements CrmAdapter interface.
 * Wraps existing Salesforce functionality (SOQL queries, contact mapping, activity sync)
 * behind the unified CrmAdapter contract.
 */

import { supabase } from '../../supabase'
import type { CrmAdapter, CrmContact, CrmActivity, CrmImportOptions, CrmAdapterMeta } from '../types'

// --- Re-exported types and functions from original salesforce.ts ---

export interface SalesforceRecord {
  Id: string
  FirstName?: string
  LastName?: string
  Name?: string
  Email?: string
  Phone?: string
  Company?: string
  Title?: string
  CreatedDate: string
  LastModifiedDate: string
}

export interface SalesforceQueryOptions {
  objectType: 'Lead' | 'Contact' | 'Account'
  ownerId?: string
  startDate?: string
  endDate?: string
}

export async function querySalesforceRecords(
  accessToken: string,
  instanceUrl: string,
  options: SalesforceQueryOptions
): Promise<{ records: SalesforceRecord[]; totalSize: number }> {
  const { objectType, ownerId, startDate, endDate } = options

  const ALLOWED_OBJECT_TYPES = ['Lead', 'Contact', 'Account'] as const
  if (!ALLOWED_OBJECT_TYPES.includes(objectType as typeof ALLOWED_OBJECT_TYPES[number])) {
    throw new Error(`Invalid Salesforce object type: ${objectType}`)
  }

  let fields: string
  const conditions: string[] = []

  switch (objectType) {
    case 'Lead':
      fields = 'Id, FirstName, LastName, Email, Phone, Company, Title, CreatedDate, LastModifiedDate'
      break
    case 'Contact':
      fields = 'Id, FirstName, LastName, Email, Phone, Title, CreatedDate, LastModifiedDate'
      break
    case 'Account':
      fields = 'Id, Name, Phone, CreatedDate, LastModifiedDate'
      break
  }

  if (ownerId) {
    if (!/^[a-zA-Z0-9]{15}$|^[a-zA-Z0-9]{18}$/.test(ownerId)) {
      throw new Error(`Invalid Salesforce ID format: ${ownerId}`)
    }
    conditions.push(`OwnerId = '${ownerId}'`)
  }
  if (startDate) conditions.push(`CreatedDate >= ${startDate}`)
  if (endDate) conditions.push(`CreatedDate <= ${endDate}`)

  const whereClause = conditions.length > 0 ? ' WHERE ' + conditions.join(' AND ') : ''
  const soql = `SELECT ${fields} FROM ${objectType}${whereClause} ORDER BY CreatedDate DESC LIMIT 200`
  const queryUrl = `${instanceUrl}/services/data/v59.0/query?q=${encodeURIComponent(soql)}`

  const response = await fetch(queryUrl, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Salesforce API error: ${response.status} ${error}`)
  }

  const data = await response.json()
  return {
    records: data.records || [],
    totalSize: data.totalSize || 0,
  }
}

export async function getSalesforceUserId(accessToken: string, instanceUrl: string): Promise<string> {
  const response = await fetch(`${instanceUrl}/services/oauth2/userinfo`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!response.ok) throw new Error('Failed to fetch Salesforce user info')
  const data = await response.json()
  return data.user_id
}

export function mapSalesforceToContact(
  record: SalesforceRecord,
  objectType: 'Lead' | 'Contact' | 'Account',
  orgId: string,
  userId: string
): {
  first_name: string | null
  last_name: string | null
  email: string | null
  phone: string | null
  company: string | null
  title: string | null
  source: string
  salesforce_id: string
  org_id: string
  created_by: string
} {
  let firstName = null
  let lastName = null
  let company = null

  if (objectType === 'Lead' || objectType === 'Contact') {
    firstName = record.FirstName || null
    lastName = record.LastName || null
    company = objectType === 'Lead' ? (record.Company || null) : null
  } else if (objectType === 'Account') {
    const nameParts = (record.Name || '').split(' ')
    firstName = nameParts[0] || null
    lastName = nameParts.slice(1).join(' ') || null
    company = record.Name || null
  }

  return {
    first_name: firstName,
    last_name: lastName,
    email: record.Email || null,
    phone: record.Phone || null,
    company,
    title: record.Title || null,
    source: 'salesforce',
    salesforce_id: record.Id,
    org_id: orgId,
    created_by: userId,
  }
}

export async function getSalesforceConnection(): Promise<{
  access_token: string
  instance_url: string
} | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data, error } = await supabase
    .from('oauth_connections')
    .select('access_token, metadata')
    .eq('provider', 'salesforce')
    .eq('user_id', user.id)
    .maybeSingle()

  if (error || !data) return null

  const instanceUrl = (data.metadata as { instance_url?: string })?.instance_url
  if (!instanceUrl) return null

  return { access_token: data.access_token, instance_url: instanceUrl }
}

export async function isSalesforceConnected(): Promise<boolean> {
  const connection = await getSalesforceConnection()
  return connection !== null
}

export async function isSalesforceAutoPushEnabled(): Promise<boolean> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return false

    const { data: userData } = await supabase
      .from('users')
      .select('org_id')
      .eq('id', user.id)
      .single()

    if (!userData?.org_id) return false

    const { data: orgData } = await supabase
      .from('organizations')
      .select('sf_auto_push_activities')
      .eq('id', userData.org_id)
      .single()

    return orgData?.sf_auto_push_activities || false
  } catch (error) {
    console.error('Error checking SF auto-push setting:', error)
    return false
  }
}

export type SyncMarkResult = 'synced' | 'auto_push_disabled' | 'not_connected' | 'error'

export async function markActivityForSync(activityId: string): Promise<SyncMarkResult> {
  try {
    const autoPushEnabled = await isSalesforceAutoPushEnabled()
    if (!autoPushEnabled) return 'auto_push_disabled'

    const connection = await getSalesforceConnection()
    if (!connection) return 'not_connected'

    await supabase
      .from('activities')
      .update({ sync_status: 'pending' })
      .eq('id', activityId)

    console.log(`Activity ${activityId} marked for Salesforce sync`)
    return 'synced'
  } catch (error) {
    console.error('Error marking activity for sync:', error)
    return 'error'
  }
}

// --- CrmAdapter implementation ---

const salesforceMeta: CrmAdapterMeta = {
  displayName: 'Salesforce',
  provider: 'salesforce',
  iconUrl: 'https://cdn.brandfetch.io/salesforce.com/icon',
  description: 'Sync contacts and activities with Salesforce CRM',
  scopes: ['api', 'refresh_token'],
}

export const SalesforceAdapter: CrmAdapter = {
  meta: salesforceMeta,

  async isConnected(_userId: string, _orgId: string): Promise<boolean> {
    return isSalesforceConnected()
  },

  async connect(_userId: string, _orgId: string): Promise<void> {
    // Handled by SalesforceOAuthButton component
  },

  async disconnect(userId: string, orgId: string): Promise<void> {
    await supabase
      .from('oauth_connections')
      .delete()
      .eq('user_id', userId)
      .eq('org_id', orgId)
      .eq('provider', 'salesforce')
  },

  async importContacts(_options: CrmImportOptions): Promise<CrmContact[]> {
    const connection = await getSalesforceConnection()
    if (!connection) return []

    const { records } = await querySalesforceRecords(
      connection.access_token,
      connection.instance_url,
      { objectType: 'Contact' }
    )

    return records.map((record) => ({
      externalId: record.Id,
      email: record.Email || '',
      firstName: record.FirstName || '',
      lastName: record.LastName || '',
      phone: record.Phone || undefined,
      company: record.Company || undefined,
      title: record.Title || undefined,
      source: 'salesforce',
    }))
  },

  async pushActivity(activity: CrmActivity, _userId: string, _orgId: string): Promise<void> {
    await markActivityForSync(activity.contactExternalId)
  },
}
