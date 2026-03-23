/**
 * Attio CRM Adapter — implements CrmAdapter interface for Attio.
 * Maps Attio People to CrmContact, pushes activities as Attio Notes.
 */

import { supabase } from '../../supabase'
import type {
  CrmAdapter,
  CrmContact,
  CrmActivity,
  CrmImportOptions,
  CrmAdapterMeta,
} from '../types'

const ATTIO_API = 'https://api.attio.com/v2'

/**
 * Retrieve the stored Attio OAuth access token for a given user+org.
 */
async function getAttioToken(
  userId: string,
  orgId: string
): Promise<string | null> {
  const { data } = await supabase
    .from('oauth_connections')
    .select('access_token')
    .eq('user_id', userId)
    .eq('org_id', orgId)
    .eq('provider', 'attio')
    .maybeSingle()

  return data?.access_token ?? null
}

const attioMeta: CrmAdapterMeta = {
  displayName: 'Attio',
  provider: 'attio',
  iconUrl: 'https://cdn.brandfetch.io/attio.com/icon',
  description: 'Sync contacts and activities with Attio CRM',
  scopes: ['read:people', 'write:notes', 'read:companies', 'read:deals'],
}

export const AttioAdapter: CrmAdapter = {
  meta: attioMeta,

  async isConnected(userId: string, orgId: string): Promise<boolean> {
    const token = await getAttioToken(userId, orgId)
    return token !== null
  },

  async connect(_userId: string, _orgId: string): Promise<void> {
    // Handled by AttioOAuthButton component
  },

  async disconnect(userId: string, orgId: string): Promise<void> {
    await supabase
      .from('oauth_connections')
      .delete()
      .eq('user_id', userId)
      .eq('org_id', orgId)
      .eq('provider', 'attio')
  },

  async importContacts(options: CrmImportOptions): Promise<CrmContact[]> {
    const token = await getAttioToken(options.userId, options.orgId)
    if (!token) return []

    const contacts: CrmContact[] = []
    let offset: string | null = null

    // Paginate through Attio People records
    do {
      const body: Record<string, unknown> = { limit: 500 }
      if (offset) {
        body.offset = offset
      }

      const res = await fetch(`${ATTIO_API}/objects/people/records/query`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        console.error('Attio People query failed:', res.status, await res.text())
        break
      }

      const data = await res.json()
      const records = data.data ?? []

      for (const record of records) {
        const values = record.values ?? {}
        contacts.push({
          externalId: record.id?.record_id ?? record.id ?? '',
          email: values.email_addresses?.[0]?.email_address ?? '',
          firstName: values.name?.[0]?.first_name ?? '',
          lastName: values.name?.[0]?.last_name ?? '',
          phone: values.phone_numbers?.[0]?.phone_number ?? undefined,
          company: undefined, // Attio People don't always embed company name inline
          title: values.job_title?.[0]?.value ?? undefined,
          source: 'attio',
        })
      }

      // Attio returns next_page_offset for pagination
      offset = data.next_page_offset ?? null

      // Rate limiting: Attio allows 100 req/s, add small delay between pages
      if (offset) {
        await new Promise((resolve) => setTimeout(resolve, 10))
      }
    } while (offset)

    return contacts
  },

  async pushActivity(
    activity: CrmActivity,
    userId: string,
    orgId: string
  ): Promise<void> {
    const token = await getAttioToken(userId, orgId)
    if (!token) return

    // Look up the contact's attio_record_id
    const { data: contact } = await supabase
      .from('contacts')
      .select('attio_record_id')
      .eq('id', activity.contactExternalId)
      .maybeSingle()

    if (!contact?.attio_record_id) return

    const res = await fetch(`${ATTIO_API}/notes`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        data: {
          parent_object: 'people',
          parent_record_id: contact.attio_record_id,
          title: `[SalesBlock] ${activity.type}`,
          content: [
            {
              type: 'paragraph',
              children: [
                {
                  type: 'text',
                  text: `Type: ${activity.type}\nOutcome: ${activity.outcome ?? 'N/A'}\n\n${activity.notes ?? ''}`,
                },
              ],
            },
          ],
          created_at: activity.timestamp,
        },
      }),
    })

    if (!res.ok) {
      console.error('Attio note push failed:', res.status, await res.text())
    }
  },
}
