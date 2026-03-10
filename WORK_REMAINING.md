# SalesBlock — Work Remaining
> Last updated: 2026-03-10 (session 2) | Branch: ralph/modern-editor

This document consolidates open work items from two sources:
1. **Breadcrumb `@hazard` / `@prompt` annotations** — architectural risks flagged inside source files
2. **Session findings** — bugs and gaps discovered during the 2026-03-09 session

---

## ✅ Completed This Session (& Prior Session)

| Item | File | Commit |
|------|------|--------|
| Empty session contact queue — `list_contacts` empty when session opens | `SalesBlockSessionPage.tsx` | `824264d` |
| TS2589 deep type error in filter fallback | `SalesBlockSessionPage.tsx` | `3a23507` |
| ImportCSVModal — skipped/updated contacts not linked to selected list | `ImportCSVModal.tsx` | `034d8e7` |
| SalesBlockSessionPage — setInterval memory leak (cleanup guard in place) | `SalesBlockSessionPage.tsx` | ✅ In code |
| SalesBlockSessionPage — session_notes column exists + error handling | `SalesBlockSessionPage.tsx` | `82f71a8` |
| ListBuilderModal — debounce on preview count query (400ms) | `ListBuilderModal.tsx` | `ed5dbf5` |
| CreateSalesBlockModal — calendar event failure feedback + auth guard | `CreateSalesBlockModal.tsx` | `8a7ff1a` |
| ImportCSVModal — bulk insert chunked into 500-row batches | `ImportCSVModal.tsx` | `9ddb1e0` |
| ImportCSVModal — large CSV blocks main thread (moved to Web Worker) | `ImportCSVModal.tsx` | `23d72eb` |
| SalesBlockSessionPage — no session resume after navigation | `SalesBlockSessionPage.tsx` | `1680e30` |

---

## 🟢 Low Priority — Architecture / Future Hardening (Remaining)

### 8. ListBuilderModal — stored filter criteria not schema-versioned

**File:** `frontend/src/components/ListBuilderModal.tsx`
**Source:** Breadcrumb `@hazard`
**Problem:** Filter criteria are stored as raw JSON. If the `contacts` table schema changes (column renamed/removed), existing stored filters silently return 0 results with no error shown to the user.
**Fix:** Add a `version` field to the `filter_criteria` JSON. Add a migration utility that updates stored filters when schema changes. Validate filter fields against known schema before executing queries.
**Impact:** Medium — Affects data reliability; protects against silent filter failures on schema evolution

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
