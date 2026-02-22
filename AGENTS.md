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
- **Styling**: Tailwind CSS with `darkMode: 'class'` strategy for manual dark mode toggling
- **Routing**: React Router v6 with BrowserRouter wrapping all routes
- **Data fetching**: TanStack Query (React Query) provider wraps the entire app in `App.tsx`
- **Supabase client**: Centralized in `src/lib/supabase.ts` using environment variables
- **Dev server**: Runs on port 3000 (configured in `vite.config.ts`)

### Backend Architecture (Supabase)
- **Database**: PostgreSQL via Supabase with migrations in `supabase/migrations/`
- **Auth**: Email+password authentication enabled by default
- **Schema conventions**:
  - ENUM types for user roles and activity types
  - JSONB columns for flexible settings/preferences
  - All foreign keys use CASCADE on DELETE for org hierarchy
  - SET NULL for optional relationships (division_id, team_id)
- **RLS**: Row-level security policies enforce org-scoped data access
