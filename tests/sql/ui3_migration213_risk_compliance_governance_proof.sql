\set ON_ERROR_STOP on

begin;

do $$
declare
  v_missing text[];
  v_schema_version integer;
begin
  select array_agg(name order by name) into v_missing
  from unnest(array[
    'compliance_assessments',
    'compliance_findings',
    'compliance_remediation_actions',
    'compliance_workflow_events'
  ]) name
  where to_regclass('public.' || name) is null;
  if v_missing is not null then
    raise exception 'UI3_PROOF_MISSING_TABLES: %', v_missing;
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgrelid = 'public.risks'::regclass
      and tgname = 'trg_ui3_risk_governance_gate'
      and not tgisinternal
  ) then
    raise exception 'UI3_PROOF_RISK_GATE_MISSING';
  end if;

  if not exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'v_ui3_compliance_obligation_register'
      and c.relkind = 'v'
      and c.reloptions @> array['security_invoker=true']
  ) then
    raise exception 'UI3_PROOF_SECURITY_INVOKER_VIEW_MISSING';
  end if;

  select (public.get_governance_criteria_linkage_capabilities()->>'schema_version')::integer
  into v_schema_version;
  if v_schema_version <> 213 then
    raise exception 'UI3_PROOF_CAPABILITY_CEILING_MISMATCH: %', v_schema_version;
  end if;
end;
$$;

do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'compliance_assessments',
    'compliance_findings',
    'compliance_remediation_actions',
    'compliance_workflow_events'
  ] loop
    if not exists (
      select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = v_table and c.relrowsecurity
    ) then
      raise exception 'UI3_PROOF_RLS_DISABLED: %', v_table;
    end if;
    if has_table_privilege('authenticated', format('public.%I', v_table), 'INSERT')
      or has_table_privilege('authenticated', format('public.%I', v_table), 'UPDATE')
      or has_table_privilege('authenticated', format('public.%I', v_table), 'DELETE') then
      raise exception 'UI3_PROOF_BROWSER_DML_PRESENT: %', v_table;
    end if;
    if not has_table_privilege('authenticated', format('public.%I', v_table), 'SELECT') then
      raise exception 'UI3_PROOF_AUTHENTICATED_READ_MISSING: %', v_table;
    end if;
  end loop;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.governance_linkage_reviews'::regclass
      and pg_get_constraintdef(oid) like '%compliance_assessment%'
  ) then
    raise exception 'UI3_PROOF_COMPLIANCE_ASSESSMENT_SOURCE_NOT_GOVERNED';
  end if;

  if has_function_privilege('authenticated', 'public.ui3_risk_compliance_workflow_bridge(uuid,text,jsonb)', 'EXECUTE') then
    raise exception 'UI3_PROOF_PRIVILEGED_BRIDGE_EXPOSED';
  end if;
  if has_function_privilege('authenticated', 'public.resolve_governance_document_version_candidates(uuid,uuid,date,uuid)', 'EXECUTE') then
    raise exception 'UI3_PROOF_VERSION_RESOLVER_EXPOSED';
  end if;
  if has_function_privilege('authenticated', 'public.get_governance_criteria_linkage_capabilities()', 'EXECUTE') then
    raise exception 'UI3_PROOF_CAPABILITY_FUNCTION_EXPOSED';
  end if;
  if not has_function_privilege('authenticated', 'public.governance_linkage_source_readable(uuid,text,uuid)', 'EXECUTE')
    or not has_function_privilege('authenticated', 'public.governance_linkage_target_readable(uuid,text,uuid,uuid,uuid,uuid,uuid,uuid,uuid)', 'EXECUTE') then
    raise exception 'UI3_PROOF_RLS_VISIBILITY_HELPER_MISSING';
  end if;
end;
$$;

select 'UI-3 MIGRATION 213 SQL/SECURITY PROOF PASSED' as result;

rollback;
