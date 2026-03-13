-- Migration 018: Staff Roles and Members
-- Creates the admin RBAC tables for the admin portal.
-- Roles carry a permissions jsonb blob; staff_members maps auth users to roles.

-- staff_roles: named roles with permission sets
create table if not exists public.staff_roles (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique check (name in ('admin', 'moderator', 'analyst', 'support')),
  label       text not null,
  permissions jsonb not null default '{}',
  created_at  timestamptz not null default now()
);

-- staff_members: links auth.users to a staff role
create table if not exists public.staff_members (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id),
  role_id     uuid not null references public.staff_roles(id),
  assigned_at timestamptz not null default now(),
  assigned_by uuid references auth.users(id),
  unique (user_id)  -- one role per user
);

-- indexes
create index if not exists staff_members_user_id_idx on public.staff_members(user_id);
create index if not exists staff_members_role_id_idx on public.staff_members(role_id);

-- RLS
alter table public.staff_roles   enable row level security;
alter table public.staff_members enable row level security;

-- Only admins can view / edit staff tables.
-- We check app_metadata.role = 'admin' set on the JWT by Supabase.
create policy "admins_read_staff_roles"
  on public.staff_roles for select
  using ((auth.jwt() ->> 'role') = 'admin' or
         (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "admins_write_staff_roles"
  on public.staff_roles for all
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "admins_read_staff_members"
  on public.staff_members for select
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "admins_write_staff_members"
  on public.staff_members for all
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- Seed default roles with their permission sets
insert into public.staff_roles (name, label, permissions) values
  (
    'admin',
    'Administrator',
    '{
      "canViewUsers":    true,
      "canEditUsers":    true,
      "canDeleteUsers":  true,
      "canViewIntel":    true,
      "canEditSettings": true,
      "canViewAIConfig": true,
      "canEditAIConfig": true,
      "canManageStaff":  true
    }'::jsonb
  ),
  (
    'moderator',
    'Moderator',
    '{
      "canViewUsers":    true,
      "canEditUsers":    true,
      "canDeleteUsers":  false,
      "canViewIntel":    true,
      "canEditSettings": false,
      "canViewAIConfig": false,
      "canEditAIConfig": false,
      "canManageStaff":  false
    }'::jsonb
  ),
  (
    'analyst',
    'Analyst',
    '{
      "canViewUsers":    true,
      "canEditUsers":    false,
      "canDeleteUsers":  false,
      "canViewIntel":    true,
      "canEditSettings": false,
      "canViewAIConfig": false,
      "canEditAIConfig": false,
      "canManageStaff":  false
    }'::jsonb
  ),
  (
    'support',
    'Support',
    '{
      "canViewUsers":    true,
      "canEditUsers":    false,
      "canDeleteUsers":  false,
      "canViewIntel":    false,
      "canEditSettings": false,
      "canViewAIConfig": false,
      "canEditAIConfig": false,
      "canManageStaff":  false
    }'::jsonb
  )
on conflict (name) do nothing;
