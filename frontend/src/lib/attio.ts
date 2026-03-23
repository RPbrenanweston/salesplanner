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

/** Page size for Attio query endpoints (max 500 per their REST API docs) */
const PAGE_SIZE = 500;

/** Concurrency limit for parallel individual record fetches */
const FETCH_CONCURRENCY = 10;

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

/** Convert an Attio API record into our AttioPerson type */
function recordToPerson(record: AttioApiRecord): AttioPerson {
  const v = record.values ?? {};
  return {
    externalId: extractRecordId(record),
    firstName: extractFirstName(v.name),
    lastName: extractLastName(v.name),
    email: extractEmail(v.email_addresses),
    title: extractValue(v.job_title),
    company: extractValue(v.company),
  };
}

/** Convert an Attio API record into our AttioCompany type */
function recordToCompany(record: AttioApiRecord): AttioCompany {
  const v = record.values ?? {};
  return {
    externalId: extractRecordId(record),
    name: extractValue(v.name),
    domain: extractDomain(v.domains),
    industry: extractValue(v.categories),
  };
}

/** Extract the record_id string from Attio's nested or string id */
function extractRecordId(record: AttioApiRecord): string {
  if (typeof record.id === 'string') return record.id;
  return record.id?.record_id ?? '';
}

// ---------------------------------------------------------------------------
// Attio API response shapes (minimal typing for what we need)
// ---------------------------------------------------------------------------

interface AttioRecordValues {
  [key: string]: unknown;
}

interface AttioApiRecord {
  id: string | { record_id: string; [key: string]: unknown };
  values?: AttioRecordValues;
}

interface AttioQueryResponse {
  data: AttioApiRecord[];
  next_page_offset?: number | null;
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
  entry_id?: string;
  parent_object?: string;
  parent_record_id?: string;
  record_id?: string;
  [key: string]: unknown;
}

interface AttioListEntriesResponse {
  data: AttioListEntryRecord[];
  next_page_offset?: number | null;
}

// ---------------------------------------------------------------------------
// Core fetchers — paginated query endpoint
// ---------------------------------------------------------------------------

/**
 * Paginated fetch of ALL records from an Attio object (people or companies).
 * Uses POST /v2/objects/{type}/records/query with offset-based pagination.
 * Continues until next_page_offset is null/undefined or no data returned.
 */
async function fetchAllRecordsFromObject(
  token: string,
  objectType: 'people' | 'companies'
): Promise<AttioApiRecord[]> {
  const allRecords: AttioApiRecord[] = [];
  let offset = 0;
  let pageNum = 0;

  // Safety: max 50 pages (25,000 records) to prevent infinite loops
  while (pageNum < 50) {
    const body: Record<string, unknown> = { limit: PAGE_SIZE };
    if (offset > 0) body.offset = offset;

    const response = await fetch(`${ATTIO_API}/objects/${objectType}/records/query`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Attio API error (${objectType}): ${response.status} ${errorText}`);
    }

    const result = (await response.json()) as AttioQueryResponse;
    const pageData = result.data ?? [];

    console.log(`[Attio] ${objectType} page ${pageNum}: ${pageData.length} records, next_page_offset: ${JSON.stringify(result.next_page_offset)}, total so far: ${allRecords.length + pageData.length}`);

    // Debug first record shape
    if (allRecords.length === 0 && pageData.length > 0) {
      console.log(`[Attio] First ${objectType} record shape:`, JSON.stringify(pageData[0], null, 2).slice(0, 2000));
    }

    allRecords.push(...pageData);

    // Stop conditions:
    // 1. No data returned — we've exhausted the dataset
    if (pageData.length === 0) break;
    // 2. Got fewer records than page size — this was the last page
    if (pageData.length < PAGE_SIZE) break;
    // 3. Attio returned a next_page_offset — use it
    if (result.next_page_offset != null && typeof result.next_page_offset === 'number') {
      offset = result.next_page_offset;
    } else {
      // 4. No next_page_offset but got full page — manually increment (Attio may omit field)
      offset += PAGE_SIZE;
    }
    pageNum++;
  }

  console.log(`[Attio] Total ${objectType} records fetched: ${allRecords.length}`);
  return allRecords;
}

// ---------------------------------------------------------------------------
// Fetch a single record by ID — with retry
// ---------------------------------------------------------------------------

async function fetchRecordById(
  token: string,
  objectType: 'people' | 'companies',
  recordId: string
): Promise<AttioApiRecord | null> {
  try {
    const response = await fetch(`${ATTIO_API}/objects/${objectType}/records/${recordId}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      // Don't throw — just skip this record
      console.warn(`[Attio] Failed to fetch ${objectType} record ${recordId}: ${response.status}`);
      return null;
    }

    const result = (await response.json()) as { data: AttioApiRecord };
    return result.data ?? null;
  } catch (err) {
    console.warn(`[Attio] Error fetching record ${recordId}:`, err);
    return null;
  }
}

/**
 * Batch fetch records by IDs in parallel with concurrency limit.
 * Uses individual GET /v2/objects/{type}/records/{id} calls.
 */
async function fetchRecordsByIds(
  token: string,
  objectType: 'people' | 'companies',
  recordIds: string[]
): Promise<AttioApiRecord[]> {
  const results: AttioApiRecord[] = [];
  const total = recordIds.length;

  // Process in chunks of FETCH_CONCURRENCY
  for (let i = 0; i < total; i += FETCH_CONCURRENCY) {
    const chunk = recordIds.slice(i, i + FETCH_CONCURRENCY);
    const promises = chunk.map((id) => fetchRecordById(token, objectType, id));
    const chunkResults = await Promise.all(promises);

    for (const record of chunkResults) {
      if (record) results.push(record);
    }

    if ((i + FETCH_CONCURRENCY) % 100 === 0 || i + FETCH_CONCURRENCY >= total) {
      console.log(`[Attio] Batch fetch progress: ${Math.min(i + FETCH_CONCURRENCY, total)}/${total} records`);
    }
  }

  console.log(`[Attio] Batch fetch complete: ${results.length}/${total} records retrieved`);
  return results;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fetch all people from Attio with offset-based pagination.
 */
export async function fetchAttioPeople(
  userId: string,
  orgId: string
): Promise<AttioPerson[]> {
  const token = await getAttioToken(userId, orgId);
  if (!token) throw new Error('No Attio connection found. Please connect Attio first.');

  const records = await fetchAllRecordsFromObject(token, 'people');
  return records.filter(Boolean).map(recordToPerson);
}

/**
 * Fetch all companies from Attio with offset-based pagination.
 */
export async function fetchAttioCompanies(
  userId: string,
  orgId: string
): Promise<AttioCompany[]> {
  const token = await getAttioToken(userId, orgId);
  if (!token) throw new Error('No Attio connection found. Please connect Attio first.');

  const records = await fetchAllRecordsFromObject(token, 'companies');
  return records.filter(Boolean).map(recordToCompany);
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

// ---------------------------------------------------------------------------
// List entry fetching — get parent_record_ids with full pagination
// ---------------------------------------------------------------------------

/**
 * Extract all parent_record_ids from a list's entries (fully paginated).
 * Uses POST /v2/lists/{listId}/entries/query
 */
async function fetchListParentRecordIds(token: string, listId: string): Promise<string[]> {
  const ids: string[] = [];
  let offset = 0;
  let pageNum = 0;

  while (pageNum < 100) {
    const body: Record<string, unknown> = { limit: PAGE_SIZE };
    if (offset > 0) body.offset = offset;

    const response = await fetch(`${ATTIO_API}/lists/${listId}/entries/query`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Attio API error (list entries): ${response.status} ${errorText}`);
    }

    const result = (await response.json()) as AttioListEntriesResponse;
    const pageData = result.data ?? [];

    // Debug first entry
    if (ids.length === 0 && pageData.length > 0) {
      console.log('[Attio] First list entry shape:', JSON.stringify(pageData[0], null, 2).slice(0, 1500));
    }
    console.log(`[Attio] List entries page ${pageNum}: ${pageData.length} entries, next_page_offset: ${JSON.stringify(result.next_page_offset)}, total IDs so far: ${ids.length}`);

    for (const entry of pageData) {
      // Try multiple fields — Attio may use different structures
      const parentId = entry?.parent_record_id ?? entry?.record_id;
      if (parentId) ids.push(parentId);
    }

    // Stop conditions
    if (pageData.length === 0) break;
    if (pageData.length < PAGE_SIZE) break;
    if (result.next_page_offset != null && typeof result.next_page_offset === 'number') {
      offset = result.next_page_offset;
    } else {
      offset += PAGE_SIZE;
    }
    pageNum++;
  }

  console.log(`[Attio] Total list entry IDs collected: ${ids.length}`);
  return ids;
}

// ---------------------------------------------------------------------------
// List import — two strategies with automatic fallback
// ---------------------------------------------------------------------------

/**
 * Fetch entries from a specific Attio List as People.
 *
 * Strategy:
 * 1. Get all parent_record_ids from list entries (fully paginated)
 * 2. Try batch fetching individual records by ID (most accurate for large lists)
 * 3. If batch fetch fails (>50% errors), fall back to fetch-all-and-filter
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

  console.log(`[Attio] List has ${recordIds.length} people IDs. Trying batch fetch by ID...`);

  // Strategy 1: Batch fetch by ID
  const records = await fetchRecordsByIds(token, 'people', recordIds);
  const successRate = records.length / recordIds.length;

  if (successRate >= 0.5) {
    console.log(`[Attio] Batch fetch succeeded: ${records.length}/${recordIds.length} records`);
    return records.map(recordToPerson);
  }

  // Strategy 2: Fallback — fetch all and filter
  console.log(`[Attio] Batch fetch had low success rate (${(successRate * 100).toFixed(0)}%), falling back to fetch-all-and-filter...`);
  const idSet = new Set(recordIds);
  const allPeople = await fetchAllRecordsFromObject(token, 'people');
  const filtered = allPeople.filter((r) => idSet.has(extractRecordId(r)));
  console.log(`[Attio] Fallback: ${filtered.length}/${recordIds.length} matched from ${allPeople.length} total`);
  return filtered.map(recordToPerson);
}

/**
 * Fetch entries from a specific Attio List as Companies.
 *
 * Strategy:
 * 1. Get all parent_record_ids from list entries (fully paginated)
 * 2. Try batch fetching individual records by ID (most accurate for large lists)
 * 3. If batch fetch fails (>50% errors), fall back to fetch-all-and-filter
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

  console.log(`[Attio] List has ${recordIds.length} company IDs. Trying batch fetch by ID...`);

  // Strategy 1: Batch fetch by ID
  const records = await fetchRecordsByIds(token, 'companies', recordIds);
  const successRate = records.length / recordIds.length;

  if (successRate >= 0.5) {
    console.log(`[Attio] Batch fetch succeeded: ${records.length}/${recordIds.length} records`);
    return records.map(recordToCompany);
  }

  // Strategy 2: Fallback — fetch all and filter
  console.log(`[Attio] Batch fetch had low success rate (${(successRate * 100).toFixed(0)}%), falling back to fetch-all-and-filter...`);
  const idSet = new Set(recordIds);
  const allCompanies = await fetchAllRecordsFromObject(token, 'companies');
  const filtered = allCompanies.filter((r) => idSet.has(extractRecordId(r)));
  console.log(`[Attio] Fallback: ${filtered.length}/${recordIds.length} matched from ${allCompanies.length} total`);
  return filtered.map(recordToCompany);
}

// ---------------------------------------------------------------------------
// Connection check
// ---------------------------------------------------------------------------

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
