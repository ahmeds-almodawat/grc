-- Synthetic, identity-free Gate 13B fixture layered onto immutable baseline V2.
-- Usage: psql -v gate13b_lineage=modern|bridge -f this-file.sql
-- The fixed UUIDs and email below are test-only and do not represent a hosted user.

select pg_catalog.set_config('gate13b.fixture_lineage', :'gate13b_lineage', false);

do $fixture$
begin
  if current_setting('gate13b.fixture_lineage') not in ('modern', 'bridge') then
    raise exception 'GATE13B_FIXTURE_LINEAGE_INVALID';
  end if;
end;
$fixture$;

create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations (
  version text primary key,
  statements text[]
);
truncate table supabase_migrations.schema_migrations;
insert into supabase_migrations.schema_migrations(version)
select value
from jsonb_array_elements_text(
  case current_setting('gate13b.fixture_lineage')
    when 'modern' then '["173","174","175","176","177","178","179","180","181","182","183","184","185"]'::jsonb
    else '["173","174","175","176","177","178","179","180"]'::jsonb
  end
);

do $platform$
begin
  if to_regclass('auth.users') is null
     or to_regclass('auth.identities') is null
     or to_regclass('auth.sessions') is null
     or to_regclass('auth.refresh_tokens') is null then
    raise exception 'GATE13BR3_SUPABASE_AUTH_FIXTURE_REQUIRED';
  end if;
end;
$platform$;

insert into public.organizations(id, name_en, name_ar, is_active)
values (
  '13000000-0000-4000-8000-000000000001'::uuid,
  'Gate 13B Synthetic Organization',
  'Gate 13B Synthetic Organization',
  true
);

insert into auth.users(
  instance_id, id, aud, role, email, raw_app_meta_data,
  raw_user_meta_data, email_confirmed_at,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  phone_change, phone_change_token, email_change_token_current,
  reauthentication_token, created_at, updated_at
) values (
  '00000000-0000-0000-0000-000000000000'::uuid,
  '13000000-0000-4000-8000-000000000002'::uuid,
  'authenticated', 'authenticated',
  'gate13b-admin@synthetic.invalid',
  '{"provider":"email","providers":["email"],"credential_version":0}'::jsonb,
  '{"email_verified":true}'::jsonb,
  now(), '', '', '', '', '', '', '', '', now(), now()
);
insert into auth.identities(
  user_id, provider_id, provider, identity_data,
  last_sign_in_at, created_at, updated_at
)
values (
  '13000000-0000-4000-8000-000000000002'::uuid,
  'gate13b-admin@synthetic.invalid',
  'email',
  '{"sub":"13000000-0000-4000-8000-000000000002","email":"gate13b-admin@synthetic.invalid","email_verified":true,"phone_verified":false}'::jsonb,
  now(), now(), now()
);

-- Synthetic fixture seeding represents pre-existing hosted rows. Application
-- boundary triggers are restored before either migration is executed.
alter table public.profiles disable trigger user;
alter table public.user_credential_states disable trigger user;
alter table public.user_roles disable trigger user;
insert into public.profiles(
  id, organization_id, full_name_en, email, is_active, user_status
) values (
  '13000000-0000-4000-8000-000000000002'::uuid,
  '13000000-0000-4000-8000-000000000001'::uuid,
  'Gate 13B Synthetic Administrator',
  'gate13b-admin@synthetic.invalid',
  true, 'active'
);
insert into public.user_credential_states(
  user_id, organization_id, auth_email, identity_mode,
  credential_state, requested_lifecycle, credential_version
) values (
  '13000000-0000-4000-8000-000000000002'::uuid,
  '13000000-0000-4000-8000-000000000001'::uuid,
  'gate13b-admin@synthetic.invalid',
  'legacy_verified',
  case current_setting('gate13b.fixture_lineage')
    when 'bridge' then 'existing_password_rotation_pending'
    else 'active'
  end,
  'active', 0
);
insert into public.user_roles(
  id, user_id, role, scope, organization_id, is_active
) values (
  '13000000-0000-4000-8000-000000000003'::uuid,
  '13000000-0000-4000-8000-000000000002'::uuid,
  'super_admin', 'global',
  '13000000-0000-4000-8000-000000000001'::uuid,
  true
);

do $fixture$
begin
  if current_setting('gate13b.fixture_lineage') = 'bridge' then
    insert into auth.users(
      instance_id, id, aud, role, email, raw_app_meta_data,
      raw_user_meta_data, email_confirmed_at,
      confirmation_token, recovery_token, email_change_token_new, email_change,
      phone_change, phone_change_token, email_change_token_current,
      reauthentication_token, created_at, updated_at
    ) values (
      '00000000-0000-0000-0000-000000000000'::uuid,
      '13000000-0000-4000-8000-000000000005'::uuid,
      'authenticated', 'authenticated',
      'gate13b-executive@synthetic.invalid',
      '{"provider":"email","providers":["email"],"credential_version":0}'::jsonb,
      '{"email_verified":true}'::jsonb,
      now(), '', '', '', '', '', '', '', '', now(), now()
    );
    insert into auth.identities(
      user_id, provider_id, provider, identity_data,
      last_sign_in_at, created_at, updated_at
    )
    values (
      '13000000-0000-4000-8000-000000000005'::uuid,
      'gate13b-executive@synthetic.invalid',
      'email',
      '{"sub":"13000000-0000-4000-8000-000000000005","email":"gate13b-executive@synthetic.invalid","email_verified":true,"phone_verified":false}'::jsonb,
      now(), now(), now()
    );
    insert into public.departments(
      id, organization_id, name_en, name_ar, code, is_active
    ) values (
      '13000000-0000-4000-8000-000000000004'::uuid,
      '13000000-0000-4000-8000-000000000001'::uuid,
      'Gate 13B Synthetic Department',
      'Gate 13B Synthetic Department',
      'G13B', true
    );
    insert into public.profiles(
      id, organization_id, full_name_en, email, department_id,
      is_active, user_status
    ) values (
      '13000000-0000-4000-8000-000000000005'::uuid,
      '13000000-0000-4000-8000-000000000001'::uuid,
      'Gate 13B Synthetic Executive',
      'gate13b-executive@synthetic.invalid',
      '13000000-0000-4000-8000-000000000004'::uuid,
      true, 'active'
    );
    insert into public.user_credential_states(
      user_id, organization_id, auth_email, identity_mode,
      credential_state, requested_lifecycle, credential_version
    ) values (
      '13000000-0000-4000-8000-000000000005'::uuid,
      '13000000-0000-4000-8000-000000000001'::uuid,
      'gate13b-executive@synthetic.invalid',
      'legacy_verified', 'active', 'active', 0
    );

    -- The clone defect predates Patch 83U's activation trigger. Disable only
    -- user triggers for this synthetic historical fixture insertion, then
    -- immediately restore them before migration validation.
    insert into public.user_roles(
      id, user_id, role, scope, organization_id, department_id, is_active
    ) values (
      '13000000-0000-4000-8000-000000000006'::uuid,
      '13000000-0000-4000-8000-000000000005'::uuid,
      'executive', 'department',
      '13000000-0000-4000-8000-000000000001'::uuid,
      '13000000-0000-4000-8000-000000000004'::uuid,
      true
    );
    drop function if exists public.patch83tu_catalog_contract_attestation();
  else
    update public.patch83u_runtime_control
    set enforcement_state = 'enforced',
        prepared_at = now(),
        prepared_by = '13000000-0000-4000-8000-000000000002'::uuid,
        activated_at = now(),
        activated_by = '13000000-0000-4000-8000-000000000002'::uuid,
        activation_reason = 'Synthetic modern-lineage validation fixture',
        last_transition_reason = 'Synthetic modern-lineage validation fixture',
        compatible_edge_contract_version = expected_edge_contract_version,
        compatible_frontend_contract_version = expected_frontend_contract_version,
        compatibility_attested_at = now(),
        compatibility_attested_by = '13000000-0000-4000-8000-000000000002'::uuid,
        preflight_hash = repeat('1', 64),
        designated_super_admin_id = '13000000-0000-4000-8000-000000000002'::uuid,
        last_transition_request_id = 'gate13b-synthetic-modern-fixture',
        state_version = 5
    where singleton;
  end if;
end;
$fixture$;

do $fixture_pre180$
declare
  v_table text;
  v_view text;
begin
  if current_setting('gate13b.fixture_lineage') <> 'bridge' then
    return;
  end if;

  foreach v_table in array array[
    'company_rollout_waves','final_go_live_stop_rules','final_pilot_signoff_matrix',
    'final_validation_runs','i18n_translation_coverage_items','mock_data_allowlist',
    'phased_auto_test_cases','phased_auto_test_phases','phased_auto_test_results',
    'phased_auto_test_runs','pilot_execution_runs','pilot_feedback_items',
    'pilot_fix_sprint_items','production_data_switchovers','production_empty_state_checks',
    'production_exception_register_v58','rtl_visual_qa_items','v50_scale_test_results'
  ] loop
    execute format('alter table public.%I disable row level security', v_table);
    execute format('alter table public.%I no force row level security', v_table);
    execute format(
      'grant all privileges on table public.%I to anon, authenticated, service_role',
      v_table
    );
  end loop;

  foreach v_view in array array[
    'v_v38_final_readiness_scorecard','v_v46_language_rtl_readiness',
    'v_v46_production_hardening_scorecard','v_v58_overall_production_readiness',
    'v_v58_pilot_readiness_scorecard','v_v58_rollout_readiness_scorecard',
    'v_v59_latest_phase_results','v_v59_phase_test_scorecard',
    'v_v59_production_data_readiness','v_v60_empty_state_readiness'
  ] loop
    execute format(
      'grant all privileges on table public.%I to anon, authenticated, service_role',
      v_view
    );
  end loop;

  execute 'drop policy if exists patch183_backup_packages_privileged_read on public.backup_packages';
  execute 'drop policy if exists patch183_export_logs_privileged_read on public.export_logs';
  execute 'drop policy if exists patch183_export_logs_append on public.export_logs';
  execute 'drop policy if exists patch183_production_validation_runs_privileged_read on public.production_validation_runs';
  execute 'drop policy if exists patch183_release_candidate_controls_privileged_read on public.release_candidate_controls';
  execute 'drop policy if exists patch183_rls_persona_test_cases_privileged_read on public.rls_persona_test_cases';
  execute 'drop policy if exists patch183_rls_persona_test_runs_privileged_read on public.rls_persona_test_runs';
  execute 'drop policy if exists patch183_rls_violation_findings_privileged_read on public.rls_violation_findings';
  execute 'drop policy if exists patch183_supabase_install_verification_items_privileged_read on public.supabase_install_verification_items';
  execute 'drop policy if exists patch183_system_health_snapshots_privileged_read on public.system_health_snapshots';

  execute 'create policy "Authenticated can insert backup packages" on public.backup_packages for insert to authenticated with check (true)';
  execute 'create policy "Authenticated can read backup packages" on public.backup_packages for select to authenticated using (true)';
  execute 'create policy "Authenticated can insert export logs" on public.export_logs for insert to authenticated with check (true)';
  execute $sql$create policy export_logs_read_privileged on public.export_logs
    for select to authenticated using (
      exists (
        select 1 from public.user_roles ur
        where ur.user_id = auth.uid() and ur.is_active = true
          and ur.role in ('super_admin','executive','governance_admin','auditor','compliance_officer')
          and (ur.organization_id is null or ur.organization_id = export_logs.organization_id)
      )
    )$sql$;
  execute 'create policy "Authenticated can manage production validation" on public.production_validation_runs for all to authenticated using (true) with check (true)';
  execute 'create policy "Authenticated can read production validation" on public.production_validation_runs for select to authenticated using (true)';
  execute 'create policy "Authenticated can manage release controls" on public.release_candidate_controls for all to authenticated using (true) with check (true)';
  execute 'create policy "Authenticated can read release controls" on public.release_candidate_controls for select to authenticated using (true)';
  execute 'create policy "Authenticated can manage rls persona cases" on public.rls_persona_test_cases for all to authenticated using (true) with check (true)';
  execute 'create policy "Authenticated can read rls persona cases" on public.rls_persona_test_cases for select to authenticated using (true)';
  execute 'create policy "Authenticated can manage rls persona runs" on public.rls_persona_test_runs for all to authenticated using (true) with check (true)';
  execute 'create policy "Authenticated can read rls persona runs" on public.rls_persona_test_runs for select to authenticated using (true)';
  execute 'create policy "Authenticated can manage rls violation findings" on public.rls_violation_findings for all to authenticated using (true) with check (true)';
  execute 'create policy "Authenticated can read rls violation findings" on public.rls_violation_findings for select to authenticated using (true)';
  execute 'create policy "Authenticated can manage install verification" on public.supabase_install_verification_items for all to authenticated using (true) with check (true)';
  execute 'create policy "Authenticated can read install verification" on public.supabase_install_verification_items for select to authenticated using (true)';
  execute 'create policy "Authenticated can insert health snapshots" on public.system_health_snapshots for insert to authenticated with check (true)';
  execute 'create policy "Authenticated can read health snapshots" on public.system_health_snapshots for select to authenticated using (true)';

  execute 'drop policy if exists pilot_go_no_go_reviews_super_admin_read on public.pilot_go_no_go_reviews';
  execute 'drop policy if exists pilot_go_no_go_events_super_admin_read on public.pilot_go_no_go_events';
  execute 'create policy pilot_go_no_go_reviews_select_all on public.pilot_go_no_go_reviews for select using (true)';
  execute 'create policy pilot_go_no_go_events_select_all on public.pilot_go_no_go_events for select using (true)';
end;
$fixture_pre180$;

alter table public.profiles enable trigger user;
alter table public.user_credential_states enable trigger user;
alter table public.user_roles enable trigger user;

-- This fixture must never contain hosted project references or secrets.
do $fixture$
declare
  v_text text := pg_catalog.pg_get_functiondef(
    'public.patch83u_bootstrap_super_admin_eligible(uuid)'::regprocedure
  );
begin
  if v_text is null then
    raise exception 'GATE13B_FIXTURE_REQUIRED_ELIGIBILITY_FUNCTION_MISSING';
  end if;
end;
$fixture$;
