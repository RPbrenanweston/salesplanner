/**
 * CRM Adapter Interface — unified contract for all CRM integrations.
 * All CRM adapters (Salesforce, Attio, HubSpot, etc.) implement this interface
 * so import, push, and connection management follow a single pattern.
 */

export interface CrmContact {
  externalId: string
  email: string
  firstName: string
  lastName: string
  phone?: string
  company?: string
  title?: string
  source: string
}

export interface CrmCompany {
  externalId: string
  name: string
  domain?: string
  industry?: string
}

export interface CrmActivity {
  type: string
  outcome?: string
  notes?: string
  timestamp: string
  contactExternalId: string
}

export interface CrmImportOptions {
  orgId: string
  userId: string
  dedupeByEmail?: boolean
}

export interface CrmAdapterMeta {
  displayName: string
  provider: string
  iconUrl: string
  description: string
  scopes: string[]
}

export interface CrmAdapter {
  meta: CrmAdapterMeta
  isConnected(userId: string, orgId: string): Promise<boolean>
  connect(userId: string, orgId: string): Promise<void>
  disconnect(userId: string, orgId: string): Promise<void>
  importContacts(options: CrmImportOptions): Promise<CrmContact[]>
  pushActivity(activity: CrmActivity, userId: string, orgId: string): Promise<void>
}
