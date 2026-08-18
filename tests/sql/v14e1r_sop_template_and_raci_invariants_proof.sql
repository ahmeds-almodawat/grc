\set ON_ERROR_STOP on

SET client_min_messages TO notice;
SET request.jwt.claim.role = 'service_role';
SET request.jwt.claim.sub = 'a0000000-0000-0000-0000-000000000001';
SET request.jwt.claims = '{"role":"service_role","sub":"a0000000-0000-0000-0000-000000000001"}';

-- ============================================================================
-- GRC v1.4 — E1-R1 Invariants Proof & Regression Test Harness
-- Covering tests 01 to 58
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
  v_user_super_admin uuid := 'a0000000-0000-0000-0000-000000000006'::uuid;
  v_user_unrelated_emp uuid := 'a0000000-0000-0000-0000-000000000007'::uuid;
  v_user_inactive uuid := 'a0000000-0000-0000-0000-000000000008'::uuid;
  v_user_other_org uuid := 'b0000000-0000-0000-0000-000000000001'::uuid;

  v_rule_staged_id uuid := '60000000-0000-0000-0000-000000000001'::uuid;
  v_rule_unstaged_id uuid := '60000000-0000-0000-0000-000000000002'::uuid;
  v_rule_empty_stages_id uuid := '60000000-0000-0000-0000-000000000003'::uuid;
  v_rule_legacy_id uuid := '60000000-0000-0000-0000-000000000004'::uuid;
  v_rule_multi_approver_id uuid := '60000000-0000-0000-0000-000000000005'::uuid;

  v_doc_res jsonb;
  v_doc_id uuid;
  v_ver_id uuid;
  v_sec1_id uuid;
  v_sec2_id uuid;
  v_step1_id uuid;
  v_step2_id uuid;
  v_step3_id uuid;

  v_legacy_doc_res jsonb;
  v_legacy_doc_id uuid;
  v_legacy_ver_id uuid;

  v_other_doc_id uuid;
  v_other_ver_id uuid;
  v_err_caught boolean;
  v_appr_res jsonb;
  v_appr_req_id uuid;
  v_multi_req_id uuid;
  v_zero_req_id uuid;
  v_dec_res jsonb;
  v_fin_res jsonb;
  v_rev_res jsonb;
  v_rev_ver_id uuid;
  v_cloned_sec_count integer;
  v_cloned_step_count integer;
  v_cloned_raci_count integer;
  v_stage_orders integer[];
  v_st1_status text;
  v_st1_started timestamptz;
  v_st2_status text;
  v_st2_started timestamptz;
  v_func text;
  v_funcs text[];
  v_proc_oid oid;
  v_pub_exec boolean;
  v_anon_exec boolean;
  v_auth_exec boolean;
  v_serv_exec boolean;
BEGIN
  RAISE NOTICE 'Starting GRC v1.4 E1-R1 Invariants Proof Suite (Tests 01-58)...';
  PERFORM set_config('request.jwt.claim.role', 'service_role', false);
  PERFORM set_config('request.jwt.claim.sub', v_user_author::text, false);

  -- Fixture Setup
  INSERT INTO public.organizations (id, name_en, is_active)
  VALUES (v_org_id, 'E1R1 Test Hospital', true), (v_other_org_id, 'Other Org', true)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.departments (id, organization_id, code, name_en, is_active)
  VALUES (v_dept_id, v_org_id, 'CLINICAL', 'Clinical Governance', true),
         (v_other_dept_id, v_other_org_id, 'OTHER', 'Other Dept', true)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  VALUES
    (v_user_author, 'authenticated', 'authenticated', 'author@test.com', '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
    (v_user_dept_mgr, 'authenticated', 'authenticated', 'mgr@test.com', '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
    (v_user_qa_dir, 'authenticated', 'authenticated', 'qa@test.com', '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
    (v_user_exec, 'authenticated', 'authenticated', 'exec@test.com', '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
    (v_user_delegate, 'authenticated', 'authenticated', 'delegate@test.com', '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
    (v_user_super_admin, 'authenticated', 'authenticated', 'admin@test.com', '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
    (v_user_unrelated_emp, 'authenticated', 'authenticated', 'unrelated@test.com', '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
    (v_user_inactive, 'authenticated', 'authenticated', 'inactive@test.com', '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()),
    (v_user_other_org, 'authenticated', 'authenticated', 'ext@test.com', '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now())
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.profiles (id, organization_id, department_id, full_name_en, email, employee_no, is_active, user_status)
  VALUES
    (v_user_author, v_org_id, v_dept_id, 'Author User', 'author@test.com', 'EMP-01', true, 'active'),
    (v_user_dept_mgr, v_org_id, v_dept_id, 'Dept Manager', 'mgr@test.com', 'EMP-02', true, 'active'),
    (v_user_qa_dir, v_org_id, v_dept_id, 'QA Director', 'qa@test.com', 'EMP-03', true, 'active'),
    (v_user_exec, v_org_id, v_dept_id, 'Executive Approver', 'exec@test.com', 'EMP-04', true, 'active'),
    (v_user_delegate, v_org_id, v_dept_id, 'Delegate User', 'delegate@test.com', 'EMP-05', true, 'active'),
    (v_user_super_admin, v_org_id, v_dept_id, 'Super Admin User', 'admin@test.com', 'EMP-06', true, 'active'),
    (v_user_unrelated_emp, v_org_id, v_dept_id, 'Unrelated Emp', 'unrelated@test.com', 'EMP-07', true, 'active'),
    (v_user_inactive, v_org_id, null, 'Inactive User', 'inactive@test.com', 'EMP-08', false, 'inactive'),
    (v_user_other_org, v_other_org_id, v_other_dept_id, 'External User', 'ext@test.com', 'EMP-99', true, 'active')
  ON CONFLICT (id) DO UPDATE SET is_active = EXCLUDED.is_active, user_status = EXCLUDED.user_status, organization_id = EXCLUDED.organization_id;

  DELETE FROM public.user_roles WHERE user_id IN (v_user_author, v_user_dept_mgr, v_user_qa_dir, v_user_exec, v_user_delegate, v_user_super_admin, v_user_unrelated_emp, v_user_inactive, v_user_other_org);
  DELETE FROM public.approval_delegations WHERE delegate_id IN (v_user_author, v_user_dept_mgr, v_user_qa_dir, v_user_exec, v_user_delegate, v_user_super_admin, v_user_unrelated_emp, v_user_inactive, v_user_other_org);
  INSERT INTO public.user_roles (user_id, role, organization_id)
  VALUES
    (v_user_author, 'employee', v_org_id),
    (v_user_dept_mgr, 'department_manager', v_org_id),
    (v_user_qa_dir, 'governance_admin', v_org_id),
    (v_user_exec, 'executive', v_org_id),
    (v_user_delegate, 'employee', v_org_id),
    (v_user_super_admin, 'super_admin', v_org_id),
    (v_user_unrelated_emp, 'employee', v_org_id),
    (v_user_other_org, 'department_manager', v_other_org_id);

  -- --------------------------------------------------------------------------
  -- TEST 44 & 45 & 50 & 51 & 52 & 53 & 43: Stage Configuration Validation
  -- --------------------------------------------------------------------------
  DELETE FROM public.approval_authority_rules WHERE id IN (v_rule_staged_id, v_rule_unstaged_id, v_rule_empty_stages_id, v_rule_legacy_id, v_rule_multi_approver_id);

  INSERT INTO public.approval_authority_rules (
    id, organization_id, rule_code, rule_name, workflow_type, action_type, department_id,
    document_type, criticality_level, required_approval_count, allow_self_approval, active_flag
  ) VALUES (
    v_rule_staged_id, v_org_id, 'R-STAGED', 'SOP Two-Stage Rule', 'document_control', 'approve_document',
    v_dept_id, 'sop', 'high', 2, false, true
  );

  -- TEST 44: Unauthorized actor (employee role) cannot configure stages
  v_err_caught := false;
  BEGIN
    PERFORM public.configure_approval_authority_rule_stages(
      v_user_author,
      v_rule_staged_id,
      jsonb_build_array(
        jsonb_build_object('stage_key', 's1', 'stage_name_en', 'S1', 'reviewer_role', 'department_manager')
      )
    );
  EXCEPTION WHEN others THEN
    IF SQLERRM LIKE '%PATCH206_ACTOR_UNAUTHORIZED_FOR_STAGE_CONFIG%' THEN
      v_err_caught := true;
    END IF;
  END;
  IF NOT v_err_caught THEN
    RAISE EXCEPTION 'TEST 44 FAILED: Unauthorized actor was allowed to configure stages';
  END IF;
  RAISE NOTICE 'TEST 44 PASSED';

  -- TEST 45: Wrong-org actor cannot configure stages
  v_err_caught := false;
  BEGIN
    PERFORM public.configure_approval_authority_rule_stages(
      v_user_other_org,
      v_rule_staged_id,
      jsonb_build_array(
        jsonb_build_object('stage_key', 's1', 'stage_name_en', 'S1', 'reviewer_role', 'department_manager')
      )
    );
  EXCEPTION WHEN others THEN
    IF SQLERRM LIKE '%PATCH202_ACTOR_CROSS_ORG_FORBIDDEN%' THEN
      v_err_caught := true;
    END IF;
  END;
  IF NOT v_err_caught THEN
    RAISE EXCEPTION 'TEST 45 FAILED: Cross-org actor was allowed to configure stages';
  END IF;
  RAISE NOTICE 'TEST 45 PASSED';

  -- TEST 50: Cross-org reviewer_user_id rejected at stage configuration
  v_err_caught := false;
  BEGIN
    PERFORM public.configure_approval_authority_rule_stages(
      v_user_qa_dir,
      v_rule_staged_id,
      jsonb_build_array(
        jsonb_build_object('stage_key', 's1', 'stage_name_en', 'S1', 'reviewer_user_id', v_user_other_org, 'required_decision_count', 1)
      )
    );
  EXCEPTION WHEN others THEN
    IF SQLERRM LIKE '%PATCH206_INVALID_STAGE_REVIEWER_USER%' THEN
      v_err_caught := true;
    END IF;
  END;
  IF NOT v_err_caught THEN
    RAISE EXCEPTION 'TEST 50 FAILED: Cross-org reviewer_user_id was not rejected';
  END IF;
  RAISE NOTICE 'TEST 50 PASSED';

  -- TEST 51: Inactive reviewer_user_id rejected
  v_err_caught := false;
  BEGIN
    PERFORM public.configure_approval_authority_rule_stages(
      v_user_qa_dir,
      v_rule_staged_id,
      jsonb_build_array(
        jsonb_build_object('stage_key', 's1', 'stage_name_en', 'S1', 'reviewer_user_id', v_user_inactive, 'required_decision_count', 1)
      )
    );
  EXCEPTION WHEN others THEN
    IF SQLERRM LIKE '%PATCH206_INVALID_STAGE_REVIEWER_USER%' THEN
      v_err_caught := true;
    END IF;
  END;
  IF NOT v_err_caught THEN
    RAISE EXCEPTION 'TEST 51 FAILED: Inactive reviewer_user_id was not rejected';
  END IF;
  RAISE NOTICE 'TEST 51 PASSED';

  -- TEST 52: Invalid / non-app_role reviewer_role rejected
  v_err_caught := false;
  BEGIN
    PERFORM public.configure_approval_authority_rule_stages(
      v_user_qa_dir,
      v_rule_staged_id,
      jsonb_build_array(
        jsonb_build_object('stage_key', 's1', 'stage_name_en', 'S1', 'reviewer_role', 'non_existent_role_name', 'required_decision_count', 1)
      )
    );
  EXCEPTION WHEN others THEN
    IF SQLERRM LIKE '%PATCH206_INVALID_STAGE_REVIEWER_ROLE%' THEN
      v_err_caught := true;
    END IF;
  END;
  IF NOT v_err_caught THEN
    RAISE EXCEPTION 'TEST 52 FAILED: Non-canonical reviewer_role was not rejected';
  END IF;
  RAISE NOTICE 'TEST 52 PASSED';

  -- TEST 53: Role stage count=2 with only one eligible role holder rejected
  v_err_caught := false;
  BEGIN
    PERFORM public.configure_approval_authority_rule_stages(
      v_user_qa_dir,
      v_rule_staged_id,
      jsonb_build_array(
        jsonb_build_object('stage_key', 's1', 'stage_name_en', 'S1', 'reviewer_role', 'department_manager', 'required_decision_count', 2)
      )
    );
  EXCEPTION WHEN others THEN
    IF SQLERRM LIKE '%PATCH206_INSUFFICIENT_STAGE_REVIEWERS%' THEN
      v_err_caught := true;
    END IF;
  END;
  IF NOT v_err_caught THEN
    RAISE EXCEPTION 'TEST 53 FAILED: Stage requiring 2 approvers with only 1 eligible role holder was not rejected';
  END IF;
  RAISE NOTICE 'TEST 53 PASSED';

  -- TEST 43: Valid stage ordering normalization (contiguous 1..N regardless of input)
  PERFORM public.configure_approval_authority_rule_stages(
    v_user_qa_dir,
    v_rule_staged_id,
    jsonb_build_array(
      jsonb_build_object('stage_order', 10, 'stage_key', 'dept_review', 'stage_name_en', 'Department Review', 'reviewer_role', 'department_manager', 'required_decision_count', 1, 'allow_self_approval', false),
      jsonb_build_object('stage_order', 99, 'stage_key', 'qa_approval', 'stage_name_en', 'QA Director Approval', 'reviewer_role', 'governance_admin', 'required_decision_count', 1, 'allow_self_approval', false)
    )
  );

  SELECT array_agg(stage_order ORDER BY stage_order) INTO v_stage_orders
  FROM public.approval_authority_rule_stages WHERE authority_rule_id = v_rule_staged_id;

  IF v_stage_orders <> ARRAY[1, 2] THEN
    RAISE EXCEPTION 'TEST 43 FAILED: Stage orders did not normalize to contiguous 1..2 (got %)', v_stage_orders;
  END IF;
  RAISE NOTICE 'TEST 43 PASSED';

  -- Configure Un-staged Rule for Regression
  INSERT INTO public.approval_authority_rules (
    id, organization_id, rule_code, rule_name, workflow_type, action_type, department_id,
    document_type, criticality_level, required_approval_count, allow_self_approval, active_flag
  ) VALUES (
    v_rule_unstaged_id, v_org_id, 'R-UNSTAGED', 'Unstaged Dual Approval Rule', 'evidence', 'approve_evidence',
    null, null, null, 2, false, true
  );

  -- Configure Rule with Empty Stages
  INSERT INTO public.approval_authority_rules (
    id, organization_id, rule_code, rule_name, workflow_type, action_type, department_id,
    document_type, criticality_level, required_approval_count, allow_self_approval, active_flag
  ) VALUES (
    v_rule_empty_stages_id, v_org_id, 'R-EMPTY', 'Empty Stages Rule', 'document_control', 'approve_document',
    v_dept_id, 'sop', 'low', 1, false, true
  );

  -- --------------------------------------------------------------------------
  -- TEST 42 & 09 & 05: Structured Creation & client_key maps & RACI sync
  -- --------------------------------------------------------------------------
  v_doc_res := public.create_governed_sop_draft(
    p_actor_id => v_user_author,
    p_organization_id => v_org_id,
    p_title_en => 'Clinical Handover SOP',
    p_department_id => v_dept_id,
    p_criticality_level => 'high',
    p_content_mode => 'structured',
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

  -- TEST 42: Structured mode verified
  IF (SELECT content_mode FROM public.governed_sop_details WHERE version_id = v_ver_id) <> 'structured'
     OR (SELECT transcription_status FROM public.governed_sop_details WHERE version_id = v_ver_id) <> 'complete' THEN
    RAISE EXCEPTION 'TEST 42 FAILED: Structured SOP creation did not set structured/complete mode';
  END IF;
  RAISE NOTICE 'TEST 42 PASSED';

  -- TEST 09: client_key maps produce UUID mappings
  IF v_doc_res->'section_key_map'->>'sec-1' IS NULL OR v_doc_res->'step_key_map'->>'step-1' IS NULL THEN
    RAISE EXCEPTION 'TEST 09 FAILED: client_key maps did not produce UUIDs';
  END IF;
  RAISE NOTICE 'TEST 09 PASSED';

  v_sec1_id := (v_doc_res->'section_key_map'->>'sec-1')::uuid;
  v_sec2_id := (v_doc_res->'section_key_map'->>'sec-2')::uuid;
  v_step1_id := (v_doc_res->'step_key_map'->>'step-1')::uuid;
  v_step2_id := (v_doc_res->'step_key_map'->>'step-2')::uuid;

  -- TEST 05: Verify responsible_role NULL sync when no R present (Step 2) & mirrored when R is present (Step 1)
  IF (SELECT responsible_role FROM public.sop_procedure_steps WHERE id = v_step2_id) IS NOT NULL THEN
    RAISE EXCEPTION 'TEST 05 FAILED: Step 2 responsible_role should be NULL when no R is present';
  END IF;
  IF (SELECT responsible_role FROM public.sop_procedure_steps WHERE id = v_step1_id) <> 'Primary Nurse' THEN
    RAISE EXCEPTION 'TEST 05 FAILED: Step 1 responsible_role did not mirror R';
  END IF;
  RAISE NOTICE 'TEST 05 PASSED';

  -- --------------------------------------------------------------------------
  -- TEST 39: Existing legacy step preserves responsible_role when RACI omitted
  -- --------------------------------------------------------------------------
  v_step3_id := gen_random_uuid();
  INSERT INTO public.sop_procedure_steps (
    id, sop_version_id, section_id, sequence_number, responsible_role, action_instruction_en
  ) VALUES (
    v_step3_id, v_ver_id, v_sec1_id, 3, 'Senior Charge Nurse', 'Legacy instruction step'
  );

  PERFORM public.save_governed_sop_draft(
    p_actor_id => v_user_author,
    p_version_id => v_ver_id,
    p_procedure_steps => jsonb_build_array(
      jsonb_build_object('id', v_step1_id, 'sequence_number', 1, 'action_instruction_en', 'Assemble handover documentation'),
      jsonb_build_object('id', v_step2_id, 'sequence_number', 2, 'action_instruction_en', 'Conduct patient safety check'),
      jsonb_build_object('id', v_step3_id, 'sequence_number', 3, 'action_instruction_en', 'Updated legacy instruction')
    )
  );

  IF (SELECT responsible_role FROM public.sop_procedure_steps WHERE id = v_step3_id) <> 'Senior Charge Nurse' THEN
    RAISE EXCEPTION 'TEST 39 FAILED: Existing responsible_role was silently modified or nulled';
  END IF;
  RAISE NOTICE 'TEST 39 PASSED';

  -- --------------------------------------------------------------------------
  -- TEST 40: Explicit empty RACI sets responsible_role to NULL
  -- --------------------------------------------------------------------------
  PERFORM public.save_governed_sop_draft(
    p_actor_id => v_user_author,
    p_version_id => v_ver_id,
    p_procedure_steps => jsonb_build_array(
      jsonb_build_object('id', v_step1_id, 'sequence_number', 1, 'action_instruction_en', 'Assemble handover documentation'),
      jsonb_build_object('id', v_step2_id, 'sequence_number', 2, 'action_instruction_en', 'Conduct patient safety check'),
      jsonb_build_object('id', v_step3_id, 'sequence_number', 3, 'action_instruction_en', 'Updated legacy instruction', 'raci_assignments', '[]'::jsonb)
    )
  );

  IF (SELECT responsible_role FROM public.sop_procedure_steps WHERE id = v_step3_id) IS NOT NULL THEN
    RAISE EXCEPTION 'TEST 40 FAILED: Explicit empty RACI did not set responsible_role to NULL';
  END IF;
  RAISE NOTICE 'TEST 40 PASSED';

  DELETE FROM public.sop_procedure_steps WHERE id = v_step3_id;

  -- --------------------------------------------------------------------------
  -- TEST 41: Legacy controlled SOP creation preserves content_mode
  -- --------------------------------------------------------------------------
  v_legacy_doc_res := public.create_governed_sop_draft(
    p_actor_id => v_user_author,
    p_organization_id => v_org_id,
    p_title_en => 'Legacy Uploaded Procedure',
    p_department_id => v_dept_id,
    p_criticality_level => 'medium',
    p_content_mode => 'legacy_controlled_document'
  );

  v_legacy_doc_id := (v_legacy_doc_res->>'document_id')::uuid;
  v_legacy_ver_id := (v_legacy_doc_res->>'version_id')::uuid;

  IF (SELECT content_mode FROM public.governed_sop_details WHERE version_id = v_legacy_ver_id) <> 'legacy_controlled_document'
     OR (SELECT transcription_status FROM public.governed_sop_details WHERE version_id = v_legacy_ver_id) <> 'not_required' THEN
    RAISE EXCEPTION 'TEST 41 FAILED: Legacy SOP creation did not preserve legacy_controlled_document mode';
  END IF;
  RAISE NOTICE 'TEST 41 PASSED';

  -- --------------------------------------------------------------------------
  -- TEST 48: Document-Scoped RPCs Reject Cross-Org Actor
  -- --------------------------------------------------------------------------
  v_err_caught := false;
  BEGIN
    PERFORM public.save_governed_sop_draft(p_actor_id => v_user_other_org, p_version_id => v_ver_id, p_title_en => 'Unauthorized Save');
  EXCEPTION WHEN others THEN
    IF SQLERRM LIKE '%PATCH202_ACTOR_CROSS_ORG_FORBIDDEN%' THEN v_err_caught := true; END IF;
  END;
  IF NOT v_err_caught THEN RAISE EXCEPTION 'TEST 48 FAILED: save_governed_sop_draft permitted cross-org actor'; END IF;

  v_err_caught := false;
  BEGIN
    PERFORM public.submit_governed_document_for_review(v_user_other_org, v_ver_id, 'Unauthorized Submit');
  EXCEPTION WHEN others THEN
    IF SQLERRM LIKE '%PATCH202_ACTOR_CROSS_ORG_FORBIDDEN%' THEN v_err_caught := true; END IF;
  END;
  IF NOT v_err_caught THEN RAISE EXCEPTION 'TEST 48 FAILED: submit_governed_document_for_review permitted cross-org actor'; END IF;

  v_err_caught := false;
  BEGIN
    PERFORM public.finalize_governed_document_approval(v_user_other_org, v_ver_id, 'Unauthorized Finalize');
  EXCEPTION WHEN others THEN
    IF SQLERRM LIKE '%PATCH202_ACTOR_CROSS_ORG_FORBIDDEN%' THEN v_err_caught := true; END IF;
  END;
  IF NOT v_err_caught THEN RAISE EXCEPTION 'TEST 48 FAILED: finalize_governed_document_approval permitted cross-org actor'; END IF;

  v_err_caught := false;
  BEGIN
    PERFORM public.start_governed_document_revision(v_user_other_org, v_ver_id, 'minor', 'Unauthorized Revision');
  EXCEPTION WHEN others THEN
    IF SQLERRM LIKE '%PATCH202_ACTOR_CROSS_ORG_FORBIDDEN%' THEN v_err_caught := true; END IF;
  END;
  IF NOT v_err_caught THEN RAISE EXCEPTION 'TEST 48 FAILED: start_governed_document_revision permitted cross-org actor'; END IF;
  RAISE NOTICE 'TEST 48 PASSED';

  -- --------------------------------------------------------------------------
  -- TEST 54, 55, 56, 57: Unrelated Active Same-Org Employee Business Authority Guard
  -- --------------------------------------------------------------------------
  -- TEST 54: Unrelated active same-org employee cannot save another user's SOP draft
  v_err_caught := false;
  BEGIN
    PERFORM public.save_governed_sop_draft(
      p_actor_id => v_user_unrelated_emp,
      p_version_id => v_ver_id,
      p_title_en => 'Tampered Title'
    );
  EXCEPTION WHEN others THEN
    IF SQLERRM LIKE '%PATCH202_ACTOR_NOT_AUTHORIZED%' THEN v_err_caught := true; END IF;
  END;
  IF NOT v_err_caught THEN RAISE EXCEPTION 'TEST 54 FAILED: Unrelated employee saved another users SOP draft'; END IF;
  RAISE NOTICE 'TEST 54 PASSED';

  -- TEST 55: Unrelated active same-org employee cannot submit another user's SOP draft
  v_err_caught := false;
  BEGIN
    PERFORM public.submit_governed_document_for_review(v_user_unrelated_emp, v_ver_id, 'Unrelated submit attempt');
  EXCEPTION WHEN others THEN
    IF SQLERRM LIKE '%PATCH202_ACTOR_NOT_AUTHORIZED%' THEN v_err_caught := true; END IF;
  END;
  IF NOT v_err_caught THEN RAISE EXCEPTION 'TEST 55 FAILED: Unrelated employee submitted another users SOP draft'; END IF;
  RAISE NOTICE 'TEST 55 PASSED';

  -- TEST 56: Unrelated active same-org employee cannot start revision on another user's SOP
  v_err_caught := false;
  BEGIN
    PERFORM public.start_governed_document_revision(v_user_unrelated_emp, v_ver_id, 'minor', 'Unrelated revision attempt');
  EXCEPTION WHEN others THEN
    IF SQLERRM LIKE '%PATCH202_ACTOR_NOT_AUTHORIZED%' THEN v_err_caught := true; END IF;
  END;
  IF NOT v_err_caught THEN RAISE EXCEPTION 'TEST 56 FAILED: Unrelated employee started revision on another users SOP'; END IF;
  RAISE NOTICE 'TEST 56 PASSED';

  -- --------------------------------------------------------------------------
  -- TEST 01: Cross-version section attachment rejected
  -- --------------------------------------------------------------------------
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
  IF NOT v_err_caught THEN RAISE EXCEPTION 'TEST 01 FAILED: Cross-version section attachment was not rejected'; END IF;
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
  IF NOT v_err_caught THEN RAISE EXCEPTION 'TEST 02 FAILED: Cross-version RACI attachment was not rejected'; END IF;
  RAISE NOTICE 'TEST 02 PASSED';

  -- --------------------------------------------------------------------------
  -- TEST 03: Section AND Step Sequence Reorder Collision Safety (Deferrable)
  -- --------------------------------------------------------------------------
  -- Section swap 1<->2
  PERFORM public.save_governed_sop_draft(
    p_actor_id => v_user_author,
    p_version_id => v_ver_id,
    p_procedure_sections => jsonb_build_array(
      jsonb_build_object('id', v_sec1_id, 'sequence_number', 2, 'title_en', 'Pre-Handover Briefing'),
      jsonb_build_object('id', v_sec2_id, 'sequence_number', 1, 'title_en', 'Bedside Transfer')
    )
  );
  IF (SELECT sequence_number FROM public.sop_procedure_sections WHERE id = v_sec1_id) <> 2 THEN
    RAISE EXCEPTION 'TEST 03 FAILED: Deferrable section sequence swap did not persist';
  END IF;

  -- Step swap 1<->2
  PERFORM public.save_governed_sop_draft(
    p_actor_id => v_user_author,
    p_version_id => v_ver_id,
    p_procedure_steps => jsonb_build_array(
      jsonb_build_object('id', v_step1_id, 'section_id', v_sec1_id, 'sequence_number', 2, 'action_instruction_en', 'Assemble handover documentation'),
      jsonb_build_object('id', v_step2_id, 'section_id', v_sec2_id, 'sequence_number', 1, 'action_instruction_en', 'Conduct patient safety check')
    )
  );
  IF (SELECT sequence_number FROM public.sop_procedure_steps WHERE id = v_step1_id) <> 2
     OR (SELECT sequence_number FROM public.sop_procedure_steps WHERE id = v_step2_id) <> 1 THEN
    RAISE EXCEPTION 'TEST 03 FAILED: Deferrable step sequence swap did not persist';
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
  IF NOT v_err_caught THEN RAISE EXCEPTION 'TEST 04 FAILED: Second Accountable on same step was not rejected'; END IF;
  RAISE NOTICE 'TEST 04 PASSED';

  -- --------------------------------------------------------------------------
  -- TEST 06: Independent Missing-R Submission Rejection (Has exactly 1 A, 0 R)
  -- --------------------------------------------------------------------------
  -- Setup: Step 1 has A only (no R), Step 2 has R and A
  PERFORM public.save_governed_sop_draft(
    p_actor_id => v_user_author,
    p_version_id => v_ver_id,
    p_procedure_steps => jsonb_build_array(
      jsonb_build_object(
        'id', v_step1_id, 'section_id', v_sec1_id, 'sequence_number', 1,
        'action_instruction_en', 'Step 1 has A only',
        'raci_assignments', jsonb_build_array(
          jsonb_build_object('raci_type', 'A', 'role_name', 'Nurse In Charge')
        )
      ),
      jsonb_build_object(
        'id', v_step2_id, 'section_id', v_sec2_id, 'sequence_number', 2,
        'action_instruction_en', 'Step 2 has R and A',
        'raci_assignments', jsonb_build_array(
          jsonb_build_object('raci_type', 'R', 'role_name', 'Staff Nurse'),
          jsonb_build_object('raci_type', 'A', 'role_name', 'Attending Physician')
        )
      )
    )
  );

  v_err_caught := false;
  BEGIN
    PERFORM public.submit_governed_document_for_review(v_user_author, v_ver_id, 'Submit missing R');
  EXCEPTION WHEN others THEN
    IF SQLERRM LIKE '%PATCH206_SOP_STEP_RACI_INCOMPLETE%' THEN v_err_caught := true; END IF;
  END;
  IF NOT v_err_caught THEN RAISE EXCEPTION 'TEST 06 FAILED: Submission with missing R was not rejected'; END IF;
  RAISE NOTICE 'TEST 06 PASSED';

  -- --------------------------------------------------------------------------
  -- TEST 07: Independent Missing-A Submission Rejection (Has R, 0 A)
  -- --------------------------------------------------------------------------
  -- Setup: Step 1 has R only (no A), Step 2 has R and A
  PERFORM public.save_governed_sop_draft(
    p_actor_id => v_user_author,
    p_version_id => v_ver_id,
    p_procedure_steps => jsonb_build_array(
      jsonb_build_object(
        'id', v_step1_id, 'section_id', v_sec1_id, 'sequence_number', 1,
        'action_instruction_en', 'Step 1 has R only',
        'raci_assignments', jsonb_build_array(
          jsonb_build_object('raci_type', 'R', 'role_name', 'Primary Nurse')
        )
      ),
      jsonb_build_object(
        'id', v_step2_id, 'section_id', v_sec2_id, 'sequence_number', 2,
        'action_instruction_en', 'Step 2 has R and A',
        'raci_assignments', jsonb_build_array(
          jsonb_build_object('raci_type', 'R', 'role_name', 'Staff Nurse'),
          jsonb_build_object('raci_type', 'A', 'role_name', 'Attending Physician')
        )
      )
    )
  );

  v_err_caught := false;
  BEGIN
    PERFORM public.submit_governed_document_for_review(v_user_author, v_ver_id, 'Submit missing A');
  EXCEPTION WHEN others THEN
    IF SQLERRM LIKE '%PATCH206_SOP_STEP_RACI_INCOMPLETE%' THEN v_err_caught := true; END IF;
  END;
  IF NOT v_err_caught THEN RAISE EXCEPTION 'TEST 07 FAILED: Submission with missing A was not rejected'; END IF;
  RAISE NOTICE 'TEST 07 PASSED';

  -- Complete RACI on both Step 1 & Step 2 for subsequent tests
  PERFORM public.save_governed_sop_draft(
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
  INSERT INTO public.controlled_documents (id, organization_id, document_code, document_title, document_type, created_by, updated_by)
  VALUES ('40000000-0000-0000-0000-000000000088'::uuid, v_other_org_id, 'SOP-EXT-88', 'Ext Doc', 'sop', v_user_other_org, v_user_other_org)
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.document_versions (id, document_id, version_number, version_label, prepared_by, is_current_version)
  VALUES ('50000000-0000-0000-0000-000000000088'::uuid, '40000000-0000-0000-0000-000000000088'::uuid, 1, '1.0', v_user_other_org, true)
  ON CONFLICT (id) DO NOTHING;

  v_err_caught := false;
  BEGIN
    INSERT INTO public.governed_document_version_links (source_version_id, target_version_id, relationship_type)
    VALUES (v_ver_id, '50000000-0000-0000-0000-000000000088'::uuid, 'references_sop');
  EXCEPTION WHEN others THEN
    IF SQLERRM LIKE '%PATCH206_CROSS_ORGANIZATION_LINK_DENIED%' THEN v_err_caught := true; END IF;
  END;
  IF NOT v_err_caught THEN RAISE EXCEPTION 'TEST 08 FAILED: Cross-org version link was not rejected'; END IF;
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
    IF SQLERRM LIKE '%PATCH206_UNRESOLVED_SECTION_CLIENT_KEY%' THEN v_err_caught := true; END IF;
  END;
  IF NOT v_err_caught THEN RAISE EXCEPTION 'TEST 10 FAILED: Unresolved section_client_key was not rejected'; END IF;
  RAISE NOTICE 'TEST 10 PASSED';

  -- --------------------------------------------------------------------------
  -- TEST 14: Missing Authority Rule Fails Closed
  -- --------------------------------------------------------------------------
  INSERT INTO public.departments (id, organization_id, code, name_en, is_active)
  VALUES ('30000000-0000-0000-0000-000000000099'::uuid, v_org_id, 'NO_RULE_DEPT', 'No Rule Dept', true)
  ON CONFLICT (id) DO NOTHING;

  UPDATE public.controlled_documents SET department_id = '30000000-0000-0000-0000-000000000099'::uuid WHERE id = v_doc_id;

  v_err_caught := false;
  BEGIN
    PERFORM public.submit_governed_document_for_review(v_user_author, v_ver_id, 'Submit with no matching rule');
  EXCEPTION WHEN others THEN
    IF SQLERRM LIKE '%PATCH206_AUTHORITY_RULE_REQUIRED%' OR SQLERRM LIKE '%PATCH27_NO_MATCHING_RULE%' THEN
      v_err_caught := true;
    END IF;
  END;
  IF NOT v_err_caught THEN RAISE EXCEPTION 'TEST 14 FAILED: Submission with no matching rule did not fail closed'; END IF;
  RAISE NOTICE 'TEST 14 PASSED';

  UPDATE public.controlled_documents SET department_id = v_dept_id WHERE id = v_doc_id;

  -- --------------------------------------------------------------------------
  -- TEST 15: Missing Stage Configuration Fails Closed
  -- --------------------------------------------------------------------------
  UPDATE public.controlled_documents SET criticality_level = 'low' WHERE id = v_doc_id;

  v_err_caught := false;
  BEGIN
    PERFORM public.submit_governed_document_for_review(v_user_author, v_ver_id, 'Submit on rule without stages');
  EXCEPTION WHEN others THEN
    IF SQLERRM LIKE '%PATCH206_ORDERED_STAGES_REQUIRED%' THEN v_err_caught := true; END IF;
  END;
  IF NOT v_err_caught THEN RAISE EXCEPTION 'TEST 15 FAILED: Submission on rule with no stages did not fail closed'; END IF;
  RAISE NOTICE 'TEST 15 PASSED';

  UPDATE public.controlled_documents SET criticality_level = 'high' WHERE id = v_doc_id;

  -- --------------------------------------------------------------------------
  -- TEST 16 & 17: Submission & Inferred Stage 1 Status Assertions
  -- --------------------------------------------------------------------------
  v_appr_res := public.submit_governed_document_for_review(v_user_author, v_ver_id, 'Submitting for two-stage approval');
  v_appr_req_id := (v_appr_res->>'approval_request_id')::uuid;

  IF v_appr_res->>'workflow_stage' <> 'dept_review' THEN
    RAISE EXCEPTION 'TEST 16 FAILED: Initial workflow stage should be dept_review';
  END IF;
  RAISE NOTICE 'TEST 16 PASSED';

  -- TEST 17: Real assertions on Stage 1 (in_progress, started_at not null) & Stage 2 (pending, started_at null)
  SELECT stage_status, started_at INTO v_st1_status, v_st1_started
  FROM public.approval_request_stages WHERE approval_request_id = v_appr_req_id AND stage_order = 1;

  SELECT stage_status, started_at INTO v_st2_status, v_st2_started
  FROM public.approval_request_stages WHERE approval_request_id = v_appr_req_id AND stage_order = 2;

  IF v_st1_status <> 'in_progress' OR v_st1_started IS NULL THEN
    RAISE EXCEPTION 'TEST 17 FAILED: Stage 1 is not in_progress or started_at is NULL (status: %, started: %)', v_st1_status, v_st1_started;
  END IF;
  IF v_st2_status <> 'pending' OR v_st2_started IS NOT NULL THEN
    RAISE EXCEPTION 'TEST 17 FAILED: Stage 2 is not pending or started_at is NOT NULL (status: %, started: %)', v_st2_status, v_st2_started;
  END IF;
  RAISE NOTICE 'TEST 17 PASSED';

  -- --------------------------------------------------------------------------
  -- TEST 23: Self Approval Blocked on Stage 1
  -- --------------------------------------------------------------------------
  v_err_caught := false;
  BEGIN
    PERFORM public.record_approval_decision(v_appr_req_id, v_user_author, 'approved', 'Self approval attempt');
  EXCEPTION WHEN others THEN
    IF SQLERRM LIKE '%PATCH27_SELF_APPROVAL_BLOCKED%' THEN v_err_caught := true; END IF;
  END;
  IF NOT v_err_caught THEN RAISE EXCEPTION 'TEST 23 FAILED: Self approval was not blocked'; END IF;
  RAISE NOTICE 'TEST 23 PASSED';

  -- --------------------------------------------------------------------------
  -- TEST 18: Unauthorized Actor (Author lacks department_manager role)
  -- --------------------------------------------------------------------------
  v_err_caught := false;
  BEGIN
    PERFORM public.record_approval_decision(v_appr_req_id, v_user_exec, 'approved', 'Exec trying to approve stage 1');
  EXCEPTION WHEN others THEN
    IF SQLERRM LIKE '%PATCH27_APPROVER_ROLE_MISMATCH%' THEN v_err_caught := true; END IF;
  END;
  IF NOT v_err_caught THEN RAISE EXCEPTION 'TEST 18 FAILED: Wrong role actor was not rejected'; END IF;
  RAISE NOTICE 'TEST 18 PASSED';

  -- --------------------------------------------------------------------------
  -- TEST 47: Unrelated super_admin cannot bypass configured role
  -- --------------------------------------------------------------------------
  v_err_caught := false;
  BEGIN
    PERFORM public.record_approval_decision(v_appr_req_id, v_user_super_admin, 'approved', 'Super admin bypass attempt');
  EXCEPTION WHEN others THEN
    IF SQLERRM LIKE '%PATCH27_APPROVER_ROLE_MISMATCH%' THEN v_err_caught := true; END IF;
  END;
  IF NOT v_err_caught THEN RAISE EXCEPTION 'TEST 47 FAILED: Unrelated super_admin bypassed configured role'; END IF;
  RAISE NOTICE 'TEST 47 PASSED';

  -- --------------------------------------------------------------------------
  -- TEST 20 & 46: Same Role in Wrong Org Actor Rejected
  -- --------------------------------------------------------------------------
  v_err_caught := false;
  BEGIN
    PERFORM public.record_approval_decision(v_appr_req_id, v_user_other_org, 'approved', 'External user approval');
  EXCEPTION WHEN others THEN
    IF SQLERRM LIKE '%PATCH27_APPROVER_ORGANIZATION_MISMATCH%' OR SQLERRM LIKE '%PATCH27_APPROVER_ROLE_MISMATCH%' THEN
      v_err_caught := true;
    END IF;
  END;
  IF NOT v_err_caught THEN RAISE EXCEPTION 'TEST 20/46 FAILED: Wrong org actor with same role was not rejected'; END IF;
  RAISE NOTICE 'TEST 20 & 46 PASSED';

  -- --------------------------------------------------------------------------
  -- TEST 21: Delegation Rejection Matrix (Expired, Wrong Workflow, Action, Dept)
  -- --------------------------------------------------------------------------
  DELETE FROM public.approval_delegations WHERE delegate_id = v_user_delegate;

  -- 21.1: Expired delegation
  INSERT INTO public.approval_delegations (organization_id, delegator_id, delegate_id, effective_from, effective_to, active_flag, workflow_type, action_type, department_id)
  VALUES (v_org_id, v_user_dept_mgr, v_user_delegate, now() - interval '10 days', now() - interval '1 day', true, 'document_control', 'approve_document', v_dept_id);

  v_err_caught := false;
  BEGIN
    PERFORM public.record_approval_decision(v_appr_req_id, v_user_delegate, 'approved', 'Expired delegate attempt');
  EXCEPTION WHEN others THEN
    IF SQLERRM LIKE '%PATCH27_APPROVER_ROLE_MISMATCH%' THEN v_err_caught := true; END IF;
  END;
  IF NOT v_err_caught THEN RAISE EXCEPTION 'TEST 21.1 FAILED: Expired delegation was accepted'; END IF;

  -- 21.2: Wrong workflow_type
  DELETE FROM public.approval_delegations WHERE delegate_id = v_user_delegate;
  INSERT INTO public.approval_delegations (organization_id, delegator_id, delegate_id, effective_from, effective_to, active_flag, workflow_type, action_type, department_id)
  VALUES (v_org_id, v_user_dept_mgr, v_user_delegate, now() - interval '1 hour', now() + interval '10 days', true, 'evidence', 'approve_document', v_dept_id);

  v_err_caught := false;
  BEGIN
    PERFORM public.record_approval_decision(v_appr_req_id, v_user_delegate, 'approved', 'Wrong workflow delegate attempt');
  EXCEPTION WHEN others THEN
    IF SQLERRM LIKE '%PATCH27_APPROVER_ROLE_MISMATCH%' THEN v_err_caught := true; END IF;
  END;
  IF NOT v_err_caught THEN RAISE EXCEPTION 'TEST 21.2 FAILED: Wrong workflow delegation was accepted'; END IF;

  -- 21.3: Wrong action_type
  DELETE FROM public.approval_delegations WHERE delegate_id = v_user_delegate;
  INSERT INTO public.approval_delegations (organization_id, delegator_id, delegate_id, effective_from, effective_to, active_flag, workflow_type, action_type, department_id)
  VALUES (v_org_id, v_user_dept_mgr, v_user_delegate, now() - interval '1 hour', now() + interval '10 days', true, 'document_control', 'approve_evidence', v_dept_id);

  v_err_caught := false;
  BEGIN
    PERFORM public.record_approval_decision(v_appr_req_id, v_user_delegate, 'approved', 'Wrong action delegate attempt');
  EXCEPTION WHEN others THEN
    IF SQLERRM LIKE '%PATCH27_APPROVER_ROLE_MISMATCH%' THEN v_err_caught := true; END IF;
  END;
  IF NOT v_err_caught THEN RAISE EXCEPTION 'TEST 21.3 FAILED: Wrong action delegation was accepted'; END IF;

  -- 21.4: Wrong department_id
  DELETE FROM public.approval_delegations WHERE delegate_id = v_user_delegate;
  INSERT INTO public.approval_delegations (organization_id, delegator_id, delegate_id, effective_from, effective_to, active_flag, workflow_type, action_type, department_id)
  VALUES (v_org_id, v_user_dept_mgr, v_user_delegate, now() - interval '1 hour', now() + interval '10 days', true, 'document_control', 'approve_document', v_other_dept_id);

  v_err_caught := false;
  BEGIN
    PERFORM public.record_approval_decision(v_appr_req_id, v_user_delegate, 'approved', 'Wrong dept delegate attempt');
  EXCEPTION WHEN others THEN
    IF SQLERRM LIKE '%PATCH27_APPROVER_ROLE_MISMATCH%' THEN v_err_caught := true; END IF;
  END;
  IF NOT v_err_caught THEN RAISE EXCEPTION 'TEST 21.4 FAILED: Wrong dept delegation was accepted'; END IF;

  RAISE NOTICE 'TEST 21 PASSED';

  -- --------------------------------------------------------------------------
  -- TEST 22 & 19 & 25: Correctly Scoped Active Delegation Advances Stage
  -- --------------------------------------------------------------------------
  DELETE FROM public.approval_delegations WHERE delegate_id = v_user_delegate;
  INSERT INTO public.approval_delegations (
    organization_id, delegator_id, delegate_id, effective_from, effective_to, active_flag,
    workflow_type, action_type, department_id
  ) VALUES (
    v_org_id, v_user_dept_mgr, v_user_delegate, now() - interval '1 hour', now() + interval '10 days', true,
    'document_control', 'approve_document', v_dept_id
  );

  v_dec_res := public.record_approval_decision(v_appr_req_id, v_user_delegate, 'approved', 'Stage 1 Delegate Approval');

  IF v_dec_res->>'request_status' <> 'partially_approved' THEN
    RAISE EXCEPTION 'TEST 22 FAILED: Stage 1 delegate approval failed to advance status';
  END IF;

  -- TEST 25: Document advances to qa_approval, not approved
  IF (SELECT workflow_stage FROM public.controlled_documents WHERE id = v_doc_id) <> 'qa_approval' THEN
    RAISE EXCEPTION 'TEST 25 FAILED: Stage 1 did not advance document to qa_approval';
  END IF;
  RAISE NOTICE 'TEST 19, 22 & 25 PASSED';

  -- --------------------------------------------------------------------------
  -- TEST 24: Duplicate Voting on Open Multi-Approver Stage Blocked
  -- --------------------------------------------------------------------------
  -- Setup multi-approver rule (2 distinct executives required)
  INSERT INTO auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  VALUES ('a0000000-0000-0000-0000-000000000044'::uuid, 'authenticated', 'authenticated', 'exec2@test.com', '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now())
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.profiles (id, organization_id, department_id, full_name_en, email, employee_no, is_active)
  VALUES ('a0000000-0000-0000-0000-000000000044'::uuid, v_org_id, v_dept_id, 'Executive Two', 'exec2@test.com', 'EMP-44', true)
  ON CONFLICT (id) DO UPDATE SET is_active = true, organization_id = EXCLUDED.organization_id;
  INSERT INTO public.user_roles (user_id, role, organization_id)
  VALUES ('a0000000-0000-0000-0000-000000000044'::uuid, 'executive', v_org_id)
  ON CONFLICT DO NOTHING;

  INSERT INTO public.approval_authority_rules (
    id, organization_id, rule_code, rule_name, workflow_type, action_type, department_id,
    document_type, criticality_level, required_approval_count, allow_self_approval, active_flag
  ) VALUES (
    v_rule_multi_approver_id, v_org_id, 'R-MULTI-EXEC', 'Multi Exec Rule', 'document_control', 'approve_document',
    v_dept_id, 'policy', 'critical', 2, false, true
  );

  PERFORM public.configure_approval_authority_rule_stages(
    v_user_super_admin,
    v_rule_multi_approver_id,
    jsonb_build_array(
      jsonb_build_object('stage_key', 'exec_dual', 'stage_name_en', 'Dual Exec Stage', 'reviewer_role', 'executive', 'required_decision_count', 2, 'allow_self_approval', false)
    )
  );

  -- Create dummy policy to submit against multi-approver rule
  INSERT INTO public.controlled_documents (id, organization_id, document_code, document_title, document_type, criticality_level, department_id, created_by, updated_by)
  VALUES ('40000000-0000-0000-0000-000000000077'::uuid, v_org_id, 'POL-MULTI-77', 'Multi Policy', 'policy', 'critical', v_dept_id, v_user_author, v_user_author)
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.document_versions (id, document_id, version_number, version_label, prepared_by, is_current_version)
  VALUES ('50000000-0000-0000-0000-000000000077'::uuid, '40000000-0000-0000-0000-000000000077'::uuid, 1, '1.0', v_user_author, true)
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.governed_policy_details (version_id, title_en, policy_statement_en)
  VALUES ('50000000-0000-0000-0000-000000000077'::uuid, 'Multi Policy', 'Statement')
  ON CONFLICT (version_id) DO NOTHING;

  v_appr_res := public.submit_governed_document_for_review(v_user_author, '50000000-0000-0000-0000-000000000077'::uuid, 'Submitting multi-approver');
  v_multi_req_id := (v_appr_res->>'approval_request_id')::uuid;

  -- First approver votes (Stage remains in_progress, received_decision_count = 1)
  v_dec_res := public.record_approval_decision(v_multi_req_id, v_user_exec, 'approved', 'First exec vote');
  IF (SELECT stage_status FROM public.approval_request_stages WHERE approval_request_id = v_multi_req_id) <> 'in_progress'
     OR (SELECT received_decision_count FROM public.approval_request_stages WHERE approval_request_id = v_multi_req_id) <> 1 THEN
    RAISE EXCEPTION 'TEST 24 FAILED: Multi-approver stage should remain in_progress after 1 vote';
  END IF;

  -- Same approver votes AGAIN on the still-open stage -> MUST FAIL
  v_err_caught := false;
  BEGIN
    PERFORM public.record_approval_decision(v_multi_req_id, v_user_exec, 'approved', 'Duplicate vote on open stage');
  EXCEPTION WHEN others THEN
    IF SQLERRM LIKE '%PATCH27_DUPLICATE_STAGE_DECISION%' THEN v_err_caught := true; END IF;
  END;
  IF NOT v_err_caught THEN RAISE EXCEPTION 'TEST 24 FAILED: Duplicate decision on open multi-approver stage was not blocked'; END IF;
  RAISE NOTICE 'TEST 24 PASSED';

  -- --------------------------------------------------------------------------
  -- TEST 26: Final Stage Approval Marks Request Approved
  -- --------------------------------------------------------------------------
  v_dec_res := public.record_approval_decision(v_appr_req_id, v_user_qa_dir, 'approved', 'Stage 2 QA Approval');

  IF v_dec_res->>'request_status' <> 'approved' THEN
    RAISE EXCEPTION 'TEST 26 FAILED: Final stage approval should mark request approved';
  END IF;
  RAISE NOTICE 'TEST 26 PASSED';

  -- --------------------------------------------------------------------------
  -- TEST 57: Unrelated Active Same-Org Employee Cannot Finalize Approval
  -- --------------------------------------------------------------------------
  v_err_caught := false;
  BEGIN
    PERFORM public.finalize_governed_document_approval(v_user_unrelated_emp, v_ver_id, 'Unrelated finalize attempt');
  EXCEPTION WHEN others THEN
    IF SQLERRM LIKE '%PATCH202_ACTOR_NOT_AUTHORIZED%' THEN v_err_caught := true; END IF;
  END;
  IF NOT v_err_caught THEN RAISE EXCEPTION 'TEST 57 FAILED: Unrelated employee finalized approved workflow'; END IF;
  RAISE NOTICE 'TEST 57 PASSED';

  -- --------------------------------------------------------------------------
  -- TEST 31 & 58: Legitimate Operational Finalization (by Completing Approver / Admin)
  -- --------------------------------------------------------------------------
  v_fin_res := public.finalize_governed_document_approval(v_user_qa_dir, v_ver_id, 'Final sign-off note');

  IF (v_fin_res->>'approved_by')::uuid <> v_user_qa_dir THEN
    RAISE EXCEPTION 'TEST 31 FAILED: approved_by was not derived from Stage 2 QA Approver';
  END IF;
  IF (SELECT locked_by FROM public.document_versions WHERE id = v_ver_id) <> v_user_qa_dir THEN
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
    IF SQLERRM LIKE '%PATCH201_VERSION_IMMUTABLE_LOCKED%' THEN v_err_caught := true; END IF;
  END;
  IF NOT v_err_caught THEN RAISE EXCEPTION 'TEST 38 FAILED: Immutability did not block insertion on approved version'; END IF;
  RAISE NOTICE 'TEST 38 PASSED';

  -- --------------------------------------------------------------------------
  -- TEST 11, 12, 13 & 58: Revision Deep Cloning & Explicit UUID Mapping (by Author)
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

  IF EXISTS (
    SELECT 1 FROM public.sop_procedure_steps s1
    JOIN public.sop_procedure_steps s2 ON s1.id = s2.id
    WHERE s1.sop_version_id = v_ver_id AND s2.sop_version_id = v_rev_ver_id
  ) THEN
    RAISE EXCEPTION 'TEST 11 FAILED: Cloned steps share UUIDs with source version';
  END IF;

  IF (SELECT reacknowledgment_required FROM public.governed_sop_details WHERE version_id = v_rev_ver_id) <> true
     OR (SELECT retraining_required FROM public.governed_sop_details WHERE version_id = v_rev_ver_id) <> false THEN
    RAISE EXCEPTION 'TEST 13 FAILED: Rollout reset flags were not preserved';
  END IF;
  RAISE NOTICE 'TEST 11, 12, 13 PASSED';

  -- --------------------------------------------------------------------------
  -- TEST 27 & 28: Return & Rejection Lifecycle Transitions
  -- --------------------------------------------------------------------------
  v_appr_res := public.submit_governed_document_for_review(v_user_author, v_rev_ver_id, 'Submitting revision');
  v_appr_req_id := (v_appr_res->>'approval_request_id')::uuid;

  -- TEST 27: Return restores document to draft
  PERFORM public.record_approval_decision(v_appr_req_id, v_user_dept_mgr, 'returned', 'Need revisions on section 1');
  IF (SELECT document_status FROM public.controlled_documents WHERE id = v_doc_id) <> 'draft' THEN
    RAISE EXCEPTION 'TEST 27 FAILED: Return decision did not restore document status to draft';
  END IF;
  RAISE NOTICE 'TEST 27 PASSED';

  -- Submit again for Rejection test
  v_appr_res := public.submit_governed_document_for_review(v_user_author, v_rev_ver_id, 'Resubmitting revision');
  v_appr_req_id := (v_appr_res->>'approval_request_id')::uuid;

  -- TEST 28: Rejection marks document rejected
  PERFORM public.record_approval_decision(v_appr_req_id, v_user_dept_mgr, 'rejected', 'Critical clinical hazard');
  IF (SELECT document_status FROM public.controlled_documents WHERE id = v_doc_id) <> 'rejected' THEN
    RAISE EXCEPTION 'TEST 28 FAILED: Rejection decision did not set document status to rejected';
  END IF;
  RAISE NOTICE 'TEST 28 PASSED';

  -- --------------------------------------------------------------------------
  -- TEST 29 & 30: Finalization Guard Failures & Zero-Stage Finalization Assertion
  -- --------------------------------------------------------------------------
  -- TEST 29.1: Attempting to finalize an unapproved/rejected request throws PATCH202_APPROVAL_NOT_FINALIZED
  v_err_caught := false;
  BEGIN
    PERFORM public.finalize_governed_document_approval(v_user_qa_dir, v_rev_ver_id, 'Attempting finalize on rejected version');
  EXCEPTION WHEN others THEN
    IF SQLERRM LIKE '%PATCH202_APPROVAL_NOT_FINALIZED%' THEN v_err_caught := true; END IF;
  END;
  IF NOT v_err_caught THEN RAISE EXCEPTION 'TEST 29.1 FAILED: Finalization on rejected request was not rejected'; END IF;

  -- TEST 29.2: Zero-stage finalization assertion (approved request with 0 stages throws PATCH206_NO_STAGES_INSTANTIATED)
  INSERT INTO public.approval_requests (
    id, organization_id, workflow_type, linked_item_type, linked_item_id, action_type,
    requested_by, request_status, final_decision, required_approval_count, received_approval_count, requested_at
  ) VALUES (
    '70000000-0000-0000-0000-000000000099'::uuid, v_org_id, 'document_control', 'document_version',
    v_rev_ver_id, 'approve_document', v_user_author, 'approved', 'approved', 1, 1, now() + interval '1 hour'
  );

  v_err_caught := false;
  BEGIN
    PERFORM public.finalize_governed_document_approval(v_user_qa_dir, v_rev_ver_id, 'Finalize on unstaged approved request');
  EXCEPTION WHEN others THEN
    IF SQLERRM LIKE '%PATCH206_NO_STAGES_INSTANTIATED%' THEN v_err_caught := true; END IF;
  END;
  IF NOT v_err_caught THEN RAISE EXCEPTION 'TEST 29.2 FAILED: Zero-stage approved request was not rejected with PATCH206_NO_STAGES_INSTANTIATED'; END IF;

  DELETE FROM public.approval_requests WHERE id = '70000000-0000-0000-0000-000000000099'::uuid;
  RAISE NOTICE 'TEST 29 & 30 PASSED';

  -- --------------------------------------------------------------------------
  -- TEST 32, 33, 34, 35: UN-STAGED Request Patch27 Regression
  -- --------------------------------------------------------------------------
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

  -- 2nd approval: completes threshold -> approved (TEST 33)
  v_dec_res := public.record_approval_decision(v_appr_req_id, v_user_qa_dir, 'approved', 'Second approver');
  IF v_dec_res->>'request_status' <> 'approved' THEN
    RAISE EXCEPTION 'TEST 33 FAILED: Unstaged request not approved after 2nd approval';
  END IF;
  RAISE NOTICE 'TEST 32 & 33 PASSED';

  -- TEST 35: Authority events emitted
  IF NOT EXISTS (
    SELECT 1 FROM public.approval_authority_events
    WHERE approval_request_id = v_appr_req_id AND event_type = 'final_approved'
  ) THEN
    RAISE EXCEPTION 'TEST 35 FAILED: final_approved authority event was not emitted';
  END IF;
  RAISE NOTICE 'TEST 35 PASSED';

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

  -- --------------------------------------------------------------------------
  -- TEST 36: No stale create/save RPC overloads
  -- --------------------------------------------------------------------------
  IF (SELECT count(*) FROM pg_proc WHERE proname = 'save_governed_sop_draft' AND pronamespace = 'public'::regnamespace) <> 1 THEN
    RAISE EXCEPTION 'TEST 36 FAILED: More than 1 save_governed_sop_draft signature found in public schema';
  END IF;

  IF (SELECT count(*) FROM pg_proc WHERE proname = 'create_governed_sop_draft' AND pronamespace = 'public'::regnamespace) <> 1 THEN
    RAISE EXCEPTION 'TEST 36 FAILED: More than 1 create_governed_sop_draft signature found in public schema';
  END IF;
  RAISE NOTICE 'TEST 36 PASSED';

  -- --------------------------------------------------------------------------
  -- TEST 37: Direct DML mutation against staged request/decision blocked
  -- --------------------------------------------------------------------------
  -- Switch session claim to non-service-role (authenticated)
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);

  -- Attempt direct UPDATE on staged approval_request
  v_err_caught := false;
  BEGIN
    UPDATE public.approval_requests SET request_status = 'approved' WHERE id = v_multi_req_id;
  EXCEPTION WHEN others THEN
    IF SQLERRM LIKE '%PATCH206_DIRECT_STAGED_REQUEST_MUTATION_FORBIDDEN%' THEN v_err_caught := true; END IF;
  END;
  IF NOT v_err_caught THEN RAISE EXCEPTION 'TEST 37.1 FAILED: Direct UPDATE on staged approval_request was not blocked'; END IF;

  -- Attempt direct INSERT into approval_decisions on staged request
  v_err_caught := false;
  BEGIN
    INSERT INTO public.approval_decisions (approval_request_id, approver_id, decision)
    VALUES (v_multi_req_id, v_user_qa_dir, 'approved');
  EXCEPTION WHEN others THEN
    IF SQLERRM LIKE '%PATCH206_DIRECT_STAGED_DECISION_MUTATION_FORBIDDEN%' THEN v_err_caught := true; END IF;
  END;
  IF NOT v_err_caught THEN RAISE EXCEPTION 'TEST 37.2 FAILED: Direct INSERT into approval_decisions on staged request was not blocked'; END IF;

  -- Restore service_role claim
  PERFORM set_config('request.jwt.claim.role', 'service_role', true);
  RAISE NOTICE 'TEST 37 PASSED';

  -- --------------------------------------------------------------------------
  -- TEST 49: Migration 206 Security Definer Live ACL Inspection
  -- --------------------------------------------------------------------------
  v_funcs := ARRAY[
    'configure_approval_authority_rule_stages',
    'record_approval_decision',
    'submit_governed_document_for_review',
    'finalize_governed_document_approval',
    'save_governed_sop_draft',
    'create_governed_sop_draft',
    'start_governed_document_revision',
    'validate_governed_doc_ver_link_tenancy',
    'guard_staged_approval_mutations',
    'enforce_policy_sop_version_immutability'
  ];

  FOREACH v_func IN ARRAY v_funcs LOOP
    SELECT p.oid INTO v_proc_oid
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = v_func
    LIMIT 1;

    IF v_proc_oid IS NULL THEN
      RAISE EXCEPTION 'TEST 49 FAILED: Function public.% not found in pg_proc', v_func;
    END IF;

    -- Verify PUBLIC, anon, authenticated execute permissions are revoked
    v_pub_exec := has_function_privilege('public', v_proc_oid, 'EXECUTE');
    v_anon_exec := has_function_privilege('anon', v_proc_oid, 'EXECUTE');
    v_auth_exec := has_function_privilege('authenticated', v_proc_oid, 'EXECUTE');
    v_serv_exec := has_function_privilege('service_role', v_proc_oid, 'EXECUTE');

    IF v_pub_exec OR v_anon_exec OR v_auth_exec THEN
      RAISE EXCEPTION 'TEST 49 FAILED: Function public.% is executable by unprivileged roles (pub: %, anon: %, auth: %)',
        v_func, v_pub_exec, v_anon_exec, v_auth_exec;
    END IF;

    IF v_func IN ('validate_governed_doc_ver_link_tenancy', 'guard_staged_approval_mutations', 'enforce_policy_sop_version_immutability') THEN
      -- Trigger functions must be owner-only (service_role execute false)
      IF v_serv_exec THEN
        RAISE EXCEPTION 'TEST 49 FAILED: Owner-only trigger function public.% has service_role execute privilege', v_func;
      END IF;
    ELSE
      -- RPCs must be service_role_only (service_role execute true)
      IF NOT v_serv_exec THEN
        RAISE EXCEPTION 'TEST 49 FAILED: Service RPC public.% is missing service_role execute privilege', v_func;
      END IF;
    END IF;
  END LOOP;
  RAISE NOTICE 'TEST 49 PASSED';

  -- --------------------------------------------------------------------------
  -- TEST 58: Legitimate Governance Admin Authority Flow
  -- --------------------------------------------------------------------------
  -- Governance admin can save and submit draft on behalf of governance operations
  PERFORM public.save_governed_sop_draft(
    p_actor_id => v_user_qa_dir,
    p_version_id => v_rev_ver_id,
    p_title_en => 'Clinical Handover SOP - Admin Approved Title'
  );

  IF (SELECT document_title FROM public.controlled_documents WHERE id = v_doc_id) <> 'Clinical Handover SOP - Admin Approved Title' THEN
    RAISE EXCEPTION 'TEST 58 FAILED: Governance admin save draft failed';
  END IF;
  RAISE NOTICE 'TEST 58 PASSED';

  RAISE NOTICE '=======================================================';
  RAISE NOTICE 'ALL 58 E1-R1 INVARIANT TESTS DETERMINISTICALLY PASSED!';
  RAISE NOTICE '=======================================================';
END $$;
