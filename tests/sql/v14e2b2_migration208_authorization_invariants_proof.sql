\set ON_ERROR_STOP on

SET client_min_messages TO notice;
SET request.jwt.claim.role = 'service_role';
SET request.jwt.claim.sub = 'a0000000-0000-0000-0000-000000000001';
SET request.jwt.claims = '{"role":"service_role","sub":"a0000000-0000-0000-0000-000000000001"}';
SET patch83u.controlled_role_restore = 'on';

-- ============================================================================
-- GRC v1.4-E2B2: MIGRATION 208 AUTHORIZATION & COMPLIANCE INVARIANTS PROOF
--
-- Complete deterministic fail-closed SQL verification:
-- SECTION A: Structural Catalog & ACL Invariants
-- SECTION B: Behavioral Multi-Persona & Edge Contract Proof (Disposable Fixtures)
-- ============================================================================

-- ============================================================================
-- SECTION A: STRUCTURAL CATALOG & ACL INVARIANTS
-- ============================================================================
DO $$
DECLARE
  v_count integer;
  v_fn_names text[] := ARRAY[
    'start_training_assignment',
    'complete_training_assignment',
    'record_competency_assessment',
    'waive_training_assignment_with_reason',
    'cancel_training_assignment_with_reason',
    'reopen_training_assignment_with_reason',
    'record_document_acknowledgment',
    'publish_sop_training_obligations'
  ];
  v_fn text;
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
  RAISE NOTICE '--- Starting Section A: Structural Catalog & ACL Invariants ---';

  -- 1. Check all 8 functions exist and are SECURITY DEFINER
  FOREACH v_fn IN ARRAY v_fn_names LOOP
    SELECT count(*) INTO v_count
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = v_fn
      AND p.prosecdef = true;

    IF v_count < 1 THEN
      RAISE EXCEPTION 'INVARIANT_FAILURE: Function % must exist and be SECURITY DEFINER', v_fn;
    END IF;
  END LOOP;
  RAISE NOTICE 'CHECK 1 PASSED: All 8 operational RPCs exist and are SECURITY DEFINER.';

  -- 2. Exact search_path = public, pg_temp
  SELECT count(*) INTO v_count
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = ANY(v_fn_names)
    AND (p.proconfig IS NULL OR NOT ARRAY['search_path=public, pg_temp'] <@ p.proconfig);

  IF v_count > 0 THEN
    RAISE EXCEPTION 'INVARIANT_FAILURE: All operational RPCs must have search_path = public, pg_temp (violations: %)', v_count;
  END IF;
  RAISE NOTICE 'CHECK 2 PASSED: All 8 operational RPCs have exact search_path = public, pg_temp.';

  -- 3. ACL Verification: public=false, anon=false, authenticated=false, service_role=true
  SELECT count(*) INTO v_count
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = ANY(v_fn_names)
    AND (
      p.proacl IS NULL
      OR p.proacl::text LIKE '%=X/%'
      OR p.proacl::text LIKE '%anon=X/%'
      OR p.proacl::text LIKE '%authenticated=X/%'
    );

  IF v_count > 0 THEN
    RAISE EXCEPTION 'INVARIANT_FAILURE: Public/anon/authenticated execution must be revoked on all 8 RPCs (violations: %)', v_count;
  END IF;
  RAISE NOTICE 'CHECK 3 PASSED: Public, anon, and authenticated execution is strictly revoked.';

  -- 4. Check absence of legacy permissive write policies
  FOREACH v_pol IN ARRAY v_legacy_policies LOOP
    SELECT count(*) INTO v_count
    FROM pg_policy
    WHERE polname = v_pol;

    IF v_count > 0 THEN
      RAISE EXCEPTION 'INVARIANT_FAILURE: Legacy permissive policy % must be dropped', v_pol;
    END IF;
  END LOOP;
  RAISE NOTICE 'CHECK 4 PASSED: All 7 legacy permissive policies are confirmed dropped.';

  -- 5. Check preservation of Patch83U restrictive credential gate
  SELECT count(*) INTO v_count
  FROM pg_policy
  WHERE polname = 'patch83u_credential_gate'
    AND polpermissive = 'RESTRICTIVE';

  IF v_count < 1 THEN
    RAISE EXCEPTION 'INVARIANT_FAILURE: Restrictive policy patch83u_credential_gate must be preserved';
  END IF;
  RAISE NOTICE 'CHECK 5 PASSED: patch83u_credential_gate RESTRICTIVE policy is preserved across tables.';

  -- 6. Check existence of all 6 remediated scoped SELECT policies
  FOREACH v_pol IN ARRAY v_new_policies LOOP
    SELECT count(*) INTO v_count
    FROM pg_policy
    WHERE polname = v_pol;

    IF v_count < 1 THEN
      RAISE EXCEPTION 'INVARIANT_FAILURE: Remediated SELECT policy % must exist', v_pol;
    END IF;
  END LOOP;
  RAISE NOTICE 'CHECK 6 PASSED: All 6 remediated scoped SELECT policies exist.';

  -- 7. training_events direct browser access is completely absent
  SELECT count(*) INTO v_count
  FROM information_schema.table_privileges
  WHERE table_schema = 'public'
    AND table_name = 'training_events'
    AND grantee IN ('anon', 'authenticated', 'public');

  IF v_count > 0 THEN
    RAISE EXCEPTION 'INVARIANT_FAILURE: training_events must have 0 browser privileges (found: %)', v_count;
  END IF;
  RAISE NOTICE 'CHECK 7 PASSED: training_events has zero browser privileges.';

  -- 8. Verify security_invoker on all 4 reporting & compliance views
  FOREACH v_view IN ARRAY v_views LOOP
    SELECT count(*) INTO v_count
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = v_view
      AND c.relkind = 'v'
      AND (c.reloptions IS NULL OR NOT ARRAY['security_invoker=true'] <@ c.reloptions);

    IF v_count > 0 THEN
      RAISE EXCEPTION 'INVARIANT_FAILURE: View % must have security_invoker = true', v_view;
    END IF;
  END LOOP;
  RAISE NOTICE 'CHECK 8 PASSED: All 4 analytical & compliance read views have security_invoker = true.';
END;
$$;

-- ============================================================================
-- SECTION B: BEHAVIORAL MULTI-PERSONA & CONTRACT VERIFICATION
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
  v_doc_ack    uuid := '44444444-0000-0000-0000-000000000002'::uuid;
  v_ver_ack    uuid := '55555555-0000-0000-0000-000000000002'::uuid;
  v_doc_comp   uuid := '44444444-0000-0000-0000-000000000003'::uuid;
  v_ver_comp   uuid := '55555555-0000-0000-0000-000000000003'::uuid;

  v_prog_formal uuid;
  v_prog_ack    uuid;
  v_prog_comp   uuid;
  v_assign_a1   uuid;
  v_assign_comp uuid;
  v_assessment_id uuid;
  v_count integer;
  v_threw boolean;
BEGIN
  RAISE NOTICE '--- Starting Section B: Behavioral Multi-Persona & Contract Verification ---';

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

  -- 4. Setup User Roles
  DELETE FROM public.user_roles WHERE user_id IN (v_emp_a1, v_emp_a2, v_mgr_a, v_mgr_b, v_gov_a, v_exec_a, v_aud_a, v_emp_b1, v_gov_b);
  INSERT INTO public.user_roles (user_id, role, scope, organization_id, department_id, is_active)
  VALUES
    (v_emp_a1, 'employee', 'global', v_org_a, null, true),
    (v_emp_a2, 'employee', 'global', v_org_a, null, true),
    (v_mgr_a,  'department_manager', 'department', v_org_a, v_dept_a, true),
    (v_mgr_b,  'department_manager', 'department', v_org_a, v_dept_b, true),
    (v_gov_a,  'governance_admin', 'global', v_org_a, null, true),
    (v_exec_a, 'executive', 'global', v_org_a, null, true),
    (v_aud_a,  'auditor', 'global', v_org_a, null, true),
    (v_emp_b1, 'employee', 'global', v_org_b, null, true),
    (v_gov_b,  'governance_admin', 'global', v_org_b, null, true);

  -- 5. Setup Controlled Documents & SOP Details
  -- 5A. Formal Training SOP (Requires formal training + acknowledgment + competency)
  INSERT INTO public.controlled_documents (id, organization_id, document_code, document_title, document_type, document_status, department_id, document_owner_id)
  VALUES (v_doc_formal, v_org_a, 'SOP-FORMAL-01', 'Formal Clinical SOP', 'sop', 'published', v_dept_a, v_gov_a)
  ON CONFLICT (id) DO UPDATE SET organization_id = EXCLUDED.organization_id;

  INSERT INTO public.document_versions (id, document_id, version_number, version_label, status)
  VALUES (v_ver_formal, v_doc_formal, 1, 'v1.0', 'published')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.governed_sop_details (version_id, training_required, acknowledgment_required, competency_assessment_required, acknowledgment_sla_days)
  VALUES (v_ver_formal, true, true, true, 30)
  ON CONFLICT (version_id) DO UPDATE SET training_required = true, acknowledgment_required = true, competency_assessment_required = true;

  -- Department scope target for Formal SOP: only Dept A
  INSERT INTO public.document_version_department_scope (version_id, department_id)
  VALUES (v_ver_formal, v_dept_a)
  ON CONFLICT DO NOTHING;

  -- Publish Formal SOP obligations via service_role
  PERFORM public.publish_sop_training_obligations(v_gov_a, v_ver_formal);

  SELECT id INTO v_prog_formal FROM public.training_programs WHERE linked_sop_id = v_doc_formal;
  SELECT id INTO v_assign_a1 FROM public.training_assignments WHERE program_id = v_prog_formal AND assigned_to_user_id = v_emp_a1;

  IF v_assign_a1 IS NULL THEN
    RAISE EXCEPTION 'BEHAVIORAL_FAILURE: Assignment for Employee A1 was not created';
  END IF;

  -- 5B. Acknowledgment-Only SOP (No formal training, no competency)
  INSERT INTO public.controlled_documents (id, organization_id, document_code, document_title, document_type, document_status, department_id, document_owner_id)
  VALUES (v_doc_ack, v_org_a, 'SOP-ACK-01', 'Acknowledgment Only SOP', 'sop', 'published', v_dept_a, v_gov_a)
  ON CONFLICT (id) DO UPDATE SET organization_id = EXCLUDED.organization_id;

  INSERT INTO public.document_versions (id, document_id, version_number, version_label, status)
  VALUES (v_ver_ack, v_doc_ack, 1, 'v1.0', 'published')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.governed_sop_details (version_id, training_required, acknowledgment_required, competency_assessment_required, acknowledgment_sla_days)
  VALUES (v_ver_ack, false, true, false, 30)
  ON CONFLICT (version_id) DO UPDATE SET training_required = false, acknowledgment_required = true, competency_assessment_required = false;

  INSERT INTO public.document_version_department_scope (version_id, department_id)
  VALUES (v_ver_ack, v_dept_a)
  ON CONFLICT DO NOTHING;

  PERFORM public.publish_sop_training_obligations(v_gov_a, v_ver_ack);

  -- 5C. Competency-Only SOP (No formal training, acknowledgment true, competency true)
  INSERT INTO public.controlled_documents (id, organization_id, document_code, document_title, document_type, document_status, department_id, document_owner_id)
  VALUES (v_doc_comp, v_org_a, 'SOP-COMP-01', 'Competency Only SOP', 'sop', 'published', v_dept_a, v_gov_a)
  ON CONFLICT (id) DO UPDATE SET organization_id = EXCLUDED.organization_id;

  INSERT INTO public.document_versions (id, document_id, version_number, version_label, status)
  VALUES (v_ver_comp, v_doc_comp, 1, 'v1.0', 'published')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.governed_sop_details (version_id, training_required, acknowledgment_required, competency_assessment_required, acknowledgment_sla_days)
  VALUES (v_ver_comp, false, true, true, 30)
  ON CONFLICT (version_id) DO UPDATE SET training_required = false, acknowledgment_required = true, competency_assessment_required = true;

  INSERT INTO public.document_version_department_scope (version_id, department_id)
  VALUES (v_ver_comp, v_dept_a)
  ON CONFLICT DO NOTHING;

  PERFORM public.publish_sop_training_obligations(v_gov_a, v_ver_comp);
  SELECT id INTO v_prog_comp FROM public.training_programs WHERE linked_sop_id = v_doc_comp;
  SELECT id INTO v_assign_comp FROM public.training_assignments WHERE program_id = v_prog_comp AND assigned_to_user_id = v_emp_a1;

  -- --------------------------------------------------------------------------
  -- BEHAVIORAL ASSERTION 1: Employee starts own training assignment
  -- --------------------------------------------------------------------------
  PERFORM public.start_training_assignment(v_assign_a1, v_emp_a1);
  SELECT count(*) INTO v_count FROM public.training_assignments WHERE id = v_assign_a1 AND status = 'in_progress';
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'BEHAVIORAL_FAILURE: Employee A1 failed to start own training assignment';
  END IF;
  RAISE NOTICE 'BEHAVIORAL CHECK 1 PASSED: Employee starts own assignment.';

  -- --------------------------------------------------------------------------
  -- BEHAVIORAL ASSERTION 2: Employee cannot start another user''s assignment
  -- --------------------------------------------------------------------------
  v_threw := false;
  BEGIN
    PERFORM public.start_training_assignment(v_assign_a1, v_emp_a2);
  EXCEPTION WHEN OTHERS THEN
    v_threw := true;
  END;
  IF NOT v_threw THEN
    RAISE EXCEPTION 'BEHAVIORAL_FAILURE: Employee A2 was incorrectly permitted to start Employee A1 assignment';
  END IF;
  RAISE NOTICE 'BEHAVIORAL CHECK 2 PASSED: Starting another user''s assignment is rejected.';

  -- --------------------------------------------------------------------------
  -- BEHAVIORAL ASSERTION 3: Competency-only assignment rejects start_training
  -- --------------------------------------------------------------------------
  v_threw := false;
  BEGIN
    PERFORM public.start_training_assignment(v_assign_comp, v_emp_a1);
  EXCEPTION WHEN OTHERS THEN
    v_threw := true;
  END;
  IF NOT v_threw THEN
    RAISE EXCEPTION 'BEHAVIORAL_FAILURE: Competency-only assignment should reject start_training';
  END IF;
  RAISE NOTICE 'BEHAVIORAL CHECK 3 PASSED: Competency-only assignment correctly rejects training start.';

  -- --------------------------------------------------------------------------
  -- BEHAVIORAL ASSERTION 4: Governed formal training rejects self-completion
  -- --------------------------------------------------------------------------
  v_threw := false;
  BEGIN
    PERFORM public.complete_training_assignment(v_assign_a1, v_emp_a1);
  EXCEPTION WHEN OTHERS THEN
    v_threw := true;
  END;
  IF NOT v_threw THEN
    RAISE EXCEPTION 'BEHAVIORAL_FAILURE: Governed formal training permitted employee self-completion';
  END IF;
  RAISE NOTICE 'BEHAVIORAL CHECK 4 PASSED: Governed formal training self-completion is rejected.';

  -- --------------------------------------------------------------------------
  -- BEHAVIORAL ASSERTION 5: Executive cannot certify training completion
  -- --------------------------------------------------------------------------
  v_threw := false;
  BEGIN
    PERFORM public.complete_training_assignment(v_assign_a1, v_exec_a);
  EXCEPTION WHEN OTHERS THEN
    v_threw := true;
  END;
  IF NOT v_threw THEN
    RAISE EXCEPTION 'BEHAVIORAL_FAILURE: Executive was incorrectly permitted to certify completion';
  END IF;
  RAISE NOTICE 'BEHAVIORAL CHECK 5 PASSED: Executive certifier rejection verified.';

  -- --------------------------------------------------------------------------
  -- BEHAVIORAL ASSERTION 6: Auditor cannot certify training completion
  -- --------------------------------------------------------------------------
  v_threw := false;
  BEGIN
    PERFORM public.complete_training_assignment(v_assign_a1, v_aud_a);
  EXCEPTION WHEN OTHERS THEN
    v_threw := true;
  END;
  IF NOT v_threw THEN
    RAISE EXCEPTION 'BEHAVIORAL_FAILURE: Auditor was incorrectly permitted to certify completion';
  END IF;
  RAISE NOTICE 'BEHAVIORAL CHECK 6 PASSED: Auditor certifier rejection verified.';

  -- --------------------------------------------------------------------------
  -- BEHAVIORAL ASSERTION 7: Department Manager certifies formal completion
  -- --------------------------------------------------------------------------
  PERFORM public.complete_training_assignment(v_assign_a1, v_mgr_a);
  SELECT count(*) INTO v_count FROM public.training_assignments WHERE id = v_assign_a1 AND status = 'completed';
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'BEHAVIORAL_FAILURE: Manager A failed to certify formal completion';
  END IF;
  RAISE NOTICE 'BEHAVIORAL CHECK 7 PASSED: Department Manager certified formal completion.';

  -- --------------------------------------------------------------------------
  -- BEHAVIORAL ASSERTION 8: Employee cannot self-assess competency
  -- --------------------------------------------------------------------------
  v_threw := false;
  BEGIN
    PERFORM public.record_competency_assessment(v_assign_a1, v_emp_a1, 'Clinical Procedure', 'passed', null, null, null, v_emp_a1);
  EXCEPTION WHEN OTHERS THEN
    v_threw := true;
  END;
  IF NOT v_threw THEN
    RAISE EXCEPTION 'BEHAVIORAL_FAILURE: Employee self-assessment was incorrectly permitted';
  END IF;
  RAISE NOTICE 'BEHAVIORAL CHECK 8 PASSED: Segregation of duties on self-assessment verified.';

  -- --------------------------------------------------------------------------
  -- BEHAVIORAL ASSERTION 9: Department Manager A assesses Employee A1 competency
  -- --------------------------------------------------------------------------
  v_assessment_id := public.record_competency_assessment(v_assign_a1, v_emp_a1, 'Clinical Procedure', 'passed', 95, null, 'Demonstrated competency', v_mgr_a);
  IF v_assessment_id IS NULL THEN
    RAISE EXCEPTION 'BEHAVIORAL_FAILURE: Manager A competency assessment failed to record';
  END IF;
  RAISE NOTICE 'BEHAVIORAL CHECK 9 PASSED: Scoped Department Manager assessed competency.';

  -- --------------------------------------------------------------------------
  -- BEHAVIORAL ASSERTION 10: Wrong Department Manager B cannot assess Dept A user
  -- --------------------------------------------------------------------------
  v_threw := false;
  BEGIN
    PERFORM public.record_competency_assessment(v_assign_a1, v_emp_a1, 'Clinical Procedure', 'passed', 90, null, null, v_mgr_b);
  EXCEPTION WHEN OTHERS THEN
    v_threw := true;
  END;
  IF NOT v_threw THEN
    RAISE EXCEPTION 'BEHAVIORAL_FAILURE: Manager B was incorrectly permitted to assess Dept A user';
  END IF;
  RAISE NOTICE 'BEHAVIORAL CHECK 10 PASSED: Out-of-department manager assessment is rejected.';

  -- --------------------------------------------------------------------------
  -- BEHAVIORAL ASSERTION 11: Reason > 1000 characters is rejected
  -- --------------------------------------------------------------------------
  v_threw := false;
  BEGIN
    PERFORM public.reopen_training_assignment_with_reason(v_assign_a1, repeat('X', 1001), v_mgr_a);
  EXCEPTION WHEN OTHERS THEN
    v_threw := true;
  END;
  IF NOT v_threw THEN
    RAISE EXCEPTION 'BEHAVIORAL_FAILURE: Reason > 1000 characters was incorrectly accepted';
  END IF;
  RAISE NOTICE 'BEHAVIORAL CHECK 11 PASSED: Reason field upper bound (1000 chars) enforced.';

  -- --------------------------------------------------------------------------
  -- BEHAVIORAL ASSERTION 12: Reopen, Waive, and Cancel lifecycle mutations
  -- --------------------------------------------------------------------------
  PERFORM public.reopen_training_assignment_with_reason(v_assign_a1, 'Need refresher for new standard', v_mgr_a);
  SELECT status INTO v_count FROM public.training_assignments WHERE id = v_assign_a1;
  PERFORM public.waive_training_assignment_with_reason(v_assign_a1, 'Prior external certified qualification verified', v_mgr_a);
  SELECT count(*) INTO v_count FROM public.training_assignments WHERE id = v_assign_a1 AND status = 'waived';
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'BEHAVIORAL_FAILURE: Waiving assignment failed';
  END IF;

  PERFORM public.reopen_training_assignment_with_reason(v_assign_a1, 'Reopening for standard cycle', v_gov_a);
  PERFORM public.cancel_training_assignment_with_reason(v_assign_a1, 'Assignment cancelled due to transfer', v_mgr_a);
  SELECT count(*) INTO v_count FROM public.training_assignments WHERE id = v_assign_a1 AND status = 'cancelled';
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'BEHAVIORAL_FAILURE: Cancelling assignment failed';
  END IF;
  RAISE NOTICE 'BEHAVIORAL CHECK 12 PASSED: Reopen, waive, and cancel lifecycle mutations verified.';

  -- --------------------------------------------------------------------------
  -- BEHAVIORAL ASSERTION 13: Acknowledgment-only SOP creates specific_users req
  -- --------------------------------------------------------------------------
  SELECT count(*) INTO v_count
  FROM public.document_acknowledgment_requirements
  WHERE version_id = v_ver_ack AND requirement_scope = 'specific_users' AND user_id = v_emp_a1;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'BEHAVIORAL_FAILURE: Specific-user acknowledgment requirement not created for Employee A1';
  END IF;

  -- Out-of-scope employee in Dept B gets no requirement
  SELECT count(*) INTO v_count
  FROM public.document_acknowledgment_requirements
  WHERE version_id = v_ver_ack AND user_id = v_emp_a2;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'BEHAVIORAL_FAILURE: Out-of-scope Employee A2 received acknowledgment requirement';
  END IF;
  RAISE NOTICE 'BEHAVIORAL CHECK 13 PASSED: Specific-user acknowledgment publication & scope isolation verified.';

  -- --------------------------------------------------------------------------
  -- BEHAVIORAL ASSERTION 14: Compliance Matrix calculates correctly for ack-only
  -- --------------------------------------------------------------------------
  SELECT count(*) INTO v_count
  FROM public.v_sop_training_compliance_matrix
  WHERE sop_version_id = v_ver_ack AND target_population_count = 1 AND assigned_count = 0 AND acknowledgment_gap_count = 1;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'BEHAVIORAL_FAILURE: v_sop_training_compliance_matrix failed to calculate ack-only targets';
  END IF;
  RAISE NOTICE 'BEHAVIORAL CHECK 14 PASSED: Compliance matrix correctly reports acknowledgment-only SOP targets.';

  -- --------------------------------------------------------------------------
  -- CLEANUP DISPOSABLE FIXTURES
  -- --------------------------------------------------------------------------
  DELETE FROM public.document_acknowledgments WHERE version_id IN (v_ver_formal, v_ver_ack, v_ver_comp);
  DELETE FROM public.document_acknowledgment_requirements WHERE version_id IN (v_ver_formal, v_ver_ack, v_ver_comp);
  DELETE FROM public.competency_assessments WHERE user_id IN (v_emp_a1, v_emp_a2, v_emp_b1);
  DELETE FROM public.training_events WHERE entity_id IN (v_assign_a1, v_assign_comp) OR user_id IN (v_emp_a1, v_emp_a2, v_mgr_a, v_mgr_b, v_gov_a, v_exec_a, v_aud_a);
  DELETE FROM public.training_assignments WHERE program_id IN (v_prog_formal, v_prog_ack, v_prog_comp);
  DELETE FROM public.training_programs WHERE linked_sop_id IN (v_doc_formal, v_doc_ack, v_doc_comp);
  DELETE FROM public.document_version_department_scope WHERE version_id IN (v_ver_formal, v_ver_ack, v_ver_comp);
  DELETE FROM public.governed_sop_details WHERE version_id IN (v_ver_formal, v_ver_ack, v_ver_comp);
  DELETE FROM public.document_versions WHERE id IN (v_ver_formal, v_ver_ack, v_ver_comp);
  DELETE FROM public.controlled_documents WHERE id IN (v_doc_formal, v_doc_ack, v_doc_comp);
  DELETE FROM public.user_roles WHERE user_id IN (v_emp_a1, v_emp_a2, v_mgr_a, v_mgr_b, v_gov_a, v_exec_a, v_aud_a, v_emp_b1, v_gov_b);
  DELETE FROM public.profiles WHERE id IN (v_emp_a1, v_emp_a2, v_mgr_a, v_mgr_b, v_gov_a, v_exec_a, v_aud_a, v_emp_b1, v_gov_b);
  DELETE FROM public.departments WHERE id IN (v_dept_a, v_dept_b, v_dept_b1);
  DELETE FROM public.organizations WHERE id IN (v_org_a, v_org_b);

  RAISE NOTICE 'ALL BEHAVIORAL CHECKS DETERMINISTICALLY VERIFIED (PASSED). FIXTURES CLEANED UP.';
END;
$$;
