\set ON_ERROR_STOP on

-- Migration210 and candidate211 are applied in the caller's transaction.
-- Every fixture and schema change is rolled back by this proof.
set local client_min_messages = notice;
set local patch83u.controlled_role_restore = 'on';

do $structural$
declare
  v_cap jsonb;
  v_count integer;
begin
  perform set_config('request.jwt.claim.role', 'service_role', true);
  v_cap := public.get_f2_ovr_governance_feedback_capabilities();
  if v_cap <> jsonb_build_object(
    'contract_version', 'f2-ovr-governance-feedback-v1',
    'schema_version', 211,
    'initiate_review_available', true,
    'complete_review_available', true,
    'sync_capa_available', true
  ) then raise exception 'CASE_01_CAPABILITY_EXACTNESS_FAILURE: %', v_cap; end if;

  select count(*) into v_count
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname in (
      'get_f2_ovr_governance_feedback_capabilities',
      'initiate_ovr_governance_feedback_review',
      'complete_ovr_governance_feedback_review',
      'sync_ovr_corrective_action_capa_link'
    ) and p.prosecdef
    and array['search_path=public, pg_temp'] <@ p.proconfig;
  if v_count <> 4 then raise exception 'CASE_02_05_SECURITY_DEFINER_SEARCH_PATH_FAILURE: %', v_count; end if;

  select count(*) into v_count
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname in (
      'get_f2_ovr_governance_feedback_capabilities',
      'initiate_ovr_governance_feedback_review',
      'complete_ovr_governance_feedback_review',
      'sync_ovr_corrective_action_capa_link'
    ) and (
      has_function_privilege('anon', p.oid, 'execute')
      or has_function_privilege('authenticated', p.oid, 'execute')
      or not has_function_privilege('service_role', p.oid, 'execute')
    );
  if v_count <> 0 then raise exception 'CASE_06_SERVICE_ROLE_ACL_FAILURE: %', v_count; end if;

  if (select count(*) from pg_policies where schemaname = 'public'
      and tablename = 'governed_document_review_triggers'
      and policyname like 'review_triggers_f2_ovr_%_guard' and permissive = 'RESTRICTIVE') <> 4 then
    raise exception 'CASE_07_REVIEW_RESTRICTIVE_POLICY_FAILURE';
  end if;
  if (select count(*) from pg_policies where schemaname = 'public'
      and tablename = 'ovr_capa_evidence_links'
      and policyname like 'ovr_capa_links_f2_%_guard' and permissive = 'RESTRICTIVE') <> 4 then
    raise exception 'CASE_08_CAPA_RESTRICTIVE_POLICY_FAILURE';
  end if;
  if not exists (
    select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'v_f2_ovr_governance_feedback'
      and array_to_string(c.reloptions, ',') like '%security_invoker=true%'
  ) then raise exception 'CASE_09_SECURITY_INVOKER_VIEW_FAILURE'; end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.ovr_capa_evidence_links'::regclass
      and conname = 'ovr_capa_evidence_links_ovr_fkey'
  ) then raise exception 'CASE_10_CAPA_OVR_FK_MISSING'; end if;
  if not exists (
    select 1 from pg_indexes where schemaname = 'public'
      and indexname = 'ovr_capa_evidence_links_f2_canonical_uniq'
  ) then raise exception 'CASE_11_CAPA_UNIQUENESS_MISSING'; end if;
  if not exists (
    select 1 from pg_trigger where tgrelid = 'public.ovr_capa_evidence_links'::regclass
      and tgname = 'trg_validate_f2_ovr_corrective_action_link' and not tgisinternal
  ) then raise exception 'CASE_12_CAPA_VALIDATOR_MISSING'; end if;
  if to_regprocedure('public.patch83u_runtime_credential_state_allowed(text,text)') is null then
    raise exception 'CASE_13_PATCH83U_CREDENTIAL_RUNTIME_MISSING';
  end if;
  if to_regprocedure('public.patch83u_request_frontend_contract_compatible()') is null then
    raise exception 'CASE_14_PATCH83U_FRONTEND_CONTRACT_RUNTIME_MISSING';
  end if;
  raise notice 'F2 STRUCTURAL CASES 01-14 PASSED';
end;
$structural$;

do $behavior$
declare
  v_org_a uuid := 'f2000000-0000-4000-8000-000000000001';
  v_org_b uuid := 'f2000000-0000-4000-8000-000000000002';
  v_gov uuid := 'f2000000-0000-4000-8000-000000000101';
  v_compliance uuid := 'f2000000-0000-4000-8000-000000000102';
  v_employee uuid := 'f2000000-0000-4000-8000-000000000103';
  v_executive uuid := 'f2000000-0000-4000-8000-000000000104';
  v_auditor uuid := 'f2000000-0000-4000-8000-000000000105';
  v_manager uuid := 'f2000000-0000-4000-8000-000000000106';
  v_null_org uuid := 'f2000000-0000-4000-8000-000000000107';
  v_wrong_org uuid := 'f2000000-0000-4000-8000-000000000108';
  v_inactive uuid := 'f2000000-0000-4000-8000-000000000109';
  v_doc uuid := 'f2000000-0000-4000-8000-000000000201';
  v_v1 uuid := 'f2000000-0000-4000-8000-000000000301';
  v_v2 uuid := 'f2000000-0000-4000-8000-000000000302';
  v_ovr uuid := 'f2000000-0000-4000-8000-000000000401';
  v_other_ovr uuid := 'f2000000-0000-4000-8000-000000000402';
  v_project uuid := 'f2000000-0000-4000-8000-000000000501';
  v_project_2 uuid := 'f2000000-0000-4000-8000-000000000502';
  v_link uuid;
  v_trigger uuid;
  v_major_trigger uuid;
  v_retire_trigger uuid;
  v_minor uuid;
  v_v3 uuid;
  v_result jsonb;
  v_before integer;
  v_after integer;
  v_threw boolean;
  v_actor uuid;
begin
  insert into public.organizations (id, name_en, is_active)
  values (v_org_a, 'F2 Proof Org A', true), (v_org_b, 'F2 Proof Org B', true);

  insert into auth.users (id, email, aud, role, email_confirmed_at, raw_app_meta_data)
  select id, email, 'authenticated', 'authenticated', now(), '{"provider":"email","providers":["email"]}'::jsonb
  from (values
    (v_gov, 'f2.gov@test.invalid'), (v_compliance, 'f2.compliance@test.invalid'),
    (v_employee, 'f2.employee@test.invalid'), (v_executive, 'f2.executive@test.invalid'),
    (v_auditor, 'f2.auditor@test.invalid'), (v_manager, 'f2.manager@test.invalid'),
    (v_null_org, 'f2.null@test.invalid'), (v_wrong_org, 'f2.wrong@test.invalid'),
    (v_inactive, 'f2.inactive@test.invalid')
  ) fixture(id, email);

  insert into public.profiles (id, organization_id, full_name_en, email, employee_no, is_active, user_status)
  select id, organization_id, full_name, email, employee_no, is_active, user_status
  from (values
    (v_gov, v_org_a, 'F2 Governance', 'f2.gov@test.invalid', 'F2-101', true, 'active'),
    (v_compliance, v_org_a, 'F2 Compliance', 'f2.compliance@test.invalid', 'F2-102', true, 'active'),
    (v_employee, v_org_a, 'F2 Employee', 'f2.employee@test.invalid', 'F2-103', true, 'active'),
    (v_executive, v_org_a, 'F2 Executive', 'f2.executive@test.invalid', 'F2-104', true, 'active'),
    (v_auditor, v_org_a, 'F2 Auditor', 'f2.auditor@test.invalid', 'F2-105', true, 'active'),
    (v_manager, v_org_a, 'F2 Manager', 'f2.manager@test.invalid', 'F2-106', true, 'active'),
    (v_null_org, v_org_a, 'F2 Null Org', 'f2.null@test.invalid', 'F2-107', true, 'active'),
    (v_wrong_org, v_org_a, 'F2 Wrong Org', 'f2.wrong@test.invalid', 'F2-108', true, 'active'),
    (v_inactive, v_org_a, 'F2 Inactive', 'f2.inactive@test.invalid', 'F2-109', false, 'inactive')
  ) fixture(id, organization_id, full_name, email, employee_no, is_active, user_status);

  insert into public.user_roles (user_id, role, scope, organization_id, is_active) values
    (v_gov, 'governance_admin', 'global', v_org_a, true),
    (v_compliance, 'compliance_officer', 'global', v_org_a, true),
    (v_employee, 'employee', 'assigned_only', v_org_a, true),
    (v_executive, 'executive', 'global', v_org_a, true),
    (v_auditor, 'auditor', 'global', v_org_a, true),
    (v_manager, 'department_manager', 'department', v_org_a, true),
    (v_null_org, 'governance_admin', 'global', null, true),
    (v_wrong_org, 'governance_admin', 'global', v_org_b, true),
    (v_inactive, 'governance_admin', 'global', v_org_a, true);

  insert into public.controlled_documents (
    id, organization_id, document_code, document_title, document_type,
    document_status, document_owner_id
  ) values (v_doc, v_org_a, 'F2-SOP-01', 'F2 Historical SOP', 'sop', 'approved', v_gov);
  insert into public.document_versions (
    id, document_id, version_number, version_label, approved_at, locked_at,
    prepared_by, is_current_version
  ) values
    (v_v1, v_doc, 1, '1.0', null, null, v_gov, true),
    (v_v2, v_doc, 2, '2.0', null, null, v_gov, false);
  insert into public.governed_sop_details (
    version_id, title_en, process_name_en, governance_link_state, content_mode, transcription_status
  ) values
    (v_v1, 'F2 Historical SOP V1', 'F2 Proof Process', 'not_applicable', 'structured', 'complete'),
    (v_v2, 'F2 Current SOP V2', 'F2 Proof Process', 'not_applicable', 'structured', 'complete');
  update public.document_versions
    set approved_at = now() - interval '60 days', locked_at = now() - interval '60 days'
    where id = v_v1;
  update public.document_versions
    set approved_at = now() - interval '10 days', locked_at = now() - interval '10 days'
    where id = v_v2;
  update public.controlled_documents set current_version_id = v_v1 where id = v_doc;

  insert into public.ovr_reports (id, organization_id, brief_description, reported_by)
  values
    (v_ovr, v_org_a, 'F2 disposable proof OVR', v_employee),
    (v_other_ovr, v_org_a, 'F2 other disposable proof OVR', v_employee);

  execute 'set local role service_role';
  perform set_config('request.jwt.claim.role', 'service_role', true);
  v_result := public.link_ovr_governed_document_version(v_gov, v_ovr, v_v1, 'F2 exact V1 source');
  v_link := (v_result->>'link_id')::uuid;
  execute 'reset role';

  -- V2 becomes current after the OVR remains linked to historical V1.
  update public.document_versions set is_current_version = false, superseded_by_version_id = v_v2 where id = v_v1;
  update public.document_versions set is_current_version = true, supersedes_version_id = v_v1 where id = v_v2;
  update public.controlled_documents set current_version_id = v_v2 where id = v_doc;

  execute 'set local role service_role';
  v_result := public.initiate_ovr_governance_feedback_review(
    v_gov, v_ovr, v_link, current_date + 30, 'Historical source requires governance assessment'
  );
  v_trigger := (v_result->>'trigger_id')::uuid;
  if v_result->>'created' <> 'true' then raise exception 'CASE_15_REVIEW_NOT_CREATED'; end if;
  if (select version_id from public.governed_document_review_triggers where id = v_trigger) <> v_v1 then
    raise exception 'CASE_16_EXACT_V1_SOURCE_NOT_PRESERVED';
  end if;
  if (select source_document_link_id from public.governed_document_review_triggers where id = v_trigger) <> v_link then
    raise exception 'CASE_17_F1_SOURCE_LINK_NOT_PRESERVED';
  end if;
  execute 'reset role';
  select count(*) into v_before from public.document_review_events
  where event_type = 'ovr_feedback_review_opened' and version_id = v_v1;
  execute 'set local role service_role';
  v_result := public.initiate_ovr_governance_feedback_review(
    v_gov, v_ovr, v_link, current_date + 30, 'Idempotent replay remains exact'
  );
  execute 'reset role';
  select count(*) into v_after from public.document_review_events
  where event_type = 'ovr_feedback_review_opened' and version_id = v_v1;
  if v_result->>'created' <> 'false' or v_before <> v_after then
    raise exception 'CASE_18_19_INITIATE_IDEMPOTENCY_OR_AUDIT_FAILURE';
  end if;

  execute 'set local role service_role';
  foreach v_actor in array array[v_employee, v_executive, v_auditor, v_manager, v_null_org, v_wrong_org, v_inactive] loop
    v_threw := false;
    begin
      perform public.initiate_ovr_governance_feedback_review(
        v_actor, v_other_ovr, v_link, current_date + 30, 'Unauthorized actor attempt'
      );
    exception when others then v_threw := true; end;
    if not v_threw then raise exception 'CASE_20_26_UNAUTHORIZED_ACTOR_ALLOWED: %', v_actor; end if;
  end loop;

  v_threw := false;
  begin perform public.initiate_ovr_governance_feedback_review(v_gov, gen_random_uuid(), v_link, current_date + 30, 'Missing OVR');
  exception when others then v_threw := sqlerrm like '%OVR_NOT_FOUND%'; end;
  if not v_threw then raise exception 'CASE_27_NONEXISTENT_OVR_ALLOWED'; end if;
  v_threw := false;
  begin perform public.initiate_ovr_governance_feedback_review(v_gov, v_ovr, gen_random_uuid(), current_date + 30, 'Missing link');
  exception when others then v_threw := sqlerrm like '%CANONICAL_F1_LINK_NOT_FOUND%'; end;
  if not v_threw then raise exception 'CASE_28_NONEXISTENT_LINK_ALLOWED'; end if;
  v_threw := false;
  begin perform public.initiate_ovr_governance_feedback_review(v_gov, v_other_ovr, v_link, current_date + 30, 'Wrong OVR link');
  exception when others then v_threw := sqlerrm like '%CANONICAL_F1_LINK_NOT_FOUND%'; end;
  if not v_threw then raise exception 'CASE_29_WRONG_OVR_LINK_ALLOWED'; end if;

  v_result := public.complete_ovr_governance_feedback_review(
    v_gov, v_trigger, 'no_change', 'The exact incident source remains fit for purpose'
  );
  if v_result->>'outcome' <> 'no_change' or v_result->>'resulting_version_id' is not null then
    raise exception 'OUTCOME_NO_CHANGE_FAILURE';
  end if;

  v_result := public.initiate_ovr_governance_feedback_review(
    v_gov, v_ovr, v_link, current_date + 30, 'Minor revision outcome proof'
  );
  v_trigger := (v_result->>'trigger_id')::uuid;
  v_result := public.complete_ovr_governance_feedback_review(
    v_gov, v_trigger, 'minor_revision', 'Minor revision required from current V2'
  );
  v_minor := (v_result->>'resulting_version_id')::uuid;
  if v_minor is null or (select supersedes_version_id from public.document_versions where id = v_minor) <> v_v2 then
    raise exception 'OUTCOME_MINOR_REVISION_FAILURE';
  end if;

  -- Remove only the disposable minor draft so the mandatory replay can prove
  -- that major revision is the V3 derived directly from current V2.
  execute 'reset role';
  delete from public.document_versions where id = v_minor;
  execute 'set local role service_role';
  v_result := public.initiate_ovr_governance_feedback_review(
    v_compliance, v_ovr, v_link, current_date + 30, 'Mandatory historical major revision replay'
  );
  v_trigger := (v_result->>'trigger_id')::uuid;
  v_major_trigger := v_trigger;
  v_result := public.complete_ovr_governance_feedback_review(
    v_compliance, v_trigger, 'major_revision', 'Major revision required from the current governed version'
  );
  v_v3 := (v_result->>'resulting_version_id')::uuid;
  if v_v3 is null then raise exception 'CASE_30_RESULTING_V3_MISSING'; end if;
  if (select version_number from public.document_versions where id = v_v3) <> 3 then
    raise exception 'CASE_31_RESULTING_VERSION_NOT_V3';
  end if;
  if (select supersedes_version_id from public.document_versions where id = v_v3) <> v_v2 then
    raise exception 'CASE_32_V3_NOT_BASED_ON_CURRENT_V2';
  end if;
  if (select version_id from public.governed_document_review_triggers where id = v_trigger) <> v_v1 then
    raise exception 'CASE_33_TRIGGER_SOURCE_RETARGETED';
  end if;
  if (select resulting_version_id from public.governed_document_review_triggers where id = v_trigger) <> v_v3 then
    raise exception 'CASE_34_RESULTING_VERSION_NOT_STORED';
  end if;
  execute 'reset role';
  if not exists (select 1 from public.document_review_events
      where event_type = 'ovr_feedback_review_completed' and version_id = v_v1) then
    raise exception 'CASE_35_COMPLETION_AUDIT_MISSING';
  end if;

  execute 'set local role service_role';
  v_result := public.initiate_ovr_governance_feedback_review(
    v_gov, v_ovr, v_link, current_date + 30, 'Retirement outcome proof'
  );
  v_retire_trigger := (v_result->>'trigger_id')::uuid;
  v_result := public.complete_ovr_governance_feedback_review(
    v_gov, v_retire_trigger, 'retire', 'Governed document retirement required'
  );
  if v_result->>'outcome' <> 'retire'
     or (select document_status::text from public.controlled_documents where id = v_doc) <> 'retired' then
    raise exception 'OUTCOME_RETIRE_FAILURE';
  end if;
  execute 'reset role';

  insert into public.projects (
    id, organization_id, title, source_type, source_reference_id, created_by
  ) values
    (v_project, v_org_a, 'F2 Corrective Action', 'incident_ovr', v_ovr, v_gov),
    (v_project_2, v_org_a, 'F2 Conflicting Corrective Action', 'incident_ovr', v_ovr, v_gov);
  update public.ovr_reports set linked_project_id = v_project where id = v_ovr;
  select count(*) into v_before from public.clinical_governance_events
  where event_type = 'ovr_corrective_action_capa_link_created';
  execute 'set local role service_role';
  v_result := public.sync_ovr_corrective_action_capa_link(v_compliance, v_ovr);
  if v_result->>'created' <> 'true' then raise exception 'CASE_36_CAPA_LINK_NOT_CREATED'; end if;
  if not exists (select 1 from public.ovr_capa_evidence_links
      where ovr_id = v_ovr and linked_entity_id = v_project
        and linked_entity_type = 'capa' and link_role = 'corrective_action') then
    raise exception 'CASE_37_CANONICAL_CAPA_SHAPE_MISSING';
  end if;
  if (select corrective_action_project_id from public.governed_document_review_triggers where id = v_trigger) <> v_project then
    raise exception 'CASE_38_REVIEW_CAPA_ASSOCIATION_MISSING';
  end if;
  v_result := public.sync_ovr_corrective_action_capa_link(v_compliance, v_ovr);
  execute 'reset role';
  select count(*) into v_after from public.clinical_governance_events
  where event_type = 'ovr_corrective_action_capa_link_created';
  if v_result->>'created' <> 'false' or v_before + 1 <> v_after then
    raise exception 'CASE_39_40_CAPA_IDEMPOTENCY_OR_AUDIT_FAILURE';
  end if;

  execute 'reset role';
  update public.ovr_reports set linked_corrective_action_project_id = v_project_2 where id = v_ovr;
  execute 'set local role service_role';
  v_threw := false;
  begin perform public.sync_ovr_corrective_action_capa_link(v_gov, v_ovr);
  exception when others then v_threw := sqlerrm like '%CONFLICTING_CORRECTIVE_PROJECT_POINTERS%'; end;
  if not v_threw then raise exception 'CASE_41_CONFLICTING_POINTERS_ALLOWED'; end if;
  execute 'reset role';
  update public.ovr_reports set linked_corrective_action_project_id = null where id = v_ovr;

  v_threw := false;
  begin
    insert into public.ovr_capa_evidence_links (
      ovr_id, linked_entity_type, linked_entity_id, link_role, created_by
    ) values (v_other_ovr, 'capa', v_project, 'corrective_action', v_gov);
  exception when others then v_threw := sqlerrm like '%PROJECT_OVR_MISMATCH%'; end;
  if not v_threw then raise exception 'CASE_42_CROSS_OVR_PROJECT_REUSE_ALLOWED'; end if;

  if not exists (select 1 from public.v_f2_ovr_governance_feedback
      where trigger_id = v_major_trigger and source_version_id = v_v1
        and current_version_id = v_v2 and resulting_version_id = v_v3
        and corrective_action_project_id = v_project) then
    raise exception 'CASE_43_TRACE_VIEW_CHAIN_FAILURE';
  end if;
  if (select count(*) from public.governed_document_review_triggers where source_entity_id = v_ovr) <> 4 then
    raise exception 'CASE_44_REVIEW_DUPLICATION';
  end if;
  if (select count(*) from public.ovr_capa_evidence_links where ovr_id = v_ovr
      and linked_entity_type = 'capa' and link_role = 'corrective_action') <> 1 then
    raise exception 'CASE_45_CAPA_DUPLICATION';
  end if;
  raise notice 'F2 BEHAVIORAL CASES 15-45 PASSED';
end;
$behavior$;

do $$ begin
  raise notice 'ALL 45 F2 MIGRATION211 SECURITY/LIFECYCLE CASES DETERMINISTICALLY VERIFIED (PASSED).';
end $$;

rollback;
