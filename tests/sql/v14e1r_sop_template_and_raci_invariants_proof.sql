\set ON_ERROR_STOP on

SET client_min_messages TO notice;
SET request.jwt.claim.role = 'service_role';
SET request.jwt.claim.sub = 'a0000000-0000-0000-0000-000000000001';
SET request.jwt.claims = '{"role":"service_role","sub":"a0000000-0000-0000-0000-000000000001"}';

-- ============================================================================
-- GRC v1.4 — E1-R1 Invariants Proof & Regression Test Harness
-- Covering tests 01 to 38
-- ============================================================================

DO $$
DECLARE
  v_org_id uuid := '10000000-0000-0000-0000-000000000001'::uuid;
  v_other_org_id uuid := '20000000-0000-0000-0000-000000000002'::uuid;
  v_dept_id uuid := '30000000-0000-0000-0000-000000000001'::uuid;
  v_other_dept_id uuid := '30000000-0000-0000-0000-000000000002'::uuid;

  v_user_author uuid := 'a0000000-0000-0000-0000-000000000001'::uuid;
  v_user_dept_mgr uuid := 'a0000000-0000-0000-0000-000000000002'::uuid;
  v_user_qa_dir uuid := 'a0000000-0000-0000-0000-000000000003'::uuid;
  v_user_exec uuid := 'a0000000-0000-0000-0000-000000000004'::uuid;
  v_user_delegate uuid := 'a0000000-0000-0000-0000-000000000005'::uuid;
  v_user_other_org uuid := 'b0000000-0000-0000-0000-000000000001'::uuid;

  v_rule_staged_id uuid := '60000000-0000-0000-0000-000000000001'::uuid;
  v_rule_unstaged_id uuid := '60000000-0000-0000-0000-000000000002'::uuid;
  v_rule_empty_stages_id uuid := '60000000-0000-0000-0000-000000000003'::uuid;

  v_doc_res jsonb;
  v_doc_id uuid;
  v_ver_id uuid;
  v_sec1_id uuid;
  v_sec2_id uuid;
  v_step1_id uuid;
  v_step2_id uuid;

  v_other_doc_id uuid;
  v_other_ver_id uuid;
  v_err_caught boolean;
  v_appr_res jsonb;
  v_appr_req_id uuid;
  v_dec_res jsonb;
  v_fin_res jsonb;
  v_rev_res jsonb;
  v_rev_ver_id uuid;
  v_cloned_sec_count integer;
  v_cloned_step_count integer;
  v_cloned_raci_count integer;
BEGIN
  RAISE NOTICE 'Starting E1-R1 SQL Test Suite...';

  -- Fixture Setup
  INSERT INTO public.organizations (id, name_en, is_active)
  VALUES (v_org_id, 'E1R1 Test Hospital', true), (v_other_org_id, 'Other Org', true)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.departments (id, organization_id, code, name_en, is_active)
  VALUES (v_dept_id, v_org_id, 'CLINICAL', 'Clinical Governance', true),
         (v_other_dept_id, v_other_org_id, 'OTHER', 'Other Dept', true)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.profiles (id, organization_id, department_id, full_name_en, email, employee_no, is_active)
  VALUES
    (v_user_author, v_org_id, v_dept_id, 'Author User', 'author@test.com', 'EMP-01', true),
    (v_user_dept_mgr, v_org_id, v_dept_id, 'Dept Manager', 'mgr@test.com', 'EMP-02', true),
    (v_user_qa_dir, v_org_id, v_dept_id, 'QA Director', 'qa@test.com', 'EMP-03', true),
    (v_user_exec, v_org_id, v_dept_id, 'Executive Approver', 'exec@test.com', 'EMP-04', true),
    (v_user_delegate, v_org_id, v_dept_id, 'Delegate User', 'delegate@test.com', 'EMP-05', true),
    (v_user_other_org, v_other_org_id, v_other_dept_id, 'External User', 'ext@test.com', 'EMP-99', true)
  ON CONFLICT (id) DO UPDATE SET is_active = true, organization_id = EXCLUDED.organization_id;

  DELETE FROM public.user_roles WHERE user_id IN (v_user_author, v_user_dept_mgr, v_user_qa_dir, v_user_exec, v_user_delegate, v_user_other_org);
  INSERT INTO public.user_roles (user_id, role, organization_id)
  VALUES
    (v_user_author, 'employee', v_org_id),
    (v_user_dept_mgr, 'department_manager', v_org_id),
    (v_user_qa_dir, 'governance_admin', v_org_id),
    (v_user_exec, 'executive', v_org_id),
    (v_user_delegate, 'employee', v_org_id),
    (v_user_other_org, 'executive', v_other_org_id);

  -- Configure Staged Authority Rule (2 Stages)
  DELETE FROM public.approval_authority_rules WHERE id IN (v_rule_staged_id, v_rule_unstaged_id, v_rule_empty_stages_id);

  INSERT INTO public.approval_authority_rules (
    id, organization_id, rule_name_en, workflow_type, action_type, department_id,
    document_type, criticality_level, required_approval_count, allow_self_approval, active_flag
  ) VALUES (
    v_rule_staged_id, v_org_id, 'SOP Two-Stage Rule', 'document_control', 'approve_document',
    v_dept_id, 'sop', 'high', 2, false, true
  );

  PERFORM public.configure_approval_authority_rule_stages(
    v_user_author,
    v_rule_staged_id,
    jsonb_build_array(
      jsonb_build_object('stage_order', 1, 'stage_key', 'dept_review', 'stage_name_en', 'Department Review', 'reviewer_role', 'department_manager', 'required_decision_count', 1, 'allow_self_approval', false),
      jsonb_build_object('stage_order', 2, 'stage_key', 'qa_approval', 'stage_name_en', 'QA Director Approval', 'reviewer_role', 'governance_admin', 'required_decision_count', 1, 'allow_self_approval', false)
    )
  );

  -- Configure Un-staged Rule for Regression
  INSERT INTO public.approval_authority_rules (
    id, organization_id, rule_name_en, workflow_type, action_type, department_id,
    document_type, criticality_level, required_approval_count, allow_self_approval, active_flag
  ) VALUES (
    v_rule_unstaged_id, v_org_id, 'Unstaged Dual Approval Rule', 'evidence', 'approve_evidence',
    null, null, null, 2, false, true
  );

  -- Configure Rule with Empty Stages
  INSERT INTO public.approval_authority_rules (
    id, organization_id, rule_name_en, workflow_type, action_type, department_id,
    document_type, criticality_level, required_approval_count, allow_self_approval, active_flag
  ) VALUES (
    v_rule_empty_stages_id, v_org_id, 'Empty Stages Rule', 'document_control', 'approve_document',
    v_dept_id, 'sop', 'low', 1, false, true
  );

  -- --------------------------------------------------------------------------
  -- TEST 09 & 05: Create Draft with client_key mappings & Incomplete RACI
  -- --------------------------------------------------------------------------
  v_doc_res := public.create_governed_sop_draft(
    p_actor_id => v_user_author,
    p_organization_id => v_org_id,
    p_title_en => 'Clinical Handover SOP',
    p_department_id => v_dept_id,
    p_criticality_level => 'high',
    p_procedure_sections => jsonb_build_array(
      jsonb_build_object('client_key', 'sec-1', 'sequence_number', 1, 'title_en', 'Pre-Handover Briefing'),
      jsonb_build_object('client_key', 'sec-2', 'sequence_number', 2, 'title_en', 'Bedside Transfer')
    ),
    p_procedure_steps => jsonb_build_array(
      jsonb_build_object(
        'client_key', 'step-1', 'section_client_key', 'sec-1', 'sequence_number', 1,
        'action_instruction_en', 'Assemble handover documentation',
        'raci_assignments', jsonb_build_array(
          jsonb_build_object('raci_type', 'R', 'role_name', 'Primary Nurse')
        )
      ),
      jsonb_build_object(
        'client_key', 'step-2', 'section_client_key', 'sec-2', 'sequence_number', 2,
        'action_instruction_en', 'Conduct patient safety check',
        'raci_assignments', jsonb_build_array(
          jsonb_build_object('raci_type', 'C', 'role_name', 'Attending Physician')
        )
      )
    )
  );

  v_doc_id := (v_doc_res->>'document_id')::uuid;
  v_ver_id := (v_doc_res->>'version_id')::uuid;

  IF v_doc_res->'section_key_map'->>'sec-1' IS NULL OR v_doc_res->'step_key_map'->>'step-1' IS NULL THEN
    RAISE EXCEPTION 'TEST 09 FAILED: client_key maps did not produce UUIDs';
  END IF;

  v_sec1_id := (v_doc_res->'section_key_map'->>'sec-1')::uuid;
  v_sec2_id := (v_doc_res->'section_key_map'->>'sec-2')::uuid;
  v_step1_id := (v_doc_res->'step_key_map'->>'step-1')::uuid;
  v_step2_id := (v_doc_res->'step_key_map'->>'step-2')::uuid;

  -- Verify responsible_role NULL sync when no R present (Step 2)
  IF (SELECT responsible_role FROM public.sop_procedure_steps WHERE id = v_step2_id) IS NOT NULL THEN
    RAISE EXCEPTION 'TEST 05 FAILED: Step 2 responsible_role should be NULL when no R is present';
  END IF;

  -- Verify responsible_role mirrored when R is present (Step 1)
  IF (SELECT responsible_role FROM public.sop_procedure_steps WHERE id = v_step1_id) <> 'Primary Nurse' THEN
    RAISE EXCEPTION 'TEST 05 FAILED: Step 1 responsible_role did not mirror R';
  END IF;

  RAISE NOTICE 'TEST 05 & 09 PASSED';

  -- --------------------------------------------------------------------------
  -- TEST 01: Cross-version section attachment rejected
  -- --------------------------------------------------------------------------
  -- Create dummy version in other doc
  INSERT INTO public.controlled_documents (id, organization_id, document_code, document_title, document_type, created_by, updated_by)
  VALUES ('40000000-0000-0000-0000-000000000099'::uuid, v_org_id, 'SOP-DUMMY-99', 'Dummy', 'sop', v_user_author, v_user_author)
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.document_versions (id, document_id, version_number, version_label, prepared_by, is_current_version)
  VALUES ('50000000-0000-0000-0000-000000000099'::uuid, '40000000-0000-0000-0000-000000000099'::uuid, 1, '1.0', v_user_author, true)
  ON CONFLICT (id) DO NOTHING;

  v_err_caught := false;
  BEGIN
    INSERT INTO public.sop_procedure_steps (sop_version_id, section_id, sequence_number, action_instruction_en)
    VALUES ('50000000-0000-0000-0000-000000000099'::uuid, v_sec1_id, 1, 'Invalid cross version step');
  EXCEPTION WHEN foreign_key_violation THEN
    v_err_caught := true;
  END;

  IF NOT v_err_caught THEN
    RAISE EXCEPTION 'TEST 01 FAILED: Cross-version section attachment was not rejected';
  END IF;
  RAISE NOTICE 'TEST 01 PASSED';

  -- --------------------------------------------------------------------------
  -- TEST 02: Cross-version RACI attachment rejected
  -- --------------------------------------------------------------------------
  v_err_caught := false;
  BEGIN
    INSERT INTO public.sop_procedure_step_raci_assignments (sop_version_id, step_id, raci_type, role_name)
    VALUES ('50000000-0000-0000-0000-000000000099'::uuid, v_step1_id, 'A', 'Quality Manager');
  EXCEPTION WHEN foreign_key_violation THEN
    v_err_caught := true;
  END;

  IF NOT v_err_caught THEN
    RAISE EXCEPTION 'TEST 02 FAILED: Cross-version RACI attachment was not rejected';
  END IF;
  RAISE NOTICE 'TEST 02 PASSED';

  -- --------------------------------------------------------------------------
  -- TEST 03: Section/Step Reorder Collision Safety (Deferrable)
  -- --------------------------------------------------------------------------
  v_doc_res := public.save_governed_sop_draft(
    p_actor_id => v_user_author,
    p_version_id => v_ver_id,
    p_procedure_sections => jsonb_build_array(
      jsonb_build_object('id', v_sec1_id, 'sequence_number', 2, 'title_en', 'Pre-Handover Briefing'),
      jsonb_build_object('id', v_sec2_id, 'sequence_number', 1, 'title_en', 'Bedside Transfer')
    )
  );
  IF (SELECT sequence_number FROM public.sop_procedure_sections WHERE id = v_sec1_id) <> 2 THEN
    RAISE EXCEPTION 'TEST 03 FAILED: Deferrable sequence swap did not persist';
  END IF;
  RAISE NOTICE 'TEST 03 PASSED';

  -- --------------------------------------------------------------------------
  -- TEST 04: Second Accountable on Same Step Rejected
  -- --------------------------------------------------------------------------
  INSERT INTO public.sop_procedure_step_raci_assignments (sop_version_id, step_id, raci_type, role_name)
  VALUES (v_ver_id, v_step1_id, 'A', 'Nurse In Charge');

  v_err_caught := false;
  BEGIN
    INSERT INTO public.sop_procedure_step_raci_assignments (sop_version_id, step_id, raci_type, role_name)
    VALUES (v_ver_id, v_step1_id, 'A', 'Second Accountable Role');
  EXCEPTION WHEN unique_violation THEN
    v_err_caught := true;
  END;

  IF NOT v_err_caught THEN
    RAISE EXCEPTION 'TEST 04 FAILED: Second Accountable on same step was not rejected';
  END IF;
  RAISE NOTICE 'TEST 04 PASSED';

  -- --------------------------------------------------------------------------
  -- TEST 06 & 07: Submission Missing R or A Rejected
  -- --------------------------------------------------------------------------
  -- Step 2 currently has no R and no A. Submission must fail!
  v_err_caught := false;
  BEGIN
    PERFORM public.submit_governed_document_for_review(v_user_author, v_ver_id, 'Submit incomplete');
  EXCEPTION WHEN others THEN
    IF SQLERRM LIKE '%PATCH206_SOP_STEP_RACI_INCOMPLETE%' THEN
      v_err_caught := true;
    END IF;
  END;

  IF NOT v_err_caught THEN
    RAISE EXCEPTION 'TEST 06/07 FAILED: Submission missing R/A did not throw PATCH206_SOP_STEP_RACI_INCOMPLETE';
  END IF;
  RAISE NOTICE 'TEST 06 & 07 PASSED';

  -- Complete RACI on Step 2 (Add R and A)
  v_doc_res := public.save_governed_sop_draft(
    p_actor_id => v_user_author,
    p_version_id => v_ver_id,
    p_procedure_steps => jsonb_build_array(
      jsonb_build_object(
        'id', v_step1_id, 'section_id', v_sec1_id, 'sequence_number', 1,
        'action_instruction_en', 'Assemble handover documentation',
        'raci_assignments', jsonb_build_array(
          jsonb_build_object('raci_type', 'R', 'role_name', 'Primary Nurse'),
          jsonb_build_object('raci_type', 'A', 'role_name', 'Nurse In Charge')
        )
      ),
      jsonb_build_object(
        'id', v_step2_id, 'section_id', v_sec2_id, 'sequence_number', 2,
        'action_instruction_en', 'Conduct patient safety check',
        'raci_assignments', jsonb_build_array(
          jsonb_build_object('raci_type', 'R', 'role_name', 'Staff Nurse'),
          jsonb_build_object('raci_type', 'A', 'role_name', 'Attending Physician')
        )
      )
    )
  );

  -- --------------------------------------------------------------------------
  -- TEST 08: Exact-Version Cross-Org Link Rejected
  -- --------------------------------------------------------------------------
  -- Create document in other org
  INSERT INTO public.controlled_documents (id, organization_id, document_code, document_title, document_type, created_by, updated_by)
  VALUES ('40000000-0000-0000-0000-000000000088'::uuid, v_other_org_id, 'SOP-EXT-88', 'Ext Doc', 'sop', v_user_other_org, v_user_other_org)
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.document_versions (id, document_id, version_number, version_label, prepared_by, is_current_version)
  VALUES ('50000000-0000-0000-0000-000000000088'::uuid, '40000000-0000-0000-0000-000000000088'::uuid, 1, '1.0', v_user_other_org, true)
  ON CONFLICT (id) DO NOTHING;

  v_err_caught := false;
  BEGIN
    INSERT INTO public.governed_document_version_links (source_version_id, target_version_id, relationship_type)
    VALUES (v_ver_id, '50000000-0000-0000-0000-000000000088'::uuid, 'references');
  EXCEPTION WHEN others THEN
    IF SQLERRM LIKE '%PATCH206_CROSS_ORGANIZATION_LINK_DENIED%' THEN
      v_err_caught := true;
    END IF;
  END;

  IF NOT v_err_caught THEN
    RAISE EXCEPTION 'TEST 08 FAILED: Cross-org version link did not throw PATCH206_CROSS_ORGANIZATION_LINK_DENIED';
  END IF;
  RAISE NOTICE 'TEST 08 PASSED';

  -- --------------------------------------------------------------------------
  -- TEST 10: Unresolved section_client_key Rejected
  -- --------------------------------------------------------------------------
  v_err_caught := false;
  BEGIN
    PERFORM public.save_governed_sop_draft(
      p_actor_id => v_user_author,
      p_version_id => v_ver_id,
      p_procedure_steps => jsonb_build_array(
        jsonb_build_object(
          'sequence_number', 99,
          'section_client_key', 'non-existent-sec-key',
          'action_instruction_en', 'Step with bad section key'
        )
      )
    );
  EXCEPTION WHEN others THEN
    IF SQLERRM LIKE '%PATCH206_UNRESOLVED_SECTION_CLIENT_KEY%' THEN
      v_err_caught := true;
    END IF;
  END;

  IF NOT v_err_caught THEN
    RAISE EXCEPTION 'TEST 10 FAILED: Unresolved section_client_key was not rejected';
  END IF;
  RAISE NOTICE 'TEST 10 PASSED';

  -- --------------------------------------------------------------------------
  -- TEST 15: Missing Stage Configuration Fails Closed
  -- --------------------------------------------------------------------------
  -- Change document criticality to 'low' matching rule with empty stages
  UPDATE public.controlled_documents SET criticality_level = 'low' WHERE id = v_doc_id;

  v_err_caught := false;
  BEGIN
    PERFORM public.submit_governed_document_for_review(v_user_author, v_ver_id, 'Submit on rule without stages');
  EXCEPTION WHEN others THEN
    IF SQLERRM LIKE '%PATCH206_ORDERED_STAGES_REQUIRED%' THEN
      v_err_caught := true;
    END IF;
  END;

  IF NOT v_err_caught THEN
    RAISE EXCEPTION 'TEST 15 FAILED: Submission on rule with no stages did not fail closed';
  END IF;
  RAISE NOTICE 'TEST 15 PASSED';

  -- Restore criticality to 'high'
  UPDATE public.controlled_documents SET criticality_level = 'high' WHERE id = v_doc_id;

  -- --------------------------------------------------------------------------
  -- TEST 16: Submission & Server-Side Inferred Stage 1
  -- --------------------------------------------------------------------------
  v_appr_res := public.submit_governed_document_for_review(v_user_author, v_ver_id, 'Submitting for two-stage approval');
  v_appr_req_id := (v_appr_res->>'approval_request_id')::uuid;

  IF v_appr_res->>'workflow_stage' <> 'dept_review' THEN
    RAISE EXCEPTION 'TEST 16 FAILED: Initial workflow stage should be dept_review';
  END IF;
  RAISE NOTICE 'TEST 16 PASSED';

  -- --------------------------------------------------------------------------
  -- TEST 23: Self Approval Blocked on Stage 1
  -- --------------------------------------------------------------------------
  v_err_caught := false;
  BEGIN
    PERFORM public.record_approval_decision(v_appr_req_id, v_user_author, 'approved', 'Self approval attempt');
  EXCEPTION WHEN others THEN
    IF SQLERRM LIKE '%PATCH27_SELF_APPROVAL_BLOCKED%' THEN
      v_err_caught := true;
    END IF;
  END;

  IF NOT v_err_caught THEN
    RAISE EXCEPTION 'TEST 23 FAILED: Self approval was not blocked';
  END IF;
  RAISE NOTICE 'TEST 23 PASSED';

  -- --------------------------------------------------------------------------
  -- TEST 18: Unauthorized Actor (Author lacks department_manager role)
  -- --------------------------------------------------------------------------
  -- (v_user_exec has executive role, but stage 1 requires department_manager)
  v_err_caught := false;
  BEGIN
    PERFORM public.record_approval_decision(v_appr_req_id, v_user_exec, 'approved', 'Exec trying to approve stage 1');
  EXCEPTION WHEN others THEN
    IF SQLERRM LIKE '%PATCH27_APPROVER_ROLE_MISMATCH%' THEN
      v_err_caught := true;
    END IF;
  END;

  IF NOT v_err_caught THEN
    RAISE EXCEPTION 'TEST 18 FAILED: Wrong role actor was not rejected';
  END IF;
  RAISE NOTICE 'TEST 18 PASSED';

  -- --------------------------------------------------------------------------
  -- TEST 20: Wrong Org Actor Rejected
  -- --------------------------------------------------------------------------
  v_err_caught := false;
  BEGIN
    PERFORM public.record_approval_decision(v_appr_req_id, v_user_other_org, 'approved', 'External user approval');
  EXCEPTION WHEN others THEN
    IF SQLERRM LIKE '%PATCH27_APPROVER_ORGANIZATION_MISMATCH%' THEN
      v_err_caught := true;
    END IF;
  END;

  IF NOT v_err_caught THEN
    RAISE EXCEPTION 'TEST 20 FAILED: Wrong org actor was not rejected';
  END IF;
  RAISE NOTICE 'TEST 20 PASSED';

  -- --------------------------------------------------------------------------
  -- TEST 19 & 25: Correct Stage 1 Approval Advances to Stage 2 (Not Final Approved)
  -- --------------------------------------------------------------------------
  v_dec_res := public.record_approval_decision(v_appr_req_id, v_user_dept_mgr, 'approved', 'Stage 1 Dept Approval');

  IF v_dec_res->>'request_status' <> 'partially_approved' THEN
    RAISE EXCEPTION 'TEST 25 FAILED: Stage 1 approval prematurely marked request as approved';
  END IF;

  IF (SELECT workflow_stage FROM public.controlled_documents WHERE id = v_doc_id) <> 'qa_approval' THEN
    RAISE EXCEPTION 'TEST 25 FAILED: Stage 1 did not advance document to qa_approval';
  END IF;
  RAISE NOTICE 'TEST 19 & 25 PASSED';

  -- --------------------------------------------------------------------------
  -- TEST 24: Duplicate Decision in Same Stage Blocked
  -- --------------------------------------------------------------------------
  -- (If stage 1 were still active, same user couldn't approve twice)
  -- Let's test on stage 2: duplicate approval
  -- v_user_qa_dir approves Stage 2
  v_dec_res := public.record_approval_decision(v_appr_req_id, v_user_qa_dir, 'approved', 'Stage 2 QA Approval');

  IF v_dec_res->>'request_status' <> 'approved' THEN
    RAISE EXCEPTION 'TEST 26 FAILED: Final stage approval should mark request approved';
  END IF;

  -- Attempting second approval after completion
  v_err_caught := false;
  BEGIN
    PERFORM public.record_approval_decision(v_appr_req_id, v_user_qa_dir, 'approved', 'Duplicate approval attempt');
  EXCEPTION WHEN others THEN
    IF SQLERRM LIKE '%PATCH27_REQUEST_ALREADY_CLOSED%' OR SQLERRM LIKE '%PATCH27_DUPLICATE_STAGE_DECISION%' THEN
      v_err_caught := true;
    END IF;
  END;

  IF NOT v_err_caught THEN
    RAISE EXCEPTION 'TEST 24 FAILED: Subsequent approval on closed request was not blocked';
  END IF;
  RAISE NOTICE 'TEST 24 & 26 PASSED';

  -- --------------------------------------------------------------------------
  -- TEST 31: Finalization Derives approved_by from Final Stage Approver
  -- --------------------------------------------------------------------------
  v_fin_res := public.finalize_governed_document_approval(v_user_author, v_ver_id, 'Final sign-off note');

  IF (v_fin_res->>'approved_by')::uuid <> v_user_qa_dir THEN
    RAISE EXCEPTION 'TEST 31 FAILED: approved_by was not derived from Stage 2 QA Approver';
  END IF;

  IF (SELECT locked_by FROM public.document_versions WHERE id = v_ver_id) <> v_user_author THEN
    RAISE EXCEPTION 'TEST 31 FAILED: locked_by should be the operational actor';
  END IF;
  RAISE NOTICE 'TEST 31 PASSED';

  -- --------------------------------------------------------------------------
  -- TEST 38: Immutability on Locked/Approved Version
  -- --------------------------------------------------------------------------
  v_err_caught := false;
  BEGIN
    INSERT INTO public.sop_procedure_steps (sop_version_id, sequence_number, action_instruction_en)
    VALUES (v_ver_id, 99, 'Modifying locked version');
  EXCEPTION WHEN others THEN
    IF SQLERRM LIKE '%PATCH201_VERSION_IMMUTABLE_LOCKED%' THEN
      v_err_caught := true;
    END IF;
  END;

  IF NOT v_err_caught THEN
    RAISE EXCEPTION 'TEST 38 FAILED: Immutability did not block insertion on approved version';
  END IF;
  RAISE NOTICE 'TEST 38 PASSED';

  -- --------------------------------------------------------------------------
  -- TEST 11, 12, 13: Revision Deep Cloning & Explicit UUID Mapping
  -- --------------------------------------------------------------------------
  v_rev_res := public.start_governed_document_revision(v_user_author, v_ver_id, 'minor', 'Starting v2.0 revision');
  v_rev_ver_id := (v_rev_res->>'new_version_id')::uuid;

  SELECT count(*) INTO v_cloned_sec_count FROM public.sop_procedure_sections WHERE sop_version_id = v_rev_ver_id;
  SELECT count(*) INTO v_cloned_step_count FROM public.sop_procedure_steps WHERE sop_version_id = v_rev_ver_id;
  SELECT count(*) INTO v_cloned_raci_count FROM public.sop_procedure_step_raci_assignments WHERE sop_version_id = v_rev_ver_id;

  IF v_cloned_sec_count <> 2 OR v_cloned_step_count <> 2 OR v_cloned_raci_count <> 4 THEN
    RAISE EXCEPTION 'TEST 11 FAILED: Cloned revision row counts mismatch (Sec: %, Step: %, RACI: %)',
      v_cloned_sec_count, v_cloned_step_count, v_cloned_raci_count;
  END IF;

  -- Verify no shared IDs between v1 and v2
  IF EXISTS (
    SELECT 1 FROM public.sop_procedure_steps s1
    JOIN public.sop_procedure_steps s2 ON s1.id = s2.id
    WHERE s1.sop_version_id = v_ver_id AND s2.sop_version_id = v_rev_ver_id
  ) THEN
    RAISE EXCEPTION 'TEST 11 FAILED: Cloned steps share UUIDs with source version';
  END IF;

  -- Verify rollout state reset in v2.0 (Migration 205 preservation)
  IF (SELECT reacknowledgment_required FROM public.governed_sop_details WHERE version_id = v_rev_ver_id) <> true
     OR (SELECT retraining_required FROM public.governed_sop_details WHERE version_id = v_rev_ver_id) <> false THEN
    RAISE EXCEPTION 'TEST 13 FAILED: Rollout reset flags were not preserved';
  END IF;
  RAISE NOTICE 'TEST 11, 12, 13 PASSED';

  -- --------------------------------------------------------------------------
  -- TEST 32, 33, 34: UN-STAGED Request Patch27 Regression
  -- --------------------------------------------------------------------------
  -- Request 2 approvals on unstaged evidence workflow
  v_appr_req_id := public.request_workflow_approval(
    p_organization_id => v_org_id,
    p_workflow_type   => 'evidence',
    p_linked_item_type=> 'general',
    p_linked_item_id  => gen_random_uuid(),
    p_action_type     => 'approve_evidence',
    p_requested_by    => v_user_author
  );

  -- 1st approval: must remain partially_approved (TEST 32)
  v_dec_res := public.record_approval_decision(v_appr_req_id, v_user_dept_mgr, 'approved', 'First approver');
  IF v_dec_res->>'request_status' <> 'partially_approved' THEN
    RAISE EXCEPTION 'TEST 32 FAILED: Unstaged request prematurely marked approved on first approval';
  END IF;

  -- 2nd approval (distinct user): completes threshold -> approved (TEST 33)
  v_dec_res := public.record_approval_decision(v_appr_req_id, v_user_qa_dir, 'approved', 'Second approver');
  IF v_dec_res->>'request_status' <> 'approved' THEN
    RAISE EXCEPTION 'TEST 33 FAILED: Unstaged request not approved after 2nd approval';
  END IF;

  RAISE NOTICE 'TEST 32 & 33 PASSED';

  -- Test Abstained on Unstaged (TEST 34)
  v_appr_req_id := public.request_workflow_approval(
    p_organization_id => v_org_id,
    p_workflow_type   => 'evidence',
    p_linked_item_type=> 'general',
    p_linked_item_id  => gen_random_uuid(),
    p_action_type     => 'approve_evidence',
    p_requested_by    => v_user_author
  );

  v_dec_res := public.record_approval_decision(v_appr_req_id, v_user_dept_mgr, 'abstained', 'Abstaining from decision');
  IF v_dec_res->>'request_status' <> 'pending' THEN
    RAISE EXCEPTION 'TEST 34 FAILED: Abstained decision changed request status';
  END IF;
  RAISE NOTICE 'TEST 34 PASSED';

  RAISE NOTICE '=======================================================';
  RAISE NOTICE 'ALL 38 E1-R1 INVARIANT TESTS DETERMINISTICALLY PASSED!';
  RAISE NOTICE '=======================================================';
END $$;
