/**
 * Re-export barrel — preserves all existing imports from '../lib/salesforce'.
 * Actual implementation lives in crm/adapters/salesforce.ts.
 */
export {
  SalesforceAdapter,
  querySalesforceRecords,
  getSalesforceUserId,
  mapSalesforceToContact,
  getSalesforceConnection,
  isSalesforceConnected,
  isSalesforceAutoPushEnabled,
  markActivityForSync,
} from './crm/adapters/salesforce'

export type {
  SalesforceRecord,
  SalesforceQueryOptions,
  SyncMarkResult,
} from './crm/adapters/salesforce'
