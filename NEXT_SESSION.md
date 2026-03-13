# SalesBlock — Next Session Handoff
> Generated: 2026-03-13 | Branch: `ralph/salesblock-io` | Last commit: `e0d6ef0`

This document is the entry point for the next implementation session.
Read this file, then `prd-prelaunch-fixes.json`, then start work.

---

## Current State

### Completed This Sprint (commits cc17975 → e0d6ef0)

| ID | Title | Commit |
|----|-------|--------|
| FIX-001 | Sanitize RichTextEditor HTML output (DOMPurify) | f9f42c2 |
| FIX-002 | Add CSRF nonce to all 5 OAuth state params | f9f42c2 |
| FIX-003 | Add ProtectedRoute guard to /diagnostics page | f9f42c2 |
| FIX-004 | Fix SignUp rollback on org/user insert failure | f9f42c2 |
| FIX-005 | Add missing routes for Arena and ContentLibrary | 2d58225 |
| FIX-006 | Install @sentry/react, init in main.tsx, wire logError | 1bac826 |
| FIX-007 | Fix AddContactModal to read org_id from auth context | 2d58225 |
| FEAT-001 | Google SSO + returnTo deep link on SignIn | e0d6ef0 |
| FEAT-003 | Pull pricing from `pricing_plans` Supabase table | e0d6ef0 |
| FEAT-005 | Inline InviteModal on Team page (email + role) | e0d6ef0 |

Also completed in the security sprint (subsumed by P0 fixes):
- SOQL injection guard in `salesforce.ts`
- Error stack trace sanitization (ErrorBoundary + OAuthCallbackLayout)
- Cross-org RLS audit and org_id policy gaps
- Client-side rate limiting on auth form (sliding window)
- Token refresh race condition fix (OAuth interceptor)
- Pagination limits on 5 unbounded list views
- Timezone-aware chart dates in Analytics

### Branch Note
The repo has no `main` branch. `ralph/salesblock-io` is the default and Vercel deploy target.
Do NOT create a `main` branch without coordinating with RPBW — it would break Vercel.

---

## Remaining Work by Priority

### P2 — Fix Before First Real User (10 items)

Start here. These are reliability and data-integrity issues.

| ID | Title | Files | Notes |
|----|-------|-------|-------|
| **FIX-008** | Add ON CONFLICT handling to ImportCSVModal list_contacts insert | `frontend/src/components/ImportCSVModal.tsx` | Current bulk insert fails silently when contact already exists in list. Add `onConflict: 'ignore'` to `from('list_contacts').insert()` calls |
| **FIX-009** | Fix Pipeline drag StrictMode double-fire + optimistic rollback | `frontend/src/pages/Pipeline.tsx` | `@dnd-kit` onDragEnd fires twice in React StrictMode dev. Guard with `useRef` idempotency token. Add rollback on Supabase update failure |
| **FIX-010** | Add calendar pre-check and failure feedback to BookMeetingModal | `frontend/src/components/BookMeetingModal.tsx` | Currently silently fails if calendar OAuth token is expired. Check token validity before opening modal; show actionable error with re-auth link |
| **FIX-011** | Fix ContactDetailPage null back navigation | `frontend/src/pages/ContactDetail.tsx` | `navigate(-1)` crashes if user navigated directly to `/contacts/:id` (no history). Replace with `navigate('/contacts')` fallback when `window.history.length <= 1` |
| **FIX-012** | Add idempotency to Stripe webhook edge function | `supabase/functions/stripe-webhook/index.ts` | Duplicate webhook deliveries can double-process subscription events. Add `processed_at` column check or use Stripe's idempotency key |
| **FIX-013** | Add idempotency to Salesforce sync and email reply tracker | `supabase/functions/sync-salesforce-activities/`, `supabase/functions/check-email-replies/` | Both edge functions can insert duplicate rows on retry. Add `ON CONFLICT DO NOTHING` or upsert pattern |
| **FIX-014** | Add transactional rollback to team invitation on email failure | `supabase/functions/send-team-invitation/index.ts` | Current flow: insert DB row → send email. If email fails, orphaned invitation row exists with no way to resend. Wrap in try/catch; delete row on email failure or add `status: 'pending_delivery'` flag |
| **FIX-015** | Add concurrent refresh lock for Google + Microsoft token refresh | `frontend/src/lib/google-calendar.ts`, `frontend/src/lib/outlook-calendar.ts` | Multiple simultaneous API calls all detect expired token and race to refresh. Add mutex/lock so only one refresh fires; others await |
| **FIX-016** | Add Salesforce connection pre-check to activity log modals + SOQL guard | `frontend/src/components/LogActivityModal.tsx`, `frontend/src/lib/salesforce.ts` | Push-to-Salesforce silently fails when disconnected. Add connection check before displaying Salesforce push option. SOQL guard already added to salesforce.ts but verify edge cases |
| **FIX-017** | Add delete confirmations for SalesBlocks, Scripts, Goals, EmailTemplates | `frontend/src/pages/SalesBlocks.tsx`, `Scripts.tsx`, `Goals.tsx`, `EmailTemplates.tsx` | All four pages have delete actions with no confirmation dialog. Reuse existing `AlertDialog` from shadcn/ui — pattern already used in Pipeline page |

---

### P3 — Core UX Improvements (23 items)

Implement during beta period. Roughly ordered by user impact.

#### Bugs

| ID | Title | Files | Notes |
|----|-------|-------|-------|
| **FIX-018** | Fix useTheme listener cleanup + write failure feedback | `frontend/src/hooks/useTheme.ts` | `useEffect` dependency array missing — listener re-registers on state change. Fix deps. Add toast on `localStorage` write failure |
| **FIX-019** | Fix Arena void-700 Tailwind colour class | `frontend/src/pages/Arena.tsx` | `bg-void-700` not in Tailwind config — renders transparent. Replace with `bg-slate-800` or add to config |
| **FIX-020** | Fix ProtectedRoute redirect loop + useAuth loading race | `frontend/src/components/ProtectedRoute.tsx`, `frontend/src/hooks/useAuth.ts` | When `loading=true`, ProtectedRoute redirects to `/sign-in` before auth resolves. Add `if (loading) return <PageLoader />` guard |
| **FIX-021** | Fix TrialExpiryBanner dismiss persistence | `frontend/src/components/AppLayout.tsx` | Dismiss button uses `useState` — banner reappears on page reload. Store dismissal in `localStorage` with expiry timestamp |
| **FIX-025** | Fix ForgotPassword SITE_URL to use correct production origin | `supabase/functions/reset-password/`, `frontend/src/pages/ForgotPassword.tsx` | Magic link uses hardcoded localhost origin in some paths. Replace with `window.location.origin` or `VITE_SITE_URL` env var |

#### Feature Improvements

| ID | Title | Files | Notes |
|----|-------|-------|-------|
| **FIX-022** | Add time-range filter to Analytics page | `frontend/src/pages/Analytics.tsx` | Currently shows all-time data with no filter. Add 7d/30d/90d/all selector — wire to `useDashboardData` hook's date range param |
| **FIX-023** | Add pagination to ContactActivityTimeline and Email page | `frontend/src/components/ContactActivityTimeline.tsx`, `frontend/src/pages/Email.tsx` | Both fetch unbounded rows. Email page can accumulate thousands of rows. Add cursor-based pagination with "Load more" button |
| **FIX-024** | Fix Home.tsx CreateSalesBlockModal post-create callback | `frontend/src/pages/Home.tsx` | After creating a SalesBlock from the Home quick-action, the home widget count doesn't refresh. Pass `onSuccess={() => refetchBlocks()}` to modal |
| **FEAT-004** | Add Analytics time-range filter + Recharts trend lines | `frontend/src/pages/Analytics.tsx`, `frontend/src/hooks/useDashboardData.ts` | Extend FIX-022 with sparkline trend charts using Recharts (already installed). Show WoW/MoM delta labels on KPI cards |
| **FEAT-006** | Add Arena real-time leaderboard + time-range filter | `frontend/src/pages/Arena.tsx` | Current leaderboard is static. Add 30d/90d/all filter. Consider Supabase Realtime subscription for live updates if <10 team members |
| **FEAT-007** | Add Pipeline deal value totals + empty-state improvements | `frontend/src/pages/Pipeline.tsx` | No column totals shown. Sum `deal_value` per stage and display in column header. Add empty state per column with "Add deal" CTA |
| **FEAT-008** | Add Goals timezone-correct aggregation + empty state | `frontend/src/pages/Goals.tsx`, `frontend/src/hooks/useGoalProgress.ts` | `useGoalProgress` has Feb 30/31 date overflow bug in goal period calculations. Fix with `date-fns` `endOfMonth`. Add empty state when no goals set |
| **FEAT-009** | Add SalesBlocks status filter tabs + empty state | `frontend/src/pages/SalesBlocks.tsx` | No way to filter by status (active/complete/scheduled). Add tab row. Add empty state for new users with "Create your first SalesBlock" CTA |
| **FEAT-010** | Add Scripts search, categories, and SalesBlock linking | `frontend/src/pages/Scripts.tsx` | Scripts list is flat with no search. Add search input, category tags, and link script to specific SalesBlock when creating/editing |
| **FEAT-011** | Add EmailTemplates preview and search/filter | `frontend/src/pages/EmailTemplates.tsx` | No preview capability — user must open edit modal to see content. Add preview pane or inline expand. Add search by name/subject |
| **FEAT-012** | Add template insertion to ComposeEmailModal | `frontend/src/components/ComposeEmailModal.tsx` | Email composition has no template picker. Add "Use template" dropdown that populates subject + body from email_templates table |
| **FEAT-013** | Consolidate Microsoft OAuth buttons into MicrosoftOAuthButton | `frontend/src/components/OutlookOAuthButton.tsx`, `OutlookCalendarOAuthButton.tsx` | Two nearly identical components. Extract shared `MicrosoftOAuthButton` with `scope` prop. Reduces OAuth CSRF fix surface area |
| **FEAT-014** | Consolidate Gmail + Google Calendar OAuth into shared hook | `frontend/src/components/GmailOAuthButton.tsx`, `GoogleCalendarOAuthButton.tsx` | Same pattern as FEAT-013. Extract `useGoogleOAuth(scope)` hook |
| **FEAT-015** | Add SettingsPage per-OAuth ErrorBoundaries + success/error toasts | `frontend/src/pages/Settings.tsx` | OAuth connect/disconnect actions have no feedback. Wrap each OAuth section in ErrorBoundary. Add toast on success/failure |
| **FEAT-016** | Add configurable activity types via org settings | `frontend/src/pages/Settings.tsx`, `supabase/migrations/` | Activity types (call, email, meeting, etc.) are hardcoded. Add `activity_types` table, org-specific overrides, settings UI |
| **FEAT-017** | Add batch list_contacts count to fix Lists N+1 | `frontend/src/pages/Lists.tsx`, `frontend/src/hooks/useListQuery.ts` | Lists page fires one `count` query per list to show contact count. For 20 lists = 20 queries. Replace with single aggregate query or RPC |
| **FEAT-018** | Add ContactActivityTimeline cursor-based pagination | `frontend/src/components/ContactActivityTimeline.tsx` | Partially overlaps FIX-023. Implement infinite-scroll with Supabase `.range()` cursor |
| **FEAT-019** | Add ContactDetailPage 404 state + server-side sort | `frontend/src/pages/ContactDetail.tsx` | Navigating to `/contacts/invalid-id` shows blank page. Add 404 handling. Activity sort currently client-side; move to Supabase `.order()` |

---

### P4 — Polish (6 items)

Nice-to-have. Do last or skip for MVP.

| ID | Title | Files | Notes |
|----|-------|-------|-------|
| **FEAT-020** | Add Social page empty state + date range filter | `frontend/src/pages/Social.tsx` | Empty state for new users. Filter by date range (matches Activity page pattern) |
| **FEAT-021** | Add merge tag validation + preview to TemplateModal | `frontend/src/components/TemplateModal.tsx` | Email templates support `{{first_name}}` etc. but no validation or preview. Add tag autocomplete and live preview panel |
| **FEAT-022** | Add Home dashboard skeleton loaders + empty-state messaging | `frontend/src/pages/Home.tsx`, `frontend/src/components/dashboard/` | KPI cards flash blank on load. Add `SkeletonTable` component (already exists in lib) as loading state. Add "No activity yet" empty states per card |
| **FEAT-023** | Add ImportCSVModal batch insert + streaming progress | `frontend/src/components/ImportCSVModal.tsx` | Large CSVs already use Web Worker. Add streaming progress updates (worker → main thread `postMessage`) so user sees "Importing row 450/2000..." |
| **FEAT-024** | ContentLibrary redundancy review | `frontend/src/pages/ContentLibrary.tsx` | ContentLibrary and Scripts pages may overlap in purpose. Decide: merge into Scripts or give ContentLibrary distinct purpose (media assets, case studies). Decision needed before building |
| **FEAT-025** | Add team invitation resend endpoint + expiry enforcement | `supabase/functions/send-team-invitation/`, `frontend/src/pages/Team.tsx` | Invitations don't expire. Add `expires_at` column (72h default). Add "Resend" action on Team page for expired invitations |

---

## Environment Setup Required

Before Sentry captures anything in production:
```bash
# Add to Vercel environment variables (prod + preview):
VITE_SENTRY_DSN=<your-dsn-from-sentry.io>
# Get from: sentry.io → Project Settings → Client Keys
```

All other env vars already in Vercel. See `.env.example` for full list.

---

## Key Architecture Patterns (Read Before Coding)

### org_id Pattern
`useAuth` does NOT expose `org_id`. Fetch it once on component mount:
```typescript
const { user } = useAuth()
const [orgId, setOrgId] = useState<string | null>(null)
useEffect(() => {
  if (!isOpen || !user) return
  supabase.from('users').select('org_id').eq('id', user.id).single()
    .then(({ data }) => { if (data) setOrgId(data.org_id) })
}, [isOpen, user])
```

### Error Logging
Use `logError(error, 'ComponentName')` from `frontend/src/lib/error-logger.ts`.
Routes to Sentry when `VITE_SENTRY_DSN` is set, console otherwise.

### Rate Limiting
`isRateLimited(key, config)` in `frontend/src/lib/rate-limiter.ts`.
Sliding window, in-memory. Already used on auth forms.

### Toast Notifications
Imperative API: `import { toast } from '../hooks/use-toast'` — `toast({ variant: 'destructive', title: '...' })`.
Do NOT use `alert()` anywhere in the codebase.

### Route IDs
All routes defined in `frontend/src/lib/routes.ts` as `ROUTES.*` constants.
Never hardcode path strings in components.

### Supabase Edge Functions
Located in `supabase/functions/`. Invoke via:
```typescript
supabase.functions.invoke('function-name', { body: { ... } })
```

---

## File Ownership Quick Reference

| Feature Area | Key Files |
|-------------|-----------|
| Auth / session | `frontend/src/hooks/useAuth.ts`, `frontend/src/pages/SignIn.tsx`, `frontend/src/components/ProtectedRoute.tsx` |
| Contacts | `frontend/src/pages/Contacts.tsx`, `AddContactModal.tsx`, `ImportCSVModal.tsx`, `ContactDetail.tsx` |
| Lists | `frontend/src/pages/Lists.tsx`, `ListDetail.tsx`, `ListBuilderModal.tsx` |
| SalesBlocks | `frontend/src/pages/SalesBlocks.tsx`, `SalesBlockSessionPage.tsx`, `CreateSalesBlockModal.tsx` |
| Pipeline | `frontend/src/pages/Pipeline.tsx`, `AddDealModal.tsx`, `DealDetailModal.tsx` |
| Analytics | `frontend/src/pages/Analytics.tsx`, `frontend/src/hooks/useDashboardData.ts` |
| Team / Billing | `frontend/src/pages/Team.tsx`, `PricingPage.tsx`, `Settings.tsx` |
| OAuth | `frontend/src/components/{Gmail,Outlook,GoogleCalendar,OutlookCalendar,Salesforce}OAuth*.tsx` |
| Email | `frontend/src/pages/Email.tsx`, `ComposeEmailModal.tsx`, `EmailTemplates.tsx`, `TemplateModal.tsx` |
| Shared lib | `frontend/src/lib/{supabase,routes,formatters,validators,rate-limiter,error-logger}.ts` |
| Edge functions | `supabase/functions/` (stripe-webhook, send-team-invitation, sync-salesforce-activities, check-email-replies, create-checkout-session) |

---

## Starting the Next Session

```bash
cd /Users/robertpeacock/Desktop/Claude\ code/salesblock-io
git branch --show-current   # should be ralph/salesblock-io
git log --oneline -5        # verify last commit is e0d6ef0
cat NEXT_SESSION.md         # this file
cat prd-prelaunch-fixes.json | python3 -c "import json,sys; [print(s['id'], s['title']) for s in json.load(sys.stdin)['userStories'] if not s.get('passes')]"
# → lists all remaining stories, start with first P2 item (FIX-008)
```
