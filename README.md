# SalesBlock.io

> **🔒 Private Beta** — SalesBlock is currently in private beta. [Request early access →](#getting-access)

A sales execution cockpit that turns scattered tools into a single focused workflow. SalesBlock gives reps a structured session environment to execute calls, send emails, log activities, and move deals — without switching between five apps.

---

## Why SalesBlock?

Sales reps lose 2–3 hours a day switching between CRM, email, dialers, and spreadsheets. SalesBlock eliminates context-switching with one place to run a complete outreach session:

- **SalesBlocks** — timed focus sessions (25–60 min) with a live contact queue, scripts, and activity logging built in
- **Multi-channel outreach** — call, email, and social from one screen, with templates and call scripts attached
- **Automatic activity capture** — every touch logged to the contact, pipeline, and optionally Salesforce
- **Pipeline visibility** — deal board always visible so reps know where to focus

---

## Current Status

**Private beta as of March 2026.** The full feature set is built and deployed. We are running closed beta sessions with a small group of early users to validate the core workflow before opening access.

### What's working today

| Area | Status |
|------|--------|
| SalesBlock session execution | ✅ Live |
| Contacts, lists, CSV import | ✅ Live |
| Gmail + Outlook email (OAuth) | ✅ Live |
| Google Calendar + Outlook Calendar | ✅ Live |
| Salesforce bidirectional sync | ✅ Live |
| Pipeline Kanban board | ✅ Live |
| Goals and custom KPIs | ✅ Live |
| Analytics and team leaderboard | ✅ Live |
| Stripe billing and subscriptions | ✅ Live |
| Team invitations and org management | ✅ Live |
| Google SSO sign-in | ✅ Live |
| Error monitoring (Sentry) | ✅ Live |

### Recently shipped (March 2026 hardening sprint)
- Full security audit: XSS sanitization (DOMPurify), OAuth CSRF nonce validation across all 5 providers, SOQL injection guard, error sanitization, org-scoped RLS audit
- Signup flow now fully atomic with rollback on partial failure
- Client-side rate limiting on all authentication forms
- Pagination on unbounded list views (contacts, activities, email threads)
- Token refresh race condition fix for OAuth integrations
- Error monitoring wired to Sentry — all caught errors forwarded with context tags

---

## Features

### SalesBlocks & Session Execution
- Create timed focus sessions (25, 45, or 60 minutes)
- Attach curated contact lists — session auto-queues contacts
- Live countdown timer with pause/resume
- Log calls, emails, and social touches directly inside the session
- Post-session debrief with 7-rate funnel and summary metrics
- Session resume after navigation — progress persists across page refreshes
- Calendar sync (Google Calendar, Outlook) for scheduling blocks

### Contacts & Lists
- Import contacts via CSV (Web Worker-based parsing for large files, 500-row batch inserts)
- Manual contact creation with duplicate detection
- Smart list builder with filter criteria and contact segmentation
- Contact detail pages with full unified activity timeline
- Salesforce bidirectional contact sync

### Multi-Channel Outreach
- **Email:** Gmail and Outlook OAuth, compose with rich text editor, email templates library, thread reply tracking
- **Phone:** Step-by-step call scripts library, script management
- **Social:** Log LinkedIn and social touches, track social activity per contact

### Pipeline & Deals
- Kanban-style deal board with drag-and-drop stage management
- Deal detail modals (value, close date, notes, contact links)
- Revenue forecast rollups by stage and time period

### Goals & Activity Tracking
- Set daily/weekly/monthly targets (calls, emails, meetings)
- Visual progress tracking against targets
- Custom KPI definitions

### Analytics & Reporting
- Session performance metrics (contacts reached, activities per block)
- Activity trend charts with Recharts visualizations
- Pipeline conversion analytics
- Team Arena leaderboard

### CRM Integration
- Salesforce OAuth connection
- Bidirectional contact sync with field mapping
- Automatic activity push (calls, emails, meetings) to Salesforce

### Billing
- Stripe-powered checkout and subscription management
- Webhook-driven subscription state sync
- Pricing pulled live from database — no hard-coded tiers
- Trial expiry banners and plan upgrade flows

### Team & Settings
- Team invitation flow with email delivery
- Role-based access (SDR, AE, Manager)
- Organization logo and settings management
- Tabbed settings (Profile, Organization, Integrations, Billing)

---

## Roadmap

Items are ordered by priority. P2 items are actively being worked on.

### Near-term (P2) — Beta reliability
- **Import deduplication** — handle duplicate contacts gracefully on CSV re-import
- **Pipeline drag stability** — fix edge-case double-fire in React StrictMode
- **Calendar connection validation** — pre-check OAuth token validity before opening booking modal
- **Stripe webhook idempotency** — guard against duplicate event processing
- **Concurrent OAuth token refresh lock** — prevent race condition when multiple API calls fire on an expired token simultaneously
- **CRM connection status in activity modals** — surface disconnected Salesforce state before attempting activity push
- **Destructive action confirmations** — confirmation dialogs on delete for SalesBlocks, scripts, goals, and email templates
- **Team invitation delivery guarantees** — atomic rollback if email delivery fails; resend support

### Next (P3) — Core UX improvements
- Analytics time-range filter (7d / 30d / 90d / all-time) with trend sparklines
- Pipeline deal value totals per column
- Scripts — search, categories, and SalesBlock linking
- Email templates — inline preview and search
- Insert template directly in compose email modal
- Goals — timezone-correct aggregation fix + empty state for new users
- SalesBlocks — status filter tabs (active / complete / scheduled)
- Contact activity timeline — cursor-based pagination for high-volume contacts
- Contact 404 state for invalid/deleted contact IDs
- Configurable activity types per organization
- Home dashboard skeleton loaders and empty-state onboarding messages
- Lists N+1 query fix — batch contact count query

### Later (P4) — Polish
- Social page date range filter and empty state
- Merge tag validation and live preview in email template editor
- CSV import streaming progress indicator for large files
- Team invitation resend and 72-hour expiry enforcement

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18, TypeScript, Vite |
| **Styling** | Tailwind CSS, Lucide Icons |
| **State & Fetching** | TanStack React Query v5 |
| **Rich Text** | TipTap v3 |
| **Charts** | Recharts |
| **Drag & Drop** | @hello-pangea/dnd |
| **CSV Parsing** | PapaParse (Web Worker) |
| **Security** | DOMPurify (XSS sanitization) |
| **Error Monitoring** | Sentry (@sentry/react) |
| **Backend** | Supabase (Auth, Database, Edge Functions, Storage, RLS) |
| **Payments** | Stripe (Checkout, Webhooks, Subscriptions) |
| **Database** | PostgreSQL via Supabase with row-level security |
| **Deployment** | Vercel (frontend), Supabase Edge Functions (serverless) |

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     React Frontend                       │
│  (Vite + TypeScript + Tailwind + TanStack Query)        │
└──────────┬──────────────┬──────────────┬────────────────┘
           │              │              │
     Supabase Client  Stripe.js    OAuth Flows
           │              │         (Gmail, Outlook,
           │              │      Google Cal, Salesforce)
           ▼              ▼              │
┌──────────────────┐  ┌──────────┐      │
│     Supabase     │  │  Stripe  │      │
│  ┌────────────┐  │  │  API     │      │
│  │    Auth    │  │  └────┬─────┘      │
│  ├────────────┤  │       │            │
│  │  Database  │  │       ▼            │
│  │  (Postgres)│  │  ┌──────────────┐  │
│  ├────────────┤  │  │    Edge      │◄─┘
│  │  Storage   │  │  │  Functions   │
│  ├────────────┤  │  │  (Webhooks,  │
│  │    RLS     │  │  │   Sync,      │
│  │  Policies  │  │  │   Emails)    │
│  └────────────┘  │  └──────────────┘
└──────────────────┘
```

**Key architectural decisions:**
- **No custom backend server** — Supabase handles auth, database, storage, and edge functions. The frontend talks directly to Supabase via the JS client.
- **Row Level Security (RLS)** enforces data isolation per organization at the database level — no org data can leak across tenants.
- **Edge Functions** handle server-side concerns: Stripe webhooks, email delivery, Salesforce sync, and email reply tracking.
- **OAuth flows** connect Gmail, Outlook, Google Calendar, and Salesforce with token storage in Supabase and automatic refresh.

---

## Getting Started

### Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) project
- A [Stripe](https://stripe.com) account (for billing features)

### 1. Clone and install

```bash
git clone git@github.com:RPbrenanweston/salesblock-io.git
cd salesblock-io/frontend
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Fill in your project credentials — see `.env.example` for all required variables:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...
# Optional: enable error monitoring
VITE_SENTRY_DSN=your-sentry-dsn
```

### 3. Set up database

Apply the Supabase migrations to create the schema:

```bash
supabase db push
```

Or apply migrations individually from `supabase/migrations/` (18 migration files covering the full schema).

### 4. Start the development server

```bash
cd frontend
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

### 5. Type checking

```bash
cd frontend
npm run typecheck
```

---

## Database Schema

18 Supabase migrations covering:

- **Organizations & Users** — multi-tenant org structure with RLS isolation
- **Contacts & Lists** — contact records, list membership, filter criteria, activity logs
- **SalesBlocks** — session definitions, timers, calendar links, session notes
- **Email & Templates** — OAuth token storage, email templates, thread tracking
- **Pipeline & Deals** — deal stages, values, forecast data
- **Goals & KPIs** — activity targets, custom KPI definitions, progress tracking
- **Billing** — Stripe customer IDs, subscription status, pricing plans
- **Team** — invitations, roles, org hierarchy

All tables enforce row-level security scoped to the authenticated user's organization.

---

## Edge Functions

| Function | Purpose |
|----------|---------|
| `create-checkout-session` | Creates a Stripe Checkout session for plan selection |
| `handle-stripe-webhook` | Processes Stripe events (subscription created/updated/cancelled) |
| `send-team-invitation` | Sends email invitations and creates invitation records |
| `sync-activities-to-salesforce` | Pushes call/email/meeting activities to Salesforce |
| `track-email-replies` | Monitors email threads for reply detection |

---

## Getting Access

SalesBlock is in **private beta**. To request early access:

- Email **robert@brenanweston.com** with "SalesBlock Beta" in the subject
- Include your team size and what CRM/sales tools you currently use

Beta users get full access, direct support, and significant influence over the roadmap.

---

## License

MIT
