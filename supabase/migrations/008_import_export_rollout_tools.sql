-- =========================================================
-- GRC Control Center - Migration 008
-- Import / Export rollout tools and staging controls
-- =========================================================

-- This migration supports safe rollout to 1,000 employees / 50 departments.
-- It stages pasted CSV/Excel data for review before actual inserts/auth user creation.
-- Browser clients should NOT create Supabase Auth users directly.

-- =========================
-- ENUMS
-- =========================

do $$ begin
  create type public.bulk_import_type as enum (
    'divisions',
    'departments',
    'units',
    'employees',
    'projects',
    'risks',
    'compliance',
    'audit_findings',
    'governance_decisions'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.bulk_import_status as enum (
    'uploaded',
    'validated',
    'validated_with_errors',
    'approved_for_import',
    'importing',
    'imported',
    'partially_imported',
    'rejected',
    'cancelled'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.bulk_import_row_validation_status as enum (
    'valid',
    'invalid',
    'warning'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.bulk_import_row_import_status as enum (
    'not_imported',
    'imported',
    'failed',
    'skipped'
  );
exception when duplicate_object then null;
end $$;

-- =========================
-- BULK IMPORT BATCHES
-- =========================

create table if not exists public.bulk_import_batches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,

  batch_type public.bulk_import_type not null,
  source_file_name text,

  status public.bulk_import_status not null default 'uploaded',

  total_rows integer not null default 0 check (total_rows >= 0),
  valid_rows integer not null default 0 check (valid_rows >= 0),
  invalid_rows integer not null default 0 check (invalid_rows >= 0),

  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  approval_note text,

  imported_by uuid references public.profiles(id) on delete set null,
  imported_at timestamptz,

  rejection_reason text,

  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint bulk_import_row_counts_valid check (valid_rows + invalid_rows <= total_rows)
);

create table if not exists public.bulk_import_rows (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  batch_id uuid not null references public.bulk_import_batches(id) on delete cascade,

  row_number integer not null check (row_number > 0),
  raw_data jsonb not null default '{}'::jsonb,

  validation_status public.bulk_import_row_validation_status not null default 'valid',
  validation_errors text[] not null default array[]::text[],
  validation_warnings text[] not null default array[]::text[],

  import_status public.bulk_import_row_import_status not null default 'not_imported',
  import_error text,
  created_record_table text,
  created_record_id uuid,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (batch_id, row_number)
);

-- Employee auth creation requires server-side service-role processing.
-- This table stores reviewed employee rows before a secure Edge Function creates auth.users + profiles + user_roles.
create table if not exists public.employee_import_staging (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  batch_id uuid references public.bulk_import_batches(id) on delete set null,
  row_id uuid references public.bulk_import_rows(id) on delete set null,

  employee_no text,
  full_name_en text not null,
  full_name_ar text,
  email text not null,
  job_title text,

  division_code text,
  department_code text,
  unit_code text,

  primary_role public.app_role not null default 'employee',
  role_scope public.access_scope not null default 'assigned_only',

  is_active boolean not null default true,

  status text not null default 'staged' check (status in ('staged','ready','created','failed','cancelled')),
  profile_id uuid references public.profiles(id) on delete set null,
  processing_error text,

  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (organization_id, email),
  unique (organization_id, employee_no)
);

create index if not exists idx_bulk_import_batches_org on public.bulk_import_batches(organization_id);
create index if not exists idx_bulk_import_batches_status on public.bulk_import_batches(status);
create index if not exists idx_bulk_import_batches_type on public.bulk_import_batches(batch_type);
create index if not exists idx_bulk_import_batches_created on public.bulk_import_batches(created_at);

create index if not exists idx_bulk_import_rows_batch on public.bulk_import_rows(batch_id);
create index if not exists idx_bulk_import_rows_validation on public.bulk_import_rows(validation_status);
create index if not exists idx_bulk_import_rows_import on public.bulk_import_rows(import_status);
create index if not exists idx_bulk_import_rows_raw_gin on public.bulk_import_rows using gin(raw_data);

create index if not exists idx_employee_import_staging_org on public.employee_import_staging(organization_id);
create index if not exists idx_employee_import_staging_batch on public.employee_import_staging(batch_id);
create index if not exists idx_employee_import_staging_email on public.employee_import_staging(lower(email));
create index if not exists idx_employee_import_staging_department_code on public.employee_import_staging(lower(department_code));
create index if not exists idx_employee_import_staging_status on public.employee_import_staging(status);

-- updated_at triggers

drop trigger if exists trg_bulk_import_batches_updated_at on public.bulk_import_batches;
create trigger trg_bulk_import_batches_updated_at
before update on public.bulk_import_batches
for each row execute function public.set_updated_at();

drop trigger if exists trg_bulk_import_rows_updated_at on public.bulk_import_rows;
create trigger trg_bulk_import_rows_updated_at
before update on public.bulk_import_rows
for each row execute function public.set_updated_at();

drop trigger if exists trg_employee_import_staging_updated_at on public.employee_import_staging;
create trigger trg_employee_import_staging_updated_at
before update on public.employee_import_staging
for each row execute function public.set_updated_at();

-- audit logs

drop trigger if exists trg_audit_bulk_import_batches on public.bulk_import_batches;
create trigger trg_audit_bulk_import_batches
after insert or update or delete on public.bulk_import_batches
for each row execute function public.audit_log_row_change();

drop trigger if exists trg_audit_bulk_import_rows on public.bulk_import_rows;
create trigger trg_audit_bulk_import_rows
after insert or update or delete on public.bulk_import_rows
for each row execute function public.audit_log_row_change();

drop trigger if exists trg_audit_employee_import_staging on public.employee_import_staging;
create trigger trg_audit_employee_import_staging
after insert or update or delete on public.employee_import_staging
for each row execute function public.audit_log_row_change();

-- =========================
-- RLS
-- =========================

alter table public.bulk_import_batches enable row level security;
alter table public.bulk_import_rows enable row level security;
alter table public.employee_import_staging enable row level security;

create policy bulk_import_batches_read on public.bulk_import_batches
for select using (public.can_access_org(organization_id) and public.can_manage_grc());

create policy bulk_import_batches_insert on public.bulk_import_batches
for insert with check (public.can_access_org(organization_id) and public.can_manage_grc());

create policy bulk_import_batches_update on public.bulk_import_batches
for update using (public.can_access_org(organization_id) and public.can_manage_grc())
with check (public.can_access_org(organization_id) and public.can_manage_grc());

create policy bulk_import_rows_read on public.bulk_import_rows
for select using (public.can_access_org(organization_id) and public.can_manage_grc());

create policy bulk_import_rows_insert on public.bulk_import_rows
for insert with check (public.can_access_org(organization_id) and public.can_manage_grc());

create policy bulk_import_rows_update on public.bulk_import_rows
for update using (public.can_access_org(organization_id) and public.can_manage_grc())
with check (public.can_access_org(organization_id) and public.can_manage_grc());

create policy employee_import_staging_read on public.employee_import_staging
for select using (public.can_access_org(organization_id) and public.has_any_role(array['super_admin','executive','governance_admin']::public.app_role[]));

create policy employee_import_staging_write on public.employee_import_staging
for all using (public.can_access_org(organization_id) and public.has_any_role(array['super_admin','governance_admin']::public.app_role[]))
with check (public.can_access_org(organization_id) and public.has_any_role(array['super_admin','governance_admin']::public.app_role[]));

-- =========================
-- QUALITY / DUPLICATE HEALTH VIEWS
-- =========================

create or replace view public.v_bulk_import_batch_summary as
select
  b.id,
  b.organization_id,
  b.batch_type,
  b.source_file_name,
  b.status,
  b.total_rows,
  b.valid_rows,
  b.invalid_rows,
  round(case when b.total_rows > 0 then (b.valid_rows::numeric / b.total_rows::numeric) * 100 else 0 end, 2) as valid_percent,
  b.created_at,
  creator.full_name_en as created_by_name,
  approver.full_name_en as approved_by_name,
  importer.full_name_en as imported_by_name
from public.bulk_import_batches b
left join public.profiles creator on creator.id = b.created_by
left join public.profiles approver on approver.id = b.approved_by
left join public.profiles importer on importer.id = b.imported_by;

create or replace view public.v_duplicate_active_department_codes as
select
  organization_id,
  lower(trim(code)) as normalized_code,
  count(*) as duplicate_count,
  array_agg(id order by created_at) as department_ids,
  array_agg(name_en order by created_at) as department_names
from public.departments
where is_active = true and code is not null and trim(code) <> ''
group by organization_id, lower(trim(code))
having count(*) > 1;

create or replace view public.v_duplicate_active_unit_codes as
select
  department_id,
  lower(trim(code)) as normalized_code,
  count(*) as duplicate_count,
  array_agg(id order by created_at) as unit_ids,
  array_agg(name_en order by created_at) as unit_names
from public.units
where is_active = true and code is not null and trim(code) <> ''
group by department_id, lower(trim(code))
having count(*) > 1;

create or replace view public.v_duplicate_profile_emails as
select
  organization_id,
  lower(trim(email)) as normalized_email,
  count(*) as duplicate_count,
  array_agg(id order by created_at) as profile_ids,
  array_agg(full_name_en order by created_at) as profile_names
from public.profiles
where email is not null and trim(email) <> ''
group by organization_id, lower(trim(email))
having count(*) > 1;

-- Helper view for dashboard/admin health checks.
create or replace view public.v_rollout_data_health_summary as
select
  o.id as organization_id,
  o.name_en as organization_name_en,
  (select count(*) from public.divisions d where d.organization_id = o.id and d.is_active = true) as active_divisions,
  (select count(*) from public.departments d where d.organization_id = o.id and d.is_active = true) as active_departments,
  (select count(*) from public.units u where u.organization_id = o.id and u.is_active = true) as active_units,
  (select count(*) from public.profiles p where p.organization_id = o.id and p.is_active = true) as active_profiles,
  (select count(*) from public.bulk_import_batches b where b.organization_id = o.id and b.status in ('uploaded','validated','validated_with_errors','approved_for_import')) as open_import_batches,
  (select coalesce(sum(invalid_rows), 0) from public.bulk_import_batches b where b.organization_id = o.id and b.status in ('uploaded','validated_with_errors')) as unresolved_import_errors,
  (select count(*) from public.v_duplicate_active_department_codes dd where dd.organization_id = o.id) as duplicate_department_code_groups,
  (select count(*) from public.v_duplicate_profile_emails pe where pe.organization_id = o.id) as duplicate_profile_email_groups
from public.organizations o;
