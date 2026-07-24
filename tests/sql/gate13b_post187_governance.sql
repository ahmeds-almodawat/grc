-- Run only in a disposable database after migration 187.
begin read only;

do $test$
declare
  v_attestation jsonb;
  v_table text;
begin
  v_attestation := public.patch83b_release_lineage_attestation();
  if (v_attestation ->> 'overall_pass')::boolean is distinct from true then
    raise exception 'GATE13B_RELEASE_LINEAGE_ATTESTATION_FAILED';
  end if;
  if v_attestation ->> 'lineage' = 'production_bridge_lineage' and (
    v_attestation ->> 'mandatory_super_admin_password_rotation' <> 'required'
    or (v_attestation #>> '{safe_counts,transitional_rotation_required_admins}')::integer <> 1
    or (v_attestation #>> '{safe_counts,eligible_super_admins}')::integer <> 0
  ) then
    raise exception 'GATE13BR3_TRANSITIONAL_ROTATION_ATTESTATION_FAILED';
  end if;
  if v_attestation ->> 'lineage' = 'modern_legacy_lineage' and (
    v_attestation ->> 'mandatory_super_admin_password_rotation' <> 'not_applicable'
    or (v_attestation #>> '{safe_counts,eligible_super_admins}')::integer <> 1
  ) then
    raise exception 'GATE13BR3_MODERN_ADMIN_ATTESTATION_FAILED';
  end if;
  if (public.patch83tu_catalog_contract_attestation() ->> 'overall_pass')::boolean is distinct from true then
    raise exception 'GATE13B_PATCH83TU_ATTESTATION_FAILED';
  end if;
  if exists (
    select 1 from public.user_roles ur join public.profiles p on p.id = ur.user_id
    where ur.is_active and (
      public.patch83u_role_scope_allowed(ur.role, ur.scope) is distinct from true
      or public.patch83u_role_assignment_valid(
        p.organization_id, ur.scope, ur.organization_id,
        ur.division_id, ur.department_id, ur.unit_id
      ) is distinct from true
    )
  ) then
    raise exception 'GATE13B_INVALID_ACTIVE_ROLE_REMAINS';
  end if;
  foreach v_table in array array[
    'patch83b_release_migration_events','patch83b_legacy_runtime_bridges'
  ] loop
    if exists (
      select 1 from information_schema.role_table_grants g
      where g.table_schema='public' and g.table_name=v_table
        and g.grantee in ('PUBLIC','anon','authenticated')
    ) or exists (
      select 1 from pg_catalog.pg_policies p
      where p.schemaname='public' and p.tablename=v_table
    ) then
      raise exception 'GATE13B_BRIDGE_EVIDENCE_EXPOSED: %', v_table;
    end if;
  end loop;
end;
$test$;

rollback;
