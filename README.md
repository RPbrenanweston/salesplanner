# SalesPlanner

**The day planner built for sellers.**

SalesPlanner is a focused, 5-screen sales productivity tool that gives individual sales reps a complete daily workflow loop — without the complexity of a full CRM. It's the entry product for [SalesBlock](https://salesblock.io), a comprehensive sales execution platform.

```
Morning Briefing → Day Planner → Focus Session → Activity Feed → Daily Debrief
     (plan)        (organize)     (execute)        (track)        (reflect)
```

---

## Why SalesPlanner Exists

Sales tools are built for **measurement** — CRMs serve managers, dialers serve operations. Nobody builds for the person **actually doing the selling**. Reps face:

- **Decision paralysis** — too many contacts, no clear "work THIS next"
- **Mental fatigue** — organizing and executing are different cognitive modes
- **No sales-specific planner** — day planners exist universally, but none for sellers
- **Psychology drives performance** — outcomes correlate with focus and energy, not just lead quality

> **"Focus is the key currency in a world of more."**

SalesPlanner solves this with a tight daily loop that keeps reps in execution mode.

---

## The 5 Screens

### 1. Morning Briefing
Set your intention for the day. Review yesterday's results, see today's scheduled meetings, and check in on energy and mindset.

### 2. Day Planner
Structured daily schedule with time-blocking. Pomodoro timer (Cycle 1-4), activity counters (Dials, Connects, Emails, LinkedIn, Meetings, Proposals), and a visual timeline from 7AM-6PM with drag-and-drop blocks.

### 3. Focus Session
Timed execution environment — the core experience. Countdown timer (25/45/60 min), contact queue with smart ordering (unworked first), one-click activity logging, and full-screen distraction-free mode.

### 4. Activity Feed
Running log of everything done today. Daily totals (Calls, Emails, Meetings, Social touches), chronological timeline, and progress toward daily goals — all captured automatically from sessions.

### 5. Daily Debrief
End-of-day reflection. Blocks Completed, Focus Time, Break Time, Completion Rate stats. Reflection prompts: Wins, Improvements, Tomorrow's Priorities. Closes the loop for the next morning's briefing.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript 5.3, Vite 5 |
| Styling | Tailwind CSS 3.4, Lucide Icons |
| State | TanStack React Query v5, Zustand |
| Backend | Supabase (PostgreSQL + Auth + RLS + Edge Functions) |
| Auth | Email/password + Google SSO |
| Monitoring | Sentry |
| Deployment | Vercel |

---

## Project Structure

```
salesplanner/
├── frontend/
│   ├── src/
│   │   ├── SalesPlannerApp.tsx      # SalesPlanner route tree (7 routes)
│   │   ├── App.tsx                  # SalesBlock route tree (26 routes)
│   │   ├── main-planner.tsx         # SalesPlanner entry point
│   │   ├── main.tsx                 # SalesBlock entry point
│   │   ├── components/
│   │   │   ├── PlannerLayout.tsx    # SalesPlanner sidebar (6 nav items)
│   │   │   ├── AppLayout.tsx        # SalesBlock sidebar (19 nav items)
│   │   │   └── ...48 components
│   │   ├── pages/                   # 37 page components
│   │   │   ├── SalesPlannerLanding.tsx
│   │   │   ├── ActivityFeedPage.tsx
│   │   │   ├── DayPlannerPage.tsx
│   │   │   ├── MorningBriefingPage.tsx
│   │   │   ├── DailyDebriefPage.tsx
│   │   │   ├── SalesBlockSessionPage.tsx
│   │   │   └── ...
│   │   ├── hooks/                   # 21 custom React hooks
│   │   ├── lib/
│   │   │   ├── branding.ts         # SalesPlanner brand config
│   │   │   ├── supabase.ts         # Supabase client
│   │   │   ├── queries/            # Data access layer
│   │   │   └── ...
│   │   └── types/                   # TypeScript domain types
│   ├── index-planner.html           # SalesPlanner HTML entry
│   ├── index.html                   # SalesBlock HTML entry
│   └── vite.config.ts              # Dual entry point support
├── supabase/
│   ├── migrations/                  # 35 PostgreSQL migrations
│   └── functions/                   # 12 Edge Functions
└── HANDOVER.md                      # Product context and strategy
```

---

## Architecture: Dual Entry Point

SalesPlanner and SalesBlock share the same codebase and Supabase backend but are completely separate products:

```
[salesplanner.io]                    [salesblock.io]
index-planner.html                   index.html
  └─ main-planner.tsx                  └─ main.tsx
       └─ SalesPlannerApp.tsx               └─ App.tsx
            └─ PlannerLayout (6 nav)             └─ AppLayout (19 nav)
                 └─ 7 routes                          └─ 26 routes
```

**Build commands:**
```bash
# SalesPlanner build
VITE_APP=planner npm run build

# SalesBlock build (full product)
npm run build
```

The `VITE_APP=planner` env var tells Vite to use `index-planner.html` as the entry point and activates the SPA fallback middleware for dev mode.

**Why shared codebase?**
- Zero code duplication for shared pages (DayPlanner, Focus Session, etc.)
- Same Supabase = seamless upgrade path (user data carries over to SalesBlock)
- One `npm install`, one type system, one CI pipeline
- SalesPlanner build is ~230KB gzipped (vs full SalesBlock) — only ships what's needed

---

## SalesPlanner vs SalesBlock

| Feature | SalesPlanner | SalesBlock |
|---------|:---:|:---:|
| Morning Briefing | Yes | Yes |
| Day Planner | Yes | Yes |
| Focus Sessions | Yes | Yes |
| Activity Feed | Yes | Yes |
| Daily Debrief | Yes | Yes |
| Goals and KPIs | Yes | Yes |
| Contact Management | - | Yes |
| Pipeline / Kanban | - | Yes |
| Email (Gmail/Outlook) | - | Yes |
| Calendar Sync | - | Yes |
| Salesforce Integration | - | Yes |
| Attio Integration | - | Yes |
| Team Management | - | Yes |
| Scripts and Templates | - | Yes |
| Analytics Dashboard | - | Yes |
| Arena Leaderboard | - | Yes |
| Stripe Billing | - | Yes |

---

## Getting Started

### Prerequisites
- Node.js 20+
- npm or bun
- A [Supabase](https://supabase.com) project

### Setup

```bash
# Clone
git clone https://github.com/RPbrenanweston/salesplanner.git
cd salesplanner/frontend

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your Supabase credentials:
#   VITE_SUPABASE_URL=https://your-project.supabase.co
#   VITE_SUPABASE_ANON_KEY=your-anon-key
```

### Run SalesPlanner

```bash
cd frontend
VITE_APP=planner npm run dev
# → http://localhost:3000
```

### Run SalesBlock (full product)

```bash
cd frontend
npm run dev
# → http://localhost:3000
```

### Build for Production

```bash
cd frontend

# SalesPlanner
VITE_APP=planner npm run build

# Type check
npm run typecheck

# Tests
npm run test
```

Output: `frontend/dist/`

---

## Deployment

### Vercel (Recommended)

Create two Vercel projects from this repo:

| Project | Build Command | Output | Domain |
|---------|--------------|--------|--------|
| SalesPlanner | `cd frontend && VITE_APP=planner npm run build` | `frontend/dist` | salesplanner.io |
| SalesBlock | `cd frontend && npm run build` | `frontend/dist` | salesblock.io |

Both projects share the same environment variables:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

**Supabase configuration:** Add your deployment domain (e.g., `salesplanner.io`) to Supabase Auth > URL Configuration > Redirect URLs to enable OAuth callbacks.

---

## Database

35 PostgreSQL migrations with full Row-Level Security. Key tables:

| Table | Purpose |
|-------|---------|
| `organizations` | Multi-tenant orgs with settings |
| `users` | User profiles with role (sdr/ae/manager) |
| `contacts` | Contact records with source tracking |
| `salesblocks` | Timed focus sessions with timer state |
| `activities` | All touches: calls, emails, meetings, social |
| `goals` | Daily/weekly/monthly targets |
| `custom_kpis` | Organization-defined custom metrics |
| `lists` / `list_contacts` | Contact segmentation and ordering |
| `deals` / `deal_stages` | Sales pipeline (SalesBlock only) |
| `oauth_connections` | OAuth tokens for integrations |
| `pricing_plans` / `subscriptions` | Stripe billing state |

All tables enforce row-level security scoped to the authenticated user's organization.

### Apply Migrations

```bash
supabase db push
```

Or apply individually from `supabase/migrations/`.

---

## Edge Functions

| Function | Purpose |
|----------|---------|
| `create-checkout-session` | Stripe Checkout session creation |
| `handle-stripe-webhook` | Process Stripe subscription events |
| `send-team-invitation` | Email delivery for team invites |
| `sync-activities-to-salesforce` | Push activities to Salesforce |
| `track-email-replies` | Monitor email threads for replies |
| `exchange-google-token` | Google OAuth token exchange |
| `exchange-microsoft-token` | Microsoft OAuth token exchange |
| `refresh-google-token` | Google token refresh |
| `refresh-microsoft-token` | Microsoft token refresh |

---

## Product Strategy

```
[SalesPlanner]              [SalesBlock]              [Agent-First CRM]
 Productivity tool           Execution platform         Ops layer
 For: individual reps        For: reps + team leads     For: CROs, RevOps
 Free / low cost             Paid SaaS                  Future product
 5 screens                   26+ routes                 TBD
 User acquisition            Revenue generation         Leadership layer
 salesplanner.io             salesblock.io              TBD
```

SalesPlanner is the **entry product** — a narrow wedge that proves the thesis ("sellers need execution tools, not more CRM") and funnels users into the full SalesBlock experience via a subtle upgrade CTA in the sidebar.

---

## Design Principles

- **Anti-paralysis** — Never show a blank screen. Always suggest what to do next.
- **Zero friction** — If it takes more than 1 click to log an activity, it's too many.
- **Sales psychology** — Energy management, not just time management.
- **Focus mode** — When in a session, everything else disappears.
- **Progressive disclosure** — Start simple. Features reveal as needed.

---

## Key Documents

| Document | Purpose |
|----------|---------|
| `HANDOVER.md` | Full product context, strategy, and open questions |
| `CLAUDE.md` | Development guidelines and code quality principles |
| `AGENTS.md` | Accumulated operational patterns from implementation |
| `DATABASE_SETUP.md` | Supabase schema documentation |
| `DEPLOY.md` | Deployment instructions |
| `CODE_QUALITY_REVIEW.md` | Architecture review and hazard analysis |

---

## Contact

**Owner:** Robert Peacock (RPbrenanweston)
**Email:** robert@brenanweston.com
**GitHub:** [github.com/RPbrenanweston](https://github.com/RPbrenanweston)

---

## License

Proprietary. See [LICENSE](LICENSE).
