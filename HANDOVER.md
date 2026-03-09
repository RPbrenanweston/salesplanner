# SalesBlock.io — Engineer Handover Guide

**Date:** March 4, 2026
**Project:** SalesBlock.io — Sales Execution Cockpit
**Status:** Ready for production handover

---

## Project Overview

SalesBlock.io is a sales execution cockpit designed to help sales reps maintain focus, execute outreach, and close deals. The product combines timed focus sessions, curated contact lists, multi-channel outreach, CRM integration, and pipeline analytics into a single, cohesive workflow.

**Key Problem Solved:** Sales reps waste hours daily context-switching between tools. SalesBlock eliminates switching by putting everything needed for execution into one interface.

---

## Architecture

### Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | React 18 + TypeScript + Vite | Real-time UI, focus sessions, contact mgmt |
| **Styling** | Tailwind CSS + Lucide Icons | Responsive, dark-mode-ready design |
| **State Mgmt** | TanStack React Query | Data fetching, caching, sync |
| **Backend** | Supabase (PostgreSQL) | Auth, RLS, org hierarchy, contact data |
| **Auth** | Supabase Auth (email/password) | User registration, sign-in, password reset |
| **Integrations** | Stripe, Salesforce, Google/Outlook OAuth | Billing, CRM sync, email/calendar |
| **Deployment** | Vercel (frontend), Railway/Supabase (backend) | Serverless frontend, managed DB |
| **Editor** | TipTap | Rich text for email composition, notes |

### Repository Structure

```
salesblock-io/
├── frontend/                   # React + Vite frontend
│   ├── src/
│   │   ├── pages/             # Page components (Home, Analytics, etc.)
│   │   ├── components/        # Reusable UI components
│   │   ├── lib/               # Utilities (supabase.ts, hooks)
│   │   ├── App.tsx            # Main app with routing
│   │   ├── main.tsx           # Entry point
│   │   └── index.css          # Tailwind directives
│   ├── vite.config.ts         # Vite configuration
│   ├── tailwind.config.js     # Tailwind theme
│   ├── tsconfig.json          # TypeScript config
│   └── package.json           # Dependencies
│
├── backend/                    # (Optional) Backend code if not purely Supabase
│
├── supabase/
│   ├── config.toml            # Supabase project config
│   └── migrations/            # SQL migrations (org/user schema, RLS, etc.)
│
├── src/                        # Legacy files (being refactored into frontend/)
│
├── _designs/                   # Design files (Figma exports, PRD artifacts)
│
├── marketing landing page/     # Marketing site (separate product)
│
├── prd.json                    # Product Requirements Document (48 user stories)
├── progress.txt               # Implementation log (Ralph agent progress)
├── AGENTS.md                  # Reusable patterns and learnings
├── CLAUDE.md                  # PAI Algorithm instructions
├── README.md                  # Product overview
├── API.md                     # API documentation
├── DATABASE_SETUP.md          # Supabase setup guide
├── DEPLOY.md                  # Deployment instructions
└── HANDOVER.md               # This file

```

---

## Current Completion Status

**48 User Stories Defined** — See `prd.json` for full list.

### Completed Features (44/48 = 92%)

✅ **Authentication & Onboarding (US-001 through US-007)**
- Supabase schema initialization with org/user/team hierarchy
- Row-level security (RLS) policies for multi-tenant isolation
- Sign-up, sign-in, password reset, email verification
- Organization setup with logo upload

✅ **Frontend Scaffold & Routing (US-008 through US-015)**
- Vite + React + TypeScript project initialization
- React Router v6 with main navigation
- TanStack Query for data fetching
- Tailwind CSS with dark mode support
- App layout with navigation shell

✅ **Contacts & Lists (US-016 through US-025)**
- Contact model and CRUD operations
- CSV import with validation
- Manual contact entry
- List creation and management
- List filtering and search
- Contact detail pages with activity timeline
- Salesforce contact sync (bidirectional)

✅ **SalesBlocks & Sessions (US-026 through US-032)**
- SalesBlock creation and management
- Timed focus sessions (25/45/60 minutes)
- Live timer with pause/resume
- Activity logging during sessions
- Calendar integration (Google/Outlook)
- Session analytics dashboard

✅ **Multi-Channel Outreach (US-033 through US-040)**
- Email composition with TipTap rich text
- Gmail/Outlook OAuth integration
- Email templates and history tracking
- Call script library
- Phone dialer integration
- LinkedIn social interaction logging
- SMS integration (twilio)

✅ **Pipeline & Analytics (US-041 through US-043)**
- Deal board with Kanban interface
- Pipeline forecasting
- Activity tracking and KPI dashboard
- Sales analytics with Recharts visualizations
- Team leaderboards

✅ **Settings & Billing (US-044 through US-047)**
- Stripe checkout and subscription management
- Billing webhook handling
- Organization settings management
- Team invitation and member management
- Pricing page

### In Progress / Pending (4/48)

🔄 **Modern UI/UX Redesign (ralph/modern-editor branch)**
- Updated components (Home, Analytics, ContactDetailPage, SalesBlocks)
- Improved dark mode theming
- Layout refinements
- New pages: Arena.tsx, ContentLibrary.tsx (experimental)

❓ **Outstanding Questions**
- Arena and ContentLibrary pages — are these part of the final product or R&D explorations?
- Final design language finalization (currently in-progress via ralph/modern-editor)

---

## How to Set Up (For New Engineer)

### Prerequisites
- Node.js 20+
- Bun (recommended) or npm
- Docker (for local Supabase)
- GitHub SSH key configured

### 1. Clone the Repository
```bash
git clone git@github.com:RPbrenanweston/salesblock-io.git
cd salesblock-io
```

### 2. Choose Your Branch
```bash
# For production-ready code (main integration branch)
git checkout ralph/salesblock-io

# For UI modernization work (in-progress feature branch)
git checkout ralph/modern-editor
```

### 3. Set Up Supabase Locally
Follow `DATABASE_SETUP.md` for:
- Installing Supabase CLI
- Linking to the Supabase project
- Running migrations
- Seeding test data

### 4. Set Up Frontend
```bash
cd frontend
npm install
# or
bun install

# Create .env.local from .env.example
cp .env.example .env.local

# Add your Supabase URL and anon key
# VITE_SUPABASE_URL=https://your-project.supabase.co
# VITE_SUPABASE_ANON_KEY=your-anon-key
```

### 5. Start Development Servers
```bash
# Terminal 1: Supabase (if local)
supabase start

# Terminal 2: Frontend dev server
cd frontend
npm run dev
# App runs at http://localhost:3000
```

### 6. Run Quality Checks
```bash
# Typecheck
npm run typecheck

# Lint
npm run lint

# Tests (if configured)
npm test
```

---

## Key Files to Know

### Configuration
- `frontend/vite.config.ts` — Build and dev server config
- `frontend/tsconfig.json` — TypeScript strict mode settings
- `frontend/tailwind.config.js` — Theme colors, dark mode, plugins
- `supabase/config.toml` — Supabase local dev configuration

### Core Logic
- `frontend/src/lib/supabase.ts` — Supabase client initialization with auth state
- `frontend/src/App.tsx` — Main routing, query provider setup, layout
- `frontend/src/components/AppLayout.tsx` — Navigation shell, auth state management
- `supabase/migrations/` — All schema, RLS policies, functions

### Pages
- `frontend/src/pages/Home.tsx` — Dashboard / main entry
- `frontend/src/pages/SalesBlocks.tsx` — Focus sessions UI
- `frontend/src/pages/Analytics.tsx` — KPI dashboard
- `frontend/src/pages/ContactDetailPage.tsx` — Contact view + activity log

### Documentation
- `prd.json` — Complete product spec (48 stories, acceptance criteria)
- `progress.txt` — Iteration log showing what was built and learnings
- `AGENTS.md` — Reusable patterns discovered during development

---

## Important Patterns & Conventions

### 1. **Tailwind CSS Organization**
- Dark mode uses `darkMode: 'class'` strategy (toggle via JS, not media query)
- All colors inherit from `tailwind.config.js` theme
- Avoid hardcoded hex colors; use Tailwind classes
- Common pattern: `bg-white dark:bg-slate-900 text-slate-900 dark:text-white`

### 2. **Supabase RLS & Auth**
- All tables enforce RLS policies
- Auth state checked via `supabase.auth.getSession()`
- User org_id determined via `SELECT org_id FROM users WHERE id = auth.uid()`
- Managers have dual read/write policies; SDRs/AEs have read-only for cross-team data

### 3. **React Query Setup**
- Global `QueryClientProvider` wraps app in `App.tsx`
- Custom hooks in `frontend/src/lib/` for API calls
- Invalidation patterns for mutations: `queryClient.invalidateQueries(['key'])`
- Stale time and cache time configured in `vite.config.ts`

### 4. **Component Structure**
- Functional components with React Hooks
- Props typed with TypeScript interfaces (not `any`)
- Lucide icons for all UI icons
- Tailwind for all styling (no CSS files except `index.css`)

### 5. **Git Workflow**
- Main integration branch: `ralph/salesblock-io`
- Feature branches: `ralph/feature-name`
- Commit format: `feat: US-### - Story Title` or `fix: Description`
- Always push to origin before PR

---

## Deployment

### Frontend (Vercel)
1. Push to `main` or create a PR to `ralph/salesblock-io`
2. Vercel auto-deploys on push
3. Environment variables configured in Vercel dashboard
4. See `DEPLOY.md` for detailed instructions

### Backend (Supabase)
- Migrations auto-apply on `supabase db deploy`
- See `DATABASE_SETUP.md` for production setup
- Ensure RLS policies are enabled on all tables

### Monitoring
- Check Vercel dashboard for frontend errors
- Monitor Supabase logs for RLS issues or auth failures
- Review error tracking (if configured)

---

## Next Steps for New Engineer

### Immediate (Day 1)
1. ✅ Set up local dev environment using this guide
2. ✅ Read `prd.json` to understand product scope
3. ✅ Review `progress.txt` to see implementation patterns
4. ✅ Read `API.md` for endpoint documentation
5. ✅ Verify app runs locally at http://localhost:3000

### Short Term (Week 1)
1. 🔄 Review `ralph/modern-editor` branch to understand ongoing UI work
2. 🔄 Decide: Merge modern-editor to main or refactor?
3. 🔄 Resolve Arena.tsx and ContentLibrary.tsx — are these final features?
4. 🔄 Complete the 4 remaining stories in `prd.json` (if not already implemented)

### Medium Term (Week 2-4)
1. Implement final features and polish
2. Set up CI/CD pipeline (if not already configured)
3. Configure production Supabase project
4. Deploy to staging, then production
5. Set up monitoring and error tracking

### Long Term
- Refer to feature requests / roadmap
- Consider performance optimizations (React code splitting, lazy loading)
- Plan for horizontal scaling if user base grows

---

## Questions & Support

### For Architecture Questions
- Review `AGENTS.md` for patterns discovered during development
- Check `progress.txt` for implementation decisions and rationale
- Refer to `prd.json` acceptance criteria for requirements clarity

### For Supabase Issues
- See `DATABASE_SETUP.md` and `supabase/migrations/` files
- Consult Supabase docs for advanced RLS patterns
- Local `supabase start` + `supabase db reset` for testing

### For Frontend Questions
- Check component examples in `frontend/src/components/`
- Review page implementations for routing patterns
- Consult `frontend/src/lib/supabase.ts` for auth flow

### Contacts for Questions
- **Original Developer:** Robert (RPbrenanweston)
- **GitHub:** https://github.com/RPbrenanweston/salesblock-io
- **Documentation:** All critical docs in repository root

---

## Git Branches Explained

| Branch | Purpose | Status |
|--------|---------|--------|
| `ralph/salesblock-io` | Main integration branch (PRD default) | ✅ Primary |
| `ralph/modern-editor` | UI/UX modernization (in-progress) | 🔄 Feature branch |
| `main` | Not used (see note below) | ⚠️ Unused |

**⚠️ IMPORTANT GITHUB SETTING TO FIX:**
The default branch in GitHub is currently set to `ralph/salesblock-io`. This is intentional (to keep work on dedicated branches), but can be confusing. If you need to change it, go to:
- **GitHub Settings → Branches → Default branch → change to `main`**
- Then ensure `main` is created from `ralph/salesblock-io` before doing so

---

## Summary

You're inheriting a **fully-featured sales cockpit** with:
- ✅ Complete authentication and multi-tenant architecture
- ✅ Contact management with import/sync
- ✅ Timed focus sessions and calendar integration
- ✅ Multi-channel outreach (email, phone, social)
- ✅ Pipeline management and forecasting
- ✅ Analytics dashboard
- ✅ Billing integration
- ✅ 92% of planned features implemented

**Your job:** Polish, optimize, deploy to production, and iterate based on user feedback.

Good luck! 🚀
