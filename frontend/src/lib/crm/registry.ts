/**
 * CRM Adapter Registry — maps provider names to adapter instances.
 * Settings > Integrations uses this to dynamically render available CRMs.
 */

import type { CrmAdapter } from './types'
import { SalesforceAdapter } from './adapters/salesforce'

const adapters = new Map<string, CrmAdapter>()

export function registerAdapter(adapter: CrmAdapter): void {
  adapters.set(adapter.meta.provider, adapter)
}

export function getAdapter(provider: string): CrmAdapter | undefined {
  return adapters.get(provider)
}

export function getAvailableAdapters(): CrmAdapter[] {
  return Array.from(adapters.values())
}

// Auto-register Salesforce on import
registerAdapter(SalesforceAdapter)
