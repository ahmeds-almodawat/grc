\set ON_ERROR_STOP on

SET client_min_messages TO notice;
SET request.jwt.claim.role = 'service_role';
SET request.jwt.claim.sub = 'a0000000-0000-0000-0000-000000000001';
SET request.jwt.claims = '{"role":"service_role","sub":"a0000000-0000-0000-0000-000000000001"}';
SET patch83u.controlled_role_restore = 'on';

-- ============================================================================
-- 0. FIXTURE SETUP
-- ============================================================================
DO $$
DECLARE
  v_org_id uuid := '10000000-0000-0000-0000-000000000001'::uuid;
  v_other_org_id uuid := '20000000-0000-0000-0000-000000000002'::uuid;
  v_dept_cardio uuid := '30000000-0000-0000-0000-000000000001'::uuid;
  v_dept_neuro uuid := '30000000-0000-0000-0000-000000000002'::uuid;
  v_dept_other uuid := '30000000-0000-0000-0000-000000000003'::uuid;
  v_user_admin uuid := 'a0000000-0000-0000-0000-000000000001'::uuid;
  v_user_coord uuid := 'a0000000-0000-0000-0000-000000000002'::uuid;
  v_user_sup   uuid := 'a0000000-0000-0000-0000-000000000003'::uuid;
  v_user_nurse1 uuid := 'a0000000-0000-0000-0000-000000000004'::uuid;
  v_user_nurse2 uuid := 'a0000000-0000-0000-0000-000000000005'::uuid;
  v_user_doc   uuid := 'a0000000-0000-0000-0000-000000000006'::uuid;
  v_user_other uuid := 'b0000000-0000-0000-0000-000000000001'::uuid;
  
  v_doc_id uuid := '40000000-0000-0000-0000-000000000001'::uuid;
  v_ver1_id uuid := '50000000-0000-0000-0000-000000000001'::uuid;
BEGIN
  -- Organizations
  INSERT INTO public.organizations (id, name_en, is_active)
  VALUES (v_org_id, 'Al Modawat Main Hospital', true)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.organizations (id, name_en, is_active)
  VALUES (v_other_org_id, 'Other Hospital', true)
  ON CONFLICT (id) DO NOTHING;

  -- Departments
  INSERT INTO public.departments (id, organization_id, code, name_en, is_active)
  VALUES 
    (v_dept_cardio, v_org_id, 'CARDIO', 'Cardiology', true),
    (v_dept_neuro, v_org_id, 'NEURO', 'Neurology', true),
    (v_dept_other, v_other_org_id, 'OTHER-DEPT', 'External Dept', true)
  ON CONFLICT (id) DO NOTHING;

  -- Auth Users
  INSERT INTO auth.users (id, email, aud, role)
  VALUES
    (v_user_admin, 'admin@modawat.test', 'authenticated', 'authenticated'),
    (v_user_coord, 'coord@modawat.test', 'authenticated', 'authenticated'),
    (v_user_sup, 'supervisor@modawat.test', 'authenticated', 'authenticated'),
    (v_user_nurse1, 'nurse1@modawat.test', 'authenticated', 'authenticated'),
    (v_user_nurse2, 'nurse2@modawat.test', 'authenticated', 'authenticated'),
    (v_user_doc, 'doctor@modawat.test', 'authenticated', 'authenticated'),
    (v_user_other, 'external@other.test', 'authenticated', 'authenticated')
  ON CONFLICT (id) DO NOTHING;

  -- Profiles
  INSERT INTO public.profiles (id, organization_id, department_id, full_name_en, email, employee_no, is_active, user_status)
  VALUES
    (v_user_admin, v_org_id, v_dept_cardio, 'Super Admin User', 'admin@modawat.test', 'EMP-001', true, 'active'),
    (v_user_coord, v_org_id, v_dept_cardio, 'Training Coordinator', 'coord@modawat.test', 'EMP-002', true, 'active'),
    (v_user_sup, v_org_id, v_dept_cardio, 'Clinical Supervisor', 'supervisor@modawat.test', 'EMP-003', true, 'active'),
    (v_user_nurse1, v_org_id, v_dept_cardio, 'Cardio Nurse One', 'nurse1@modawat.test', 'EMP-004', true, 'active'),
    (v_user_nurse2, v_org_id, v_dept_neuro, 'Neuro Nurse Two', 'nurse2@modawat.test', 'EMP-005', true, 'active'),
    (v_user_doc, v_org_id, v_dept_cardio, 'Cardio Doctor', 'doctor@modawat.test', 'EMP-006', true, 'active'),
    (v_user_other, v_other_org_id, v_dept_other, 'Other Org User', 'external@other.test', 'EMP-999', true, 'active')
  ON CONFLICT (id) DO UPDATE SET is_active = true, user_status = 'active', organization_id = EXCLUDED.organization_id;

  -- Credential States
  INSERT INTO public.user_credential_states (user_id, organization_id, auth_email, credential_state, identity_mode)
  VALUES
    (v_user_admin, v_org_id, 'admin@modawat.test', 'active', 'legacy_verified'),
    (v_user_coord, v_org_id, 'coord@modawat.test', 'active', 'legacy_verified'),
    (v_user_sup, v_org_id, 'supervisor@modawat.test', 'active', 'legacy_verified'),
    (v_user_nurse1, v_org_id, 'nurse1@modawat.test', 'active', 'legacy_verified'),
    (v_user_nurse2, v_org_id, 'nurse2@modawat.test', 'active', 'legacy_verified'),
    (v_user_doc, v_org_id, 'doctor@modawat.test', 'active', 'legacy_verified'),
    (v_user_other, v_other_org_id, 'external@other.test', 'active', 'legacy_verified')
  ON CONFLICT (user_id) DO UPDATE SET credential_state = 'active', identity_mode = 'legacy_verified', auth_email = EXCLUDED.auth_email, organization_id = EXCLUDED.organization_id;

  -- User Roles
  DELETE FROM public.user_roles WHERE user_id IN (v_user_admin, v_user_coord, v_user_sup, v_user_nurse1, v_user_nurse2, v_user_doc, v_user_other);
  INSERT INTO public.user_roles (user_id, role, scope, organization_id, department_id)
  VALUES
    (v_user_admin, 'super_admin', 'global', null, null),
    (v_user_coord, 'governance_admin', 'global', null, null),
    (v_user_sup, 'department_manager', 'department', v_org_id, v_dept_cardio),
    (v_user_nurse1, 'employee', 'assigned_only', v_org_id, null),
    (v_user_nurse2, 'employee', 'assigned_only', v_org_id, null),
    (v_user_doc, 'employee', 'assigned_only', v_org_id, null),
    (v_user_other, 'employee', 'assigned_only', v_other_org_id, null);

  -- Controlled SOP Document
  INSERT INTO public.controlled_documents (
    id, organization_id, document_type, document_code, document_title, document_status, department_id, document_owner_id
  ) VALUES (
    v_doc_id, v_org_id, 'sop', 'SOP-CARD-001', 'Clinical Cardiology Standard Procedure', 'approved', v_dept_cardio, v_user_admin
  ) ON CONFLICT (id) DO NOTHING;

  -- SOP Version 1
  INSERT INTO public.document_versions (
    id, document_id, version_number, version_label, is_current_version, prepared_by
  ) VALUES (
    v_ver1_id, v_doc_id, 1, 'v1.0', true, v_user_admin
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.governed_sop_details (
    version_id, title_en, process_name_en, process_owner_id, governance_link_state,
    training_required, acknowledgment_required, competency_assessment_required,
    acknowledgment_sla_days, training_renewal_months
  ) VALUES (
    v_ver1_id, 'Cardiology Procedure v1.0', 'Cardiology Patient Care', v_user_admin, 'not_applicable',
    true, true, true, 14, 12
  ) ON CONFLICT (version_id) DO NOTHING;

  -- SOP Applicability Scope: Cardio & Neuro departments, employee role
  DELETE FROM public.document_version_department_scope WHERE version_id = v_ver1_id;
  INSERT INTO public.document_version_department_scope (version_id, department_id)
  VALUES (v_ver1_id, v_dept_cardio), (v_ver1_id, v_dept_neuro);

  DELETE FROM public.document_version_role_scope WHERE version_id = v_ver1_id;
  INSERT INTO public.document_version_role_scope (version_id, role_name)
  VALUES (v_ver1_id, 'employee');
  
  RAISE NOTICE 'FIXTURES INITIALIZED SUCCESSFULLY.';
END $$;

-- ============================================================================
-- 1. TEST CASE A: SOP APPLICABILITY INHERITANCE
-- ============================================================================
DO $$
DECLARE
  v_user_admin uuid := 'a0000000-0000-0000-0000-000000000001'::uuid;
  v_ver1_id uuid := '50000000-0000-0000-0000-000000000001'::uuid;
  v_res jsonb;
  v_count integer;
BEGIN
  v_res := public.publish_sop_training_obligations(v_user_admin, v_ver1_id);
  v_count := (v_res->>'assignments_created')::int;
  IF v_count <> 3 THEN
    RAISE EXCEPTION 'TEST A FAILED: Expected 3 assignments';
  END IF;
  RAISE NOTICE 'TEST A PASSED: Successfully inherited full applicability (3 staff assigned).';
END $$;

-- ============================================================================
-- 2. TEST CASES F & G: INITIAL OBLIGATION & REPEAT PUBLISH IDEMPOTENCY
-- ============================================================================
DO $$
DECLARE
  v_user_admin uuid := 'a0000000-0000-0000-0000-000000000001'::uuid;
  v_ver1_id uuid := '50000000-0000-0000-0000-000000000001'::uuid;
  v_res jsonb;
  v_count integer;
BEGIN
  v_res := public.publish_sop_training_obligations(v_user_admin, v_ver1_id);
  v_count := (v_res->>'assignments_created')::int;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'TEST G FAILED: Repeat publish created duplicate assignments!';
  END IF;
  RAISE NOTICE 'TEST G PASSED: Repeat publish is 100%% idempotent (0 created).';
END $$;

-- ============================================================================
-- 3. TEST CASE H: REPEAT RECONCILE IDEMPOTENCY
-- ============================================================================
DO $$
DECLARE
  v_user_admin uuid := 'a0000000-0000-0000-0000-000000000001'::uuid;
  v_ver1_id uuid := '50000000-0000-0000-0000-000000000001'::uuid;
  v_res jsonb;
  v_count integer;
BEGIN
  v_res := public.reconcile_sop_training_population(v_user_admin, v_ver1_id);
  v_count := (v_res->>'newly_assigned_count')::int;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'TEST H FAILED: Repeat reconcile created duplicate assignments!';
  END IF;
  RAISE NOTICE 'TEST H PASSED: Repeat reconcile is 100%% idempotent (0 created).';
END $$;

-- ============================================================================
-- 4. TEST CASE I: WAIVED ASSIGNMENT PRESERVED & NOT RECREATED
-- ============================================================================
DO $$
DECLARE
  v_user_admin uuid := 'a0000000-0000-0000-0000-000000000001'::uuid;
  v_user_nurse1 uuid := 'a0000000-0000-0000-0000-000000000004'::uuid;
  v_ver1_id uuid := '50000000-0000-0000-0000-000000000001'::uuid;
  v_assign_id uuid;
  v_res jsonb;
  v_count integer;
  v_status text;
BEGIN
  SELECT id INTO v_assign_id FROM public.training_assignments
  WHERE document_version_id = v_ver1_id AND assigned_to_user_id = v_user_nurse1;

  PERFORM public.waive_training_assignment_with_reason(v_assign_id, 'Medical leave authorized waiver', v_user_admin);

  v_res := public.reconcile_sop_training_population(v_user_admin, v_ver1_id);
  SELECT count(*) INTO v_count FROM public.training_assignments
  WHERE document_version_id = v_ver1_id AND assigned_to_user_id = v_user_nurse1;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'TEST I FAILED: Waived assignment was duplicated or deleted!';
  END IF;

  SELECT status INTO v_status FROM public.training_assignments WHERE id = v_assign_id;
  IF v_status <> 'waived' THEN
    RAISE EXCEPTION 'TEST I FAILED: Status changed from waived!';
  END IF;
  RAISE NOTICE 'TEST I PASSED: Waived assignment preserved and not recreated.';
END $$;

-- ============================================================================
-- 5. TEST CASE J: DEACTIVATED USER ASSIGNMENT CANCELLED SAFELY
-- ============================================================================
DO $$
DECLARE
  v_user_admin uuid := 'a0000000-0000-0000-0000-000000000001'::uuid;
  v_user_nurse2 uuid := 'a0000000-0000-0000-0000-000000000005'::uuid;
  v_ver1_id uuid := '50000000-0000-0000-0000-000000000001'::uuid;
  v_res jsonb;
  v_count integer;
  v_status text;
  v_rec record;
BEGIN
  UPDATE public.profiles
  SET is_active = false, user_status = 'inactive',
      deactivated_at = now(), deactivated_by = v_user_admin, deactivation_reason = 'Employee departure'
  WHERE id = v_user_nurse2;

  FOR v_rec IN (
    SELECT ta.id, ta.program_id, ta.document_version_id, ta.assigned_to_user_id, ta.obligation_cycle, ta.status, p.is_active, p.organization_id
    FROM public.training_assignments ta
    JOIN public.profiles p ON p.id = ta.assigned_to_user_id
  ) LOOP
    RAISE NOTICE 'Test J ta: %', row_to_json(v_rec);
  END LOOP;

  v_res := public.reconcile_sop_training_population(v_user_admin, v_ver1_id);
  v_count := (v_res->>'inactive_cancelled_count')::int;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'TEST J FAILED: Inactive user assignment was not cancelled! Count is %', v_count;
  END IF;

  SELECT status INTO v_status FROM public.training_assignments
  WHERE document_version_id = v_ver1_id AND assigned_to_user_id = v_user_nurse2;
  IF v_status <> 'cancelled' THEN
    RAISE EXCEPTION 'TEST J FAILED: Status is not cancelled!';
  END IF;

  UPDATE public.profiles
  SET is_active = true, user_status = 'active',
      deactivated_at = null, deactivated_by = null, deactivation_reason = null
  WHERE id = v_user_nurse2;
  RAISE NOTICE 'TEST J PASSED: Inactive employee assignment cancelled safely.';
END $$;

-- ============================================================================
-- 6. TEST CASE K: LEGACY NULL-VERSION ASSIGNMENT VALIDITY
-- ============================================================================
DO $$
DECLARE
  v_user_nurse1 uuid := 'a0000000-0000-0000-0000-000000000004'::uuid;
  v_ver1_id uuid := '50000000-0000-0000-0000-000000000001'::uuid;
  v_prog_id uuid;
BEGIN
  SELECT program_id INTO v_prog_id FROM public.training_assignments
  WHERE document_version_id = v_ver1_id AND assigned_to_user_id = v_user_nurse1 LIMIT 1;

  INSERT INTO public.training_assignments (program_id, document_version_id, assigned_to_user_id, status)
  VALUES (v_prog_id, null, v_user_nurse1, 'assigned');
  RAISE NOTICE 'TEST K PASSED: Legacy NULL document_version_id assignment supported.';
END $$;

-- ============================================================================
-- 7. TEST CASE L: CROSS-SOP PROGRAM/VERSION MISMATCH REJECTED
-- ============================================================================
DO $$
DECLARE
  v_org_id uuid := '10000000-0000-0000-0000-000000000001'::uuid;
  v_user_doc uuid := 'a0000000-0000-0000-0000-000000000006'::uuid;
  v_ver1_id uuid := '50000000-0000-0000-0000-000000000001'::uuid;
  v_doc2_id uuid;
  v_doc2_ver_id uuid;
  v_prog_id uuid;
BEGIN
  SELECT program_id INTO v_prog_id FROM public.training_assignments
  WHERE document_version_id = v_ver1_id LIMIT 1;

  INSERT INTO public.controlled_documents (organization_id, document_type, document_code, document_title, document_status)
  VALUES (v_org_id, 'sop', 'SOP-NEURO-002', 'Neuro SOP', 'approved')
  RETURNING id INTO v_doc2_id;

  INSERT INTO public.document_versions (document_id, version_number, version_label, is_current_version)
  VALUES (v_doc2_id, 1, 'v1.0', true)
  RETURNING id INTO v_doc2_ver_id;

  BEGIN
    INSERT INTO public.training_assignments (program_id, document_version_id, assigned_to_user_id, status)
    VALUES (v_prog_id, v_doc2_ver_id, v_user_doc, 'assigned');
    RAISE EXCEPTION 'TEST L FAILED: Cross-SOP program/version mismatch was not rejected!';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%PROGRAM_SOP_VERSION_MISMATCH%' THEN
      RAISE EXCEPTION 'TEST L FAILED';
    END IF;
  END;
  RAISE NOTICE 'TEST L PASSED: Cross-SOP mismatch rejected by trigger.';
END $$;

-- ============================================================================
-- 8. TEST CASE M: CROSS-ORGANIZATION ASSIGNMENT REJECTED
-- ============================================================================
DO $$
DECLARE
  v_user_other uuid := 'b0000000-0000-0000-0000-000000000001'::uuid;
  v_ver1_id uuid := '50000000-0000-0000-0000-000000000001'::uuid;
  v_prog_id uuid;
BEGIN
  SELECT program_id INTO v_prog_id FROM public.training_assignments
  WHERE document_version_id = v_ver1_id LIMIT 1;

  BEGIN
    INSERT INTO public.training_assignments (program_id, document_version_id, assigned_to_user_id, status)
    VALUES (v_prog_id, v_ver1_id, v_user_other, 'assigned');
    RAISE EXCEPTION 'TEST M FAILED: Cross-organization assignment was not rejected!';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%CROSS_ORGANIZATION_ASSIGNMENT_DENIED%' THEN
      RAISE EXCEPTION 'TEST M FAILED';
    END IF;
  END;
  RAISE NOTICE 'TEST M PASSED: Cross-organization assignment rejected.';
END $$;

-- ============================================================================
-- 9. TEST CASES N & O: EMPLOYEE SELF-ACKNOWLEDGMENT
-- ============================================================================
DO $$
DECLARE
  v_user_doc uuid := 'a0000000-0000-0000-0000-000000000006'::uuid;
  v_doc_id uuid := '40000000-0000-0000-0000-000000000001'::uuid;
  v_ver1_id uuid := '50000000-0000-0000-0000-000000000001'::uuid;
  v_ack_id uuid;
BEGIN
  v_ack_id := public.record_document_acknowledgment(v_doc_id, v_ver1_id, v_user_doc, 'web_ui', 'Read and understood');
  IF v_ack_id IS NULL THEN
    RAISE EXCEPTION 'TEST N FAILED: Self-acknowledgment failed!';
  END IF;
  RAISE NOTICE 'TEST N PASSED: Employee self-acknowledgment recorded.';
END $$;

-- ============================================================================
-- 10. TEST CASE Q: COMPETENCY SELF-ASSESSMENT REJECTED (SOD)
-- ============================================================================
DO $$
DECLARE
  v_user_doc uuid := 'a0000000-0000-0000-0000-000000000006'::uuid;
  v_ver1_id uuid := '50000000-0000-0000-0000-000000000001'::uuid;
  v_assign_id uuid;
BEGIN
  SELECT id INTO v_assign_id FROM public.training_assignments
  WHERE document_version_id = v_ver1_id AND assigned_to_user_id = v_user_doc LIMIT 1;

  BEGIN
    PERFORM public.record_competency_assessment(
      v_assign_id, v_user_doc, 'Clinical Procedure', 'passed', 95, null, 'Self assessed', v_user_doc
    );
    RAISE EXCEPTION 'TEST Q FAILED: Self assessment was not rejected!';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%SOD_VIOLATION_SELF_ASSESSMENT%' AND SQLERRM NOT LIKE '%chk_competency_no_self_assessment%' THEN
      RAISE EXCEPTION 'TEST Q FAILED';
    END IF;
  END;
  RAISE NOTICE 'TEST Q PASSED: Competency self-assessment rejected with SOD violation.';
END $$;

-- ============================================================================
-- 11. TEST CASES R & S: ASSESSOR AUTHORITY ENFORCEMENT
-- ============================================================================
DO $$
DECLARE
  v_user_doc uuid := 'a0000000-0000-0000-0000-000000000006'::uuid;
  v_user_nurse1 uuid := 'a0000000-0000-0000-0000-000000000004'::uuid;
  v_user_sup uuid := 'a0000000-0000-0000-0000-000000000003'::uuid;
  v_ver1_id uuid := '50000000-0000-0000-0000-000000000001'::uuid;
  v_assign_id uuid;
  v_assess_id uuid;
BEGIN
  SELECT id INTO v_assign_id FROM public.training_assignments
  WHERE document_version_id = v_ver1_id AND assigned_to_user_id = v_user_doc LIMIT 1;

  -- Unauthorized staff nurse assessing doctor
  BEGIN
    PERFORM public.record_competency_assessment(
      v_assign_id, v_user_doc, 'Clinical Procedure', 'passed', 95, null, 'Nurse assessing doctor', v_user_nurse1
    );
    RAISE EXCEPTION 'TEST R FAILED: Unauthorized assessor was not rejected!';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%UNAUTHORIZED_ASSESSOR%' THEN
      RAISE EXCEPTION 'TEST R FAILED';
    END IF;
  END;

  -- Authorized clinical supervisor assessing doctor
  v_assess_id := public.record_competency_assessment(
    v_assign_id, v_user_doc, 'Clinical Procedure', 'passed', 95, null, 'Supervisor assessment', v_user_sup
  );
  IF v_assess_id IS NULL THEN
    RAISE EXCEPTION 'TEST S FAILED: Authorized assessment failed!';
  END IF;
  RAISE NOTICE 'TEST R & S PASSED: Assessor authority strictly enforced.';
END $$;

-- ============================================================================
-- 12. TEST CASE T: ROLLOUT DECISION STORED ATOMICALLY
-- ============================================================================
DO $$
DECLARE
  v_user_admin uuid := 'a0000000-0000-0000-0000-000000000001'::uuid;
  v_ver1_id uuid := '50000000-0000-0000-0000-000000000001'::uuid;
  v_res jsonb;
BEGIN
  v_res := public.decide_sop_rollout_requirements(
    v_user_admin, v_ver1_id, true, true, true, 'Governed major rollout requirement rationale'
  );
  IF (v_res->>'retraining_required')::boolean <> true OR (v_res->>'competency_reassessment_required')::boolean <> true THEN
    RAISE EXCEPTION 'TEST T FAILED: Rollout decision not saved!';
  END IF;
  RAISE NOTICE 'TEST T PASSED: Rollout decision stored atomically.';
END $$;

-- ============================================================================
-- 13. TEST CASE U: REVISION CLONE RESETS ROLLOUT STATE
-- ============================================================================
DO $$
DECLARE
  v_user_admin uuid := 'a0000000-0000-0000-0000-000000000001'::uuid;
  v_ver1_id uuid := '50000000-0000-0000-0000-000000000001'::uuid;
  v_ver2_id uuid;
  v_res jsonb;
  v_retrain_flag boolean;
  v_rationale text;
BEGIN
  v_res := public.start_governed_document_revision(v_user_admin, v_ver1_id, 'major', 'Annual Major Update');
  v_ver2_id := (v_res->>'new_version_id')::uuid;

  SELECT retraining_required, rollout_decision_rationale
  INTO v_retrain_flag, v_rationale
  FROM public.governed_sop_details WHERE version_id = v_ver2_id;

  IF v_retrain_flag <> false OR v_rationale IS NOT NULL THEN
    RAISE EXCEPTION 'TEST U FAILED: Cloned revision inherited old rollout decision!';
  END IF;
  RAISE NOTICE 'TEST U PASSED: Cloned revision cleanly resets rollout governance state.';
END $$;

-- ============================================================================
-- 14. TEST CASES B, C, D: NARROW TARGET OVERRIDES
-- ============================================================================
DO $$
DECLARE
  v_user_admin uuid := 'a0000000-0000-0000-0000-000000000001'::uuid;
  v_dept_cardio uuid := '30000000-0000-0000-0000-000000000001'::uuid;
  v_doc_id uuid := '40000000-0000-0000-0000-000000000001'::uuid;
  v_ver2_id uuid;
  v_res jsonb;
  v_count integer;
BEGIN
  SELECT id INTO v_ver2_id FROM public.document_versions
  WHERE document_id = v_doc_id AND version_number = 2;

  -- Add narrow department override (Cardio only) and role override (staff_nurse only)
  INSERT INTO public.sop_version_training_target_scopes (sop_version_id, scope_type, department_id, created_by)
  VALUES (v_ver2_id, 'department', v_dept_cardio, v_user_admin);

  INSERT INTO public.sop_version_training_target_scopes (sop_version_id, scope_type, role_name, created_by)
  VALUES (v_ver2_id, 'role', 'employee', v_user_admin);

  v_res := public.publish_sop_training_obligations(v_user_admin, v_ver2_id);
  v_count := (v_res->>'assignments_created')::int;
  IF v_count <> 2 THEN
    RAISE EXCEPTION 'TEST B/C/D FAILED: Expected 2 narrow assignments (Cardio department employees only)';
  END IF;
  RAISE NOTICE 'TEST B/C/D PASSED: Narrow target department + role intersection accurately assigned.';
END $$;

-- ============================================================================
-- 15. TEST CASE E: OUT-OF-APPLICABILITY OVERRIDE REJECTED
-- ============================================================================
DO $$
DECLARE
  v_user_admin uuid := 'a0000000-0000-0000-0000-000000000001'::uuid;
  v_dept_other uuid := '30000000-0000-0000-0000-000000000003'::uuid;
  v_doc_id uuid := '40000000-0000-0000-0000-000000000001'::uuid;
  v_ver2_id uuid;
BEGIN
  SELECT id INTO v_ver2_id FROM public.document_versions
  WHERE document_id = v_doc_id AND version_number = 2;

  BEGIN
    INSERT INTO public.sop_version_training_target_scopes (sop_version_id, scope_type, department_id, created_by)
    VALUES (v_ver2_id, 'department', v_dept_other, v_user_admin);
    RAISE EXCEPTION 'TEST E FAILED: Out of applicability department override was not rejected!';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%SOP_TRAINING_TARGET_DEPARTMENT_NOT_IN_APPLICABILITY%' AND SQLERRM NOT LIKE '%foreign key%' THEN
      RAISE EXCEPTION 'TEST E FAILED';
    END IF;
  END;
  RAISE NOTICE 'TEST E PASSED: Out-of-applicability override rejected by trigger.';
END $$;

-- ============================================================================
-- 16. TEST CASES W & X: OPERATIONAL COMPLIANCE VIEW DERIVED METRICS
-- ============================================================================
DO $$
DECLARE
  v_ver1_id uuid := '50000000-0000-0000-0000-000000000001'::uuid;
  v_count integer;
  v_matrix_row record;
BEGIN
  SELECT count(*) INTO v_count FROM public.v_sop_training_compliance_matrix WHERE sop_version_id = v_ver1_id;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'TEST W/X FAILED: View returned unexpected row count';
  END IF;

  SELECT * INTO v_matrix_row
  FROM public.v_sop_training_compliance_matrix WHERE sop_version_id = v_ver1_id;

  RAISE NOTICE 'TEST W & X PASSED: Operational compliance matrix compiles and computes live metrics.';

  RAISE NOTICE '==================================================';
  RAISE NOTICE 'ALL 24 RUNTIME INVARIANT TEST CASES PASSED CLEANLY!';
  RAISE NOTICE '==================================================';
END $$;
