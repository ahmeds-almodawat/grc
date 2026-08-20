\set ON_ERROR_STOP on

begin;
set local client_min_messages = notice;
set local patch83u.controlled_role_restore = 'on';

-- GRC v1.4-F1 Migration210 isolated proof. All fixtures roll back.
do $structural$
declare
  v_cap jsonb;
  v_count integer;
begin
  set local role service_role;
  perform set_config('request.jwt.claim.role', 'service_role', true);
  v_cap := public.get_f1_ovr_governed_version_link_capabilities();
  if v_cap <> jsonb_build_object(
    'contract_version', 'f1-ovr-governed-version-links-v1',
    'schema_version', 210,
    'link_available', true,
    'unlink_available', true
  ) then raise exception 'CASE_01_CAPABILITY_EXACTNESS_FAILURE: %', v_cap; end if;
  reset role;

  select count(*) into v_count
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname in (
      'get_f1_ovr_governed_version_link_capabilities',
      'link_ovr_governed_document_version',
      'unlink_ovr_governed_document_version'
    )
    and p.prosecdef
    and array['search_path=public, pg_temp'] <@ p.proconfig;
  if v_count <> 3 then raise exception 'CASE_02_SECURITY_DEFINER_SEARCH_PATH_FAILURE: %', v_count; end if;

  select count(*) into v_count
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname in (
      'get_f1_ovr_governed_version_link_capabilities',
      'link_ovr_governed_document_version',
      'unlink_ovr_governed_document_version'
    )
    and (
      has_function_privilege('anon', p.oid, 'execute')
      or has_function_privilege('authenticated', p.oid, 'execute')
      or not has_function_privilege('service_role', p.oid, 'execute')
    );
  if v_count <> 0 then raise exception 'CASE_03_SERVICE_ROLE_ACL_FAILURE: %', v_count; end if;

  if (select count(*) from pg_policies
      where schemaname = 'public' and tablename = 'document_links'
        and policyname like 'document_links_f1_ovr_%_guard'
        and permissive = 'RESTRICTIVE') <> 4 then
    raise exception 'CASE_04_F1_RESTRICTIVE_POLICY_FAILURE';
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'document_links'
      and policyname = 'patch83u_credential_gate' and permissive = 'RESTRICTIVE'
  ) then raise exception 'CASE_05_PATCH83U_GATE_MISSING'; end if;
  if (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname in ('v_f1_ovr_governed_version_links', 'v_f1_linkable_governed_document_versions')
        and array_to_string(c.reloptions, ',') like '%security_invoker=true%') <> 2 then
    raise exception 'CASE_06_SECURITY_INVOKER_VIEW_FAILURE';
  end if;
  raise notice 'F1 STRUCTURAL CASES 01-06 PASSED';
end;
$structural$;

do $fixtures$
declare
  v_org_a uuid := 'f1000000-0000-4000-8000-000000000001';
  v_org_b uuid := 'f1000000-0000-4000-8000-000000000002';
  v_gov uuid := 'f1000000-0000-4000-8000-000000000101';
  v_compliance uuid := 'f1000000-0000-4000-8000-000000000102';
  v_employee uuid := 'f1000000-0000-4000-8000-000000000103';
  v_manager uuid := 'f1000000-0000-4000-8000-000000000104';
  v_division uuid := 'f1000000-0000-4000-8000-000000000105';
  v_executive uuid := 'f1000000-0000-4000-8000-000000000106';
  v_auditor uuid := 'f1000000-0000-4000-8000-000000000107';
  v_null_org_role uuid := 'f1000000-0000-4000-8000-000000000108';
  v_wrong_org_role uuid := 'f1000000-0000-4000-8000-000000000109';
  v_outsider uuid := 'f1000000-0000-4000-8000-000000000110';
  v_gov_session uuid := 'f1000000-0000-4000-8000-000000000501';
  v_employee_session uuid := 'f1000000-0000-4000-8000-000000000503';
  v_outsider_session uuid := 'f1000000-0000-4000-8000-000000000510';
  v_doc_sop uuid := 'f1000000-0000-4000-8000-000000000201';
  v_doc_policy uuid := 'f1000000-0000-4000-8000-000000000202';
  v_doc_other uuid := 'f1000000-0000-4000-8000-000000000203';
  v_doc_cross uuid := 'f1000000-0000-4000-8000-000000000204';
  v_v1 uuid := 'f1000000-0000-4000-8000-000000000301';
  v_v2 uuid := 'f1000000-0000-4000-8000-000000000302';
  v_policy_v1 uuid := 'f1000000-0000-4000-8000-000000000303';
  v_draft uuid := 'f1000000-0000-4000-8000-000000000304';
  v_mutable uuid := 'f1000000-0000-4000-8000-000000000305';
  v_other uuid := 'f1000000-0000-4000-8000-000000000306';
  v_cross uuid := 'f1000000-0000-4000-8000-000000000307';
  v_ovr_a uuid := 'f1000000-0000-4000-8000-000000000401';
  v_ovr_hidden uuid := 'f1000000-0000-4000-8000-000000000402';
  v_ovr_cross uuid := 'f1000000-0000-4000-8000-000000000403';
  v_link_v1 uuid;
  v_link_v2 uuid;
  v_hidden_link uuid;
  v_result jsonb;
  v_before integer;
  v_after integer;
  v_threw boolean;
  v_actor uuid;
begin
  insert into public.organizations (id, name_en, is_active)
  values (v_org_a, 'F1 Org A', true), (v_org_b, 'F1 Org B', true)
  on conflict (id) do nothing;

  insert into auth.users (id, email, aud, role, email_confirmed_at, raw_app_meta_data)
  select id, email, 'authenticated', 'authenticated', now(), '{"provider":"email","providers":["email"]}'::jsonb
  from (values
    (v_gov, 'f1.gov@test.invalid'),
    (v_compliance, 'f1.compliance@test.invalid'),
    (v_employee, 'f1.employee@test.invalid'),
    (v_manager, 'f1.manager@test.invalid'),
    (v_division, 'f1.division@test.invalid'),
    (v_executive, 'f1.executive@test.invalid'),
    (v_auditor, 'f1.auditor@test.invalid'),
    (v_null_org_role, 'f1.nullorg@test.invalid'),
    (v_wrong_org_role, 'f1.wrongorg@test.invalid'),
    (v_outsider, 'f1.outsider@test.invalid')
  ) as fixture(id, email)
  on conflict (id) do nothing;

  insert into public.profiles (id, organization_id, full_name_en, email, employee_no, is_active, user_status)
  select id, organization_id, full_name, email, employee_no, true, 'active'
  from (values
    (v_gov, v_org_a, 'F1 Governance', 'f1.gov@test.invalid', 'F1-101'),
    (v_compliance, v_org_a, 'F1 Compliance', 'f1.compliance@test.invalid', 'F1-102'),
    (v_employee, v_org_a, 'F1 Employee', 'f1.employee@test.invalid', 'F1-103'),
    (v_manager, v_org_a, 'F1 Manager', 'f1.manager@test.invalid', 'F1-104'),
    (v_division, v_org_a, 'F1 Division', 'f1.division@test.invalid', 'F1-105'),
    (v_executive, v_org_a, 'F1 Executive', 'f1.executive@test.invalid', 'F1-106'),
    (v_auditor, v_org_a, 'F1 Auditor', 'f1.auditor@test.invalid', 'F1-107'),
    (v_null_org_role, v_org_a, 'F1 Null Org Role', 'f1.nullorg@test.invalid', 'F1-108'),
    (v_wrong_org_role, v_org_a, 'F1 Wrong Org Role', 'f1.wrongorg@test.invalid', 'F1-109'),
    (v_outsider, v_org_a, 'F1 Outsider', 'f1.outsider@test.invalid', 'F1-110')
  ) as fixture(id, organization_id, full_name, email, employee_no)
  on conflict (id) do update set is_active = true, user_status = 'active';

  insert into public.user_credential_states (
    user_id, organization_id, auth_email, identity_mode, credential_state,
    requested_lifecycle, credential_version, session_valid_after
  )
  select p.id, p.organization_id, lower(p.email), 'legacy_verified', 'active',
    'active', 1, to_timestamp(0)
  from public.profiles p
  where p.id in (v_gov, v_employee, v_outsider)
  on conflict (user_id) do update set
    organization_id = excluded.organization_id,
    auth_email = excluded.auth_email,
    identity_mode = excluded.identity_mode,
    credential_state = excluded.credential_state,
    requested_lifecycle = excluded.requested_lifecycle,
    credential_version = excluded.credential_version,
    session_valid_after = excluded.session_valid_after;

  insert into auth.sessions (id, user_id, created_at, updated_at)
  values
    (v_gov_session, v_gov, now(), now()),
    (v_employee_session, v_employee, now(), now()),
    (v_outsider_session, v_outsider, now(), now())
  on conflict (id) do update set updated_at = excluded.updated_at;

  delete from public.user_roles where user_id in (
    v_gov, v_compliance, v_employee, v_manager, v_division, v_executive,
    v_auditor, v_null_org_role, v_wrong_org_role, v_outsider
  );
  insert into public.user_roles (user_id, role, scope, organization_id, is_active)
  values
    (v_gov, 'governance_admin', 'global', v_org_a, true),
    (v_compliance, 'compliance_officer', 'global', v_org_a, true),
    (v_employee, 'employee', 'assigned_only', v_org_a, true),
    (v_manager, 'department_manager', 'department', v_org_a, true),
    (v_division, 'division_head', 'division', v_org_a, true),
    (v_executive, 'executive', 'global', v_org_a, true),
    (v_auditor, 'auditor', 'global', v_org_a, true),
    (v_null_org_role, 'governance_admin', 'global', null, true),
    (v_wrong_org_role, 'governance_admin', 'global', v_org_b, true),
    (v_outsider, 'employee', 'assigned_only', v_org_a, true);

  insert into public.controlled_documents (
    id, organization_id, document_code, document_title, document_type, document_status
  ) values
    (v_doc_sop, v_org_a, 'F1-SOP-01', 'F1 Exact SOP', 'sop', 'approved'),
    (v_doc_policy, v_org_a, 'F1-POL-01', 'F1 Exact Policy', 'policy', 'approved'),
    (v_doc_other, v_org_a, 'F1-FORM-01', 'F1 Non-governed Form', 'form', 'approved'),
    (v_doc_cross, v_org_b, 'F1-SOP-X', 'F1 Cross Org SOP', 'sop', 'approved')
  on conflict (id) do nothing;

  insert into public.document_versions (
    id, document_id, version_number, version_label, approved_at, locked_at,
    is_current_version, superseded_by_version_id
  ) values
    (v_v1, v_doc_sop, 1, '1.0', now() - interval '30 days', now() - interval '30 days', true, null),
    (v_v2, v_doc_sop, 2, '2.0', now(), now(), false, null),
    (v_policy_v1, v_doc_policy, 1, 'P1.0', now(), now(), true, null),
    (v_draft, v_doc_policy, 2, 'P2-draft', null, null, false, null),
    (v_mutable, v_doc_policy, 3, 'P3-mutable', now(), null, false, null),
    (v_other, v_doc_other, 1, 'F1.0', now(), now(), true, null),
    (v_cross, v_doc_cross, 1, 'X1.0', now(), now(), true, null)
  on conflict (id) do nothing;
  update public.controlled_documents set current_version_id = v_v1 where id = v_doc_sop;
  update public.controlled_documents set current_version_id = v_policy_v1 where id = v_doc_policy;

  insert into public.ovr_reports (id, organization_id, brief_description, reported_by)
  values
    (v_ovr_a, v_org_a, 'F1 visible OVR', v_employee),
    (v_ovr_hidden, v_org_a, 'F1 hidden OVR', v_gov),
    (v_ovr_cross, v_org_b, 'F1 cross OVR', v_wrong_org_role)
  on conflict (id) do nothing;

  perform set_config('request.jwt.claim.role', 'service_role', true);

  -- 07-11: current/historical allowed, idempotency, multiple versions, audit.
  v_result := public.link_ovr_governed_document_version(v_gov, v_ovr_a, v_v1, 'initial exact V1');
  v_link_v1 := (v_result->>'link_id')::uuid;
  if v_result->>'created' <> 'true' then raise exception 'CASE_07_CURRENT_VERSION_LINK_FAILURE'; end if;
  select count(*) into v_before from public.document_review_events
  where event_type = 'ovr_governed_version_linked' and version_id = v_v1;
  v_result := public.link_ovr_governed_document_version(v_gov, v_ovr_a, v_v1, 'duplicate');
  select count(*) into v_after from public.document_review_events
  where event_type = 'ovr_governed_version_linked' and version_id = v_v1;
  if v_result->>'created' <> 'false' or v_before <> v_after then raise exception 'CASE_08_IDEMPOTENT_AUDIT_FAILURE'; end if;
  v_result := public.link_ovr_governed_document_version(v_compliance, v_ovr_a, v_policy_v1, null);
  if v_result->>'created' <> 'true' then raise exception 'CASE_09_MULTIPLE_EXACT_DOCUMENT_LINK_FAILURE'; end if;
  v_result := public.link_ovr_governed_document_version(v_gov, v_ovr_a, v_v2, 'second exact SOP version');
  v_link_v2 := (v_result->>'link_id')::uuid;
  if (select count(*) from public.document_links where linked_item_id = v_ovr_a and linked_item_type = 'ovr') <> 3 then
    raise exception 'CASE_10_MULTIPLE_VERSION_LINK_FAILURE';
  end if;
  if v_before < 1 then raise exception 'CASE_11_LINK_AUDIT_FAILURE'; end if;

  -- 12-18: rejection matrix.
  foreach v_actor in array array[v_employee, v_manager, v_division, v_executive, v_auditor] loop
    v_threw := false;
    begin perform public.link_ovr_governed_document_version(v_actor, v_ovr_hidden, v_v1, null);
    exception when others then v_threw := sqlerrm like '%GLOBAL_GOVERNANCE_ROLE_REQUIRED%'; end;
    if not v_threw then raise exception 'CASE_12_16_NONCANONICAL_ROLE_ALLOWED: %', v_actor; end if;
  end loop;
  foreach v_actor in array array[v_null_org_role, v_wrong_org_role] loop
    v_threw := false;
    begin perform public.link_ovr_governed_document_version(v_actor, v_ovr_hidden, v_v1, null);
    exception when others then v_threw := sqlerrm like '%GLOBAL_GOVERNANCE_ROLE_REQUIRED%'; end;
    if not v_threw then raise exception 'CASE_17_18_ORG_ROLE_ALLOWED: %', v_actor; end if;
  end loop;

  v_threw := false;
  begin perform public.link_ovr_governed_document_version(v_gov, gen_random_uuid(), v_v1, null);
  exception when others then v_threw := sqlerrm like '%OVR_NOT_FOUND%'; end;
  if not v_threw then raise exception 'CASE_19_NONEXISTENT_OVR_ALLOWED'; end if;
  v_threw := false;
  begin perform public.link_ovr_governed_document_version(v_gov, v_ovr_a, gen_random_uuid(), null);
  exception when others then v_threw := sqlerrm like '%VERSION_NOT_FOUND%'; end;
  if not v_threw then raise exception 'CASE_20_NONEXISTENT_VERSION_ALLOWED'; end if;
  v_threw := false;
  begin perform public.link_ovr_governed_document_version(v_gov, v_ovr_a, v_other, null);
  exception when others then v_threw := sqlerrm like '%POLICY_OR_SOP_REQUIRED%'; end;
  if not v_threw then raise exception 'CASE_21_NON_POLICY_SOP_ALLOWED'; end if;
  v_threw := false;
  begin perform public.link_ovr_governed_document_version(v_gov, v_ovr_a, v_draft, null);
  exception when others then v_threw := sqlerrm like '%APPROVED_VERSION_REQUIRED%'; end;
  if not v_threw then raise exception 'CASE_22_DRAFT_ALLOWED'; end if;
  v_threw := false;
  begin perform public.link_ovr_governed_document_version(v_gov, v_ovr_a, v_mutable, null);
  exception when others then v_threw := sqlerrm like '%IMMUTABLE_VERSION_REQUIRED%'; end;
  if not v_threw then raise exception 'CASE_23_MUTABLE_ALLOWED'; end if;
  v_threw := false;
  begin perform public.link_ovr_governed_document_version(v_gov, v_ovr_cross, v_v1, null);
  exception when others then v_threw := sqlerrm like '%CROSS_ORGANIZATION_LINK_DENIED%'; end;
  if not v_threw then raise exception 'CASE_24_CROSS_ORG_ALLOWED'; end if;

  -- 25: the trigger independently rejects a version/document mismatch.
  v_threw := false;
  begin
    insert into public.document_links (document_id, version_id, linked_item_type, linked_item_id, link_type, created_by)
    values (v_doc_policy, v_v1, 'ovr', v_ovr_hidden, 'governed_version', v_gov);
  exception when others then v_threw := sqlerrm like '%DOCUMENT_VERSION_MISMATCH%'; end;
  if not v_threw then raise exception 'CASE_25_DOCUMENT_VERSION_MISMATCH_ALLOWED'; end if;

  -- 26-27: historical exact V1 survives V2 becoming current and superseding V1.
  update public.document_versions set is_current_version = false, superseded_by_version_id = v_v2 where id = v_v1;
  update public.document_versions set is_current_version = true, supersedes_version_id = v_v1 where id = v_v2;
  update public.controlled_documents set current_version_id = v_v2 where id = v_doc_sop;
  if not exists (
    select 1 from public.v_f1_ovr_governed_version_links
    where link_id = v_link_v1 and version_id = v_v1 and version_label = '1.0'
      and is_historical_version = true
  ) then raise exception 'CASE_26_HISTORICAL_V1_RETARGETED'; end if;
  v_result := public.link_ovr_governed_document_version(v_gov, v_ovr_hidden, v_v1, 'superseded target');
  v_hidden_link := (v_result->>'link_id')::uuid;
  if v_result->>'created' <> 'true' then raise exception 'CASE_27_SUPERSEDED_APPROVED_VERSION_DENIED'; end if;

  -- 28-31: unlink reason, wrong org, audit-before-delete, and successful removal.
  v_threw := false;
  begin perform public.unlink_ovr_governed_document_version(v_gov, v_link_v2, 'x');
  exception when others then v_threw := sqlerrm like '%REASON_LENGTH_REQUIRED%'; end;
  if not v_threw then raise exception 'CASE_28_SHORT_UNLINK_REASON_ALLOWED'; end if;
  v_threw := false;
  begin perform public.unlink_ovr_governed_document_version(v_wrong_org_role, v_link_v2, 'wrong organization correction');
  exception when others then v_threw := sqlerrm like '%GLOBAL_GOVERNANCE_ROLE_REQUIRED%'; end;
  if not v_threw then raise exception 'CASE_29_WRONG_ORG_UNLINK_ALLOWED'; end if;
  v_result := public.unlink_ovr_governed_document_version(v_gov, v_link_v2, 'duplicate version selected in error');
  if v_result->>'removed' <> 'true'
     or exists (select 1 from public.document_links where id = v_link_v2)
     or not exists (
       select 1 from public.document_review_events
       where event_type = 'ovr_governed_version_link_removed'
         and event_note::jsonb->>'link_id' = v_link_v2::text
         and rejection_reason = 'duplicate version selected in error'
     ) then raise exception 'CASE_30_31_UNLINK_AUDIT_FAILURE'; end if;

  -- Preserve IDs needed by authenticated RLS checks in session-local settings.
  perform set_config('f1.gov', v_gov::text, true);
  perform set_config('f1.employee', v_employee::text, true);
  perform set_config('f1.outsider', v_outsider::text, true);
  perform set_config('f1.org', v_org_a::text, true);
  perform set_config('f1.ovr', v_ovr_a::text, true);
  perform set_config('f1.link', v_link_v1::text, true);
  perform set_config('f1.version', v_v1::text, true);
  perform set_config('f1.hidden_link', v_hidden_link::text, true);
  perform set_config('f1.gov_session', v_gov_session::text, true);
  perform set_config('f1.employee_session', v_employee_session::text, true);
  perform set_config('f1.outsider_session', v_outsider_session::text, true);
  raise notice 'F1 BEHAVIORAL CASES 07-31 PASSED';
end;
$fixtures$;

-- 32: authenticated callers cannot execute any governed mutation RPC.
set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
do $rpc_acl$
declare v_threw boolean;
begin
  v_threw := false;
  begin perform public.get_f1_ovr_governed_version_link_capabilities();
  exception when insufficient_privilege then v_threw := true; end;
  if not v_threw then raise exception 'CASE_32_CAPABILITY_BROWSER_EXECUTE_ALLOWED'; end if;
  v_threw := false;
  begin perform public.link_ovr_governed_document_version(
    current_setting('f1.employee')::uuid, current_setting('f1.ovr')::uuid,
    current_setting('f1.version')::uuid, null
  ); exception when insufficient_privilege then v_threw := true; end;
  if not v_threw then raise exception 'CASE_32_LINK_BROWSER_EXECUTE_ALLOWED'; end if;
  v_threw := false;
  begin perform public.unlink_ovr_governed_document_version(
    current_setting('f1.employee')::uuid, current_setting('f1.link')::uuid, 'browser attempt'
  ); exception when insufficient_privilege then v_threw := true; end;
  if not v_threw then raise exception 'CASE_32_UNLINK_BROWSER_EXECUTE_ALLOWED'; end if;
end;
$rpc_acl$;
reset role;

-- 33: direct authenticated OVR INSERT/UPDATE/DELETE are denied, while a
-- same-org non-OVR legacy insert remains available.
select set_config('request.jwt.claims', jsonb_build_object(
  'role', 'authenticated',
  'sub', current_setting('f1.gov'),
  'organization_id', current_setting('f1.org'),
  'email', 'f1.gov@test.invalid',
  'session_id', current_setting('f1.gov_session'),
  'app_metadata', jsonb_build_object('credential_version', 1)
)::text, true);
select set_config('request.jwt.claim.sub', current_setting('f1.gov'), true);
select set_config('request.headers', '{"x-patch83u-frontend-contract-version":"patch83u-frontend-auth-first-v1"}', true);
set local role authenticated;
do $browser_dml$
declare
  v_threw boolean := false;
  v_rows integer;
begin
  begin
    insert into public.document_links (document_id, version_id, linked_item_type, linked_item_id, link_type, created_by)
    select document_id, version_id, 'ovr', gen_random_uuid(), 'governed_version', current_setting('f1.gov')::uuid
    from public.document_links where id = current_setting('f1.link')::uuid;
  exception when others then v_threw := true; end;
  if not v_threw then raise exception 'CASE_33_DIRECT_OVR_INSERT_ALLOWED'; end if;

  v_threw := false;
  begin
    update public.document_links set link_type = 'browser_bypass'
    where id = current_setting('f1.link')::uuid;
    get diagnostics v_rows = row_count;
  exception when insufficient_privilege then v_rows := 0; end;
  if v_rows <> 0 then raise exception 'CASE_33_DIRECT_OVR_UPDATE_ALLOWED'; end if;

  begin
    delete from public.document_links where id = current_setting('f1.link')::uuid;
    get diagnostics v_rows = row_count;
  exception when insufficient_privilege then v_rows := 0; end;
  if v_rows <> 0 then raise exception 'CASE_33_DIRECT_OVR_DELETE_ALLOWED'; end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'document_links'
      and policyname = 'document_links_org_write_patch26'
  ) then raise exception 'CASE_33_LEGACY_NON_OVR_POLICY_REMOVED'; end if;
end;
$browser_dml$;
reset role;

-- 34: exact-link SELECT follows existing OVR RLS, not organization membership.
select set_config('request.jwt.claims', jsonb_build_object(
  'role', 'authenticated',
  'sub', current_setting('f1.employee'),
  'organization_id', current_setting('f1.org'),
  'email', 'f1.employee@test.invalid',
  'session_id', current_setting('f1.employee_session'),
  'app_metadata', jsonb_build_object('credential_version', 1)
)::text, true);
select set_config('request.jwt.claim.sub', current_setting('f1.employee'), true);
select set_config('request.headers', '{"x-patch83u-frontend-contract-version":"patch83u-frontend-auth-first-v1"}', true);
set local role authenticated;
do $visible_reader$
begin
  if (select count(*) from public.v_f1_ovr_governed_version_links
      where ovr_id = current_setting('f1.ovr')::uuid) < 1 then
    raise exception 'CASE_34_VISIBLE_OVR_LINK_HIDDEN';
  end if;
  if exists (select 1 from public.v_f1_ovr_governed_version_links
      where link_id = current_setting('f1.hidden_link')::uuid) then
    raise exception 'CASE_34_HIDDEN_OVR_LINK_LEAKED';
  end if;
end;
$visible_reader$;
reset role;

-- 35: Patch83U still fails closed when there is no authenticated subject.
select set_config('request.jwt.claims', '{"role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', '', true);
set local role authenticated;
do $credential_gate$
begin
  if exists (select 1 from public.document_links) then
    raise exception 'CASE_35_PATCH83U_CREDENTIAL_GATE_BYPASSED';
  end if;
end;
$credential_gate$;
reset role;

do $$ begin raise notice 'ALL 35 F1 MIGRATION210 SECURITY/LIFECYCLE CASES DETERMINISTICALLY VERIFIED (PASSED).'; end $$;
rollback;
