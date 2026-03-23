// Attio CRM API adapter
// Provides functions to fetch people, companies, and lists from Attio's REST API
// Attio API docs: https://docs.attio.com/reference

import { supabase } from './supabase';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AttioList {
  id: string;
  name: string;
  apiSlug: string;
  /** 'people' | 'companies' | 'deals' etc — the record type this list contains */
  parentObject: string;
}

export interface AttioPerson {
  externalId: string;
  firstName: string;
  lastName: string;
  email: string;
  title: string;
  company: string;
}

export interface AttioCompany {
  externalId: string;
  name: string;
  domain: string;
  industry: string;
}

/** Union type used by the modal to display any kind of Attio record */
export type AttioRecord = AttioPerson | AttioCompany;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const ATTIO_API = 'https://api.attio.com/v2';

/**
 * Retrieve the stored Attio access token for the current user.
 * Falls back to null when no connection exists.
 */
async function getAttioToken(userId: string, orgId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('oauth_connections')
    .select('access_token')
    .eq('user_id', userId)
    .eq('provider', 'attio')
    .eq('org_id', orgId)
    .maybeSingle();

  if (error || !data) return null;
  return data.access_token;
}

/**
 * Extract a plain string from an Attio values array entry.
 * Attio values are arrays like: [{ value: "x", active_from: "...", ... }]
 * Different field types use different keys for the actual value.
 */
function extractValue(valuesArray: unknown): string {
  if (!Array.isArray(valuesArray) || valuesArray.length === 0) return '';
  const first = valuesArray[0] as Record<string, unknown>;
  if (!first || typeof first !== 'object') return '';
  // Check known value keys in priority order
  for (const key of ['value', 'first_name', 'last_name', 'email_address', 'domain', 'full_name', 'phone_number']) {
    if (typeof first[key] === 'string') return first[key] as string;
  }
  // Fallback: find any string value that isn't metadata
  const metaKeys = new Set(['active_from', 'active_until', 'attribute_type', 'created_by_actor', 'id', 'type']);
  for (const [k, v] of Object.entries(first)) {
    if (typeof v === 'string' && !metaKeys.has(k) && v.length > 0 && !v.startsWith('20')) return v;
  }
  return '';
}

function extractEmail(valuesArray: unknown): string {
  if (!Array.isArray(valuesArray) || valuesArray.length === 0) return '';
  const first = valuesArray[0] as Record<string, unknown>;
  if (!first || typeof first !== 'object') return '';
  if (typeof first.email_address === 'string') return first.email_address;
  if (typeof first.value === 'string') return first.value;
  if (typeof first.original_email_address === 'string') return first.original_email_address;
  return '';
}

function extractDomain(valuesArray: unknown): string {
  if (!Array.isArray(valuesArray) || valuesArray.length === 0) return '';
  const first = valuesArray[0] as Record<string, unknown>;
  if (!first || typeof first !== 'object') return '';
  if (typeof first.domain === 'string') return first.domain;
  if (typeof first.root_domain === 'string') return first.root_domain;
  if (typeof first.value === 'string') return first.value;
  return '';
}

function extractFirstName(valuesArray: unknown): string {
  if (!Array.isArray(valuesArray) || valuesArray.length === 0) return '';
  const first = valuesArray[0] as Record<string, unknown>;
  if (!first || typeof first !== 'object') return '';
  if (typeof first.first_name === 'string') return first.first_name;
  if (typeof first.value === 'string') return first.value;
  return '';
}

function extractLastName(valuesArray: unknown): string {
  if (!Array.isArray(valuesArray) || valuesArray.length === 0) return '';
  const first = valuesArray[0] as Record<string, unknown>;
  if (!first || typeof first !== 'object') return '';
  if (typeof first.last_name === 'string') return first.last_name;
  return '';
}

// ---------------------------------------------------------------------------
// Attio API response shapes (minimal typing for what we need)
// ---------------------------------------------------------------------------

interface AttioRecordValues {
  [key: string]: unknown;
}

interface AttioApiRecord {
  id: string | { record_id: string };
  values?: AttioRecordValues;
}

interface AttioQueryResponse {
  data: AttioApiRecord[];
  next_page_offset: number | string | null;
}

interface AttioListApiEntry {
  id: string | { list_id: string };
  api_slug: string;
  name: string;
  /** Array of parent object slugs, e.g. ["people"] or ["companies"] */
  parent_object: string[];
}

interface AttioListsResponse {
  data: AttioListApiEntry[];
}

interface AttioListEntryRecord {
  entry_id: string;
  parent_object: string;
  parent_record_id: string;
  record_id: string;
  values: AttioRecordValues;
}

interface AttioListEntriesResponse {
  data: AttioListEntryRecord[];
  next_page_offset: number | string | null;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fetch all people from Attio with offset-based pagination.
 * Uses POST /v2/objects/people/records/query
 */
export async function fetchAttioPeople(
  userId: string,
  orgId: string
): Promise<AttioPerson[]> {
  const token = await getAttioToken(userId, orgId);
  if (!token) throw new Error('No Attio connection found. Please connect Attio first.');

  const people: AttioPerson[] = [];
  let offset: number | string | null = 0;

  while (offset !== null) {
    const body: Record<string, unknown> = { limit: 500 };
    if (offset !== 0) body.offset = offset;

    const response = await fetch(`${ATTIO_API}/objects/people/records/query`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Attio API error (people): ${response.status} ${errorText}`);
    }

    const result = (await response.json()) as AttioQueryResponse;
    console.log(`[Attio] People page: ${result.data.length} records, next_page_offset: ${result.next_page_offset}`);

    for (const record of result.data) {
      if (!record) continue;
      const v = record.values ?? {};
      const recordId = typeof record.id === 'string' ? record.id : record.id?.record_id ?? '';
      people.push({
        externalId: recordId,
        firstName: extractFirstName(v.name),
        lastName: extractLastName(v.name),
        email: extractEmail(v.email_addresses),
        title: extractValue(v.job_title),
        company: extractValue(v.company),
      });
    }

    offset = result.next_page_offset ?? null;
  }

  return people;
}

/**
 * Fetch all companies from Attio with offset-based pagination.
 * Uses POST /v2/objects/companies/records/query
 */
export async function fetchAttioCompanies(
  userId: string,
  orgId: string
): Promise<AttioCompany[]> {
  const token = await getAttioToken(userId, orgId);
  if (!token) throw new Error('No Attio connection found. Please connect Attio first.');

  const companies: AttioCompany[] = [];
  let offset: number | string | null = 0;

  while (offset !== null) {
    const body: Record<string, unknown> = { limit: 500 };
    if (offset !== 0) body.offset = offset;

    const response = await fetch(`${ATTIO_API}/objects/companies/records/query`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Attio API error (companies): ${response.status} ${errorText}`);
    }

    const result = (await response.json()) as AttioQueryResponse;
    console.log(`[Attio] Companies page: ${result.data.length} records, next_page_offset: ${result.next_page_offset}`);

    // Debug: log first record to understand API response shape
    if (companies.length === 0 && result.data.length > 0) {
      console.log('[Attio] First company record shape:', JSON.stringify(result.data[0], null, 2).slice(0, 2000));
    }

    for (const record of result.data) {
      if (!record) continue;
      const v = record.values ?? {};
      const recordId = typeof record.id === 'string' ? record.id : record.id?.record_id ?? '';
      companies.push({
        externalId: recordId,
        name: extractValue(v.name),
        domain: extractDomain(v.domains),
        industry: extractValue(v.categories),
      });
    }

    offset = result.next_page_offset ?? null;
  }

  return companies;
}

/**
 * Fetch all Attio Lists visible to the workspace.
 * Uses GET /v2/lists
 */
export async function fetchAttioLists(
  userId: string,
  orgId: string
): Promise<AttioList[]> {
  const token = await getAttioToken(userId, orgId);
  if (!token) throw new Error('No Attio connection found. Please connect Attio first.');

  const response = await fetch(`${ATTIO_API}/lists`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Attio API error (lists): ${response.status} ${errorText}`);
  }

  const result = (await response.json()) as AttioListsResponse;

  return (result.data ?? []).filter(Boolean).map((entry) => {
    // parent_object is an array like ["people"] or ["companies"]
    const parentArr = Array.isArray(entry.parent_object) ? entry.parent_object : [];
    return {
      id: typeof entry.id === 'string' ? entry.id : entry.id?.list_id ?? '',
      name: entry.name ?? 'Untitled',
      apiSlug: entry.api_slug ?? '',
      parentObject: parentArr[0] ?? 'people',
    };
  });
}

/**
 * Fetch entries from a specific Attio List as People.
 * Strategy: get parent_record_ids from list entries, then fetch ALL people
 * via the query endpoint and filter to only those in the list.
 */
export async function fetchAttioListEntriesAsPeople(
  userId: string,
  orgId: string,
  listId: string
): Promise<AttioPerson[]> {
  const token = await getAttioToken(userId, orgId);
  if (!token) throw new Error('No Attio connection found. Please connect Attio first.');

  const recordIds = await fetchListParentRecordIds(token, listId);
  if (recordIds.length === 0) return [];

  const idSet = new Set(recordIds);
  const allPeople = await fetchAttioPeople(userId, orgId);
  return allPeople.filter((p) => idSet.has(p.externalId));
}

/**
 * Fetch entries from a specific Attio List as Companies.
 * Strategy: get parent_record_ids from list entries, then fetch ALL companies
 * via the query endpoint and filter to only those in the list.
 */
export async function fetchAttioListEntriesAsCompanies(
  userId: string,
  orgId: string,
  listId: string
): Promise<AttioCompany[]> {
  const token = await getAttioToken(userId, orgId);
  if (!token) throw new Error('No Attio connection found. Please connect Attio first.');

  const recordIds = await fetchListParentRecordIds(token, listId);
  if (recordIds.length === 0) return [];

  const idSet = new Set(recordIds);
  const allCompanies = await fetchAttioCompanies(userId, orgId);
  return allCompanies.filter((c) => idSet.has(c.externalId));
}

/** Extract parent_record_ids from all list entries (paginated) */
async function fetchListParentRecordIds(token: string, listId: string): Promise<string[]> {
  const ids: string[] = [];
  let offset: number | string | null = 0;

  while (offset !== null) {
    const response = await fetch(`${ATTIO_API}/lists/${listId}/entries/query`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ offset }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Attio API error (list entries): ${response.status} ${errorText}`);
    }

    const result = (await response.json()) as AttioListEntriesResponse;
    for (const entry of result.data) {
      if (entry?.parent_record_id) ids.push(entry.parent_record_id);
    }
    offset = result.next_page_offset ?? null;
  }

  return ids;
}

/**
 * Check if an Attio connection exists for the current user/org.
 */
export async function getAttioConnection(
  userId: string,
  orgId: string
): Promise<boolean> {
  const token = await getAttioToken(userId, orgId);
  return token !== null;
}
