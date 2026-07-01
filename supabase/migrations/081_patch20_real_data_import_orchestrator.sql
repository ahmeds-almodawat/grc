-- Patch 20 - Full Real Data Import Orchestrator
-- Audit-safe staging import ledger and pending auth-user queue.
-- This migration does not load data, create auth users, weaken RLS, or add hard-delete paths.

create table if not exists public.patch20_real_import_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete set null,
  mode text not null check (mode in ('dry_run', 'apply')),
  source_folder text,
  input_available boolean not null default false,
  create_auth_users boolean not null default false,
  status text not null default 'created' check (status in ('created', 'validated', 'blocked', 'applied', 'failed', 'rolled_back_manually')),
  dry_run_blocking_error_count integer not null default 0,
  warning_count integer not null default 0,
  report_paths jsonb not null default '{}'::jsonb,
  import_plan jsonb not null default '{}'::jsonb,
  pre_import_snapshot jsonb,
  rollback_note text,
  created_by text not null default 'patch20_cli',
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.patch20_real_import_rows (
  id uuid primary key default gen_random_uuid(),
  run_id uuid references public.patch20_real_import_runs(id) on delete set null,
  organization_id uuid references public.organizations(id) on delete set null,
  file_name text not null,
  dataset_key text not null,
  row_number integer,
  business_key text,
  target_table text,
  action text not null check (action in ('create', 'update', 'skip', 'stage', 'pending_auth_user', 'validation_only')),
  action_status text not null default 'planned' check (action_status in ('planned', 'success', 'failed', 'skipped')),
  message text,
  row_hash text,
  sanitized_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.patch20_pending_auth_users (
  id uuid primary key default gen_random_uuid(),
  run_id uuid references public.patch20_real_import_runs(id) on delete set null,
  organization_id uuid references public.organizations(id) on delete cascade,
  email text not null,
  employee_no text,
  full_name_en text,
  full_name_ar text,
  department_code text,
  requested_role text,
  source_file text not null default '04_users_owners.csv',
  reason text not null default 'Profile row has no matching Supabase Auth/profile account. Create explicitly from server-side tooling only.',
  status text not null default 'pending_review' check (status in ('pending_review', 'approved_for_creation', 'created', 'skipped', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, email)
);

create index if not exists idx_patch20_import_runs_org_created on public.patch20_real_import_runs(organization_id, created_at desc);
create index if not exists idx_patch20_import_rows_run on public.patch20_real_import_rows(run_id, dataset_key, action_status);
create index if not exists idx_patch20_pending_auth_org_status on public.patch20_pending_auth_users(organization_id, status);

alter table public.patch20_real_import_runs enable row level security;
alter table public.patch20_real_import_rows enable row level security;
alter table public.patch20_pending_auth_users enable row level security;

drop policy if exists patch20_real_import_runs_read on public.patch20_real_import_runs;
create policy patch20_real_import_runs_read
on public.patch20_real_import_runs
for select to authenticated
using (
  organization_id is null
  or organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')
);

drop policy if exists patch20_real_import_runs_admin_insert on public.patch20_real_import_runs;
create policy patch20_real_import_runs_admin_insert
on public.patch20_real_import_runs
for insert to authenticated
with check (
  organization_id is null
  or (
    organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')
    and public.has_any_role(array['super_admin','governance_admin']::public.app_role[])
  )
);

drop policy if exists patch20_real_import_rows_read on public.patch20_real_import_rows;
create policy patch20_real_import_rows_read
on public.patch20_real_import_rows
for select to authenticated
using (
  organization_id is null
  or organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')
);

drop policy if exists patch20_real_import_rows_admin_insert on public.patch20_real_import_rows;
create policy patch20_real_import_rows_admin_insert
on public.patch20_real_import_rows
for insert to authenticated
with check (
  organization_id is null
  or (
    organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')
    and public.has_any_role(array['super_admin','governance_admin']::public.app_role[])
  )
);

drop policy if exists patch20_pending_auth_users_read on public.patch20_pending_auth_users;
create policy patch20_pending_auth_users_read
on public.patch20_pending_auth_users
for select to authenticated
using (
  organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')
  and public.has_any_role(array['super_admin','governance_admin']::public.app_role[])
);

drop policy if exists patch20_pending_auth_users_admin_insert on public.patch20_pending_auth_users;
create policy patch20_pending_auth_users_admin_insert
on public.patch20_pending_auth_users
for insert to authenticated
with check (
  organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')
  and public.has_any_role(array['super_admin','governance_admin']::public.app_role[])
);

drop policy if exists patch20_pending_auth_users_admin_update on public.patch20_pending_auth_users;
create policy patch20_pending_auth_users_admin_update
on public.patch20_pending_auth_users
for update to authenticated
using (
  organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')
  and public.has_any_role(array['super_admin','governance_admin']::public.app_role[])
)
with check (
  organization_id::text = coalesce(auth.jwt() ->> 'organization_id', auth.jwt() -> 'app_metadata' ->> 'organization_id')
  and public.has_any_role(array['super_admin','governance_admin']::public.app_role[])
);

comment on table public.patch20_real_import_runs is 'Patch 20 staging-first real GRC import run ledger. Apply runs must be explicit and report-driven.';
comment on table public.patch20_real_import_rows is 'Patch 20 per-row create/update/skip/stage outcomes with sanitized payloads only.';
comment on table public.patch20_pending_auth_users is 'Patch 20 pending account creation queue. Browser code must not create Supabase Auth users.';
