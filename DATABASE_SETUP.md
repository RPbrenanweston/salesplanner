# Supabase Database Setup

This guide explains how to set up the Supabase database for the CodeSignal-20 research agent.

## Overview

The agent uses Supabase to:
- **Store validated engineer profiles** with all citation URLs preserved
- **Track search run metadata** (config, discovery counts, results)
- **Sync exclusion lists** bidirectionally for iterative searches
- **Enable database-first discovery** to reduce token usage over time

## Database Schema

### Table: `engineers`

Stores validated engineer profiles with citation-backed evidence.

```sql
CREATE TABLE engineers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  handle TEXT,
  primary_url TEXT UNIQUE NOT NULL,
  languages TEXT[] NOT NULL,
  engineering_focus TEXT NOT NULL,
  geography TEXT,
  signals JSONB NOT NULL,
  citations JSONB NOT NULL,
  last_validated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for query performance
CREATE INDEX idx_engineers_languages ON engineers USING GIN (languages);
CREATE INDEX idx_engineers_last_validated ON engineers (last_validated DESC);
CREATE INDEX idx_engineers_geography ON engineers (geography);
CREATE INDEX idx_engineers_primary_url ON engineers (primary_url);
```

### Table: `search_runs`

Tracks metadata for each agent execution.

```sql
CREATE TABLE search_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config JSONB NOT NULL,
  profiles_discovered INTEGER NOT NULL DEFAULT 0,
  profiles_validated INTEGER NOT NULL DEFAULT 0,
  profiles_returned INTEGER NOT NULL DEFAULT 0,
  exclusion_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for analytics
CREATE INDEX idx_search_runs_created_at ON search_runs (created_at DESC);
```

### Table: `exclusions`

Stores bidirectionally synced exclusion list for iterative searches.

```sql
CREATE TABLE exclusions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  engineer_id UUID REFERENCES engineers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  primary_url TEXT UNIQUE NOT NULL,
  search_context TEXT NOT NULL,
  excluded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for exclusion filtering
CREATE INDEX idx_exclusions_primary_url ON exclusions (primary_url);
CREATE INDEX idx_exclusions_excluded_at ON exclusions (excluded_at DESC);
```

## Setup Steps

### 1. Create Supabase Project

1. Go to [https://app.supabase.com](https://app.supabase.com)
2. Create a new project
3. Wait for the database to initialize (~2 minutes)

### 2. Run Schema Migrations

1. Open the SQL Editor in your Supabase dashboard
2. Copy the SQL schema from above
3. Execute each `CREATE TABLE` block
4. Verify tables appear in the Table Editor

### 3. Configure Environment Variables

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Get your credentials from Supabase:
   - **Project URL**: Settings → API → Project URL
   - **Anon Key**: Settings → API → Project API keys → anon/public

3. Update `.env` with your credentials:
   ```env
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_ANON_KEY=your-actual-anon-key-here
   ```

### 4. Test Connection

Run the test suite to verify graceful degradation works:

```bash
npm test src/database.test.ts
```

All tests should pass, confirming the agent handles both local-only and database-enabled modes.

## Graceful Degradation

The agent **automatically falls back to local-only mode** if:
- `SUPABASE_URL` or `SUPABASE_ANON_KEY` environment variables are missing
- Supabase connection fails during initialization
- Any database operation returns an error

**Local-only mode still works perfectly** — the agent just won't persist data to Supabase. All core functionality (discovery, validation, report generation, exclusions) operates normally using local files.

## Data Flow

### First Run (No Database)
1. User provides gating inputs
2. Agent discovers candidates via web search
3. Validates 20 profiles with citations
4. Generates research report
5. Exclusions saved to `exclusions.json` locally

### First Run (With Database)
1-4. Same as above
5. **Profiles upserted to `engineers` table**
6. **Search metadata recorded in `search_runs` table**
7. **Exclusions synced to `exclusions` table**
8. Local files still maintained for compatibility

### Subsequent Runs (With Database)
1. User provides feedback ("show me 20 more")
2. Agent queries `engineers` table first
   - Filters by language, focus, geography
   - Excludes stale profiles (> 90 days old)
   - Returns N fresh matches from database
3. If N < 20, web discovery fills gap with (20 - N) new candidates
4. Validates new candidates, updates database
5. Report shows: "12 from database, 8 from web discovery"

**Over time, the database becomes the primary source**, dramatically reducing token usage and API calls.

## Migration Path

### Phase 1: Local-Only (Current)
- Agent works without any database
- All data in local JSON files
- No credentials needed

### Phase 2: Database-Enabled (US-010)
- Add Supabase credentials to `.env`
- Agent persists data automatically
- Still works locally if DB unavailable

### Phase 3: Database-First (US-011)
- Agent queries DB before web search
- Token usage drops ~60-80% on repeat searches
- Web search becomes gap-filling only

## Security Notes

- **Never commit `.env` file** — already in `.gitignore`
- Use **anon/public key** for client-side operations
- Row-level security (RLS) not required for this use case (research data is not user-specific)
- Service role key not needed — all operations use anon key

## Monitoring

Track agent efficiency in Supabase dashboard:

```sql
-- Total engineers in database
SELECT COUNT(*) FROM engineers;

-- Engineers by language
SELECT unnest(languages) AS language, COUNT(*)
FROM engineers
GROUP BY language
ORDER BY count DESC;

-- Search run stats
SELECT
  config->>'engineeringFocus' AS focus,
  AVG(profiles_discovered) AS avg_discovered,
  AVG(profiles_returned) AS avg_returned
FROM search_runs
GROUP BY focus;

-- Staleness distribution
SELECT
  CASE
    WHEN last_validated > NOW() - INTERVAL '30 days' THEN 'Fresh (<30 days)'
    WHEN last_validated > NOW() - INTERVAL '90 days' THEN 'Valid (30-90 days)'
    ELSE 'Stale (>90 days)'
  END AS staleness,
  COUNT(*)
FROM engineers
GROUP BY staleness;
```

## Troubleshooting

### "Database unavailable" errors

**Expected behavior** — agent is in local-only mode. To enable database:
1. Verify `.env` file exists with valid credentials
2. Check credentials match Supabase dashboard
3. Restart the agent process to reload environment variables

### Profiles not appearing in database

Check:
1. `db.isAvailable()` returns `true`
2. No error messages in console during `upsertEngineers()`
3. Supabase project is active (not paused)

### Duplicate key errors

- **primary_url is unique** — upserting same URL updates existing record
- This is intentional (keeps engineers table deduplicated)

### Query returns zero results

Verify:
1. Engineers in database match target languages
2. Profiles not older than staleness threshold (default 90 days)
3. Geography filter matches stored values (case-insensitive)

## Next Steps

After database setup, see **US-011** for database-first discovery implementation, which queries Supabase before falling back to web search.
