# Ralph Agent Instructions

## Overview

Ralph is an autonomous AI agent loop that runs AI coding tools (Amp or Claude Code) repeatedly until all PRD items are complete. Each iteration is a fresh instance with clean context.

## Commands

```bash
# Run the flowchart dev server
cd flowchart && npm run dev

# Build the flowchart
cd flowchart && npm run build

# Run Ralph with Amp (default)
./ralph.sh [max_iterations]

# Run Ralph with Claude Code
./ralph.sh --tool claude [max_iterations]
```

## Key Files

- `ralph.sh` - The bash loop that spawns fresh AI instances (supports `--tool amp` or `--tool claude`)
- `prompt.md` - Instructions given to each AMP instance
-  `CLAUDE.md` - Instructions given to each Claude Code instance
- `prd.json.example` - Example PRD format
- `flowchart/` - Interactive React Flow diagram explaining how Ralph works

## Flowchart

The `flowchart/` directory contains an interactive visualization built with React Flow. It's designed for presentations - click through to reveal each step with animations.

To run locally:
```bash
cd flowchart
npm install
npm run dev
```

## Patterns

- Each iteration spawns a fresh AI instance (Amp or Claude Code) with clean context
- Memory persists via git history, `progress.txt`, and `prd.json`
- Stories should be small enough to complete in one context window
- Always update AGENTS.md with discovered patterns for future iterations

## SalesBlock.io Specific Patterns

### Frontend Architecture (Vite + React + TypeScript)
- **Project structure**: `frontend/` subdirectory contains the React app
- **Type definitions**: Must include `src/vite-env.d.ts` with `/// <reference types="vite/client" />` for env type support
- **Environment variables**: Use `VITE_` prefix (e.g., `VITE_SUPABASE_URL`) and access via `import.meta.env`
- **Environment file location**: `frontend/.env` (dev server must restart after changes)
- **Styling**: Tailwind CSS with `darkMode: 'class'` strategy for manual dark mode toggling
- **Routing**: React Router v6 with BrowserRouter wrapping all routes
- **Data fetching**: TanStack Query (React Query) provider wraps the entire app in `App.tsx`
- **Supabase client**: Centralized in `src/lib/supabase.ts` using environment variables
- **Dev server**: Runs on port 3000 (configured in `vite.config.ts`)

### Authentication Patterns (Supabase Auth)
- **Auth hook**: `src/hooks/useAuth.ts` provides centralized auth state (user, session, signOut)
- **Session management**: Supabase handles persistence automatically with getSession() + onAuthStateChange listener
- **Protected routes**: `src/components/ProtectedRoute.tsx` wraps protected pages, redirects to /signin if unauthenticated
- **Sign-up flow**: Creates auth user → organization record → user record with manager role in sequence
- **Auth pages**: SignIn (`/signin`), SignUp (`/signup`), ForgotPassword (`/forgot-password`)
- **Sign-out**: Calls `supabase.auth.signOut()` and navigates to `/signin`

### Backend Architecture (Supabase)
- **Database**: PostgreSQL via Supabase with migrations in `supabase/migrations/`
- **Auth**: Email+password authentication enabled by default
- **Schema conventions**:
  - ENUM types for user roles and activity types
  - JSONB columns for flexible settings/preferences (custom_fields, filter_criteria)
  - All foreign keys use CASCADE on DELETE for org hierarchy
  - SET NULL for optional relationships (division_id, team_id, created_by)
  - Junction tables use composite primary keys (e.g., `PRIMARY KEY (list_id, contact_id)`)
  - Position tracking in junction tables with INTEGER column for ordering
- **RLS**: Row-level security policies enforce org-scoped data access
- **Triggers**: updated_at triggers for timestamp maintenance on mutable tables

### OAuth Integration Patterns (US-022+)
- **OAuth connections table**: Stores provider, access_token, refresh_token, expires_at with RLS (users see only their own)
- **Popup OAuth flow**: `window.open()` launches OAuth in centered popup, parent polls for closure with setInterval
- **OAuth URL construction**: Provider-specific endpoints with client_id, redirect_uri, scope, state (JSON-encoded user context)
- **Callback handler**: Dedicated route (`/oauth/{provider}/callback`) parses code/state, closes popup or redirects
- **Token exchange**: Should happen in backend (Supabase Edge Function) for security - frontend only initiates flow
- **Connection UI pattern**: Icon + provider name + status badge + email + Connect/Disconnect button
- **Integration grouping**: Settings > Integrations tab organizes by Email, Calendar, CRM sections
- **Environment variables**: Provider-specific client IDs (e.g., `VITE_GMAIL_CLIENT_ID`) required for OAuth
