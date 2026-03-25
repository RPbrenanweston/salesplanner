# Handover: Attio Import — "Cannot read properties of undefined (reading 'name')"

## Date: 2026-03-23
## Branch: ralph/salesblock-roadmap
## Worktree: focused-shannon
## Deploy: salesblock-io.vercel.app (Vercel prod)

---

## Current State

The Attio CRM integration is mostly working but has a persistent error:
**"Cannot read properties of undefined (reading 'name')"** appears in the Import from Attio modal on every load.

Despite the error, lists DO load below it (Rob 1st degree connections, AI Security, Deal Flow, etc.).

---

## What Works
- Attio connected via personal access token (stored in `oauth_connections` table)
- Lists page has dual tabs: Contact Lists / Account Lists
- Import modal shows People/Companies toggle with correct labels
- Attio lists load and display with api_slug labels
- "Load All Companies" fetches companies with names + domains
- Company imports now route to `accounts` table (not contacts)
- Contact imports route to `contacts` table
- List creation with `list_type` column works
- `account_list_items` junction table exists with RLS

## What's Broken

### 1. PERSISTENT ERROR: "Cannot read properties of undefined (reading 'name')"
- **Location:** Fires during `fetchAttioLists()` in `frontend/src/lib/attio.ts` line ~274
- **Root cause unknown:** We added `.filter((entry) => entry != null && entry.name != null)` but error persists
- **Theory:** The error may be coming from a DIFFERENT code path, not the list fetch. Possibly:
  - The `fetchAttioListEntries` function (line ~287) which also accesses `.name` on record values
  - The modal's `loadAttioLists` triggers list type detection which fetches individual list metadata
  - A race condition where the error state is set before the filter runs
- **Debug approach:** Add `console.log` before EVERY `.name` access in `attio.ts` to find the exact line

### 2. List imports show wrong count
- "Rob Client List" has 861 entries in Attio but only ~23 show in SalesBlock
- Root cause: `fetchAttioCompanies` pagination may stop after first page (500 records)
- The list import fetches ALL companies then filters by list entry IDs — if pagination caps at 500, only matches within first 500 appear
- Debug: Check console for `[Attio] Companies page: X records, next_page_offset: Y` logs

### 3. Companies previously imported as contacts
- Earlier imports put companies into `contacts` table as "CompanyName (Company)"
- These ghost records need cleanup: `DELETE FROM contacts WHERE first_name LIKE '%(Company)%'`
- New code routes companies to `accounts` table correctly

---

## Key Files

| File | Purpose |
|------|---------|
| `frontend/src/lib/attio.ts` | All Attio API calls — fetch people, companies, lists, list entries |
| `frontend/src/components/ImportAttioModal.tsx` | Import UI — multi-step flow with preview + naming |
| `frontend/src/pages/Lists.tsx` | Lists page with Contact/Account tabs |
| `frontend/src/pages/ListDetailPage.tsx` | List detail — shows contacts or accounts based on list_type |
| `frontend/src/components/AttioOAuthButton.tsx` | Attio connection button (uses personal access token) |
| `supabase/migrations/20260323100000_add_list_type_and_account_list_items.sql` | Migration for list_type + account_list_items |

---

## Supabase Tables

| Table | Status |
|-------|--------|
| `lists` | Has `list_type` column (default 'contacts') — MIGRATED |
| `account_list_items` | Junction table for account lists — MIGRATED with RLS |
| `list_contacts` | Existing junction for contact lists |
| `oauth_connections` | Stores Attio token (provider='attio') — has RLS INSERT policy |
| `accounts` | Company records |
| `contacts` | People records (has ghost company records from bad imports) |

---

## Attio API Notes

- Personal access token: stored in `oauth_connections` as `access_token`
- API base: `https://api.attio.com/v2`
- Lists endpoint: `GET /v2/lists` — returns `{ data: [{ id: { list_id: "..." }, name: "...", api_slug: "..." }] }`
- Some list entries may have `id` as string instead of `{ list_id: "..." }`
- Records query: `POST /v2/objects/{type}/records/query` with `{ limit: 500, offset: N }`
- List entries: `POST /v2/lists/{listId}/entries/query`
- `parent_record_id` on list entries references the record in the parent object
- Attio MCP tools available: `list-records-in-list` (max 50/page), `get-records-by-ids` (batch), `list-records` (max 50/page)

---

## Priority Fix Order

1. **Fix the "name" error** — find exact line, add null guard or try/catch
2. **Fix pagination** — ensure all pages fetched (check `next_page_offset` handling)
3. **Clean up ghost company contacts** — DELETE from contacts where they're company records
4. **Test full import flow** — Companies → Account List, People → Contact List

---

## Environment

- Vercel project: `salesblock-io` (prj_BHSz6WIvah1yFUEmuh8G3lgaXytT)
- Supabase project: `ncalbnavyxvzdwugzrgi`
- Attio workspace: `brenan-weston`
- Attio token env var: `VITE_ATTIO_ACCESS_TOKEN` (set in Vercel)
