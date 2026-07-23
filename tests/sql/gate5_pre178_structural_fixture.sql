-- Synthetic, data-free minimum pre-178 catalog for disposable Gate 5 validation.
-- Gate 8 read-only evidence on 2026-07-22 proved that
-- patch83u_last_eligible_super_admin_count() is not a staging object. The
-- fixture therefore models migration 176's real owner-only recovery helper and
-- its service-only wrapper instead of inventing an attestation-only function.
create extension if not exists pgcrypto with schema extensions;

create schema if not exists supabase_migrations;
create table supabase_migrations.schema_migrations (
  version text primary key,
  statements text[]
);
insert into supabase_migrations.schema_migrations(version)
values ('173'),('174'),('175'),('176'),('177');

create type public.app_role as enum (
  'super_admin','executive','governance_admin','auditor','compliance_officer','employee'
);
create type public.access_scope as enum ('global','organization','division','department','unit','assigned_only');

create table public.organizations (id uuid primary key default gen_random_uuid());
create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id),
  full_name_en text, full_name_ar text, email text
);

create function public.has_any_role(public.app_role[]) returns boolean
language sql stable security invoker set search_path = pg_catalog, public
as $$ select false $$;
create function public.patch83u_credential_access_allowed() returns boolean
language sql stable security invoker set search_path = pg_catalog, public
as $$ select true $$;

create table public.patch83u_runtime_control (
  singleton boolean primary key default true,
  schema_version text not null default '174.2-auth-first',
  enforcement_state text not null,
  state_version integer not null,
  expected_edge_contract_version text not null,
  expected_frontend_contract_version text not null,
  compatible_edge_contract_version text,
  compatible_frontend_contract_version text
);
insert into public.patch83u_runtime_control values (
  true, '174.2-auth-first', 'enforced', 5,
  'patch83u-edge-auth-first-v1', 'patch83u-frontend-auth-first-v1',
  'patch83u-edge-auth-first-v1', 'patch83u-frontend-auth-first-v1'
);
alter table public.patch83u_runtime_control enable row level security;
alter table public.patch83u_runtime_control force row level security;

create table public.v210_grc_relationships (
  id uuid primary key default gen_random_uuid(), source_type text not null,
  source_code text, relationship_type text not null, target_type text not null,
  target_code text
);
create table public.patch15_rpc_classification_reviews (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null,
  rpc_name text not null, source_file text, source_line integer
);

create table public.real_data_activation_programs (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null,
  activation_stage text not null
);
create table public.real_data_dataset_catalog (
  id uuid primary key default gen_random_uuid(), program_id uuid not null,
  dataset_status text not null
);
create table public.real_data_source_files (
  id uuid primary key default gen_random_uuid(), program_id uuid not null,
  license_status text not null, validation_status text not null
);
create table public.real_data_validation_results (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null,
  dataset_id uuid, result_status text not null, severity text not null
);
create table public.real_data_load_approvals (
  id uuid primary key default gen_random_uuid(), program_id uuid not null,
  approval_status text not null
);
create table public.real_data_readiness_signoffs (
  id uuid primary key default gen_random_uuid(), program_id uuid not null,
  signoff_status text not null
);

create table public.runtime_action_reviews (
  id uuid primary key default gen_random_uuid(), action_name text not null unique,
  action_transport text not null, module_name text not null, risk_level text not null,
  classification text not null, review_status text not null,
  required_access_level text, owner_role text, review_notes text,
  reviewed_by uuid, reviewed_at timestamptz, created_by uuid,
  created_at timestamptz not null default now()
);
create table public.runtime_action_review_events (
  id uuid primary key default gen_random_uuid(), action_review_id uuid,
  action_name text not null, event_type text not null, event_summary text not null,
  actor_user_id uuid, created_at timestamptz not null default now()
);
create table public.runtime_action_review_signoffs (
  id uuid primary key default gen_random_uuid(), action_name text not null,
  reviewer_role text not null, reviewer_user_id uuid,
  signoff_status text not null default 'pending', risk_acceptance_required boolean not null default false,
  limitation_summary text, evidence_reference text, due_at timestamptz,
  signed_off_at timestamptz, created_by uuid, created_at timestamptz not null default now()
);
alter table public.runtime_action_reviews enable row level security;
alter table public.runtime_action_review_events enable row level security;
create policy patch83u_credential_gate on public.runtime_action_reviews
  as restrictive for all to authenticated
  using (public.patch83u_credential_access_allowed())
  with check (public.patch83u_credential_access_allowed());
create policy patch83u_credential_gate on public.runtime_action_review_events
  as restrictive for all to authenticated
  using (public.patch83u_credential_access_allowed())
  with check (public.patch83u_credential_access_allowed());

create function public.patch45_service_role_required() returns void language plpgsql
security definer set search_path = public as $$ begin null; end $$;
create function public.record_runtime_action_review_event(uuid,text,text,text,uuid)
returns uuid language sql security definer set search_path = public as $$ select $1 $$;
create function public.create_runtime_action_review(text,text,text,text,text,text,text,text,uuid)
returns uuid language sql security definer set search_path = public as $$ select $9 $$;
create function public.update_runtime_action_review_status(uuid,text,text,uuid)
returns uuid language sql security definer set search_path = public as $$ select $1 $$;

create table public.department_import_batches (id uuid primary key default gen_random_uuid());
create table public.user_management_import_batches (id uuid primary key default gen_random_uuid());
create table public.user_management_import_rows (id uuid primary key default gen_random_uuid());
create table public.patch83u_credential_operations (id uuid primary key default gen_random_uuid());
create table public.patch83u_runtime_events (id uuid primary key default gen_random_uuid());
create table public.user_account_provisioning (id uuid primary key default gen_random_uuid());
create table public.user_credential_events (id uuid primary key default gen_random_uuid());
create table public.user_credential_states (id uuid primary key default gen_random_uuid());
create table public.user_credential_suspended_roles (id uuid primary key default gen_random_uuid());

alter table public.department_import_batches enable row level security;
alter table public.user_management_import_batches enable row level security;
alter table public.user_management_import_rows enable row level security;
alter table public.patch83u_credential_operations enable row level security;
alter table public.patch83u_credential_operations force row level security;
alter table public.patch83u_runtime_events enable row level security;
alter table public.patch83u_runtime_events force row level security;
alter table public.user_account_provisioning enable row level security;
alter table public.user_account_provisioning force row level security;
alter table public.user_credential_events enable row level security;
alter table public.user_credential_events force row level security;
alter table public.user_credential_states enable row level security;
alter table public.user_credential_states force row level security;
alter table public.user_credential_suspended_roles enable row level security;
alter table public.user_credential_suspended_roles force row level security;

do $fixture$
declare
  v_signature text;
begin
  foreach v_signature in array array[
    'public.patch83u_get_capabilities(uuid,text,text)',
    'public.patch83u_get_credential_state(uuid,integer,text,text)',
    'public.patch83t_get_user_import_capabilities(uuid,text,text)',
    'public.patch83t_user_import_identity_references(uuid,text[])',
    'public.patch83u_list_provisioning(uuid)',
    'public.patch83u_claim_provisioning(uuid,uuid,text,text)',
    'public.patch83u_finalize_provisioning(uuid,uuid,uuid,uuid,text)',
    'public.patch83u_fail_provisioning(uuid,uuid,uuid,text,text,boolean)',
    'public.patch83u_reconcile_provisioning(uuid,uuid,text,text)',
    'public.patch83u_prepare_required_password_change(uuid,text,integer,text)',
    'public.patch83u_begin_required_password_change(uuid,text,integer,text)',
    'public.patch83u_finalize_password_change_after_revocation(uuid,uuid,text,integer,text)',
    'public.patch83u_finalize_required_password_change(uuid,uuid,text,integer,text,boolean)',
    'public.patch83u_abort_required_password_change(uuid,uuid,text,boolean,boolean,text,text)',
    'public.patch83u_begin_admin_reset(uuid,uuid,text,text,text,text)',
    'public.patch83u_admin_reset_session_revocation_proof(uuid,uuid,uuid,text,integer,text)',
    'public.patch83u_finalize_admin_reset(uuid,uuid,uuid,text,integer,text,boolean)',
    'public.patch83u_abort_admin_reset(uuid,uuid,uuid,text,boolean,boolean,text,text)',
    'public.patch83u_assign_user_role(uuid,uuid,public.app_role,public.access_scope,uuid,uuid,uuid,text)',
    'public.patch83u_deactivate_user_role(uuid,uuid,text)',
    'public.patch83t_apply_user_excel_import(uuid,jsonb)',
    'public.patch83t_update_user_profile(uuid,uuid,jsonb)',
    'public.patch83u_apply_user_lifecycle(uuid,uuid,text,text)'
  ] loop
    execute format(
      'create function %s returns jsonb language sql security definer set search_path = pg_catalog, public, pg_temp as $fn$ select ''{}''::jsonb $fn$',
      v_signature
    );
    execute format('revoke all on function %s from public, anon, authenticated', v_signature);
    execute format('grant execute on function %s to service_role', v_signature);
  end loop;
end;
$fixture$;

create function public.patch83u_reconcile_last_super_admin_recovery(
  p_actor_id uuid,
  p_target_user_id uuid,
  p_request_id text,
  p_employee_id_confirmation text
) returns jsonb
language sql
security definer
set search_path = pg_catalog, public, pg_temp
as $$ select '{}'::jsonb $$;
revoke all on function public.patch83u_reconcile_last_super_admin_recovery(
  uuid,uuid,text,text
) from public,anon,authenticated,service_role;

create function public.patch83u_reconcile_credential_state(
  p_actor_id uuid,
  p_target_user_id uuid,
  p_request_id text,
  p_employee_id_confirmation text
) returns jsonb
language sql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
  select public.patch83u_reconcile_last_super_admin_recovery(
    p_actor_id,
    p_target_user_id,
    p_request_id,
    p_employee_id_confirmation
  )
$$;
revoke all on function public.patch83u_reconcile_credential_state(
  uuid,uuid,text,text
) from public,anon,authenticated;
grant execute on function public.patch83u_reconcile_credential_state(
  uuid,uuid,text,text
) to service_role;

create table public.company_rollout_waves (id uuid primary key, organization_id uuid, status text);
create table public.final_go_live_stop_rules (id uuid primary key, owner_name text, is_active boolean, status text);
create table public.final_pilot_signoff_matrix (id uuid primary key, required_status text, decision text, decision_notes text);
create table public.final_validation_runs (id uuid primary key, owner_name text, status text);
create table public.i18n_translation_coverage_items (id uuid primary key, status text);
create table public.mock_data_allowlist (id uuid primary key, approved_by_name text, approved_at timestamptz, is_active boolean);
create table public.phased_auto_test_phases (id uuid primary key);
create table public.phased_auto_test_runs (id uuid primary key, status text);
create table public.phased_auto_test_cases (id uuid primary key, phase_id uuid, is_active boolean);
create table public.phased_auto_test_results (id uuid primary key, case_id uuid, phase_id uuid, run_id uuid, result_status text);
create table public.pilot_execution_runs (id uuid primary key, organization_id uuid, owner_name text, status text, go_no_go text);
create table public.pilot_feedback_items (id uuid primary key, organization_id uuid, run_id uuid, owner_name text, status text);
create table public.pilot_fix_sprint_items (id uuid primary key, owner_id uuid, status text);
create table public.production_data_switchovers (id uuid primary key, owner_name text, current_status text);
create table public.production_empty_state_checks (id uuid primary key, checked_by uuid, checked_status text);
create table public.production_exception_register_v58 (id uuid primary key, organization_id uuid, owner_name text, approved_by uuid, approval_status text);
create table public.rtl_visual_qa_items (id uuid primary key, tested_by uuid, status text);
create table public.v50_scale_test_results (id uuid primary key, status text);

grant all on all tables in schema public to anon, authenticated, service_role;

create view public.v_v38_final_readiness_scorecard as select id from public.final_validation_runs;
create view public.v_v46_language_rtl_readiness as select id from public.rtl_visual_qa_items;
create view public.v_v46_production_hardening_scorecard as select id from public.i18n_translation_coverage_items;
create view public.v_v58_overall_production_readiness as select id from public.production_exception_register_v58;
create view public.v_v58_pilot_readiness_scorecard as select id from public.pilot_execution_runs;
create view public.v_v58_rollout_readiness_scorecard as select id from public.company_rollout_waves;
create view public.v_v59_latest_phase_results as select id from public.phased_auto_test_results;
create view public.v_v59_phase_test_scorecard as select id from public.phased_auto_test_phases;
create view public.v_v59_production_data_readiness as select id from public.production_data_switchovers;
create view public.v_v60_empty_state_readiness as select id from public.production_empty_state_checks;
