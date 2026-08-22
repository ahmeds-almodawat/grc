\set ON_ERROR_STOP on
begin;

do $$
declare
  v_definition text;
  v_capabilities jsonb;
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'audit_findings'
      and column_name = 'audit_period_end_date'
  ) then raise exception 'UI4_PROOF_AUDIT_PERIOD_END_MISSING'; end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'audit_findings'
      and column_name = 'finding_classification'
  ) then raise exception 'UI4_PROOF_AUDIT_CLASSIFICATION_MISSING'; end if;

  if not exists (
    select 1 from pg_trigger
    where tgrelid = 'public.audit_finding_criteria_disputes'::regclass
      and tgname = 'trg_ui4_audit_criteria_disputes_immutable'
      and not tgisinternal
  ) then raise exception 'UI4_PROOF_DISPUTE_APPEND_ONLY_TRIGGER_MISSING'; end if;

  if not exists (
    select 1 from pg_trigger
    where tgrelid = 'public.audit_findings'::regclass
      and tgname = 'trg_ui4_audit_criterion_closure'
      and not tgisinternal
  ) then raise exception 'UI4_PROOF_AUDIT_CRITERION_GATE_TRIGGER_MISSING'; end if;

  select pg_get_functiondef('public.governance_linkage_source_context(text,uuid,uuid)'::regprocedure)
    into v_definition;
  if position('coalesce(a.audit_period_end_date, a.finding_date' in v_definition) = 0 then
    raise exception 'UI4_PROOF_EXACT_AUDIT_DATE_ORDER_MISSING';
  end if;

  select pg_get_functiondef('public.governance_linkage_actor_authorized(uuid,uuid,text,uuid,text)'::regprocedure)
    into v_definition;
  if position('auditor' in v_definition) = 0 or position('p_source_entity_type <> ''audit_finding''' in v_definition) = 0 then
    raise exception 'UI4_PROOF_AUDITOR_INDEPENDENCE_MISSING';
  end if;

  select pg_get_functiondef('public.append_governance_criterion_decision(uuid,uuid,text,text,text,text,text,text,uuid,uuid[])'::regprocedure)
    into v_definition;
  if position('UI4_INHERITED_GOVERNANCE_LINK_READ_ONLY' in v_definition) = 0 then
    raise exception 'UI4_PROOF_INHERITED_LINK_GUARD_MISSING';
  end if;

  select pg_get_viewdef('public.v_confirmed_governance_criteria_truth'::regclass, true)
    into v_definition;
  if position('NOT INHERITED' in upper(v_definition)) = 0 then
    raise exception 'UI4_PROOF_DUPLICATE_VIOLATION_GUARD_MISSING';
  end if;

  select public.get_governance_criteria_linkage_capabilities() into v_capabilities;
  if (v_capabilities ->> 'schema_version')::integer <> 214
     or coalesce((v_capabilities ->> 'audit_independence_available')::boolean, false) is not true
     or coalesce((v_capabilities ->> 'capa_inheritance_available')::boolean, false) is not true then
    raise exception 'UI4_PROOF_CAPABILITIES_INVALID';
  end if;

  if has_table_privilege('authenticated', 'public.audit_finding_criteria_disputes', 'INSERT') then
    raise exception 'UI4_PROOF_BROWSER_DISPUTE_WRITE_EXPOSED';
  end if;

  if has_function_privilege('authenticated', 'public.ui4_audit_capa_workflow_bridge(uuid,text,jsonb)', 'EXECUTE') then
    raise exception 'UI4_PROOF_BROWSER_WORKFLOW_RPC_EXPOSED';
  end if;
end;
$$;

select 'UI4_MIGRATION_214_AUDIT_CAPA_GOVERNANCE_PROOF_PASS' as proof_result;
rollback;
