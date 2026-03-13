-- Migration 019: Admin Configuration Tables
-- Creates platform_settings and ai_config tables used by the admin portal.
-- Both tables store a single row (id = 1) and are upserted on change.

-- ── platform_settings ─────────────────────────────────────────────────────
create table if not exists public.platform_settings (
  id integer primary key default 1,
  -- Feature flags
  "enableMentors"         boolean not null default true,
  "enableMatches"         boolean not null default true,
  "enableInterviewIntel"  boolean not null default true,
  "enableBenchmarks"      boolean not null default true,
  "enablePublicProfiles"  boolean not null default false,
  "maintenanceMode"       boolean not null default false,
  -- Global config
  "platformName"          text    not null default 'SalesBlock',
  "supportEmail"          text    not null default 'support@salesblock.io',
  "maxJobsPerEmployer"    integer not null default 10,
  "maxAppsPerCandidate"   integer not null default 50,
  -- Billing config
  "freeTierJobLimit"      integer not null default 3,
  "freeTierCandidateLimit" integer not null default 100,
  "proTierMonthlyPriceGbp" numeric(10,2) not null default 49.00,
  "billingCurrency"       text    not null default 'GBP',
  updated_at timestamptz not null default now()
);

-- Ensure only one row (idempotent — safe to re-run if constraint already exists)
do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'platform_settings_single_row'
  ) then
    alter table public.platform_settings
      add constraint platform_settings_single_row check (id = 1);
  end if;
end $$;

-- ── ai_config ──────────────────────────────────────────────────────────────
create table if not exists public.ai_config (
  id integer primary key default 1,
  "primaryModel"            text    not null default 'claude-sonnet-4-6',
  "enableJobMatchAI"        boolean not null default true,
  "enableInterviewAnalysis" boolean not null default true,
  "enableResumeScoring"     boolean not null default false,
  "enableAutoSuggestions"   boolean not null default true,
  "maxMonthlyTokens"        integer not null default 5000000,
  updated_at timestamptz not null default now()
);

do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'ai_config_single_row'
  ) then
    alter table public.ai_config
      add constraint ai_config_single_row check (id = 1);
  end if;
end $$;

-- ── RLS ────────────────────────────────────────────────────────────────────
alter table public.platform_settings enable row level security;
alter table public.ai_config         enable row level security;

-- Admins can read both tables (idempotent policy creation)
do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'platform_settings' and policyname = 'admins_read_platform_settings'
  ) then
    create policy "admins_read_platform_settings"
      on public.platform_settings for select
      using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'platform_settings' and policyname = 'admins_write_platform_settings'
  ) then
    create policy "admins_write_platform_settings"
      on public.platform_settings for all
      using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'ai_config' and policyname = 'admins_read_ai_config'
  ) then
    create policy "admins_read_ai_config"
      on public.ai_config for select
      using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'ai_config' and policyname = 'admins_write_ai_config'
  ) then
    create policy "admins_write_ai_config"
      on public.ai_config for all
      using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
  end if;
end $$;

-- ── Seed defaults ──────────────────────────────────────────────────────────
insert into public.platform_settings (id) values (1)
on conflict (id) do nothing;

insert into public.ai_config (id) values (1)
on conflict (id) do nothing;
