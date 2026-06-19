-- v6.4 Database Security + Proof Pack
-- Purpose: create a controlled security-proof registry and executable persona-test catalogue.
-- This migration does not relax existing security. It adds auditable controls and RLS-protected proof tables.

create extension if not exists pgcrypto;

create table if not exists public.v64_security_control_catalog (
  id uuid primary key default gen_random_uuid(),
  control_code text not null unique,
  domain text not null,
  title text not null,
  required boolean not null default true,
  status text not null default 'unverified' check (status in ('unverified','planned','in_progress','passed','failed','exception_approved')),
  owner_role text not null default 'it_security',
  verification_method text not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.v64_persona_test_cases (
  id uuid primary key default gen_random_uuid(),
  persona text not null,
  test_code text not null unique,
  scenario text not null,
  expected_result text not null,
  is_negative boolean not null default true,
  test_sql_hint text,
  status text not null default 'unverified' check (status in ('unverified','passed','failed','blocked','exception_approved')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.v64_security_evidence (
  id uuid primary key default gen_random_uuid(),
  evidence_code text not null unique,
  related_control_code text references public.v64_security_control_catalog(control_code) on delete set null,
  related_test_code text references public.v64_persona_test_cases(test_code) on delete set null,
  status text not null default 'unverified' check (status in ('unverified','passed','failed','exception_approved')),
  evidence_location text,
  evidence_summary text,
  verified_by uuid,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.v64_security_control_catalog enable row level security;
alter table public.v64_persona_test_cases enable row level security;
alter table public.v64_security_evidence enable row level security;

-- Metadata can be read by authenticated users. Mutation should happen through SQL editor/service role during release proof.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'v64_security_control_catalog' and policyname = 'v64_security_control_catalog_select_authenticated'
  ) then
    create policy v64_security_control_catalog_select_authenticated
      on public.v64_security_control_catalog for select
      to authenticated
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'v64_persona_test_cases' and policyname = 'v64_persona_test_cases_select_authenticated'
  ) then
    create policy v64_persona_test_cases_select_authenticated
      on public.v64_persona_test_cases for select
      to authenticated
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'v64_security_evidence' and policyname = 'v64_security_evidence_select_authenticated'
  ) then
    create policy v64_security_evidence_select_authenticated
      on public.v64_security_evidence for select
      to authenticated
      using (true);
  end if;
end $$;

create or replace function public.v64_touch_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_v64_security_control_catalog_touch') then
    create trigger trg_v64_security_control_catalog_touch
      before update on public.v64_security_control_catalog
      for each row execute function public.v64_touch_updated_at();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'trg_v64_persona_test_cases_touch') then
    create trigger trg_v64_persona_test_cases_touch
      before update on public.v64_persona_test_cases
      for each row execute function public.v64_touch_updated_at();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'trg_v64_security_evidence_touch') then
    create trigger trg_v64_security_evidence_touch
      before update on public.v64_security_evidence
      for each row execute function public.v64_touch_updated_at();
  end if;
end $$;

create or replace function public.seed_v64_database_security_proof_defaults()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.v64_security_control_catalog (control_code, domain, title, verification_method, owner_role)
  values
    ('V64_RLS_ALL_SENSITIVE_TABLES', 'rls', 'All sensitive public tables have RLS enabled', 'static audit + staging SQL test', 'it_security'),
    ('V64_RLS_ORG_DEPT_SCOPE', 'rls', 'Policies scope records by organization and department where applicable', 'persona SQL negative tests', 'it_security'),
    ('V64_OVR_CONFIDENTIALITY', 'ovr', 'OVR reports and evidence are restricted by role and scope', 'persona SQL + browser journey', 'quality_security'),
    ('V64_EVIDENCE_ACCESS', 'evidence', 'Evidence access is restricted and audited', 'persona SQL + storage policy review', 'it_security'),
    ('V64_EXPORT_BACKUP_ACCESS', 'export', 'Exports and backups are limited to authorized roles', 'role-based UI + RLS/RPC proof', 'it_security'),
    ('V64_SECURITY_DEFINER_SAFE', 'functions', 'SECURITY DEFINER functions have safe search_path and no broad execute grants', 'function static audit + SQL metadata test', 'dba'),
    ('V64_VIEW_SECURITY_INVOKER_REVIEW', 'views', 'Sensitive views use security_invoker or documented safe access path', 'view static audit + SQL metadata test', 'dba'),
    ('V64_PERSONA_TESTS_EXECUTED', 'proof', 'Five persona tests executed against staging users', 'SQL evidence attachment', 'it_security')
  on conflict (control_code) do nothing;

  insert into public.v64_persona_test_cases (persona, test_code, scenario, expected_result, is_negative, test_sql_hint)
  values
    ('anonymous', 'V64_ANON_DENIED_APP_DATA', 'Anonymous requester attempts to read sensitive application tables.', 'Denied by RLS / no rows / permission error.', true, 'Run with anon key or unauthenticated SQL role where possible.'),
    ('employee', 'V64_EMPLOYEE_DENIED_UNRELATED_DEPT', 'Employee attempts to read another department project/task/OVR/evidence.', 'Denied or zero rows.', true, 'Use two department-scoped test records.'),
    ('department_manager', 'V64_MANAGER_DENIED_OTHER_DEPT', 'Department manager attempts to read another department data.', 'Denied or zero rows.', true, 'Use manager A against department B records.'),
    ('audit', 'V64_AUDIT_READ_ONLY', 'Audit user views reports/evidence but attempts mutation.', 'Read allowed where intended; write denied.', true, 'Attempt insert/update/delete with audit persona.'),
    ('super_user', 'V64_SUPER_USER_LIMITED_ADMIN', 'Super user accesses permitted administration but not privileged release/security mutations.', 'Allowed only within defined scope.', true, 'Attempt release evidence mutation.'),
    ('admin', 'V64_ADMIN_ALLOWED_WITH_AUDIT', 'Admin performs allowed administrative operation.', 'Allowed and audit trail created.', false, 'Verify audit record created.'),
    ('quality', 'V64_QUALITY_OVR_CLOSE_ALLOWED', 'Quality user closes OVR after required corrective evidence.', 'Allowed only when preconditions are met.', false, 'Run OVR workflow fixture.'),
    ('employee', 'V64_SELF_APPROVAL_BLOCKED', 'User attempts to approve their own request/evidence.', 'Denied by trigger/policy.', true, 'Attempt self approval using same user id.')
  on conflict (test_code) do nothing;
end;
$$;

revoke all on function public.seed_v64_database_security_proof_defaults() from public;
grant execute on function public.seed_v64_database_security_proof_defaults() to service_role;

create or replace view public.v_v64_security_control_scorecard
with (security_invoker = true)
as
select
  count(*) as total_controls,
  count(*) filter (where required) as required_controls,
  count(*) filter (where status = 'passed') as passed_controls,
  count(*) filter (where status = 'failed') as failed_controls,
  count(*) filter (where status = 'unverified') as unverified_controls,
  round(
    case when count(*) filter (where required) = 0 then 0
    else 100.0 * count(*) filter (where required and status = 'passed') / count(*) filter (where required)
    end, 1
  ) as required_pass_percent
from public.v64_security_control_catalog;

create or replace view public.v_v64_persona_test_matrix
with (security_invoker = true)
as
select
  persona,
  count(*) as tests,
  count(*) filter (where is_negative) as negative_tests,
  count(*) filter (where status = 'passed') as passed,
  count(*) filter (where status = 'failed') as failed,
  count(*) filter (where status = 'unverified') as unverified
from public.v64_persona_test_cases
group by persona
order by persona;

create or replace view public.v_v64_database_security_readiness
with (security_invoker = true)
as
select
  now() as generated_at,
  (select total_controls from public.v_v64_security_control_scorecard) as total_controls,
  (select required_pass_percent from public.v_v64_security_control_scorecard) as required_pass_percent,
  (select count(*) from public.v64_persona_test_cases where status = 'passed') as passed_persona_tests,
  (select count(*) from public.v64_persona_test_cases where status = 'failed') as failed_persona_tests,
  (select count(*) from public.v64_persona_test_cases where status = 'unverified') as unverified_persona_tests,
  case
    when (select count(*) from public.v64_persona_test_cases where status = 'failed') > 0 then 'failed'
    when (select count(*) from public.v64_persona_test_cases where status = 'unverified') > 0 then 'unverified'
    when (select required_pass_percent from public.v_v64_security_control_scorecard) >= 95 then 'ready_for_controlled_pilot'
    else 'needs_evidence'
  end as readiness_status;
