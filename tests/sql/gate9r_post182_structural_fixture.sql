-- Data-free structural fixture for the verified staging post-182 surfaces used
-- by migrations 183 and 184. IDs inserted by the validation test are synthetic.

create schema if not exists auth;
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
do $roles$
begin
  if not exists (select 1 from pg_catalog.pg_roles where rolname='anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_catalog.pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_catalog.pg_roles where rolname='service_role') then create role service_role nologin bypassrls; end if;
end;
$roles$;
grant usage on schema public, auth to anon, authenticated, service_role;

create type public.app_role as enum (
  'super_admin','executive','governance_admin','auditor','compliance_officer','employee'
);
create type public.kri_direction as enum ('higher_is_worse','lower_is_worse','range');

create function auth.uid() returns uuid language sql stable
set search_path = pg_catalog
as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

create table public.profiles (
  id uuid primary key,
  organization_id uuid not null,
  is_active boolean not null default true
);
create table public.user_roles (
  id uuid primary key,
  user_id uuid not null,
  organization_id uuid,
  role public.app_role not null,
  is_active boolean not null default true
);
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
grant select on public.profiles, public.user_roles to authenticated, service_role;
create policy profiles_read_self on public.profiles for select to authenticated using (id = auth.uid());
create policy user_roles_read_self on public.user_roles for select to authenticated using (user_id = auth.uid());

create function public.current_user_org_id() returns uuid
language plpgsql stable security definer set search_path = public, auth
as $$
begin
  return (select p.organization_id from public.profiles p where p.id = auth.uid() and p.is_active limit 1);
end;
$$;
create function public.has_any_role(p_roles text[]) returns boolean
language plpgsql stable security definer set search_path = public, auth
as $$
begin
  return exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid() and ur.is_active and ur.role::text = any(p_roles)
  );
end;
$$;
create function public.has_any_role(required_roles public.app_role[]) returns boolean
language sql stable security invoker set search_path = public
as $$
  select exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid() and ur.is_active and ur.role = any(required_roles)
  )
$$;
revoke all on function public.current_user_org_id() from public, anon;
grant execute on function public.current_user_org_id() to authenticated, service_role;
grant execute on function public.has_any_role(text[]) to public, anon, authenticated, service_role;
revoke all on function public.has_any_role(public.app_role[]) from public, anon;
grant execute on function public.has_any_role(public.app_role[]) to authenticated, service_role;

create function public.patch83u_credential_access_allowed() returns boolean
language sql stable security invoker set search_path = pg_catalog
as $$ select auth.uid() is not null $$;
revoke all on function public.patch83u_credential_access_allowed() from public, anon;
grant execute on function public.patch83u_credential_access_allowed() to authenticated, service_role;

create table public.backup_packages (id uuid primary key, organization_id uuid, label text);
create table public.export_logs (id uuid primary key, organization_id uuid not null, label text, created_by uuid);
create table public.production_validation_runs (id uuid primary key, label text);
create table public.release_candidate_controls (id uuid primary key, label text);
create table public.rls_persona_test_cases (id uuid primary key, label text);
create table public.rls_persona_test_runs (id uuid primary key, organization_id uuid not null, label text);
create table public.rls_violation_findings (id uuid primary key, label text);
create table public.supabase_install_verification_items (id uuid primary key, label text);
create table public.system_health_snapshots (id uuid primary key, organization_id uuid, label text);

do $fixture_tables$
declare v_table text;
begin
  foreach v_table in array array[
    'backup_packages','export_logs','production_validation_runs','release_candidate_controls',
    'rls_persona_test_cases','rls_persona_test_runs','rls_violation_findings',
    'supabase_install_verification_items','system_health_snapshots'
  ] loop
    execute format('alter table public.%I enable row level security', v_table);
    execute format('grant all privileges on table public.%I to anon, authenticated, service_role', v_table);
    execute format(
      'create policy patch83u_credential_gate on public.%I as restrictive for all to authenticated using (public.patch83u_credential_access_allowed()) with check (public.patch83u_credential_access_allowed())',
      v_table
    );
  end loop;
end;
$fixture_tables$;

create policy "Authenticated can insert backup packages" on public.backup_packages for insert to authenticated with check (true);
create policy "Authenticated can read backup packages" on public.backup_packages for select to authenticated using (true);
create policy "Authenticated can insert export logs" on public.export_logs for insert to authenticated with check (true);
create policy export_logs_read_privileged on public.export_logs for select to authenticated using (
  exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.is_active = true
      and ur.role = any(array['super_admin','executive','governance_admin','auditor','compliance_officer']::public.app_role[])
      and (ur.organization_id is null or ur.organization_id = export_logs.organization_id)
  )
);
create policy "Authenticated can manage production validation" on public.production_validation_runs for all to authenticated using (true) with check (true);
create policy "Authenticated can read production validation" on public.production_validation_runs for select to authenticated using (true);
create policy "Authenticated can manage release controls" on public.release_candidate_controls for all to authenticated using (true) with check (true);
create policy "Authenticated can read release controls" on public.release_candidate_controls for select to authenticated using (true);
create policy "Authenticated can manage rls persona cases" on public.rls_persona_test_cases for all to authenticated using (true) with check (true);
create policy "Authenticated can read rls persona cases" on public.rls_persona_test_cases for select to authenticated using (true);
create policy "Authenticated can manage rls persona runs" on public.rls_persona_test_runs for all to authenticated using (true) with check (true);
create policy "Authenticated can read rls persona runs" on public.rls_persona_test_runs for select to authenticated using (true);
create policy "Authenticated can manage rls violation findings" on public.rls_violation_findings for all to authenticated using (true) with check (true);
create policy "Authenticated can read rls violation findings" on public.rls_violation_findings for select to authenticated using (true);
create policy "Authenticated can manage install verification" on public.supabase_install_verification_items for all to authenticated using (true) with check (true);
create policy "Authenticated can read install verification" on public.supabase_install_verification_items for select to authenticated using (true);
create policy "Authenticated can insert health snapshots" on public.system_health_snapshots for insert to authenticated with check (true);
create policy "Authenticated can read health snapshots" on public.system_health_snapshots for select to authenticated using (true);

create view public.v_backup_health_check with (security_invoker=true) as select * from public.backup_packages;
create view public.v_backup_restore_drillboard with (security_invoker=true) as select * from public.backup_packages;
create view public.v_setup_readiness_checklist with (security_invoker=true) as select * from public.backup_packages;
create view public.v_ultra_release_summary with (security_invoker=true) as select * from public.backup_packages;
create view public.v_data_retention_readiness with (security_invoker=true) as select * from public.export_logs;
create view public.v_v42_release_candidate_scorecard with (security_invoker=true) as select * from public.release_candidate_controls;
create view public.v_v42_rls_persona_matrix with (security_invoker=true) as select * from public.rls_persona_test_cases;
create view public.v_v42_rls_test_case_queue with (security_invoker=true) as select * from public.rls_persona_test_cases;
create view public.v_rls_persona_lab with (security_invoker=true) as select * from public.rls_persona_test_runs;
create view public.v_v42_supabase_install_status with (security_invoker=true) as select * from public.supabase_install_verification_items;
grant select on all tables in schema public to anon, authenticated, service_role;

-- Exact post-182 function signatures from the Gate 9 read-only catalog. Bodies
-- are data-free structural stubs because migration 184 changes only attributes.
create function public.ovr_signal_level(integer,integer,integer,integer) returns text language sql immutable as $$ select 'green'::text $$;
create function public.grc_has_accepted_evidence(text,uuid) returns boolean language sql stable as $$ select true $$;
create function public.ovr_severity_weight(text) returns integer language sql immutable as $$ select 1 $$;
create function public.search_grc_global(text,integer) returns jsonb language sql stable as $$ select '[]'::jsonb $$;
create function public.calculate_kri_breach_level(public.kri_direction,numeric,numeric,numeric,numeric,numeric,numeric) returns text language sql stable as $$ select 'normal'::text $$;
create function public.patch4_compute_event_hash(text,jsonb,timestamptz,uuid) returns text language sql stable as $$ select 'fixture-hash'::text $$;
create function public.get_pilot_go_no_go_dashboard() returns jsonb language sql as $$ select '{}'::jsonb $$;
create function public.get_executive_readiness_summary() returns jsonb language sql as $$ select '{}'::jsonb $$;
create function public.get_daily_operations_landing_summary() returns jsonb language sql as $$ select '{}'::jsonb $$;

do $fixture_functions$
declare v_name text;
begin
  foreach v_name in array array[
    'require_delay_reason_project','require_delay_reason_work','grc_guard_project_update',
    'grc_guard_milestone_update','grc_guard_task_update','grc_guard_approval_update',
    'set_v38_updated_at','require_accepted_evidence_before_project_closure',
    'require_accepted_evidence_before_work_closure','require_accepted_evidence_before_grc_closure',
    'set_v60_updated_at','set_updated_at','assign_ovr_number','set_kri_observation_breach_level',
    'v35_set_updated_at','v58_touch_updated_at','patch4_set_immutable_event_hash',
    'set_grc_training_updated_at','patch19_sync_profile_status','trg_enforce_live_environment_lock'
  ] loop
    execute format('create function public.%I() returns trigger language plpgsql as $fn$ begin return new; end $fn$', v_name);
  end loop;

  foreach v_name in array array[
    'seed_v59_no_mock_phased_tests_defaults','seed_v35_consolidation_defaults',
    'seed_v38_final_validation_defaults','seed_v42_release_validation_defaults',
    'seed_v50_scale_backup_restore_defaults','seed_v58_pilot_rollout_security_audit_defaults',
    'seed_v60_no_mock_controls_defaults'
  ] loop
    execute format('create function public.%I() returns void language plpgsql as $fn$ begin null; end $fn$', v_name);
  end loop;
end;
$fixture_functions$;

create function public.v35_attach_updated_at_if_exists(text) returns void language plpgsql as $$ begin null; end $$;
grant execute on all functions in schema public to public, anon, authenticated, service_role;
