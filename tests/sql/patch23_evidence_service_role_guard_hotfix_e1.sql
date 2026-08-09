\set ON_ERROR_STOP on

begin;

create extension if not exists pgcrypto;

create schema auth;
create schema test;

create role anon nologin;
create role authenticated nologin;
create role service_role nologin;

create or replace function auth.role()
returns text
language sql
stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')
  )::text
$$;

create table public.profiles (
  id uuid primary key,
  organization_id uuid,
  is_active boolean not null default true
);

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  organization_id uuid,
  role text not null,
  is_active boolean not null default true
);

create table public.evidence_files (
  id uuid primary key,
  organization_id uuid not null,
  uploaded_by uuid,
  evidence_owner_id uuid,
  reviewer_id uuid,
  reviewed_by uuid,
  locked_at timestamptz,
  review_status text not null default 'submitted',
  status text not null default 'submitted',
  sensitivity_level text not null default 'internal',
  classification_reason text,
  review_required boolean not null default true,
  review_due_date date,
  review_note text,
  rejection_reason text,
  revision_required boolean not null default false,
  revision_due_date date,
  superseded_by_evidence_id uuid,
  version_number integer not null default 1,
  is_current_version boolean not null default true,
  expiry_date date,
  updated_by uuid,
  reviewed_at timestamptz,
  ovr_report_id uuid
);

create table public.evidence_requirements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  requirement_code text,
  linked_item_type text not null,
  linked_item_id uuid not null,
  requirement_title text not null,
  requirement_description text,
  evidence_type_required text,
  minimum_accepted_files integer not null default 1,
  sensitivity_required text,
  due_date date,
  required_for_gate text not null,
  gate_status text not null default 'pending',
  owner_id uuid,
  reviewer_role text,
  reviewer_id uuid,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  is_active boolean not null default true,
  unique (organization_id, requirement_code)
);

create table public.evidence_links (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  evidence_file_id uuid not null,
  linked_item_type text not null,
  linked_item_id uuid not null,
  linked_item_title text,
  link_reason text,
  is_primary boolean not null default false,
  required_for_closure boolean not null default false,
  required_for_acceptance boolean not null default false,
  required_for_approval boolean not null default false,
  required_for_treatment boolean not null default false,
  linked_by uuid,
  linked_at timestamptz not null default now(),
  is_active boolean not null default true,
  unique (organization_id, evidence_file_id, linked_item_type, linked_item_id)
);

create table public.evidence_review_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  evidence_file_id uuid,
  event_type text not null,
  from_status text,
  to_status text,
  actor_id uuid,
  note text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.evidence_gate_waivers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  requirement_id uuid not null,
  linked_item_type text not null,
  linked_item_id uuid not null,
  waiver_reason text not null,
  requested_by uuid,
  requested_at timestamptz not null default now(),
  approved_by uuid,
  approved_at timestamptz,
  status text not null default 'requested',
  expiry_date date,
  audit_note text
);

create table public.projects (
  id uuid primary key,
  status text not null
);

create table public.ovr_reports (
  id uuid primary key,
  status text not null,
  evidence_required boolean not null default false,
  linked_project_id uuid
);

create or replace view public.v_patch23_evidence_closure_gate_status as
select
  null::uuid as organization_id,
  null::uuid as requirement_id,
  null::text as linked_item_type,
  null::uuid as linked_item_id,
  0::integer as accepted_evidence_count,
  false::boolean as waiver_active
where false;

create or replace function public.patch23_write_evidence_event(
  p_organization_id uuid,
  p_evidence_file_id uuid,
  p_event_type text,
  p_from_status text,
  p_to_status text,
  p_actor_id uuid,
  p_note text,
  p_metadata jsonb
)
returns void
language sql
as $$
  insert into public.evidence_review_events (
    organization_id,
    evidence_file_id,
    event_type,
    from_status,
    to_status,
    actor_id,
    note,
    metadata
  ) values (
    p_organization_id,
    p_evidence_file_id,
    p_event_type,
    p_from_status,
    p_to_status,
    p_actor_id,
    p_note,
    coalesce(p_metadata, '{}'::jsonb)
  )
$$;

create or replace function public.can_close_ovr(p_ovr_report_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.ovr_reports o
    where o.id = p_ovr_report_id
      and (
        o.evidence_required = false
        or exists (
          select 1
          from public.evidence_files e
          where e.ovr_report_id = o.id
            and e.status = 'accepted'
        )
        or exists (
          select 1
          from public.projects p
          where p.id = o.linked_project_id
            and p.status = 'closed'
        )
      )
  )
$$;

create or replace function test.assert_true(p_condition boolean, p_message text)
returns void
language plpgsql
as $$
begin
  if not coalesce(p_condition, false) then
    raise exception 'ASSERTION_FAILED: %', p_message;
  end if;
end
$$;

create or replace function test.expect_error(p_sql text, p_expected_message text)
returns void
language plpgsql
as $$
begin
  begin
    execute p_sql;
  exception when others then
    if sqlerrm = p_expected_message then
      return;
    end if;
    raise exception 'ASSERTION_FAILED: expected %, received %', p_expected_message, sqlerrm;
  end;
  raise exception 'ASSERTION_FAILED: expected %, but statement succeeded', p_expected_message;
end
$$;

grant usage on schema test to authenticated;
grant execute on function test.expect_error(text, text) to authenticated;

\ir ../../supabase/migrations/190_patch23_evidence_service_role_guard_compatibility.sql

select test.assert_true(
  not exists (
    select 1
    from pg_proc p,
      lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
    where p.oid = 'public.patch23_evidence_governance_bridge(uuid,text,jsonb)'::regprocedure
      and a.grantee = 0
      and a.privilege_type = 'EXECUTE'
  ),
  'PUBLIC must not execute the Patch23 bridge'
);
select test.assert_true(
  not has_function_privilege('anon', 'public.patch23_evidence_governance_bridge(uuid,text,jsonb)', 'EXECUTE'),
  'anon must not execute the Patch23 bridge'
);
select test.assert_true(
  not has_function_privilege('authenticated', 'public.patch23_evidence_governance_bridge(uuid,text,jsonb)', 'EXECUTE'),
  'authenticated must not execute the Patch23 bridge'
);
select test.assert_true(
  has_function_privilege('service_role', 'public.patch23_evidence_governance_bridge(uuid,text,jsonb)', 'EXECUTE'),
  'service_role must retain execute access'
);

select test.assert_true(
  (select prosecdef from pg_proc where oid = 'public.patch23_evidence_governance_bridge(uuid,text,jsonb)'::regprocedure),
  'the bridge must remain SECURITY DEFINER'
);
select test.assert_true(
  (select pg_get_userbyid(proowner) = current_user from pg_proc where oid = 'public.patch23_evidence_governance_bridge(uuid,text,jsonb)'::regprocedure),
  'CREATE OR REPLACE must preserve the existing function owner'
);
select test.assert_true(
  (select proconfig = array['search_path=public, pg_temp'] from pg_proc where oid = 'public.patch23_evidence_governance_bridge(uuid,text,jsonb)'::regprocedure),
  'the controlled search_path must be preserved'
);

select set_config('request.jwt.claim.role', '', true);
select set_config('request.jwt.claims', '{"role":"authenticated"}', true);
select test.expect_error(
  $$select public.patch23_evidence_governance_bridge(
    '10000000-0000-0000-0000-000000000001'::uuid,
    'accept_evidence',
    '{"evidence_file_id":"30000000-0000-0000-0000-000000000001"}'::jsonb
  )$$,
  'PATCH23_EVIDENCE_SERVICE_ROLE_REQUIRED'
);

select set_config('request.jwt.claims', '{"role":"anon"}', true);
select test.expect_error(
  $$select public.patch23_evidence_governance_bridge(
    '10000000-0000-0000-0000-000000000001'::uuid,
    'accept_evidence',
    '{"evidence_file_id":"30000000-0000-0000-0000-000000000001"}'::jsonb
  )$$,
  'PATCH23_EVIDENCE_SERVICE_ROLE_REQUIRED'
);

select set_config('request.jwt.claims', '', true);
select test.expect_error(
  $$select public.patch23_evidence_governance_bridge(
    '10000000-0000-0000-0000-000000000001'::uuid,
    'accept_evidence',
    '{"evidence_file_id":"30000000-0000-0000-0000-000000000001"}'::jsonb
  )$$,
  'PATCH23_EVIDENCE_SERVICE_ROLE_REQUIRED'
);

select test.assert_true(current_user = 'postgres', 'the proof owner must be postgres');
select test.expect_error(
  $$select public.patch23_evidence_governance_bridge(
    '10000000-0000-0000-0000-000000000001'::uuid,
    'accept_evidence',
    '{"evidence_file_id":"30000000-0000-0000-0000-000000000001"}'::jsonb
  )$$,
  'PATCH23_EVIDENCE_SERVICE_ROLE_REQUIRED'
);

insert into public.profiles (id, organization_id, is_active) values
  ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', true),
  ('10000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', true),
  ('10000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001', true);

insert into public.user_roles (user_id, organization_id, role, is_active) values
  ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'super_admin', true),
  ('10000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001', 'employee', true);

insert into public.ovr_reports (id, status, evidence_required) values
  ('40000000-0000-0000-0000-000000000001', 'quality_final_review', true);

insert into public.evidence_files (
  id,
  organization_id,
  uploaded_by,
  evidence_owner_id,
  review_status,
  status,
  sensitivity_level,
  ovr_report_id
) values (
  '30000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000002',
  '10000000-0000-0000-0000-000000000002',
  'submitted',
  'submitted',
  'internal',
  '40000000-0000-0000-0000-000000000001'
);

select test.assert_true(
  not public.can_close_ovr('40000000-0000-0000-0000-000000000001'),
  'OVR closure must be blocked before evidence acceptance'
);

select set_config('request.jwt.claim.role', '', true);
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
set role service_role;
select public.patch23_evidence_governance_bridge(
  '10000000-0000-0000-0000-000000000001',
  'accept_evidence',
  '{"evidence_file_id":"30000000-0000-0000-0000-000000000001","note":"synthetic local acceptance"}'::jsonb
);
reset role;

select test.assert_true(
  (select review_status = 'accepted' and status = 'accepted'
     and reviewer_id = '10000000-0000-0000-0000-000000000001'
     and reviewed_by = '10000000-0000-0000-0000-000000000001'
     and reviewed_at is not null
   from public.evidence_files
   where id = '30000000-0000-0000-0000-000000000001'),
  'accept_evidence must preserve accepted status and reviewer fields'
);
select test.assert_true(
  (select count(*) = 1
   from public.evidence_review_events
   where evidence_file_id = '30000000-0000-0000-0000-000000000001'
     and event_type = 'accepted'
     and to_status = 'accepted'),
  'accept_evidence must write one accepted chain-of-custody event'
);
select test.assert_true(
  (select status = 'quality_final_review'
   from public.ovr_reports
   where id = '40000000-0000-0000-0000-000000000001'),
  'evidence acceptance must not transition the OVR workflow'
);
select test.assert_true(
  public.can_close_ovr('40000000-0000-0000-0000-000000000001'),
  'OVR closure must become available after accepted evidence'
);

insert into public.evidence_files (
  id, organization_id, uploaded_by, review_status, status, sensitivity_level
) values
  ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', 'submitted', 'submitted', 'internal'),
  ('30000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', 'submitted', 'submitted', 'confidential');

select test.expect_error(
  $$select public.patch23_evidence_governance_bridge(
    '10000000-0000-0000-0000-000000000003'::uuid,
    'accept_evidence',
    '{"evidence_file_id":"30000000-0000-0000-0000-000000000002"}'::jsonb
  )$$,
  'PATCH23_EVIDENCE_REVIEWER_REQUIRED'
);

select test.expect_error(
  $$select public.patch23_evidence_governance_bridge(
    '10000000-0000-0000-0000-000000000001'::uuid,
    'accept_evidence',
    '{"evidence_file_id":"30000000-0000-0000-0000-000000000003"}'::jsonb
  )$$,
  'PATCH23_EVIDENCE_CLASSIFICATION_REASON_REQUIRED'
);

select set_config('request.jwt.claims', '', true);
select set_config('request.jwt.claim.role', 'service_role', true);
set role service_role;
select public.patch23_evidence_governance_bridge(
  '10000000-0000-0000-0000-000000000001',
  'check_evidence_gate_status',
  '{"linked_item_type":"ovr","linked_item_id":"40000000-0000-0000-0000-000000000001"}'::jsonb
);
reset role;

select set_config('request.jwt.claim.role', '', true);
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
set role authenticated;
select test.expect_error(
  $$select public.patch23_evidence_governance_bridge(
    '10000000-0000-0000-0000-000000000001'::uuid,
    'check_evidence_gate_status',
    '{"linked_item_type":"ovr","linked_item_id":"40000000-0000-0000-0000-000000000001"}'::jsonb
  )$$,
  'permission denied for function patch23_evidence_governance_bridge'
);
reset role;

select test.assert_true(
  (select count(*) = 1 from public.evidence_review_events where event_type = 'accepted'),
  'negative tests must not create additional acceptance events'
);

rollback;
