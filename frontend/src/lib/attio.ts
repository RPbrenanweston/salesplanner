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
  id: string | { record_id: string };
  values?: AttioRecordValues;
}

interface AttioQueryResponse {
  data: AttioApiRecord[];
  next_page_offset: number | null;
}

interface AttioListApiEntry {
  id: string | { list_id: string };
  api_slug: string;
  name: string;
  parent_object: string;
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

  return (result.data ?? []).filter(Boolean).map((entry) => ({
    id: typeof entry.id === 'string' ? entry.id : entry.id?.list_id ?? '',
    name: entry.name ?? 'Untitled',
    apiSlug: entry.api_slug ?? '',
    parentObject: entry.parent_object ?? 'people',
  }));
}

/**
 * Fetch entries from a specific Attio List as People.
 * Uses POST /v2/lists/{listId}/entries/query
 */
export async function fetchAttioListEntriesAsPeople(
  userId: string,
  orgId: string,
  listId: string
): Promise<AttioPerson[]> {
  const entries = await fetchListEntriesRaw(userId, orgId, listId);
  return entries.map((entry) => {
    const v = entry.values ?? {};
    return {
      externalId: entry.record_id || entry.parent_record_id || '',
      firstName: extractFirstName(v.name),
      lastName: extractLastName(v.name),
      email: extractEmail(v.email_addresses),
      title: extractValue(v.job_title),
      company: extractValue(v.company),
    };
  });
}

/**
 * Fetch entries from a specific Attio List as Companies.
 */
export async function fetchAttioListEntriesAsCompanies(
  userId: string,
  orgId: string,
  listId: string
): Promise<AttioCompany[]> {
  const entries = await fetchListEntriesRaw(userId, orgId, listId);
  return entries.map((entry) => {
    const v = entry.values ?? {};
    return {
      externalId: entry.record_id || entry.parent_record_id || '',
      name: extractValue(v.name),
      domain: extractDomain(v.domains),
      industry: extractValue(v.categories),
    };
  });
}

/** Internal: paginate through list entries */
async function fetchListEntriesRaw(
  userId: string,
  orgId: string,
  listId: string
): Promise<AttioListEntryRecord[]> {
  const token = await getAttioToken(userId, orgId);
  if (!token) throw new Error('No Attio connection found. Please connect Attio first.');

  const all: AttioListEntryRecord[] = [];
  let offset: number | null = 0;

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
      if (entry) all.push(entry);
    }
    offset = result.next_page_offset ?? null;
  }

  return all;
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
