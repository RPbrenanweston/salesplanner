# SalesBlock — Work Remaining
> Last updated: 2026-03-09 | Branch: ralph/modern-editor

This document consolidates open work items from two sources:
1. **Breadcrumb `@hazard` / `@prompt` annotations** — architectural risks flagged inside source files
2. **Session findings** — bugs and gaps discovered during the 2026-03-09 session

---

## ✅ Completed This Session

| Item | File | Commit |
|------|------|--------|
| Empty session contact queue — `list_contacts` empty when session opens | `SalesBlockSessionPage.tsx` | `824264d` |
| TS2589 deep type error in filter fallback | `SalesBlockSessionPage.tsx` | `3a23507` |

---

## 🔴 High Priority — Known Bugs

### 1. ImportCSVModal — skipped/updated contacts not linked to selected list
**File:** `frontend/src/components/ImportCSVModal.tsx`
**Source:** Session finding (2026-03-09)
**Problem:** When a user imports a CSV and selects a list, only *newly inserted* contacts are added to `list_contacts`. Contacts that were skipped (already exist) or updated (upserted) are silently never linked to the list. If the user's contacts already exist in the database and they re-import with the intent of adding them to a new list, nothing gets linked.
**Fix:** After the import loop completes, collect the IDs of all contacts that were `skipped` or `updated` AND a `selectedListId` is set, then insert those IDs into `list_contacts`.

### 2. SalesBlockSessionPage — setInterval memory leak
**File:** `frontend/src/pages/SalesBlockSessionPage.tsx`
**Source:** Breadcrumb `@hazard`
**Problem:** The elapsed timer `setInterval` has no cleanup guard. If the user navigates away mid-session, the interval continues firing, causing memory leak and stale state updates (`setState` on unmounted component).
**Fix:** In the `useEffect` that sets up the interval, return `() => clearInterval(intervalRef)` as cleanup.

### 3. SalesBlockSessionPage — session_notes column may not exist
**File:** `frontend/src/pages/SalesBlockSessionPage.tsx`
**Source:** Breadcrumb `@hazard`
**Problem:** Session completion writes `sessionNotes` to the `salesblocks` table. If the `session_notes` column doesn't exist (it may have been added later in a migration that wasn't applied), the write silently fails and session notes are lost.
**Fix:** Verify `session_notes` column exists in `supabase/migrations/`. If missing, create a migration to add it. Add error handling so the user is notified if the write fails.

---

## 🟡 Medium Priority — Quality / Reliability

### 4. ListBuilderModal — no debounce on preview count query
**File:** `frontend/src/components/ListBuilderModal.tsx`
**Source:** Breadcrumb `@hazard`
**Problem:** Contact preview count runs a Supabase query on every filter change with no debounce. Rapid edits fire multiple concurrent queries; the UI may show a stale count if responses arrive out of order (race condition).
**Fix:** Wrap the preview query in a `useDebounce` hook (300–500ms). Cancel in-flight requests using an abort controller or generation counter.

### 5. CreateSalesBlockModal — calendar event failure is silent
**File:** `frontend/src/components/CreateSalesBlockModal.tsx`
**Source:** Breadcrumb `@hazard`
**Problem:** `createCalendarEvent` is called inside the salesblock creation flow. If it fails (calendar not connected, OAuth expired), the salesblock is created but the user gets no feedback that the calendar event was never made.
**Fix:** Show an explicit toast after creation: either "Calendar event created ✓" or "SalesBlock created — calendar event failed (calendar not connected)". Don't block salesblock creation on calendar failure.

### 6. CreateSalesBlockModal — auth race condition
**File:** `frontend/src/components/CreateSalesBlockModal.tsx`
**Source:** Breadcrumb `@hazard`
**Problem:** The salesblock is inserted with `user_id` from `useAuth`. If `useAuth` returns a null user (race condition during auth state hydration), the insert fails silently or creates an unowned salesblock.
**Fix:** Guard the form render — don't show the form at all until `user` is non-null. Add a loading state if auth is still hydrating.

---

## 🟢 Low Priority — Architecture / Future Hardening

### 7. ImportCSVModal — single bulk insert for large files
**File:** `frontend/src/components/ImportCSVModal.tsx`
**Source:** Breadcrumb `@hazard`
**Problem:** All parsed rows are sent in one Supabase insert call. Large CSVs (1,000+ rows) may hit Supabase's per-request row limit and silently fail or partially insert.
**Fix:** Chunk inserts into batches of 500. Show per-batch progress. Report per-row errors in the summary modal.

### 8. ImportCSVModal — large CSV blocks main thread
**File:** `frontend/src/components/ImportCSVModal.tsx`
**Source:** Breadcrumb `@hazard`
**Problem:** PapaParse runs synchronously on the main thread. A 10,000+ row CSV will visibly freeze the UI during parsing.
**Fix:** Use PapaParse streaming mode or move parsing to a Web Worker.

### 9. ListBuilderModal — stored filter criteria not schema-versioned
**File:** `frontend/src/components/ListBuilderModal.tsx`
**Source:** Breadcrumb `@hazard`
**Problem:** Filter criteria are stored as raw JSON. If the `contacts` table schema changes (column renamed/removed), existing stored filters silently return 0 results with no error shown to the user.
**Fix:** Add a `version` field to the `filter_criteria` JSON. Add a migration utility that updates stored filters when schema changes. Validate filter fields against known schema before executing queries.

### 10. SalesBlockSessionPage — no session resume after navigation
**File:** `frontend/src/pages/SalesBlockSessionPage.tsx`
**Source:** Breadcrumb `@prompt`
**Problem:** If the user accidentally navigates away mid-session, all progress (call notes, current position in queue, elapsed time) is lost.
**Fix:** Persist session state (current contact index, notes, elapsed seconds) to `localStorage` keyed by `salesblock_id`. On session load, check for a saved state and offer "Resume where you left off?"

---

## Design Token Status

| Area | Status |
|------|--------|
| MarketingPage | ✅ VV applied |
| Home | ✅ VV applied (dark + light variants) |
| PricingPage | ✅ VV applied |
| OAuth callbacks (Google, Outlook, Salesforce) | ✅ VV applied |
| DealDetailModal | ✅ VV applied |
| SalesBlockSessionPage | ✅ VV applied |
| Remaining app pages (Lists, Contacts, Pipeline, etc.) | 🔲 Not yet started |

---

## Branch State

| Branch | Purpose | Status |
|--------|---------|--------|
| `ralph/modern-editor` | Active work | Latest commits here |
| `ralph/salesblock-io` | Vercel deploy target | Kept in sync with modern-editor |
