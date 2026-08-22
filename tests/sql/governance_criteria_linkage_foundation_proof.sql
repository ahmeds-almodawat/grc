\set ON_ERROR_STOP on
begin;

do $proof$
declare
  v_actor uuid;
  v_unauthorized uuid;
  v_org uuid;
  v_other_org uuid := gen_random_uuid();
  v_department uuid;
  v_ovr uuid := gen_random_uuid();
  v_other_ovr uuid := gen_random_uuid();
  v_capa uuid := gen_random_uuid();
  v_policy uuid := gen_random_uuid();
  v_policy_v1 uuid := gen_random_uuid();
  v_policy_v2 uuid := gen_random_uuid();
  v_policy_v3 uuid := gen_random_uuid();
  v_requirement uuid := gen_random_uuid();
  v_requirement_v2 uuid := gen_random_uuid();
  v_sop uuid := gen_random_uuid();
  v_sop_v1 uuid := gen_random_uuid();
  v_sop_v2 uuid := gen_random_uuid();
  v_step uuid := gen_random_uuid();
  v_step_v2 uuid := gen_random_uuid();
  v_other_policy uuid := gen_random_uuid();
  v_other_version uuid := gen_random_uuid();
  v_control uuid := gen_random_uuid();
  v_review uuid;
  v_capa_review uuid;
  v_policy_link uuid;
  v_sop_link uuid;
  v_context_link uuid;
  v_inherited_link uuid;
  v_first_confirmation uuid;
  v_result jsonb;
  v_threw boolean;
  v_before integer;
  v_after integer;
begin
  select p.id, p.organization_id, p.department_id
    into v_actor, v_org, v_department
  from public.profiles p
  where p.is_active and p.user_status = 'active'
    and exists (
      select 1 from public.user_roles ur where ur.user_id = p.id and ur.is_active
        and ur.organization_id = p.organization_id and ur.scope = 'global'
        and ur.role in ('super_admin','governance_admin','compliance_officer')
    )
  order by p.id limit 1;
  if v_actor is null then raise exception 'PROOF_FIXTURE_GLOBAL_GOVERNANCE_ACTOR_REQUIRED'; end if;

  select p.id into v_unauthorized from public.profiles p
  where p.id <> v_actor and p.is_active and p.user_status = 'active'
  order by (p.organization_id = v_org) desc, p.id limit 1;
  if v_unauthorized is null then raise exception 'PROOF_FIXTURE_UNAUTHORIZED_ACTOR_REQUIRED'; end if;

  insert into public.organizations (id, name_en) values (v_other_org, 'GOV-LINK rollback tenant');
  insert into public.ovr_reports (
    id, organization_id, occurrence_date, brief_description, occurrence_category,
    reported_by, created_by, owner_id
  ) values
    (v_ovr, v_org, date '2026-03-15', 'GOV-LINK rollback proof source', 'other', v_unauthorized, v_actor, v_actor),
    (v_other_ovr, v_other_org, date '2026-03-15', 'Cross-tenant rollback source', 'other', null, null, null);
  insert into public.capa_action_plans (
    id, organization_id, capa_title, capa_type, source_type, source_id, created_by, capa_owner_id
  ) values (v_capa, v_org, 'GOV-LINK inherited CAPA', 'corrective_action', 'ovr', v_ovr, v_actor, v_actor);

  insert into public.controlled_documents (
    id, organization_id, document_code, document_title, document_type,
    confidentiality_level, document_owner_id, document_status
  ) values
    (v_policy, v_org, 'GL-POL-' || left(v_policy::text, 8), 'Restricted rollback Policy', 'policy', 'restricted', null, 'active'),
    (v_sop, v_org, 'GL-SOP-' || left(v_sop::text, 8), 'Rollback SOP', 'sop', 'internal', v_actor, 'active'),
    (v_other_policy, v_other_org, 'GL-XPOL-' || left(v_other_policy::text, 8), 'Cross-tenant Policy', 'policy', 'internal', null, 'active');

  insert into public.document_versions (
    id, document_id, version_number, version_label, effective_date, expiry_date
  ) values
    (v_policy_v1, v_policy, 1, '1.0', date '2026-01-01', date '2026-06-30'),
    (v_policy_v2, v_policy, 2, '2.0', date '2026-07-01', null),
    (v_policy_v3, v_policy, 3, '3.0', date '2026-07-01', null),
    (v_sop_v1, v_sop, 1, '1.0', date '2026-01-01', null),
    (v_sop_v2, v_sop, 2, '2.0', date '2027-01-01', null),
    (v_other_version, v_other_policy, 1, '1.0', date '2026-01-01', null);

  insert into public.governed_policy_details (
    version_id, title_en, policy_statement_en, content_mode, transcription_status
  ) values
    (v_policy_v1, 'Rollback Policy V1', 'Proof only', 'structured', 'complete'),
    (v_policy_v2, 'Rollback Policy V2', 'Proof only', 'structured', 'complete'),
    (v_policy_v3, 'Rollback Policy V3', 'Proof only', 'structured', 'complete'),
    (v_other_version, 'Other tenant Policy', 'Proof only', 'structured', 'complete');
  insert into public.policy_requirements (
    id, policy_version_id, sequence_number, requirement_statement_en
  ) values
    (v_requirement, v_policy_v1, 1, 'Use the exact historical version.'),
    (v_requirement_v2, v_policy_v2, 1, 'Do not cross version boundaries.');

  insert into public.governed_sop_details (
    version_id, title_en, process_name_en, governance_link_state, content_mode, transcription_status
  ) values
    (v_sop_v1, 'Rollback SOP V1', 'Rollback process', 'not_applicable', 'structured', 'complete'),
    (v_sop_v2, 'Rollback SOP V2', 'Future rollback process', 'not_applicable', 'structured', 'complete');
  insert into public.sop_procedure_steps (
    id, sop_version_id, sequence_number, responsible_role, action_instruction_en
  ) values
    (v_step, v_sop_v1, 1, 'Reviewer', 'Perform the governed check.'),
    (v_step_v2, v_sop_v2, 1, 'Reviewer', 'Do not cross version boundaries.');

  update public.document_versions set approved_at = now(), locked_at = now(), approved_by = v_actor, locked_by = v_actor
  where id in (v_policy_v1, v_policy_v2, v_policy_v3, v_sop_v1, v_sop_v2, v_other_version);
  update public.controlled_documents set current_version_id = case
    when id = v_policy then v_policy_v3 when id = v_sop then v_sop_v1 else v_other_version end
  where id in (v_policy, v_sop, v_other_policy);
  insert into public.control_library_items (
    id, organization_id, control_code, title, created_by
  ) values (v_control, v_org, 'GL-CTL-' || left(v_control::text, 8), 'Rollback control', v_actor);

  -- Resolver: zero, exactly one, and overlapping candidates.
  perform set_config('request.jwt.claim.role', 'service_role', true);
  execute 'set local role service_role';
  if (select resolution_status from public.resolve_governance_document_version_candidates(v_org, v_policy, date '2025-01-01', null) limit 1) <> 'zero_candidates' then
    raise exception 'CASE_01_RESOLVER_ZERO_CANDIDATE_FAILURE';
  end if;
  if (select resolution_status from public.resolve_governance_document_version_candidates(v_org, v_policy, date '2026-03-15', null) limit 1) <> 'exactly_one' then
    raise exception 'CASE_02_RESOLVER_ONE_CANDIDATE_FAILURE';
  end if;
  if (select bool_and(resolution_status = 'overlapping_candidates') from public.resolve_governance_document_version_candidates(v_org, v_policy, date '2026-08-01', null)) is distinct from true then
    raise exception 'CASE_03_RESOLVER_OVERLAP_FAILURE';
  end if;
  execute 'reset role';

  execute 'set local role service_role';
  v_result := public.start_governance_linkage_review(v_actor, 'ovr', v_ovr, null, date '2026-03-15', 'Rollback governed review');
  v_review := (v_result->>'review_id')::uuid;
  v_result := public.suggest_governance_criterion_link(
    v_actor, v_review, 'policy_requirement', v_policy, v_policy_v1, v_requirement,
    null, null, null, null, 'direct', 'resolver_exact', date '2026-03-15', null, null, null, null,
    'Exact historical Policy requirement suggestion'
  );
  v_policy_link := (v_result->>'link_id')::uuid;
  execute 'reset role';
  if (select decision_type from public.v_current_governance_criteria_links where link_id = v_policy_link) <> 'suggested' then
    raise exception 'CASE_04_SUGGESTION_BECAME_CONFIRMATION';
  end if;

  -- Cross-organization source and target are both fail-closed.
  v_threw := false;
  begin
    insert into public.governance_linkage_reviews (
      organization_id, source_entity_type, source_entity_id, review_status
    ) values (v_org, 'ovr', v_other_ovr, 'under_review');
  exception when others then v_threw := sqlerrm like '%CROSS_ORGANIZATION%'; end;
  if not v_threw then raise exception 'CASE_05_CROSS_ORG_SOURCE_ALLOWED'; end if;

  v_threw := false;
  begin
    insert into public.governance_criteria_links (
      organization_id, review_id, source_entity_type, source_entity_id,
      root_source_entity_type, root_source_entity_id, target_criterion_type,
      target_document_id, target_version_id, relationship_origin, resolution_method, resolution_snapshot
    ) values (
      v_org, v_review, 'ovr', v_ovr, 'ovr', v_ovr, 'policy',
      v_other_policy, v_other_version, 'direct', 'direct_selection', '{}'::jsonb
    );
  exception when others then v_threw := sqlerrm like '%CROSS_ORGANIZATION%'; end;
  if not v_threw then raise exception 'CASE_06_CROSS_ORG_TARGET_ALLOWED'; end if;

  -- Policy requirement and SOP step must remain inside their exact versions.
  v_threw := false;
  begin
    insert into public.governance_criteria_links (
      organization_id, review_id, source_entity_type, source_entity_id,
      root_source_entity_type, root_source_entity_id, target_criterion_type,
      target_document_id, target_version_id, target_policy_requirement_id,
      relationship_origin, resolution_method, resolution_snapshot
    ) values (
      v_org, v_review, 'ovr', v_ovr, 'ovr', v_ovr, 'policy_requirement',
      v_policy, v_policy_v1, v_requirement_v2, 'direct', 'direct_selection', '{}'::jsonb
    );
  exception when others then v_threw := sqlerrm like '%POLICY_REQUIREMENT_VERSION_MISMATCH%'; end;
  if not v_threw then raise exception 'CASE_07_POLICY_REQUIREMENT_CONTAINMENT_FAILURE'; end if;

  v_threw := false;
  begin
    insert into public.governance_criteria_links (
      organization_id, review_id, source_entity_type, source_entity_id,
      root_source_entity_type, root_source_entity_id, target_criterion_type,
      target_document_id, target_version_id, target_sop_step_id,
      relationship_origin, resolution_method, resolution_snapshot
    ) values (
      v_org, v_review, 'ovr', v_ovr, 'ovr', v_ovr, 'sop_step',
      v_sop, v_sop_v1, v_step_v2, 'direct', 'direct_selection', '{}'::jsonb
    );
  exception when others then v_threw := sqlerrm like '%SOP_STEP_VERSION_MISMATCH%'; end;
  if not v_threw then raise exception 'CASE_08_SOP_STEP_CONTAINMENT_FAILURE'; end if;

  -- Unauthorized actors cannot confirm; authorized decisions remain append-only.
  select p.id into v_unauthorized from public.profiles p
  where p.id <> v_actor and p.is_active and p.user_status = 'active'
    and not public.governance_linkage_actor_authorized(p.id, v_org, 'ovr', v_ovr, 'review')
  order by p.id limit 1;
  if v_unauthorized is null then raise exception 'PROOF_FIXTURE_UNAUTHORIZED_ACTOR_REQUIRED'; end if;
  execute 'set local role service_role';
  v_threw := false;
  begin
    perform public.append_governance_criterion_decision(
      v_unauthorized, v_policy_link, 'confirmed', 'primary', 'noncompliance', 'incomplete',
      'Unauthorized confirmation attempt', null, null, '{}'::uuid[]
    );
  exception when others then v_threw := sqlerrm like '%REVIEW_AUTHORITY_REQUIRED%'; end;
  if not v_threw then raise exception 'CASE_09_UNAUTHORIZED_CONFIRMATION_ALLOWED'; end if;

  v_result := public.append_governance_criterion_decision(
    v_actor, v_policy_link, 'confirmed', 'primary', 'noncompliance', 'incomplete',
    'Confirmed exact historical Policy requirement', null, null, '{}'::uuid[]
  );
  v_first_confirmation := (v_result->>'decision_id')::uuid;
  execute 'reset role';
  if (select target_version_id from public.v_current_governance_criteria_links where link_id = v_policy_link) <> v_policy_v1 then
    raise exception 'CASE_10_HISTORICAL_VERSION_RETARGETED';
  end if;
  v_threw := false;
  begin update public.governance_criteria_link_decisions set rationale = 'mutated' where id = v_first_confirmation;
  exception when others then v_threw := sqlerrm like '%IMMUTABLE_HISTORY%'; end;
  if not v_threw then raise exception 'CASE_11_APPEND_ONLY_DECISION_MUTATED'; end if;

  execute 'set local role service_role';
  v_result := public.append_governance_criterion_decision(
    v_actor, v_policy_link, 'confirmed', 'primary', 'noncompliance', 'adequate',
    'Corrected adequacy while retaining prior history', 'Adequacy evidence corrected', v_first_confirmation, '{}'::uuid[]
  );
  execute 'reset role';
  if (select count(*) from public.governance_criteria_link_decisions where link_id = v_policy_link) <> 3 then
    raise exception 'CASE_12_CORRECTION_HISTORY_NOT_PRESERVED';
  end if;

  -- Rejected suggestions remain, and Policy plus SOP may share one root event.
  execute 'set local role service_role';
  v_result := public.suggest_governance_criterion_link(
    v_actor, v_review, 'sop_step', v_sop, v_sop_v1, null, v_step,
    null, null, null, 'investigator_confirmed', 'direct_selection', date '2026-03-15', null,
    null, null, null, 'SOP step suggestion retained even when rejected'
  );
  v_sop_link := (v_result->>'link_id')::uuid;
  perform public.append_governance_criterion_decision(
    v_actor, v_sop_link, 'rejected', null, null, null,
    'Evidence did not support this suggested step', null, null, '{}'::uuid[]
  );
  v_result := public.suggest_governance_criterion_link(
    v_actor, v_review, 'control', null, null, null, null, null, null, v_control,
    'direct', 'direct_selection', date '2026-03-15', null, null, null, null, 'Context-only control'
  );
  v_context_link := (v_result->>'link_id')::uuid;
  perform public.append_governance_criterion_decision(
    v_actor, v_context_link, 'confirmed', 'context_only', 'unknown', 'not_assessed',
    'Context only does not establish a violation', null, null, '{}'::uuid[]
  );
  execute 'reset role';
  if not exists (select 1 from public.governance_criteria_link_decisions where link_id = v_sop_link and decision_type = 'rejected') then
    raise exception 'CASE_13_REJECTED_SUGGESTION_NOT_PRESERVED';
  end if;
  if (select counts_as_violation from public.v_confirmed_governance_criteria_truth where link_id = v_context_link) then
    raise exception 'CASE_14_CONTEXT_UNKNOWN_FABRICATED_VIOLATION';
  end if;

  -- Inheritance keeps the OVR root and cannot increase the distinct root count.
  execute 'set local role service_role';
  v_result := public.start_governance_linkage_review(v_actor, 'capa', v_capa, null, date '2026-03-15', 'Inherited CAPA review');
  v_capa_review := (v_result->>'review_id')::uuid;
  v_result := public.suggest_governance_criterion_link(
    v_actor, v_capa_review, 'policy_requirement', v_policy, v_policy_v1, v_requirement,
    null, null, null, null, 'inherited', 'inherited', date '2026-03-15', null,
    null, null, v_policy_link, 'Inherited from the OVR root'
  );
  v_inherited_link := (v_result->>'link_id')::uuid;
  perform public.append_governance_criterion_decision(
    v_actor, v_inherited_link, 'confirmed', 'primary', 'noncompliance', 'adequate',
    'Inherited confirmation', null, null, '{}'::uuid[]
  );
  execute 'reset role';
  if not exists (
    select 1 from public.governance_criteria_links i join public.governance_criteria_links p on p.id = v_policy_link
    where i.id = v_inherited_link and i.root_source_entity_type = p.root_source_entity_type
      and i.root_source_entity_id = p.root_source_entity_id
  ) then raise exception 'CASE_15_INHERITED_ROOT_CHANGED'; end if;
  if (select count(distinct root_event_key) from public.v_confirmed_governance_criteria_truth
      where link_id in (v_policy_link, v_inherited_link)) <> 1 then
    raise exception 'CASE_16_INHERITANCE_DOUBLE_COUNTED_ROOT';
  end if;

  -- Restricted labels are redacted for a non-governance source reader.
  update public.user_roles set is_active = false
  where user_id = v_actor and organization_id = v_org
    and role in ('super_admin','governance_admin','compliance_officer');
  execute 'set local role authenticated';
  perform set_config('request.jwt.claims', jsonb_build_object(
    'sub', v_actor, 'role', 'authenticated', 'organization_id', v_org,
    'app_metadata', jsonb_build_object('organization_id', v_org)
  )::text, true);
  if (select target_display_label from public.v_current_governance_criteria_links where link_id = v_policy_link) is distinct from '[restricted]' then
    raise exception 'CASE_17_RESTRICTED_TARGET_LABEL_NOT_REDACTED';
  end if;
  v_threw := false;
  begin
    insert into public.governance_linkage_reviews (
      organization_id, source_entity_type, source_entity_id, review_status
    ) values (v_org, 'ovr', v_ovr, 'under_review');
  exception when others then v_threw := true; end;
  if not v_threw then raise exception 'CASE_18_BROWSER_DIRECT_INSERT_ALLOWED'; end if;
  execute 'reset role';

  execute 'set local role anon';
  v_threw := false;
  begin perform count(*) from public.v_current_governance_criteria_links;
  exception when others then v_threw := true; end;
  if not v_threw then raise exception 'CASE_19_ANON_READ_ALLOWED'; end if;
  execute 'reset role';

  select count(*) into v_before from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relname in (
    'governance_linkage_reviews','governance_criteria_links','governance_criteria_link_decisions',
    'governance_criteria_link_lineage','governance_criteria_link_evidence'
  ) and c.relrowsecurity;
  if v_before <> 5 then raise exception 'CASE_20_RLS_NOT_ENABLED_ON_ALL_TABLES'; end if;

  if exists (
    select 1 from information_schema.role_table_grants
    where grantee = 'authenticated' and table_schema = 'public'
      and table_name like 'governance%link%' and privilege_type in ('INSERT','UPDATE','DELETE','TRUNCATE')
  ) then raise exception 'CASE_21_BROWSER_DML_GRANT_PRESENT'; end if;
  if exists (
    select 1 from public.v_confirmed_governance_criteria_truth
    where relationship_origin = 'legacy_f1' and counts_as_violation
  ) then raise exception 'CASE_22_LEGACY_F1_FABRICATED_VIOLATION'; end if;

  select count(*) into v_after from public.governance_criteria_links
  where root_source_entity_type = 'ovr' and root_source_entity_id = v_ovr
    and target_criterion_type in ('policy_requirement','sop_step');
  if v_after < 3 then raise exception 'CASE_23_POLICY_SOP_ROOT_ATTRIBUTION_MISSING'; end if;

  raise notice 'ALL 23 GOV-LINK-1 SECURITY, HISTORY, RESOLUTION, AND DEDUPLICATION CASES PASSED';
end;
$proof$;

rollback;
