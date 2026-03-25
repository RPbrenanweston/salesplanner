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

/** Extract a plain string from an Attio values array entry */
function extractValue(valuesArray: unknown): string {
  if (!Array.isArray(valuesArray) || valuesArray.length === 0) return '';
  const first = valuesArray[0] as Record<string, unknown>;
  // Different Attio field types store the value under different keys
  if (typeof first.value === 'string') return first.value;
  if (typeof first.first_name === 'string') return first.first_name;
  if (typeof first.last_name === 'string') return first.last_name;
  if (typeof first.email_address === 'string') return first.email_address;
  if (typeof first.domain === 'string') return first.domain;
  if (typeof first.full_name === 'string') return first.full_name;
  return '';
}

/** Extract email specifically — Attio stores emails under email_address */
function extractEmail(valuesArray: unknown): string {
  if (!Array.isArray(valuesArray) || valuesArray.length === 0) return '';
  const first = valuesArray[0] as Record<string, unknown>;
  if (typeof first.email_address === 'string') return first.email_address;
  if (typeof first.value === 'string') return first.value;
  return '';
}

/** Extract domain from Attio domains array */
function extractDomain(valuesArray: unknown): string {
  if (!Array.isArray(valuesArray) || valuesArray.length === 0) return '';
  const first = valuesArray[0] as Record<string, unknown>;
  if (typeof first.domain === 'string') return first.domain;
  if (typeof first.value === 'string') return first.value;
  return '';
}

/** Extract first name from Attio name field */
function extractFirstName(valuesArray: unknown): string {
  if (!Array.isArray(valuesArray) || valuesArray.length === 0) return '';
  const first = valuesArray[0] as Record<string, unknown>;
  if (typeof first.first_name === 'string') return first.first_name;
  return '';
}

/** Extract last name from Attio name field */
function extractLastName(valuesArray: unknown): string {
  if (!Array.isArray(valuesArray) || valuesArray.length === 0) return '';
  const first = valuesArray[0] as Record<string, unknown>;
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
  id: { record_id: string };
  values: AttioRecordValues;
}

interface AttioQueryResponse {
  data: AttioApiRecord[];
  next_page_offset: number | null;
}

interface AttioListApiEntry {
  id: string | { list_id: string };
  api_slug: string;
  name: string;
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
  next_page_offset: number | null;
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
  let offset: number | null = 0;

  while (offset !== null) {
    const response = await fetch(`${ATTIO_API}/objects/people/records/query`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ limit: 500, offset }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Attio API error (people): ${response.status} ${errorText}`);
    }

    const result = (await response.json()) as AttioQueryResponse;

    for (const record of result.data) {
      const v = record.values ?? {};
      console.log('[Attio debug] fetchAttioPeople record.values:', v, 'record.id:', record.id);
      people.push({
        externalId: record.id?.record_id ?? '',
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
  let offset: number | null = 0;

  while (offset !== null) {
    const response = await fetch(`${ATTIO_API}/objects/companies/records/query`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ limit: 500, offset }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Attio API error (companies): ${response.status} ${errorText}`);
    }

    const result = (await response.json()) as AttioQueryResponse;

    for (const record of result.data) {
      const v = record.values ?? {};
      console.log('[Attio debug] fetchAttioCompanies record.values:', v, 'record.id:', record.id);
      companies.push({
        externalId: record.id?.record_id ?? '',
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
  console.log('[Attio debug] fetchAttioLists raw result.data:', JSON.stringify(result.data?.slice(0, 3)));

  return (result.data || [])
    .filter((entry) => {
      console.log('[Attio debug] fetchAttioLists entry:', entry, 'entry.name:', entry?.name);
      return entry != null && entry.name != null;
    })
    .map((entry) => ({
      id: typeof entry.id === 'string' ? entry.id : entry.id?.list_id ?? '',
      name: entry.name ?? 'Unnamed List',
      apiSlug: entry.api_slug ?? '',
    }));
}

/**
 * Fetch entries from a specific Attio List.
 *
 * Two-step process:
 *   1. Query the list entries endpoint to collect parent_record_ids.
 *      (Entry `values` contain list-level attributes like stage — NOT person data.)
 *   2. Batch-GET the actual person records by ID (20 concurrent) to get name/email/title.
 */
export async function fetchAttioListEntries(
  userId: string,
  orgId: string,
  listId: string
): Promise<AttioPerson[]> {
  const token = await getAttioToken(userId, orgId);
  if (!token) throw new Error('No Attio connection found. Please connect Attio first.');

  // ── Step 1: collect parent_record_ids from list entries ──────────────────
  const parentRecordIds: string[] = [];
  let offset: number | null = 0;

  while (offset !== null) {
    const response = await fetch(`${ATTIO_API}/lists/${listId}/entries/query`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ limit: 500, offset }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Attio API error (list entries): ${response.status} ${errorText}`);
    }

    const result = (await response.json()) as AttioListEntriesResponse;
    console.log('[Attio debug] fetchAttioListEntries page — entries:', result.data?.length, 'sample:', JSON.stringify(result.data?.[0])?.slice(0, 150));

    for (const entry of result.data) {
      const id = entry.parent_record_id || entry.record_id;
      if (id) parentRecordIds.push(id);
    }

    offset = result.next_page_offset ?? null;
  }

  if (parentRecordIds.length === 0) return [];

  // ── Step 2: batch-GET the actual person records (20 concurrent) ──────────
  const people: AttioPerson[] = [];
  const BATCH = 20;

  for (let i = 0; i < parentRecordIds.length; i += BATCH) {
    const batch = parentRecordIds.slice(i, i + BATCH);

    const records = await Promise.all(
      batch.map(async (recordId) => {
        const resp = await fetch(`${ATTIO_API}/objects/people/records/${recordId}`, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });
        if (!resp.ok) {
          console.warn('[Attio debug] person GET failed for', recordId, resp.status);
          return null;
        }
        const json = await resp.json();
        return json.data as AttioApiRecord;
      })
    );

    for (const record of records) {
      if (!record) continue;
      const v = record.values ?? {};
      console.log('[Attio debug] person record.id:', record.id?.record_id, 'values keys:', Object.keys(v).join(', '));
      people.push({
        externalId: record.id?.record_id ?? '',
        firstName: extractFirstName(v.name),
        lastName: extractLastName(v.name),
        email: extractEmail(v.email_addresses),
        title: extractValue(v.job_title),
        company: extractValue(v.company),
      });
    }

    // Brief pause between batches to stay within Attio's 100 req/s limit
    if (i + BATCH < parentRecordIds.length) {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }

  return people;
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
