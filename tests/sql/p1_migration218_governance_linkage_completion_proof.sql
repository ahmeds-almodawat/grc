\set ON_ERROR_STOP on
begin;

do $proof$
declare
  v_actor uuid;
  v_unauthorized uuid;
  v_org uuid;
  v_department uuid;
  v_obligation uuid;
  v_assessment uuid := gen_random_uuid();
  v_finding uuid := gen_random_uuid();
  v_document uuid;
  v_version uuid;
  v_capa uuid := gen_random_uuid();
  v_document_type text;
  v_document_status text;
  v_review uuid;
  v_link uuid;
  v_result jsonb;
  v_threw boolean;
  v_source_type text;
  v_source_id uuid;
begin
  if not exists (
    select 1 from supabase_migrations.schema_migrations
    where version = '218' and name = 'p1_governance_linkage_completion'
  ) then raise exception 'P1_218_LEDGER_ENTRY_MISSING'; end if;

  select p.id, p.organization_id, p.department_id
    into v_actor, v_org, v_department
  from public.profiles p
  where p.is_active and p.user_status::text = 'active'
    and exists (
      select 1 from public.user_roles ur
      where ur.user_id = p.id and ur.organization_id = p.organization_id
        and ur.is_active and ur.scope::text = 'global' and ur.role::text = 'super_admin'
    )
  order by p.id limit 1;
  if v_actor is null then raise exception 'P1_218_ACTIVE_GLOBAL_ACTOR_REQUIRED'; end if;

  select p.id into v_unauthorized from public.profiles p
  where p.id <> v_actor and p.is_active and p.user_status::text = 'active'
    and p.organization_id is distinct from v_org
  order by p.id limit 1;
  if v_unauthorized is null then raise exception 'P1_218_UNAUTHORIZED_ACTOR_FIXTURE_REQUIRED'; end if;

  select o.id, coalesce(o.department_id, v_department) into v_obligation, v_department
  from public.compliance_obligations o where o.organization_id = v_org
  order by o.id limit 1;
  if v_obligation is null then raise exception 'P1_218_COMPLIANCE_OBLIGATION_FIXTURE_REQUIRED'; end if;

  select d.id, d.current_version_id, d.document_type, d.document_status::text
    into v_document, v_version, v_document_type, v_document_status
  from public.controlled_documents d
  join public.document_versions version on version.id = d.current_version_id
  where d.organization_id = v_org and d.document_type in ('policy','sop')
    and version.approved_at is not null and version.locked_at is not null
  order by d.id limit 1;
  if v_document is null then raise exception 'P1_218_APPROVED_LOCKED_DOCUMENT_FIXTURE_REQUIRED'; end if;

  insert into public.compliance_assessments (
    id, organization_id, obligation_id, assessment_code, assessment_title,
    assessment_date, scope_description, department_id, responsible_owner_id,
    reviewer_id, result, workflow_status, created_by
  ) values (
    v_assessment, v_org, v_obligation, 'P1-A-' || left(v_assessment::text, 8),
    'P1 rollback-only assessment', current_date - 2, 'P1 rollback proof',
    v_department, v_actor, v_actor, 'noncompliant', 'draft', v_actor
  );
  insert into public.compliance_findings (
    id, organization_id, assessment_id, obligation_id, finding_code,
    finding_description, severity, responsible_owner_id, department_id, created_by
  ) values (
    v_finding, v_org, v_assessment, v_obligation, 'P1-F-' || left(v_finding::text, 8),
    'P1 rollback-only high-severity compliance finding', 'high', v_actor, v_department, v_actor
  );

  execute 'set local role service_role';
  perform set_config('request.jwt.claim.role', 'service_role', true);
  v_result := public.start_governance_linkage_review(
    v_actor, 'compliance_finding', v_finding, null, current_date - 2,
    'P1 first-class Compliance Finding proof'
  );
  v_review := (v_result->>'review_id')::uuid;
  v_result := public.suggest_governance_criterion_link(
    p_actor_id => v_actor,
    p_review_id => v_review,
    p_target_criterion_type => v_document_type,
    p_target_document_id => v_document,
    p_target_version_id => v_version,
    p_relationship_origin => 'direct',
    p_resolution_method => 'direct_selection',
    p_resolution_date => current_date - 2,
    p_rationale => 'Internal governance implementation relationship for the Compliance Finding.'
  );
  v_link := (v_result->>'link_id')::uuid;
  execute 'reset role';

  if not public.governance_linkage_actor_authorized(v_actor, v_org, 'compliance_finding', v_finding, 'review') then
    raise exception 'P1_218_COMPLIANCE_ACTOR_NOT_AUTHORIZED';
  end if;
  if public.governance_linkage_actor_authorized(v_unauthorized, v_org, 'compliance_finding', v_finding, 'review') then
    raise exception 'P1_218_UNRELATED_ACTOR_AUTHORIZED';
  end if;

  execute 'set local role service_role';
  v_threw := false;
  begin
    perform public.append_governance_criterion_decision(
      v_unauthorized, v_link, 'confirmed', 'primary', 'noncompliance', 'incomplete',
      'Unauthorized confirmation attempt', null, null, '{}'::uuid[]
    );
  exception when others then v_threw := sqlerrm like '%AUTHORITY_REQUIRED%'; end;
  if not v_threw then raise exception 'P1_218_UNAUTHORIZED_CONFIRMATION_ALLOWED'; end if;

  perform public.append_governance_criterion_decision(
    v_actor, v_link, 'confirmed', 'primary', 'noncompliance', 'incomplete',
    'Confirmed Compliance Finding governance basis', null, null, '{}'::uuid[]
  );
  execute 'reset role';

  select source_entity_type, source_entity_id into v_source_type, v_source_id
  from public.ui4_capa_governance_source('compliance_finding', v_finding);
  if v_source_type <> 'compliance_finding' or v_source_id <> v_finding then
    raise exception 'P1_218_CAPA_COMPLIANCE_FINDING_PROVENANCE_LOST';
  end if;

  insert into public.capa_action_plans (
    id, organization_id, capa_title, capa_type, source_type, source_id,
    created_by, capa_owner_id
  ) values (
    v_capa, v_org, 'P1 rollback-only inherited CAPA', 'corrective_action',
    'compliance_finding', v_finding, v_actor, v_actor
  );
  execute 'set local role service_role';
  v_result := public.ui4_inherit_governance_links_to_capa(v_actor, v_capa);
  execute 'reset role';
  if (v_result->>'inherited_link_count')::integer < 1 then
    raise exception 'P1_218_CAPA_LINK_NOT_INHERITED:%', v_result;
  end if;
  if not exists (
    select 1
    from public.governance_criteria_link_lineage lineage
    join public.governance_criteria_links child on child.id = lineage.child_link_id
    where lineage.parent_link_id = v_link and child.source_entity_type = 'capa'
      and child.source_entity_id = v_capa and child.relationship_origin = 'inherited'
      and child.root_source_entity_type = 'compliance_finding'
      and child.root_source_entity_id = v_finding
  ) then raise exception 'P1_218_CAPA_INHERITED_LINEAGE_MISSING'; end if;

  if not exists (
    select 1 from public.v_governance_link_analytics_events
    where link_id = v_link and confirmed and source_severity = 'high'
      and document_gap and not suspected
  ) then raise exception 'P1_218_ANALYTICS_EVENT_MISSING'; end if;
  if not exists (
    select 1 from public.v_governance_link_analytics_summary
    where target_document_id = v_document and target_version_id = v_version
      and confirmed_event_count >= 1 and high_critical_event_count >= 1
      and document_gap_count >= 1 and not normalized_rate_available
  ) then raise exception 'P1_218_ANALYTICS_SUMMARY_MISSING'; end if;

  execute 'set local role service_role';
  v_result := public.evaluate_governance_document_review_trigger(v_actor, v_document, current_date + 14);
  execute 'reset role';
  if (v_result->>'triggered')::boolean is distinct from true then
    raise exception 'P1_218_REVIEW_TRIGGER_NOT_OPENED:%', v_result;
  end if;
  if not exists (
    select 1 from public.governed_document_review_triggers
    where id = (v_result->>'trigger_id')::uuid and document_id = v_document
      and trigger_type = 'governance_pattern' and status = 'open'
  ) then raise exception 'P1_218_GOVERNED_REVIEW_ROW_MISSING'; end if;
  if exists (
    select 1 from public.controlled_documents
    where id = v_document and (current_version_id is distinct from v_version or document_status::text is distinct from v_document_status)
  ) then raise exception 'P1_218_REVIEW_TRIGGER_MUTATED_DOCUMENT'; end if;

  if has_function_privilege('authenticated', 'public.evaluate_governance_document_review_trigger(uuid,uuid,date)', 'execute') then
    raise exception 'P1_218_BROWSER_REVIEW_EVALUATOR_EXECUTE_ALLOWED';
  end if;
  execute 'set local role anon';
  v_threw := false;
  begin perform count(*) from public.v_governance_link_analytics_summary;
  exception when insufficient_privilege then v_threw := true; end;
  execute 'reset role';
  if not v_threw then raise exception 'P1_218_ANON_ANALYTICS_READ_ALLOWED'; end if;

  raise notice 'P1 MIGRATION 218 GOVERNANCE LINKAGE COMPLETION PROOF PASSED';
end;
$proof$;

rollback;
