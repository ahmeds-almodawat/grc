-- Production Gate 9R / migration 183
-- Reconcile nine application-owned operational tables that retained broad
-- browser grants and permissive true policies after the Patch 83U credential
-- gate was installed. No table rows are changed.

begin;
set local lock_timeout = '10s';
set local statement_timeout = '120s';

do $patch183_preflight$
declare
  v record;
  v_existing_names text[];
  v_allowed_names text[];
  v_post_count integer;
  v_index integer;
  v_actual_hash text;
begin
  for v in
    select * from (values
      ('backup_packages', array['Authenticated can insert backup packages','Authenticated can read backup packages']::text[], array['7991638461db0b556dcdd004feb33ab115a8036c9c930d681783cfb4b8c3c15e','1302fedf2292b570426b6509241422123080c85194a63efbd04d73d03e7cc977']::text[], 'patch183_backup_packages_privileged_read'),
      ('export_logs', array['Authenticated can insert export logs','export_logs_read_privileged']::text[], array['7991638461db0b556dcdd004feb33ab115a8036c9c930d681783cfb4b8c3c15e','34c262c8cab824590e54947c34d36c7141e17eec0607198030d9165de8dcdd55']::text[], 'patch183_export_logs_privileged_read'),
      ('production_validation_runs', array['Authenticated can manage production validation','Authenticated can read production validation']::text[], array['9d57bb973a71447ffec1902384180a0a4579a4c12017924b72f12289af33ba03','1302fedf2292b570426b6509241422123080c85194a63efbd04d73d03e7cc977']::text[], 'patch183_production_validation_runs_privileged_read'),
      ('release_candidate_controls', array['Authenticated can manage release controls','Authenticated can read release controls']::text[], array['9d57bb973a71447ffec1902384180a0a4579a4c12017924b72f12289af33ba03','1302fedf2292b570426b6509241422123080c85194a63efbd04d73d03e7cc977']::text[], 'patch183_release_candidate_controls_privileged_read'),
      ('rls_persona_test_cases', array['Authenticated can manage rls persona cases','Authenticated can read rls persona cases']::text[], array['9d57bb973a71447ffec1902384180a0a4579a4c12017924b72f12289af33ba03','1302fedf2292b570426b6509241422123080c85194a63efbd04d73d03e7cc977']::text[], 'patch183_rls_persona_test_cases_privileged_read'),
      ('rls_persona_test_runs', array['Authenticated can manage rls persona runs','Authenticated can read rls persona runs']::text[], array['9d57bb973a71447ffec1902384180a0a4579a4c12017924b72f12289af33ba03','1302fedf2292b570426b6509241422123080c85194a63efbd04d73d03e7cc977']::text[], 'patch183_rls_persona_test_runs_privileged_read'),
      ('rls_violation_findings', array['Authenticated can manage rls violation findings','Authenticated can read rls violation findings']::text[], array['9d57bb973a71447ffec1902384180a0a4579a4c12017924b72f12289af33ba03','1302fedf2292b570426b6509241422123080c85194a63efbd04d73d03e7cc977']::text[], 'patch183_rls_violation_findings_privileged_read'),
      ('supabase_install_verification_items', array['Authenticated can manage install verification','Authenticated can read install verification']::text[], array['9d57bb973a71447ffec1902384180a0a4579a4c12017924b72f12289af33ba03','1302fedf2292b570426b6509241422123080c85194a63efbd04d73d03e7cc977']::text[], 'patch183_supabase_install_verification_items_privileged_read'),
      ('system_health_snapshots', array['Authenticated can insert health snapshots','Authenticated can read health snapshots']::text[], array['7991638461db0b556dcdd004feb33ab115a8036c9c930d681783cfb4b8c3c15e','1302fedf2292b570426b6509241422123080c85194a63efbd04d73d03e7cc977']::text[], 'patch183_system_health_snapshots_privileged_read')
    ) as expected(table_name, legacy_policy_names, legacy_policy_hashes, read_policy_name)
  loop
    if not exists (
      select 1
      from pg_catalog.pg_class c
      join pg_catalog.pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname = v.table_name
        and c.relkind in ('r','p')
        and pg_catalog.pg_get_userbyid(c.relowner) = 'postgres'
    ) then
      raise exception using errcode = 'P0001',
        message = 'PATCH183_REQUIRED_POST182_TABLE_MISSING_OR_OWNER_DRIFT', detail = v.table_name;
    end if;

    select coalesce(array_agg(p.polname order by p.polname), array[]::text[])
      into v_existing_names
    from pg_catalog.pg_policy p
    join pg_catalog.pg_class c on c.oid = p.polrelid
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = v.table_name;

    v_allowed_names := array['patch83u_credential_gate', v.read_policy_name]
      || v.legacy_policy_names;
    if v.table_name = 'export_logs' then
      v_allowed_names := v_allowed_names || array['patch183_export_logs_append'];
    end if;

    if exists (
      select 1 from unnest(v_existing_names) as policy_name
      where not (policy_name = any(v_allowed_names))
    ) then
      raise exception using errcode = 'P0001',
        message = 'PATCH183_UNEXPECTED_POLICY_DEFINITION',
        detail = format('%s: %s', v.table_name, array_to_string(v_existing_names, ', '));
    end if;

    if not exists (
      select 1
      from pg_catalog.pg_policy p
      join pg_catalog.pg_class c on c.oid = p.polrelid
      join pg_catalog.pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = v.table_name
        and p.polname = 'patch83u_credential_gate'
        and p.polpermissive = false
        and p.polcmd = '*'
    ) then
      raise exception using errcode = 'P0001',
        message = 'PATCH183_CREDENTIAL_GATE_MISSING_OR_DRIFTED', detail = v.table_name;
    end if;

    select count(*) into v_post_count
    from unnest(v_existing_names) policy_name
    where policy_name = v.read_policy_name
       or (v.table_name = 'export_logs' and policy_name = 'patch183_export_logs_append');

    if v_post_count = 0 then
      if exists (
        select 1 from unnest(v.legacy_policy_names) required_name
        where not (required_name = any(v_existing_names))
      ) then
        raise exception using errcode = 'P0001',
          message = 'PATCH183_EXPECTED_PRESTATE_POLICY_MISSING', detail = v.table_name;
      end if;
      for v_index in 1..cardinality(v.legacy_policy_names) loop
        select pg_catalog.encode(extensions.digest(
          pg_catalog.concat_ws('|', p.cmd, p.permissive, pg_catalog.array_to_string(p.roles, ','), coalesce(p.qual,''), coalesce(p.with_check,'')),
          'sha256'
        ), 'hex')
          into v_actual_hash
        from pg_catalog.pg_policies p
        where p.schemaname='public' and p.tablename=v.table_name
          and p.policyname=v.legacy_policy_names[v_index];
        if v_actual_hash is distinct from v.legacy_policy_hashes[v_index] then
          raise exception using errcode = 'P0001',
            message = 'PATCH183_EXPECTED_PRESTATE_POLICY_DEFINITION_DRIFT',
            detail = format('%s.%s', v.table_name, v.legacy_policy_names[v_index]);
        end if;
      end loop;
    elsif v_post_count <> (case when v.table_name = 'export_logs' then 2 else 1 end)
       or exists (
         select 1 from unnest(v.legacy_policy_names) legacy_name
         where legacy_name = any(v_existing_names)
       ) then
      raise exception using errcode = 'P0001',
        message = 'PATCH183_MIXED_OR_INCOMPLETE_POLICY_STATE', detail = v.table_name;
    end if;
  end loop;
end;
$patch183_preflight$;

lock table
  public.backup_packages,
  public.export_logs,
  public.production_validation_runs,
  public.release_candidate_controls,
  public.rls_persona_test_cases,
  public.rls_persona_test_runs,
  public.rls_violation_findings,
  public.supabase_install_verification_items,
  public.system_health_snapshots
in share row exclusive mode;

alter table public.backup_packages enable row level security;
alter table public.backup_packages force row level security;
alter table public.export_logs enable row level security;
alter table public.export_logs force row level security;
alter table public.production_validation_runs enable row level security;
alter table public.production_validation_runs force row level security;
alter table public.release_candidate_controls enable row level security;
alter table public.release_candidate_controls force row level security;
alter table public.rls_persona_test_cases enable row level security;
alter table public.rls_persona_test_cases force row level security;
alter table public.rls_persona_test_runs enable row level security;
alter table public.rls_persona_test_runs force row level security;
alter table public.rls_violation_findings enable row level security;
alter table public.rls_violation_findings force row level security;
alter table public.supabase_install_verification_items enable row level security;
alter table public.supabase_install_verification_items force row level security;
alter table public.system_health_snapshots enable row level security;
alter table public.system_health_snapshots force row level security;

revoke all privileges on table public.backup_packages from public, anon, authenticated, service_role;
revoke all privileges on table public.export_logs from public, anon, authenticated, service_role;
revoke all privileges on table public.production_validation_runs from public, anon, authenticated, service_role;
revoke all privileges on table public.release_candidate_controls from public, anon, authenticated, service_role;
revoke all privileges on table public.rls_persona_test_cases from public, anon, authenticated, service_role;
revoke all privileges on table public.rls_persona_test_runs from public, anon, authenticated, service_role;
revoke all privileges on table public.rls_violation_findings from public, anon, authenticated, service_role;
revoke all privileges on table public.supabase_install_verification_items from public, anon, authenticated, service_role;
revoke all privileges on table public.system_health_snapshots from public, anon, authenticated, service_role;

grant select on table
  public.backup_packages,
  public.export_logs,
  public.production_validation_runs,
  public.release_candidate_controls,
  public.rls_persona_test_cases,
  public.rls_persona_test_runs,
  public.rls_violation_findings,
  public.supabase_install_verification_items,
  public.system_health_snapshots
to authenticated;
grant insert on table public.export_logs to authenticated;

grant select, insert, update, delete on table
  public.backup_packages,
  public.export_logs,
  public.production_validation_runs,
  public.release_candidate_controls,
  public.rls_persona_test_cases,
  public.rls_persona_test_runs,
  public.rls_violation_findings,
  public.supabase_install_verification_items,
  public.system_health_snapshots
to service_role;

drop policy if exists "Authenticated can insert backup packages" on public.backup_packages;
drop policy if exists "Authenticated can read backup packages" on public.backup_packages;
drop policy if exists "Authenticated can insert export logs" on public.export_logs;
drop policy if exists export_logs_read_privileged on public.export_logs;
drop policy if exists "Authenticated can manage production validation" on public.production_validation_runs;
drop policy if exists "Authenticated can read production validation" on public.production_validation_runs;
drop policy if exists "Authenticated can manage release controls" on public.release_candidate_controls;
drop policy if exists "Authenticated can read release controls" on public.release_candidate_controls;
drop policy if exists "Authenticated can manage rls persona cases" on public.rls_persona_test_cases;
drop policy if exists "Authenticated can read rls persona cases" on public.rls_persona_test_cases;
drop policy if exists "Authenticated can manage rls persona runs" on public.rls_persona_test_runs;
drop policy if exists "Authenticated can read rls persona runs" on public.rls_persona_test_runs;
drop policy if exists "Authenticated can manage rls violation findings" on public.rls_violation_findings;
drop policy if exists "Authenticated can read rls violation findings" on public.rls_violation_findings;
drop policy if exists "Authenticated can manage install verification" on public.supabase_install_verification_items;
drop policy if exists "Authenticated can read install verification" on public.supabase_install_verification_items;
drop policy if exists "Authenticated can insert health snapshots" on public.system_health_snapshots;
drop policy if exists "Authenticated can read health snapshots" on public.system_health_snapshots;

drop policy if exists patch183_backup_packages_privileged_read on public.backup_packages;
create policy patch183_backup_packages_privileged_read on public.backup_packages
  for select to authenticated
  using (
    public.has_any_role(array['super_admin','executive','governance_admin','auditor','compliance_officer']::public.app_role[])
    and (organization_id is null or organization_id = public.current_user_org_id())
  );

drop policy if exists patch183_export_logs_privileged_read on public.export_logs;
create policy patch183_export_logs_privileged_read on public.export_logs
  for select to authenticated
  using (
    public.has_any_role(array['super_admin','executive','governance_admin','auditor','compliance_officer']::public.app_role[])
    and organization_id = public.current_user_org_id()
  );
drop policy if exists patch183_export_logs_append on public.export_logs;
create policy patch183_export_logs_append on public.export_logs
  for insert to authenticated
  with check (
    auth.uid() is not null
    and organization_id = public.current_user_org_id()
    and public.patch83u_credential_access_allowed()
  );

drop policy if exists patch183_production_validation_runs_privileged_read on public.production_validation_runs;
create policy patch183_production_validation_runs_privileged_read on public.production_validation_runs
  for select to authenticated
  using (public.has_any_role(array['super_admin','executive','governance_admin','auditor','compliance_officer']::public.app_role[]));

drop policy if exists patch183_release_candidate_controls_privileged_read on public.release_candidate_controls;
create policy patch183_release_candidate_controls_privileged_read on public.release_candidate_controls
  for select to authenticated
  using (public.has_any_role(array['super_admin','executive','governance_admin','auditor','compliance_officer']::public.app_role[]));

drop policy if exists patch183_rls_persona_test_cases_privileged_read on public.rls_persona_test_cases;
create policy patch183_rls_persona_test_cases_privileged_read on public.rls_persona_test_cases
  for select to authenticated
  using (public.has_any_role(array['super_admin','governance_admin','auditor','compliance_officer']::public.app_role[]));

drop policy if exists patch183_rls_persona_test_runs_privileged_read on public.rls_persona_test_runs;
create policy patch183_rls_persona_test_runs_privileged_read on public.rls_persona_test_runs
  for select to authenticated
  using (
    public.has_any_role(array['super_admin','governance_admin','auditor','compliance_officer']::public.app_role[])
    and organization_id = public.current_user_org_id()
  );

drop policy if exists patch183_rls_violation_findings_privileged_read on public.rls_violation_findings;
create policy patch183_rls_violation_findings_privileged_read on public.rls_violation_findings
  for select to authenticated
  using (public.has_any_role(array['super_admin','governance_admin','auditor','compliance_officer']::public.app_role[]));

drop policy if exists patch183_supabase_install_verification_items_privileged_read on public.supabase_install_verification_items;
create policy patch183_supabase_install_verification_items_privileged_read on public.supabase_install_verification_items
  for select to authenticated
  using (public.has_any_role(array['super_admin','governance_admin','auditor']::public.app_role[]));

drop policy if exists patch183_system_health_snapshots_privileged_read on public.system_health_snapshots;
create policy patch183_system_health_snapshots_privileged_read on public.system_health_snapshots
  for select to authenticated
  using (
    public.has_any_role(array['super_admin','executive','governance_admin','auditor','compliance_officer']::public.app_role[])
    and (organization_id is null or organization_id = public.current_user_org_id())
  );

-- All dependent views were already security-invoker in the verified post-182
-- staging catalog. Preserve that property and close the remaining anon grant.
do $patch183_views$
declare
  v_view text;
  v_views constant text[] := array[
    'v_backup_health_check','v_backup_restore_drillboard','v_data_retention_readiness',
    'v_rls_persona_lab','v_setup_readiness_checklist','v_ultra_release_summary',
    'v_v42_release_candidate_scorecard','v_v42_rls_persona_matrix',
    'v_v42_rls_test_case_queue','v_v42_supabase_install_status'
  ];
begin
  foreach v_view in array v_views loop
    if not exists (
      select 1 from pg_catalog.pg_class c
      join pg_catalog.pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = v_view and c.relkind = 'v'
        and 'security_invoker=true' = any(coalesce(c.reloptions, array[]::text[]))
    ) then
      raise exception using errcode = 'P0001',
        message = 'PATCH183_DEPENDENT_VIEW_NOT_SECURITY_INVOKER', detail = v_view;
    end if;
    execute format('revoke all privileges on table public.%I from public, anon', v_view);
    execute format('grant select on table public.%I to authenticated, service_role', v_view);
    execute format(
      'comment on view public.%I is %L', v_view,
      'Patch 183 dependent security-invoker view. Browser rows remain constrained by hardened base-table RLS; anon access revoked.'
    );
  end loop;
end;
$patch183_views$;

comment on policy patch183_backup_packages_privileged_read on public.backup_packages is 'Gate 9R: privileged, credential-gated, organization-scoped read; browser writes revoked.';
comment on policy patch183_export_logs_privileged_read on public.export_logs is 'Gate 9R: privileged, credential-gated, organization-scoped audit-log read.';
comment on policy patch183_export_logs_append on public.export_logs is 'Gate 9R: append-only authenticated export event in the caller organization; update/delete revoked.';
comment on policy patch183_production_validation_runs_privileged_read on public.production_validation_runs is 'Gate 9R: privileged read; service-role/protected workflow writes only.';
comment on policy patch183_release_candidate_controls_privileged_read on public.release_candidate_controls is 'Gate 9R: privileged read; service-role/protected workflow writes only.';
comment on policy patch183_rls_persona_test_cases_privileged_read on public.rls_persona_test_cases is 'Gate 9R: security-governance read; service-role/protected workflow writes only.';
comment on policy patch183_rls_persona_test_runs_privileged_read on public.rls_persona_test_runs is 'Gate 9R: security-governance, organization-scoped read; service-role writes only.';
comment on policy patch183_rls_violation_findings_privileged_read on public.rls_violation_findings is 'Gate 9R: security-governance read; service-role/protected workflow writes only.';
comment on policy patch183_supabase_install_verification_items_privileged_read on public.supabase_install_verification_items is 'Gate 9R: security-administration read; service-role/protected workflow writes only.';
comment on policy patch183_system_health_snapshots_privileged_read on public.system_health_snapshots is 'Gate 9R: privileged, organization-scoped health read; protected workflow writes only.';

commit;
