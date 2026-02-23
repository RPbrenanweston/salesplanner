import { supabase } from './supabase';

// Salesforce field mapping interfaces
export interface SalesforceRecord {
  Id: string;
  FirstName?: string;
  LastName?: string;
  Name?: string; // Account name
  Email?: string;
  Phone?: string;
  Company?: string; // Lead only
  Title?: string;
  CreatedDate: string;
  LastModifiedDate: string;
}

export interface SalesforceQueryOptions {
  objectType: 'Lead' | 'Contact' | 'Account';
  ownerId?: string;
  startDate?: string;
  endDate?: string;
}

/**
 * Fetch Salesforce records using REST API
 * Returns: { records: SalesforceRecord[], totalSize: number }
 */
export async function querySalesforceRecords(
  accessToken: string,
  instanceUrl: string,
  options: SalesforceQueryOptions
): Promise<{ records: SalesforceRecord[]; totalSize: number }> {
  const { objectType, ownerId, startDate, endDate } = options;

  // Build SOQL query based on object type
  let fields: string;
  let whereClause = '';

  switch (objectType) {
    case 'Lead':
      fields = 'Id, FirstName, LastName, Email, Phone, Company, Title, CreatedDate, LastModifiedDate';
      break;
    case 'Contact':
      fields = 'Id, FirstName, LastName, Email, Phone, Title, CreatedDate, LastModifiedDate';
      break;
    case 'Account':
      fields = 'Id, Name, Phone, CreatedDate, LastModifiedDate';
      break;
  }

  // Build WHERE conditions
  const conditions: string[] = [];
  if (ownerId) {
    conditions.push(`OwnerId = '${ownerId}'`);
  }
  if (startDate) {
    conditions.push(`CreatedDate >= ${startDate}`);
  }
  if (endDate) {
    conditions.push(`CreatedDate <= ${endDate}`);
  }

  if (conditions.length > 0) {
    whereClause = ' WHERE ' + conditions.join(' AND ');
  }

  const soql = `SELECT ${fields} FROM ${objectType}${whereClause} ORDER BY CreatedDate DESC LIMIT 200`;

  // Execute SOQL query via Salesforce REST API
  const queryUrl = `${instanceUrl}/services/data/v59.0/query?q=${encodeURIComponent(soql)}`;

  const response = await fetch(queryUrl, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Salesforce API error: ${response.status} ${error}`);
  }

  const data = await response.json();
  return {
    records: data.records || [],
    totalSize: data.totalSize || 0,
  };
}

/**
 * Get current Salesforce user ID from /services/oauth2/userinfo endpoint
 */
export async function getSalesforceUserId(accessToken: string, instanceUrl: string): Promise<string> {
  const response = await fetch(`${instanceUrl}/services/oauth2/userinfo`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch Salesforce user info');
  }

  const data = await response.json();
  return data.user_id;
}

/**
 * Map Salesforce record to SalesBlock contact format
 */
export function mapSalesforceToContact(
  record: SalesforceRecord,
  objectType: 'Lead' | 'Contact' | 'Account',
  orgId: string,
  userId: string
): {
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  title: string | null;
  source: string;
  salesforce_id: string;
  org_id: string;
  created_by: string;
} {
  let firstName = null;
  let lastName = null;
  let company = null;

  if (objectType === 'Lead' || objectType === 'Contact') {
    firstName = record.FirstName || null;
    lastName = record.LastName || null;
    company = objectType === 'Lead' ? (record.Company || null) : null;
  } else if (objectType === 'Account') {
    // For Accounts, split Name into first/last
    const nameParts = (record.Name || '').split(' ');
    firstName = nameParts[0] || null;
    lastName = nameParts.slice(1).join(' ') || null;
    company = record.Name || null;
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
  };
}

/**
 * Check if Salesforce is connected for the current user
 */
export async function getSalesforceConnection(): Promise<{
  access_token: string;
  instance_url: string;
} | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('oauth_connections')
    .select('access_token, metadata')
    .eq('provider', 'salesforce')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error || !data) return null;

  const instanceUrl = (data.metadata as { instance_url?: string })?.instance_url;
  if (!instanceUrl) return null;

  return {
    access_token: data.access_token,
    instance_url: instanceUrl,
  };
}

/**
 * Check if Salesforce auto-push activities is enabled for the current user's org
 */
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

/**
 * Mark activity as pending sync to Salesforce (called after activity insert)
 * Non-blocking: logs errors but doesn't throw
 */
export async function markActivityForSync(activityId: string): Promise<void> {
  try {
    const autoPushEnabled = await isSalesforceAutoPushEnabled()
    if (!autoPushEnabled) return // Skip if auto-push disabled

    const connection = await getSalesforceConnection()
    if (!connection) return // Skip if no SF connection

    // Update activity to pending sync status
    await supabase
      .from('activities')
      .update({ sync_status: 'pending' })
      .eq('id', activityId)

    console.log(`Activity ${activityId} marked for Salesforce sync`)
  } catch (error) {
    console.error('Error marking activity for sync:', error)
    // Non-blocking: don't throw error, just log
  }
}
