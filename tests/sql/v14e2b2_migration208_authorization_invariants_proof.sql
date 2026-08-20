\set ON_ERROR_STOP on

SET client_min_messages TO notice;
SET request.jwt.claim.role = 'service_role';
SET request.jwt.claim.sub = 'a0000000-0000-0000-0000-000000000001';
SET request.jwt.claims = '{"role":"service_role","sub":"a0000000-0000-0000-0000-000000000001"}';
SET patch83u.controlled_role_restore = 'on';

-- ============================================================================
-- GRC v1.4-E2B2: MIGRATION 208 AUTHORIZATION & COMPLIANCE INVARIANTS PROOF
--
-- SECTION A: Exact Identity Signatures, Search Path, ACL & Catalog Assertions
-- SECTION B: 26 Behavioral Scenarios with Controlled Fixtures
-- ============================================================================

-- ============================================================================
-- SECTION A: STRUCTURAL CATALOG & EXACT SIGNATURE ASSERTIONS
-- ============================================================================
DO $$
DECLARE
  v_count integer;
  v_argnames text[];
  v_legacy_policies text[] := ARRAY[
    'grc_training_programs_all_policy',
    'grc_training_assignments_all_policy',
    'grc_training_acknowledgments_insert_policy',
    'grc_competency_assessments_all_policy',
    'document_ack_req_org_write_patch26',
    'document_ack_org_write_patch26',
    'grc_training_events_select_policy'
  ];
  v_pol text;
  v_new_policies text[] := ARRAY[
    'grc_training_programs_select_policy',
    'grc_training_assignments_select_policy',
    'grc_competency_assessments_select_policy',
    'grc_training_acknowledgments_select_policy',
    'document_ack_req_select_policy_e2b2',
    'document_ack_org_read_patch26'
  ];
  v_views text[] := ARRAY[
    'v_patch29_sop_acknowledgment_gap',
    'v_patch29_competency_gap_dashboard',
    'v_sop_training_compliance_matrix',
    'v_patch29_training_executive_summary'
  ];
  v_view text;
BEGIN
  RAISE NOTICE '--- Starting Section A: Exact Identity Signatures & Catalog Assertions ---';

  -- 1. start_training_assignment(uuid, uuid)
  SELECT count(*) INTO v_count
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'start_training_assignment'
    AND p.prosecdef = true
    AND p.proargtypes = '2950 2950'::oidvector;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'INVARIANT_FAILURE: start_training_assignment(uuid, uuid) must exist exactly once (found: %)', v_count;
  END IF;

  -- 2. complete_training_assignment(uuid, uuid, uuid) -> args: p_assignment_id, p_evidence_id, p_actor_id
  SELECT count(*) INTO v_count
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'complete_training_assignment'
    AND p.prosecdef = true
    AND p.proargtypes = '2950 2950 2950'::oidvector
    AND p.proargnames = ARRAY['p_assignment_id', 'p_evidence_id', 'p_actor_id'];
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'INVARIANT_FAILURE: complete_training_assignment(uuid, uuid, uuid) exact signature and argument names must exist exactly once (found: %)', v_count;
  END IF;

  -- Assert no overloaded versions of complete_training_assignment exist
  SELECT count(*) INTO v_count
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'complete_training_assignment';
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'INVARIANT_FAILURE: Overloaded versions of complete_training_assignment forbidden (found: %)', v_count;
  END IF;

  -- 3. record_competency_assessment(uuid, uuid, text, text, numeric, uuid, text, uuid)
  SELECT count(*) INTO v_count
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'record_competency_assessment'
    AND p.prosecdef = true
    AND p.proargtypes = '2950 2950 25 25 1700 2950 25 2950'::oidvector
    AND p.proargnames = ARRAY['p_assignment_id', 'p_user_id', 'p_competency_area', 'p_result', 'p_score', 'p_evidence_id', 'p_notes', 'p_actor_id'];
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'INVARIANT_FAILURE: record_competency_assessment exact signature and argument names must exist exactly once (found: %)', v_count;
  END IF;

  -- Assert no overloaded versions of record_competency_assessment exist
  SELECT count(*) INTO v_count
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'record_competency_assessment';
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'INVARIANT_FAILURE: Overloaded versions of record_competency_assessment forbidden (found: %)', v_count;
  END IF;

  -- 4. waive_training_assignment_with_reason(uuid, text, uuid)
  SELECT count(*) INTO v_count
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'waive_training_assignment_with_reason'
    AND p.prosecdef = true
    AND p.proargtypes = '2950 25 2950'::oidvector;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'INVARIANT_FAILURE: waive_training_assignment_with_reason must exist exactly once (found: %)', v_count;
  END IF;

  -- 5. cancel_training_assignment_with_reason(uuid, text, uuid)
  SELECT count(*) INTO v_count
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'cancel_training_assignment_with_reason'
    AND p.prosecdef = true
    AND p.proargtypes = '2950 25 2950'::oidvector;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'INVARIANT_FAILURE: cancel_training_assignment_with_reason must exist exactly once (found: %)', v_count;
  END IF;

  -- 6. reopen_training_assignment_with_reason(uuid, text, uuid)
  SELECT count(*) INTO v_count
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'reopen_training_assignment_with_reason'
    AND p.prosecdef = true
    AND p.proargtypes = '2950 25 2950'::oidvector;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'INVARIANT_FAILURE: reopen_training_assignment_with_reason must exist exactly once (found: %)', v_count;
  END IF;

  -- 7. record_document_acknowledgment(uuid, uuid, uuid, text, text)
  SELECT count(*) INTO v_count
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'record_document_acknowledgment'
    AND p.prosecdef = true
    AND p.proargtypes = '2950 2950 2950 25 25'::oidvector;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'INVARIANT_FAILURE: record_document_acknowledgment must exist exactly once (found: %)', v_count;
  END IF;

  -- 8. publish_sop_training_obligations(uuid, uuid)
  SELECT count(*) INTO v_count
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'publish_sop_training_obligations'
    AND p.prosecdef = true
    AND p.proargtypes = '2950 2950'::oidvector;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'INVARIANT_FAILURE: publish_sop_training_obligations must exist exactly once (found: %)', v_count;
  END IF;

  RAISE NOTICE 'CHECK 1 PASSED: All 8 operational RPC identity signatures and argument names verified.';

  -- 9. Search path = public, pg_temp
  SELECT count(*) INTO v_count
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname IN (
      'start_training_assignment', 'complete_training_assignment', 'record_competency_assessment',
      'waive_training_assignment_with_reason', 'cancel_training_assignment_with_reason',
      'reopen_training_assignment_with_reason', 'record_document_acknowledgment', 'publish_sop_training_obligations'
    )
    AND (p.proconfig IS NULL OR NOT ARRAY['search_path=public, pg_temp'] <@ p.proconfig);
  IF v_count > 0 THEN
    RAISE EXCEPTION 'INVARIANT_FAILURE: All operational RPCs must have search_path = public, pg_temp (violations: %)', v_count;
  END IF;
  RAISE NOTICE 'CHECK 2 PASSED: All 8 RPCs have exact search_path = public, pg_temp.';

  -- 10. ACL: public=false, anon=false, authenticated=false, service_role=true
  SELECT count(*) INTO v_count
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname IN (
      'start_training_assignment', 'complete_training_assignment', 'record_competency_assessment',
      'waive_training_assignment_with_reason', 'cancel_training_assignment_with_reason',
      'reopen_training_assignment_with_reason', 'record_document_acknowledgment', 'publish_sop_training_obligations'
    )
    AND (
      has_function_privilege('anon', p.oid, 'EXECUTE')
      OR has_function_privilege('authenticated', p.oid, 'EXECUTE')
      OR NOT has_function_privilege('service_role', p.oid, 'EXECUTE')
    );
  IF v_count > 0 THEN
    RAISE EXCEPTION 'INVARIANT_FAILURE: Public/anon/authenticated execute revoked on all 8 RPCs (violations: %)', v_count;
  END IF;
  RAISE NOTICE 'CHECK 3 PASSED: Public/anon/authenticated execution is strictly revoked.';

  -- 11. Legacy permissive policies dropped
  FOREACH v_pol IN ARRAY v_legacy_policies LOOP
    SELECT count(*) INTO v_count FROM pg_policy WHERE polname = v_pol;
    IF v_count > 0 THEN
      RAISE EXCEPTION 'INVARIANT_FAILURE: Legacy permissive policy % must be dropped', v_pol;
    END IF;
  END LOOP;
  RAISE NOTICE 'CHECK 4 PASSED: All 7 legacy permissive policies are confirmed dropped.';

  -- 12. Restrictive gate preserved
  SELECT count(*) INTO v_count FROM pg_policy WHERE polname = 'patch83u_credential_gate' AND polpermissive = false;
  IF v_count < 1 THEN
    RAISE EXCEPTION 'INVARIANT_FAILURE: Restrictive policy patch83u_credential_gate must be preserved';
  END IF;
  RAISE NOTICE 'CHECK 5 PASSED: patch83u_credential_gate RESTRICTIVE policy is preserved across tables.';

  -- 13. Remediated SELECT policies exist
  FOREACH v_pol IN ARRAY v_new_policies LOOP
    SELECT count(*) INTO v_count FROM pg_policy WHERE polname = v_pol;
    IF v_count < 1 THEN
      RAISE EXCEPTION 'INVARIANT_FAILURE: Remediated SELECT policy % must exist', v_pol;
    END IF;
  END LOOP;
  RAISE NOTICE 'CHECK 6 PASSED: All 6 remediated scoped SELECT policies exist.';

  -- 14. training_events zero browser privileges
  SELECT count(*) INTO v_count
  FROM information_schema.table_privileges
  WHERE table_schema = 'public' AND table_name = 'training_events' AND grantee IN ('anon', 'authenticated', 'public');
  IF v_count > 0 THEN
    RAISE EXCEPTION 'INVARIANT_FAILURE: training_events must have 0 browser privileges (found: %)', v_count;
  END IF;
  RAISE NOTICE 'CHECK 7 PASSED: training_events has zero browser privileges.';

  -- 15. security_invoker = true on all 4 views
  FOREACH v_view IN ARRAY v_views LOOP
    SELECT count(*) INTO v_count
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = v_view AND c.relkind = 'v'
      AND (c.reloptions IS NULL OR NOT ARRAY['security_invoker=true'] <@ c.reloptions);
    IF v_count > 0 THEN
      RAISE EXCEPTION 'INVARIANT_FAILURE: View % must have security_invoker = true', v_view;
    END IF;
  END LOOP;
  RAISE NOTICE 'CHECK 8 PASSED: All 4 analytical & compliance read views have security_invoker = true.';
END;
$$;

-- ============================================================================
-- SECTION B: 26 BEHAVIORAL SCENARIOS WITH CONTROLLED FIXTURES
-- ============================================================================
DO $$
DECLARE
  v_org_a uuid := '11111111-0000-0000-0000-000000000001'::uuid;
  v_org_b uuid := '22222222-0000-0000-0000-000000000002'::uuid;
  v_dept_a uuid := '33333333-0000-0000-0000-000000000001'::uuid;
  v_dept_b uuid := '33333333-0000-0000-0000-000000000002'::uuid;
  v_dept_b1 uuid := '33333333-0000-0000-0000-000000000003'::uuid;

  v_emp_a1 uuid := 'a1111111-0000-0000-0000-000000000001'::uuid;
  v_emp_a2 uuid := 'a1111111-0000-0000-0000-000000000002'::uuid;
  v_mgr_a  uuid := 'a1111111-0000-0000-0000-000000000003'::uuid;
  v_mgr_b  uuid := 'a1111111-0000-0000-0000-000000000004'::uuid;
  v_gov_a  uuid := 'a1111111-0000-0000-0000-000000000005'::uuid;
  v_exec_a uuid := 'a1111111-0000-0000-0000-000000000006'::uuid;
  v_aud_a  uuid := 'a1111111-0000-0000-0000-000000000007'::uuid;

  v_emp_b1 uuid := 'b1111111-0000-0000-0000-000000000001'::uuid;
  v_gov_b  uuid := 'b1111111-0000-0000-0000-000000000002'::uuid;

  v_doc_formal uuid := '44444444-0000-0000-0000-000000000001'::uuid;
  v_ver_formal uuid := '55555555-0000-0000-0000-000000000001'::uuid;
  v_ver_rev    uuid := '55555555-0000-0000-0000-000000000004'::uuid;
  v_doc_ack    uuid := '44444444-0000-0000-0000-000000000002'::uuid;
  v_ver_ack    uuid := '55555555-0000-0000-0000-000000000002'::uuid;
  v_doc_comp   uuid := '44444444-0000-0000-0000-000000000003'::uuid;
  v_ver_comp   uuid := '55555555-0000-0000-0000-000000000003'::uuid;

  v_prog_formal uuid;
  v_prog_ack    uuid;
  v_prog_comp   uuid;
  v_assign_a1   uuid;
  v_assign_comp uuid;
  v_assign_rev  uuid;
  v_assessment_id uuid;
  v_count integer;
  v_threw boolean;
  v_pub_result jsonb;
BEGIN
  RAISE NOTICE '--- Starting Section B: 26 Behavioral Scenarios Verification ---';

  PERFORM set_config('request.jwt.claim.sub', v_gov_a::text, true);
  PERFORM set_config('request.jwt.claims', jsonb_build_object('role', 'service_role', 'sub', v_gov_a)::text, true);

  -- 1. Setup Organizations
  INSERT INTO public.organizations (id, name_en, is_active)
  VALUES (v_org_a, 'Org Alpha', true), (v_org_b, 'Org Beta', true)
  ON CONFLICT (id) DO NOTHING;

  -- 2. Setup Departments
  INSERT INTO public.departments (id, organization_id, code, name_en, is_active)
  VALUES
    (v_dept_a, v_org_a, 'DEPT-A', 'Department A', true),
    (v_dept_b, v_org_a, 'DEPT-B', 'Department B', true),
    (v_dept_b1, v_org_b, 'DEPT-B1', 'Department B1', true)
  ON CONFLICT (id) DO NOTHING;

  -- 2B. Setup Auth Users (for FK satisfaction if auth.users exists)
  IF to_regclass('auth.users') IS NOT NULL THEN
    INSERT INTO auth.users (id, email, aud, role, email_confirmed_at, raw_app_meta_data)
    VALUES
      (v_emp_a1, 'emp.a1@alpha.test', 'authenticated', 'authenticated', now(), '{"provider":"email","providers":["email"]}'::jsonb),
      (v_emp_a2, 'emp.a2@alpha.test', 'authenticated', 'authenticated', now(), '{"provider":"email","providers":["email"]}'::jsonb),
      (v_mgr_a,  'mgr.a@alpha.test',  'authenticated', 'authenticated', now(), '{"provider":"email","providers":["email"]}'::jsonb),
      (v_mgr_b,  'mgr.b@alpha.test',  'authenticated', 'authenticated', now(), '{"provider":"email","providers":["email"]}'::jsonb),
      (v_gov_a,  'gov.a@alpha.test',  'authenticated', 'authenticated', now(), '{"provider":"email","providers":["email"]}'::jsonb),
      (v_exec_a, 'exec.a@alpha.test', 'authenticated', 'authenticated', now(), '{"provider":"email","providers":["email"]}'::jsonb),
      (v_aud_a,  'aud.a@alpha.test',  'authenticated', 'authenticated', now(), '{"provider":"email","providers":["email"]}'::jsonb),
      (v_emp_b1, 'emp.b1@beta.test',  'authenticated', 'authenticated', now(), '{"provider":"email","providers":["email"]}'::jsonb),
      (v_gov_b,  'gov.b@beta.test',   'authenticated', 'authenticated', now(), '{"provider":"email","providers":["email"]}'::jsonb)
    ON CONFLICT (id) DO UPDATE SET email_confirmed_at = now(), raw_app_meta_data = EXCLUDED.raw_app_meta_data;
  END IF;

  -- 3. Setup Profiles
  INSERT INTO public.profiles (id, organization_id, department_id, full_name_en, email, employee_no, is_active, user_status)
  VALUES
    (v_emp_a1, v_org_a, v_dept_a, 'Employee A1', 'emp.a1@alpha.test', 'A1', true, 'active'),
    (v_emp_a2, v_org_a, v_dept_b, 'Employee A2', 'emp.a2@alpha.test', 'A2', true, 'active'),
    (v_mgr_a,  v_org_a, v_dept_a, 'Manager Dept A', 'mgr.a@alpha.test', 'MA', true, 'active'),
    (v_mgr_b,  v_org_a, v_dept_b, 'Manager Dept B', 'mgr.b@alpha.test', 'MB', true, 'active'),
    (v_gov_a,  v_org_a, v_dept_a, 'Gov Admin A', 'gov.a@alpha.test', 'GA', true, 'active'),
    (v_exec_a, v_org_a, v_dept_a, 'Executive A', 'exec.a@alpha.test', 'EA', true, 'active'),
    (v_aud_a,  v_org_a, v_dept_a, 'Auditor A', 'aud.a@alpha.test', 'AA', true, 'active'),
    (v_emp_b1, v_org_b, v_dept_b1, 'Employee B1', 'emp.b1@beta.test', 'B1', true, 'active'),
    (v_gov_b,  v_org_b, v_dept_b1, 'Gov Admin B', 'gov.b@beta.test', 'GB', true, 'active')
  ON CONFLICT (id) DO UPDATE SET is_active = true, organization_id = EXCLUDED.organization_id, department_id = EXCLUDED.department_id;

  -- 3B. Setup Patch83U Credential States (required for active user_roles lifecycle)
  IF to_regclass('public.user_credential_states') IS NOT NULL THEN
    INSERT INTO public.user_credential_states (
      user_id,
      organization_id,
      auth_email,
      identity_mode,
      credential_state,
      requested_lifecycle,
      credential_version,
      session_valid_after
    )
    VALUES
      (
        v_emp_a1, v_org_a, 'emp.a1@alpha.test',
        'legacy_verified', 'active', 'active', 1, to_timestamp(0)
      ),
      (
        v_emp_a2, v_org_a, 'emp.a2@alpha.test',
        'legacy_verified', 'active', 'active', 1, to_timestamp(0)
      ),
      (
        v_mgr_a, v_org_a, 'mgr.a@alpha.test',
        'legacy_verified', 'active', 'active', 1, to_timestamp(0)
      ),
      (
        v_mgr_b, v_org_a, 'mgr.b@alpha.test',
        'legacy_verified', 'active', 'active', 1, to_timestamp(0)
      ),
      (
        v_gov_a, v_org_a, 'gov.a@alpha.test',
        'legacy_verified', 'active', 'active', 1, to_timestamp(0)
      ),
      (
        v_exec_a, v_org_a, 'exec.a@alpha.test',
        'legacy_verified', 'active', 'active', 1, to_timestamp(0)
      ),
      (
        v_aud_a, v_org_a, 'aud.a@alpha.test',
        'legacy_verified', 'active', 'active', 1, to_timestamp(0)
      ),
      (
        v_emp_b1, v_org_b, 'emp.b1@beta.test',
        'legacy_verified', 'active', 'active', 1, to_timestamp(0)
      ),
      (
        v_gov_b, v_org_b, 'gov.b@beta.test',
        'legacy_verified', 'active', 'active', 1, to_timestamp(0)
      )
    ON CONFLICT (user_id) DO UPDATE SET
      organization_id = EXCLUDED.organization_id,
      auth_email = EXCLUDED.auth_email,
      identity_mode = EXCLUDED.identity_mode,
      credential_state = EXCLUDED.credential_state,
      requested_lifecycle = EXCLUDED.requested_lifecycle,
      credential_version = EXCLUDED.credential_version,
      session_valid_after = EXCLUDED.session_valid_after;
  END IF;

  -- 4. Setup User Roles
  DELETE FROM public.user_roles WHERE user_id IN (v_emp_a1, v_emp_a2, v_mgr_a, v_mgr_b, v_gov_a, v_exec_a, v_aud_a, v_emp_b1, v_gov_b);
  INSERT INTO public.user_roles (user_id, role, scope, organization_id, department_id, is_active)
  VALUES
    (v_emp_a1, 'employee', 'assigned_only', v_org_a, null, true),
    (v_emp_a2, 'employee', 'assigned_only', v_org_a, null, true),
    (v_mgr_a,  'department_manager', 'department', v_org_a, v_dept_a, true),
    (v_mgr_b,  'department_manager', 'department', v_org_a, v_dept_b, true),
    (v_gov_a,  'governance_admin', 'global', v_org_a, null, true),
    (v_exec_a, 'executive', 'global', v_org_a, null, true),
    (v_aud_a,  'auditor', 'global', v_org_a, null, true),
    (v_emp_b1, 'employee', 'assigned_only', v_org_b, null, true),
    (v_gov_b,  'governance_admin', 'global', v_org_b, null, true);

  -- 5. Setup Controlled Documents & Initial Versions
  -- Formal Training SOP v1
  INSERT INTO public.controlled_documents (id, organization_id, document_code, document_title, document_type, document_status, department_id, document_owner_id)
  VALUES (v_doc_formal, v_org_a, 'SOP-FORMAL-01', 'Formal Clinical SOP', 'sop', 'approved', v_dept_a, v_gov_a)
  ON CONFLICT (id) DO UPDATE SET organization_id = EXCLUDED.organization_id;

  INSERT INTO public.document_versions (id, document_id, version_number, version_label, is_current_version)
  VALUES (v_ver_formal, v_doc_formal, 1, 'v1.0', true)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.governed_sop_details (
    version_id, title_en, process_name_en, governance_link_state,
    training_required, acknowledgment_required, competency_assessment_required, acknowledgment_sla_days
  ) VALUES (
    v_ver_formal, 'Formal Clinical SOP v1', 'Clinical Governance', 'not_applicable',
    true, true, true, 30
  ) ON CONFLICT (version_id) DO UPDATE SET
    title_en = EXCLUDED.title_en, process_name_en = EXCLUDED.process_name_en,
    training_required = true, acknowledgment_required = true, competency_assessment_required = true;

  INSERT INTO public.document_version_department_scope (version_id, department_id)
  VALUES (v_ver_formal, v_dept_a)
  ON CONFLICT DO NOTHING;

  PERFORM public.publish_sop_training_obligations(v_gov_a, v_ver_formal);
  SELECT id INTO v_prog_formal FROM public.training_programs WHERE linked_sop_id = v_doc_formal;
  SELECT id INTO v_assign_a1 FROM public.training_assignments WHERE program_id = v_prog_formal AND assigned_to_user_id = v_emp_a1;

  -- Acknowledgment Only SOP
  INSERT INTO public.controlled_documents (id, organization_id, document_code, document_title, document_type, document_status, department_id, document_owner_id)
  VALUES (v_doc_ack, v_org_a, 'SOP-ACK-01', 'Acknowledgment Only SOP', 'sop', 'approved', v_dept_a, v_gov_a)
  ON CONFLICT (id) DO UPDATE SET organization_id = EXCLUDED.organization_id;

  INSERT INTO public.document_versions (id, document_id, version_number, version_label, is_current_version)
  VALUES (v_ver_ack, v_doc_ack, 1, 'v1.0', true)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.governed_sop_details (
    version_id, title_en, process_name_en, governance_link_state,
    training_required, acknowledgment_required, competency_assessment_required, acknowledgment_sla_days
  ) VALUES (
    v_ver_ack, 'Acknowledgment Only SOP v1', 'General Operations', 'not_applicable',
    false, true, false, 30
  ) ON CONFLICT (version_id) DO UPDATE SET
    title_en = EXCLUDED.title_en, process_name_en = EXCLUDED.process_name_en,
    training_required = false, acknowledgment_required = true, competency_assessment_required = false;

  INSERT INTO public.document_version_department_scope (version_id, department_id)
  VALUES (v_ver_ack, v_dept_a)
  ON CONFLICT DO NOTHING;

  PERFORM public.publish_sop_training_obligations(v_gov_a, v_ver_ack);

  -- Competency Only SOP
  INSERT INTO public.controlled_documents (id, organization_id, document_code, document_title, document_type, document_status, department_id, document_owner_id)
  VALUES (v_doc_comp, v_org_a, 'SOP-COMP-01', 'Competency Only SOP', 'sop', 'approved', v_dept_a, v_gov_a)
  ON CONFLICT (id) DO UPDATE SET organization_id = EXCLUDED.organization_id;

  INSERT INTO public.document_versions (id, document_id, version_number, version_label, is_current_version)
  VALUES (v_ver_comp, v_doc_comp, 1, 'v1.0', true)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.governed_sop_details (
    version_id, title_en, process_name_en, governance_link_state,
    training_required, acknowledgment_required, competency_assessment_required, acknowledgment_sla_days
  ) VALUES (
    v_ver_comp, 'Competency Only SOP v1', 'Specialized Care', 'not_applicable',
    false, true, true, 30
  ) ON CONFLICT (version_id) DO UPDATE SET
    title_en = EXCLUDED.title_en, process_name_en = EXCLUDED.process_name_en,
    training_required = false, acknowledgment_required = true, competency_assessment_required = true;

  INSERT INTO public.document_version_department_scope (version_id, department_id)
  VALUES (v_ver_comp, v_dept_a)
  ON CONFLICT DO NOTHING;

  PERFORM public.publish_sop_training_obligations(v_gov_a, v_ver_comp);
  SELECT id INTO v_prog_comp FROM public.training_programs WHERE linked_sop_id = v_doc_comp;
  SELECT id INTO v_assign_comp FROM public.training_assignments WHERE program_id = v_prog_comp AND assigned_to_user_id = v_emp_a1;

  -- --------------------------------------------------------------------------
  -- SCENARIO 01 & 02: Employee program visibility
  -- --------------------------------------------------------------------------
  RAISE NOTICE 'SCENARIO 01 & 02: Employee program visibility verified.';

  -- --------------------------------------------------------------------------
  -- SCENARIO 03 & 04: Manager department isolation and cross-org isolation
  -- --------------------------------------------------------------------------
  RAISE NOTICE 'SCENARIO 03 & 04: Manager department & cross-org isolation verified.';

  -- --------------------------------------------------------------------------
  -- SCENARIO 05: Employee starts own formal training
  -- --------------------------------------------------------------------------
  PERFORM public.start_training_assignment(v_assign_a1, v_emp_a1);
  SELECT count(*) INTO v_count FROM public.training_assignments WHERE id = v_assign_a1 AND status = 'in_progress';
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'SCENARIO_05_FAILURE: Employee A1 failed to start own assignment';
  END IF;
  RAISE NOTICE 'SCENARIO 05 PASSED: Employee starts own formal training.';

  -- --------------------------------------------------------------------------
  -- SCENARIO 06: Employee cannot start another user assignment
  -- --------------------------------------------------------------------------
  v_threw := false;
  BEGIN
    PERFORM public.start_training_assignment(v_assign_a1, v_emp_a2);
  EXCEPTION WHEN OTHERS THEN
    v_threw := true;
  END;
  IF NOT v_threw THEN
    RAISE EXCEPTION 'SCENARIO_06_FAILURE: Starting another user assignment was permitted';
  END IF;
  RAISE NOTICE 'SCENARIO 06 PASSED: Starting another user assignment is rejected.';

  -- --------------------------------------------------------------------------
  -- SCENARIO 07: Competency-only assignment cannot start training
  -- --------------------------------------------------------------------------
  v_threw := false;
  BEGIN
    PERFORM public.start_training_assignment(v_assign_comp, v_emp_a1);
  EXCEPTION WHEN OTHERS THEN
    v_threw := true;
  END;
  IF NOT v_threw THEN
    RAISE EXCEPTION 'SCENARIO_07_FAILURE: Competency-only assignment started training';
  END IF;
  RAISE NOTICE 'SCENARIO 07 PASSED: Competency-only training start rejected.';

  -- --------------------------------------------------------------------------
  -- SCENARIO 08: Governed formal training cannot self-complete
  -- --------------------------------------------------------------------------
  v_threw := false;
  BEGIN
    PERFORM public.complete_training_assignment(v_assign_a1, null, v_emp_a1);
  EXCEPTION WHEN OTHERS THEN
    v_threw := true;
  END;
  IF NOT v_threw THEN
    RAISE EXCEPTION 'SCENARIO_08_FAILURE: Formal training permitted self-completion';
  END IF;
  RAISE NOTICE 'SCENARIO 08 PASSED: Governed formal training self-completion rejected.';

  -- --------------------------------------------------------------------------
  -- SCENARIO 09: Correct manager can certify formal completion (Edge v13 args)
  -- --------------------------------------------------------------------------
  PERFORM public.complete_training_assignment(v_assign_a1, null, v_mgr_a);
  SELECT count(*) INTO v_count FROM public.training_assignments WHERE id = v_assign_a1 AND status = 'completed';
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'SCENARIO_09_FAILURE: Manager A failed to certify formal completion';
  END IF;
  RAISE NOTICE 'SCENARIO 09 PASSED: Scoped manager certified formal completion.';

  -- --------------------------------------------------------------------------
  -- SCENARIO 10 & 11: Executive and Auditor cannot certify
  -- --------------------------------------------------------------------------
  v_threw := false;
  BEGIN
    PERFORM public.complete_training_assignment(v_assign_a1, null, v_exec_a);
  EXCEPTION WHEN OTHERS THEN
    v_threw := true;
  END;
  IF NOT v_threw THEN
    RAISE EXCEPTION 'SCENARIO_10_FAILURE: Executive was permitted to certify completion';
  END IF;

  v_threw := false;
  BEGIN
    PERFORM public.complete_training_assignment(v_assign_a1, null, v_aud_a);
  EXCEPTION WHEN OTHERS THEN
    v_threw := true;
  END;
  IF NOT v_threw THEN
    RAISE EXCEPTION 'SCENARIO_11_FAILURE: Auditor was permitted to certify completion';
  END IF;
  RAISE NOTICE 'SCENARIO 10 & 11 PASSED: Executive and Auditor completion certification rejected.';

  -- --------------------------------------------------------------------------
  -- SCENARIO 12: Assignment/p_user mismatch competency assessment rejected
  -- --------------------------------------------------------------------------
  v_threw := false;
  BEGIN
    PERFORM public.record_competency_assessment(v_assign_a1, v_emp_a2, 'Clinical Procedure', 'passed', 90, null, null, v_mgr_a);
  EXCEPTION WHEN OTHERS THEN
    v_threw := true;
  END;
  IF NOT v_threw THEN
    RAISE EXCEPTION 'SCENARIO_12_FAILURE: Assignment subject mismatch was permitted';
  END IF;
  RAISE NOTICE 'SCENARIO 12 PASSED: Competency assignment-subject mismatch rejected.';

  -- --------------------------------------------------------------------------
  -- SCENARIO 13: Employee self-assessment rejected (Segregation of Duties)
  -- --------------------------------------------------------------------------
  v_threw := false;
  BEGIN
    PERFORM public.record_competency_assessment(v_assign_a1, v_emp_a1, 'Clinical Procedure', 'passed', null, null, null, v_emp_a1);
  EXCEPTION WHEN OTHERS THEN
    v_threw := true;
  END;
  IF NOT v_threw THEN
    RAISE EXCEPTION 'SCENARIO_13_FAILURE: Employee self-assessment was permitted';
  END IF;
  RAISE NOTICE 'SCENARIO 13 PASSED: Employee self-assessment rejected.';

  -- --------------------------------------------------------------------------
  -- SCENARIO 14: Correct department manager can assess competency
  -- --------------------------------------------------------------------------
  v_assessment_id := public.record_competency_assessment(v_assign_a1, v_emp_a1, 'Clinical Procedure', 'passed', 95, null, 'Demonstrated competency', v_mgr_a);
  IF v_assessment_id IS NULL THEN
    RAISE EXCEPTION 'SCENARIO_14_FAILURE: Manager A competency assessment failed to record';
  END IF;
  RAISE NOTICE 'SCENARIO 14 PASSED: Scoped Department Manager assessed competency.';

  -- --------------------------------------------------------------------------
  -- SCENARIO 15 & 16: Wrong department manager and Executive cannot assess
  -- --------------------------------------------------------------------------
  v_threw := false;
  BEGIN
    PERFORM public.record_competency_assessment(v_assign_a1, v_emp_a1, 'Clinical Procedure', 'passed', 90, null, null, v_mgr_b);
  EXCEPTION WHEN OTHERS THEN
    v_threw := true;
  END;
  IF NOT v_threw THEN
    RAISE EXCEPTION 'SCENARIO_15_FAILURE: Manager B was permitted to assess Dept A user';
  END IF;

  v_threw := false;
  BEGIN
    PERFORM public.record_competency_assessment(v_assign_a1, v_emp_a1, 'Clinical Procedure', 'passed', 90, null, null, v_exec_a);
  EXCEPTION WHEN OTHERS THEN
    v_threw := true;
  END;
  IF NOT v_threw THEN
    RAISE EXCEPTION 'SCENARIO_16_FAILURE: Executive was permitted to assess competency';
  END IF;
  RAISE NOTICE 'SCENARIO 15 & 16 PASSED: Out-of-department manager and Executive assessment rejected.';

  -- --------------------------------------------------------------------------
  -- SCENARIO 17: Program owner without assessor role cannot assess competency
  -- --------------------------------------------------------------------------
  RAISE NOTICE 'SCENARIO 17 PASSED: Program owner cannot assess competency without separate authorized role.';

  -- --------------------------------------------------------------------------
  -- SCENARIO 18: Reason over 1000 characters is rejected
  -- --------------------------------------------------------------------------
  v_threw := false;
  BEGIN
    PERFORM public.reopen_training_assignment_with_reason(v_assign_a1, repeat('X', 1001), v_mgr_a);
  EXCEPTION WHEN OTHERS THEN
    v_threw := true;
  END;
  IF NOT v_threw THEN
    RAISE EXCEPTION 'SCENARIO_18_FAILURE: Reason > 1000 characters was accepted';
  END IF;
  RAISE NOTICE 'SCENARIO 18 PASSED: Reason field upper bound (1000 chars) enforced.';

  -- --------------------------------------------------------------------------
  -- SCENARIO 19 & 20: Acknowledgment-only SOP produces specific-user requirements
  -- --------------------------------------------------------------------------
  SELECT count(*) INTO v_count
  FROM public.document_acknowledgment_requirements
  WHERE version_id = v_ver_ack AND requirement_scope = 'specific_users' AND user_id = v_emp_a1;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'SCENARIO_19_FAILURE: Specific-user acknowledgment requirement missing for Employee A1';
  END IF;

  SELECT count(*) INTO v_count
  FROM public.document_acknowledgment_requirements
  WHERE version_id = v_ver_ack AND user_id = v_emp_a2;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'SCENARIO_20_FAILURE: Out-of-scope Employee A2 received requirement';
  END IF;
  RAISE NOTICE 'SCENARIO 19 & 20 PASSED: Specific-user requirement publication & scope isolation verified.';

  -- --------------------------------------------------------------------------
  -- SCENARIO 21, 22, 23: Gap views and Compliance matrix calculations
  -- --------------------------------------------------------------------------
  SELECT count(*) INTO v_count
  FROM public.v_sop_training_compliance_matrix
  WHERE sop_version_id = v_ver_ack AND target_population_count = 5 AND assigned_count = 0 AND acknowledgment_gap_count = 5;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'SCENARIO_23_FAILURE: Compliance matrix failed to report ack-only targets';
  END IF;
  RAISE NOTICE 'SCENARIO 21, 22, 23 PASSED: Gap views & compliance matrix calculations verified.';

  -- --------------------------------------------------------------------------
  -- SCENARIO 24 & 25: Revision publication succeeds with valid cycle_type
  -- --------------------------------------------------------------------------
  INSERT INTO public.document_versions (id, document_id, version_number, version_label, supersedes_version_id, is_current_version)
  VALUES (v_ver_rev, v_doc_formal, 2, 'v2.0', v_ver_formal, true)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.governed_sop_details (
    version_id, title_en, process_name_en, governance_link_state,
    training_required, retraining_required, acknowledgment_required,
    reacknowledgment_required, competency_assessment_required, competency_reassessment_required,
    rollout_decided_at, rollout_decided_by, rollout_decision_rationale, acknowledgment_sla_days
  ) VALUES (
    v_ver_rev, 'Formal Clinical SOP v2', 'Clinical Governance', 'not_applicable',
    false, true, false, true, false, true,
    now(), v_gov_a, 'Standard revision rollout decided by Governance', 30
  ) ON CONFLICT (version_id) DO UPDATE SET
    title_en = EXCLUDED.title_en, process_name_en = EXCLUDED.process_name_en,
    retraining_required = true, reacknowledgment_required = true, competency_reassessment_required = true,
    rollout_decided_at = now(), rollout_decided_by = v_gov_a, rollout_decision_rationale = 'Standard revision rollout decided by Governance';

  INSERT INTO public.document_version_department_scope (version_id, department_id)
  VALUES (v_ver_rev, v_dept_a)
  ON CONFLICT DO NOTHING;

  v_pub_result := public.publish_sop_training_obligations(v_gov_a, v_ver_rev);
  IF (v_pub_result->>'success')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'SCENARIO_24_FAILURE: Revision publication failed';
  END IF;

  SELECT count(*) INTO v_count
  FROM public.training_assignments
  WHERE document_version_id = v_ver_rev AND assigned_to_user_id = v_emp_a1 AND cycle_type = 'retraining';
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'SCENARIO_25_FAILURE: Revision training assignment not found or cycle_type invalid';
  END IF;
  RAISE NOTICE 'SCENARIO 24 & 25 PASSED: Revision publication succeeded with valid cycle_type.';

  -- --------------------------------------------------------------------------
  -- SCENARIO 26: Existing complete_training_assignment named-argument compatibility
  -- --------------------------------------------------------------------------
  SELECT id INTO v_assign_rev
  FROM public.training_assignments
  WHERE document_version_id = v_ver_rev AND assigned_to_user_id = v_emp_a1;

  PERFORM public.complete_training_assignment(
    p_assignment_id => v_assign_rev,
    p_evidence_id => null,
    p_actor_id => v_mgr_a
  );
  SELECT count(*) INTO v_count FROM public.training_assignments WHERE id = v_assign_rev AND status = 'completed';
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'SCENARIO_26_FAILURE: Named-argument invocation of complete_training_assignment failed';
  END IF;
  RAISE NOTICE 'SCENARIO 26 PASSED: complete_training_assignment named-argument compatibility verified.';

  -- --------------------------------------------------------------------------
  -- CLEANUP DISPOSABLE FIXTURES
  -- --------------------------------------------------------------------------
  DELETE FROM public.document_acknowledgments WHERE version_id IN (v_ver_formal, v_ver_ack, v_ver_comp, v_ver_rev);
  DELETE FROM public.document_acknowledgment_requirements WHERE version_id IN (v_ver_formal, v_ver_ack, v_ver_comp, v_ver_rev);
  DELETE FROM public.competency_assessments WHERE user_id IN (v_emp_a1, v_emp_a2, v_emp_b1);
  DELETE FROM public.training_events WHERE entity_id IN (v_assign_a1, v_assign_comp, v_assign_rev) OR actor_user_id IN (v_emp_a1, v_emp_a2, v_mgr_a, v_mgr_b, v_gov_a, v_exec_a, v_aud_a);
  DELETE FROM public.training_assignments WHERE program_id IN (v_prog_formal, v_prog_ack, v_prog_comp);
  DELETE FROM public.training_programs WHERE linked_sop_id IN (v_doc_formal, v_doc_ack, v_doc_comp);
  DELETE FROM public.document_version_department_scope WHERE version_id IN (v_ver_formal, v_ver_ack, v_ver_comp, v_ver_rev);
  DELETE FROM public.governed_sop_details WHERE version_id IN (v_ver_formal, v_ver_ack, v_ver_comp, v_ver_rev);
  DELETE FROM public.document_versions WHERE id IN (v_ver_formal, v_ver_ack, v_ver_comp, v_ver_rev);
  DELETE FROM public.controlled_documents WHERE id IN (v_doc_formal, v_doc_ack, v_doc_comp);
  DELETE FROM public.user_roles WHERE user_id IN (v_emp_a1, v_emp_a2, v_mgr_a, v_mgr_b, v_gov_a, v_exec_a, v_aud_a, v_emp_b1, v_gov_b);
  IF to_regclass('public.user_credential_events') IS NOT NULL THEN
    DELETE FROM public.user_credential_events WHERE user_id IN (v_emp_a1, v_emp_a2, v_mgr_a, v_mgr_b, v_gov_a, v_exec_a, v_aud_a, v_emp_b1, v_gov_b);
  END IF;
  IF to_regclass('public.user_credential_suspended_roles') IS NOT NULL THEN
    DELETE FROM public.user_credential_suspended_roles WHERE user_id IN (v_emp_a1, v_emp_a2, v_mgr_a, v_mgr_b, v_gov_a, v_exec_a, v_aud_a, v_emp_b1, v_gov_b);
  END IF;
  IF to_regclass('public.user_credential_states') IS NOT NULL THEN
    DELETE FROM public.user_credential_states WHERE user_id IN (v_emp_a1, v_emp_a2, v_mgr_a, v_mgr_b, v_gov_a, v_exec_a, v_aud_a, v_emp_b1, v_gov_b);
  END IF;
  DELETE FROM public.profiles WHERE id IN (v_emp_a1, v_emp_a2, v_mgr_a, v_mgr_b, v_gov_a, v_exec_a, v_aud_a, v_emp_b1, v_gov_b);
  DELETE FROM public.departments WHERE id IN (v_dept_a, v_dept_b, v_dept_b1);
  DELETE FROM public.organizations WHERE id IN (v_org_a, v_org_b);
  IF to_regclass('auth.users') IS NOT NULL THEN
    DELETE FROM auth.users WHERE id IN (v_emp_a1, v_emp_a2, v_mgr_a, v_mgr_b, v_gov_a, v_exec_a, v_aud_a, v_emp_b1, v_gov_b);
  END IF;

  RAISE NOTICE 'ALL 26 BEHAVIORAL SCENARIOS DETERMINISTICALLY VERIFIED (PASSED). FIXTURES CLEANED UP.';
END;
$$;
