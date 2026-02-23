# SalesBlock.io

A sales execution cockpit that helps sales reps focus, execute, and close. SalesBlock combines timed focus sessions, curated contact lists, multi-channel outreach, CRM sync, and pipeline analytics into a single workflow.

## Why SalesBlock?

Sales reps lose hours daily switching between tools. SalesBlock eliminates context-switching by putting everything needed to execute a sales session into one place:

- **Timed SalesBlocks** keep reps focused with 25-60 minute structured sessions
- **Curated contact lists** with CSV import, manual entry, and Salesforce sync
- **Multi-channel outreach** across email, phone, and social from one screen
- **Pipeline visibility** so reps always know where their deals stand
- **Activity tracking** that feeds into goals, analytics, and CRM automatically

## Features

### Authentication & Onboarding
- Email/password authentication with Supabase Auth
- Organization setup with logo upload
- Team invitations and role management
- Password reset flow

### SalesBlocks & Sessions
- Create timed focus sessions (25, 45, or 60 minutes)
- Attach curated contact lists to each session
- Live countdown timer with pause/resume
- Log calls, emails, and social touches during sessions
- Calendar sync (Google Calendar, Outlook) for scheduling blocks

### Contacts & Lists
- Import contacts via CSV or manual entry
- Smart list builder with filters and segmentation
- Contact detail pages with full activity timeline
- Salesforce bidirectional sync for contacts

### Multi-Channel Outreach
- **Email:** Gmail and Outlook OAuth integration, compose with rich text editor, email templates, thread tracking
- **Phone:** Call scripts with step-by-step guidance, script library management
- **Social:** Log LinkedIn and social interactions, track social touches per contact

### Pipeline & Deals
- Kanban-style deal board with drag-and-drop stages
- Deal detail modals with value, close date, and notes
- Forecast rollups by stage and time period

### Goals & Activity Tracking
- Set daily/weekly/monthly activity targets (calls, emails, meetings)
- Progress tracking with visual indicators
- Custom KPI definitions

### Analytics & Reporting
- Session performance metrics (contacts reached, activities per block)
- Activity trends over time with Recharts visualizations
- Pipeline conversion analytics
- Team leaderboards

### CRM Integration
- Salesforce OAuth connection
- Bidirectional contact sync
- Activity push to Salesforce (calls, emails, meetings)

### Billing
- Stripe integration with checkout sessions
- Webhook-driven subscription management
- Trial expiry banners and pricing page
- Plan upgrade/downgrade flows

### Team & Settings
- Team invitation flow with email delivery
- Organization hierarchy management
- Settings page with tabbed navigation (Profile, Organization, Integrations, Billing)

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18, TypeScript, Vite |
| **Styling** | Tailwind CSS, Lucide Icons |
| **State** | TanStack React Query |
| **Rich Text** | TipTap editor |
| **Charts** | Recharts |
| **Drag & Drop** | @hello-pangea/dnd |
| **CSV Parsing** | PapaParse |
| **Backend** | Supabase (Auth, Database, Edge Functions, Storage, RLS) |
| **Payments** | Stripe (Checkout, Webhooks, Subscriptions) |
| **Database** | PostgreSQL via Supabase |
| **Deployment** | Vite build, Supabase Edge Functions |

## Project Structure

```
salesblock-io/
├── frontend/
│   ├── src/
│   │   ├── components/       # Reusable UI components
│   │   │   ├── AppLayout.tsx             # Main app shell with sidebar nav
│   │   │   ├── ProtectedRoute.tsx        # Auth guard wrapper
│   │   │   ├── CreateSalesBlockModal.tsx  # SalesBlock creation flow
│   │   │   ├── ComposeEmailModal.tsx      # Email composition with rich text
│   │   │   ├── AddContactModal.tsx        # Contact creation
│   │   │   ├── AddDealModal.tsx           # Deal creation
│   │   │   ├── ListBuilderModal.tsx       # Smart list builder
│   │   │   ├── ImportCSVModal.tsx         # CSV import handler
│   │   │   ├── ScriptModal.tsx            # Call script editor
│   │   │   ├── TemplateModal.tsx          # Email template editor
│   │   │   ├── BookMeetingModal.tsx       # Calendar meeting scheduler
│   │   │   ├── LogActivityModal.tsx       # Activity logging
│   │   │   ├── RichTextEditor.tsx         # TipTap-based editor
│   │   │   ├── TrialExpiryBanner.tsx      # Subscription status banner
│   │   │   └── *OAuthButton.tsx           # OAuth connection buttons
│   │   ├── pages/            # Route-level page components
│   │   │   ├── Home.tsx                   # Dashboard
│   │   │   ├── SalesBlocks.tsx            # SalesBlock list & management
│   │   │   ├── SalesBlockSessionPage.tsx  # Live session execution
│   │   │   ├── Lists.tsx                  # Contact list management
│   │   │   ├── ListDetailPage.tsx         # Individual list view
│   │   │   ├── ContactDetailPage.tsx      # Contact profile & timeline
│   │   │   ├── Email.tsx                  # Email inbox & management
│   │   │   ├── EmailTemplates.tsx         # Template library
│   │   │   ├── Scripts.tsx                # Call script library
│   │   │   ├── Social.tsx                 # Social activity tracking
│   │   │   ├── Pipeline.tsx               # Deal pipeline (Kanban)
│   │   │   ├── Goals.tsx                  # Goal setting & tracking
│   │   │   ├── Analytics.tsx              # Performance dashboards
│   │   │   ├── Team.tsx                   # Team management
│   │   │   ├── SettingsPage.tsx           # App settings (tabbed)
│   │   │   ├── PricingPage.tsx            # Plan selection & billing
│   │   │   └── SignIn/SignUp/ForgotPassword.tsx  # Auth pages
│   │   ├── hooks/            # Custom React hooks
│   │   │   ├── useAuth.ts                 # Authentication state
│   │   │   └── useTheme.ts                # Theme management
│   │   ├── lib/              # Shared utilities
│   │   │   ├── supabase.ts                # Supabase client
│   │   │   ├── calendar.ts                # Calendar API helpers
│   │   │   └── salesforce.ts              # Salesforce API helpers
│   │   ├── App.tsx           # Root router configuration
│   │   └── main.tsx          # Entry point
│   ├── tailwind.config.js
│   ├── vite.config.ts
│   └── package.json
├── supabase/
│   ├── migrations/           # Database schema migrations (18 files)
│   ├── functions/            # Edge Functions
│   │   ├── create-checkout-session/   # Stripe checkout
│   │   ├── handle-stripe-webhook/     # Stripe event processing
│   │   ├── send-team-invitation/      # Email invitations
│   │   ├── sync-activities-to-salesforce/  # CRM activity sync
│   │   ├── track-email-replies/       # Email thread tracking
│   │   └── _shared/                   # Shared utilities
│   └── config.toml           # Supabase project configuration
├── .env.example              # Environment variable template
├── .gitignore
└── LICENSE
```

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
│  │    RLS     │  │  │   Sync,     │
│  │  Policies  │  │  │   Emails)   │
│  └────────────┘  │  └──────────────┘
└──────────────────┘
```

**Key architectural decisions:**

- **No custom backend server.** Supabase handles auth, database, storage, and edge functions. The frontend talks directly to Supabase via the JS client.
- **Row Level Security (RLS)** enforces data isolation per organization at the database level.
- **Edge Functions** handle server-side concerns: Stripe webhooks, email delivery, Salesforce sync, and email reply tracking.
- **OAuth flows** connect Gmail, Outlook, Google Calendar, and Salesforce with token storage in Supabase.

## Getting Started

### Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) project
- A [Stripe](https://stripe.com) account (for billing features)

### 1. Clone and install

```bash
git clone git@github.com:RPbrenanweston/salesblock-io.git
cd salesblock-io
cd frontend && npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Fill in your Supabase and Stripe keys:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

### 3. Set up database

Run the Supabase migrations to create the schema:

```bash
supabase db push
```

Or apply migrations individually from `supabase/migrations/`.

### 4. Start development server

```bash
cd frontend
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### 5. Type checking

```bash
cd frontend
npm run typecheck
```

## Database Schema

The database is managed through 18 Supabase migrations covering:

- **Organizations & Users** — Multi-tenant org structure with RLS
- **Contacts & Lists** — Contact records, list membership, activity logs
- **SalesBlocks** — Session definitions, timers, calendar links
- **Email & Templates** — OAuth connections, email templates, thread tracking
- **Pipeline & Deals** — Deal stages, values, forecasting
- **Goals & KPIs** — Activity targets, custom KPI definitions
- **Billing** — Subscription status, Stripe customer IDs
- **Team** — Invitations, roles, org hierarchy

All tables enforce row-level security scoped to the user's organization.

## Edge Functions

| Function | Purpose |
|----------|---------|
| `create-checkout-session` | Creates a Stripe Checkout session for plan upgrades |
| `handle-stripe-webhook` | Processes Stripe events (subscription created, updated, deleted) |
| `send-team-invitation` | Sends email invitations to join an organization |
| `sync-activities-to-salesforce` | Pushes call/email/meeting activities to Salesforce |
| `track-email-replies` | Monitors email threads for reply detection |

## License

MIT
