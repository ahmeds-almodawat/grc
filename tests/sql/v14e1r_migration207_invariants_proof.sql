-- ============================================================================
-- GRC v1.4-E1-R: MIGRATION 207 RUNTIME CONTRACT REMEDIATION PROOF
-- 
-- Verifies save_governed_sop_draft and start_governed_document_revision against
-- the actual established Production schema:
-- - document_version_role_scope (role_name, job_title)
-- - sop_role_responsibilities (role_name, job_title, responsibility_en/ar, accountable_for_en/ar, sequence_number)
-- - sop_monitoring_kpis (kpi_name_en/ar, target_value, measurement_frequency, owner_id, description_en/ar, sequence_number)
-- - sop_version_risk_links (risk_id, relationship_type, context_note_en/ar, sequence_number)
-- - sop_version_accreditation_links (clause_id, link_strength, context_note_en/ar, sequence_number)
-- - governed_document_version_links (source_version_id, target_version_id, relationship_type, context_note_en/ar, sequence_number)
-- - sop_procedure_sections, sop_procedure_steps & RACI
-- ============================================================================

DO $$
DECLARE
  v_org_id uuid := '11111111-1111-1111-1111-111111111111'::uuid;
  v_actor_id uuid := '22222222-2222-2222-2222-222222222222'::uuid;
  v_kpi_owner_id uuid := '33333333-3333-3333-3333-333333333333'::uuid;
  v_dept_id uuid := '44444444-4444-4444-4444-444444444444'::uuid;
  v_risk_id uuid := '55555555-5555-5555-5555-555555555555'::uuid;
  v_clause_id uuid := '66666666-6666-6666-6666-666666666666'::uuid;
  v_target_doc_id uuid := '77777777-7777-7777-7777-777777777777'::uuid;
  v_target_ver_id uuid := '88888888-8888-8888-8888-888888888888'::uuid;

  v_doc_id uuid;
  v_version_id uuid;
  v_save_result jsonb;
  v_rev_result jsonb;
  v_new_ver_id uuid;

  -- Assertion variables
  v_cnt integer;
  v_text_val text;
  v_uuid_val uuid;
  v_int_val integer;
  v_bool_val boolean;
BEGIN
  RAISE NOTICE '============================================================';
  RAISE NOTICE 'STARTING MIGRATION 207 RUNTIME CONTRACT REMEDIATION PROOF';
  RAISE NOTICE '============================================================';

  -- --------------------------------------------------------------------------
  -- Setup Synthetic Tenant & Master Records
  -- --------------------------------------------------------------------------
  INSERT INTO public.organizations (id, name, slug)
  VALUES (v_org_id, 'Al Modawat Health Test Org', 'modawat-test')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.profiles (id, organization_id, email, full_name_en, full_name_ar, is_active)
  VALUES
    (v_actor_id, v_org_id, 'author.m207@almodawat.test', 'Governance Author', 'معد الحوكمة', true),
    (v_kpi_owner_id, v_org_id, 'kpi.owner@almodawat.test', 'KPI Owner', 'مسؤول المؤشر', true)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.departments (id, organization_id, name, code)
  VALUES (v_dept_id, v_org_id, 'Clinical Quality Department', 'CQD')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.risks (id, organization_id, risk_code, title_en, status, severity, likelihood)
  VALUES (v_risk_id, v_org_id, 'RSK-CLIN-001', 'Clinical Protocol Deviation Hazard', 'open', 'high', 'possible')
  ON CONFLICT (id) DO NOTHING;

  -- Create Accreditation Chapter & Clause if needed
  INSERT INTO public.accreditation_clauses (id, organization_id, clause_code, title_en)
  VALUES (v_clause_id, v_org_id, 'CBAHI-IPC-04.1', 'Sterile Supply and Hand Hygiene Protocol')
  ON CONFLICT (id) DO NOTHING;

  -- Create Target Policy Document and Version for version link
  INSERT INTO public.controlled_documents (id, organization_id, document_code, document_title, document_type, document_status, created_by, updated_by)
  VALUES (v_target_doc_id, v_org_id, 'POL-CQD-001', 'Clinical Sterilization Master Policy', 'policy', 'approved', v_actor_id, v_actor_id)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.document_versions (id, document_id, version_number, version_label, is_current_version, approved_at, prepared_by)
  VALUES (v_target_ver_id, v_target_doc_id, 1, '1.0', true, now(), v_actor_id)
  ON CONFLICT (id) DO NOTHING;

  -- --------------------------------------------------------------------------
  -- TEST 01: All Families Simultaneous Persistence in Production Schema
  -- --------------------------------------------------------------------------
  RAISE NOTICE 'TEST 01: All Families Simultaneous Persistence in Production Schema';

  -- Create Base Governed SOP Draft via create_governed_sop_draft
  v_save_result := public.create_governed_sop_draft(
    p_actor_id => v_actor_id,
    p_organization_id => v_org_id,
    p_title_en => 'Governed Central Sterile Supply Protocol SOP',
    p_title_ar => 'الإجراء التشغيلي الموحد للتعقيم المركزي',
    p_process_name_en => 'CSSD Operational Flow',
    p_process_name_ar => 'مسار تشغيل التعقيم المركزي',
    p_purpose_en => 'Establish standardized sterile processing and sterilization quality control.',
    p_purpose_ar => 'توحيد إجراءات التعقيم وضبط الجودة في قسم التعقيم المركزي.',
    p_process_owner_id => v_actor_id,
    p_primary_policy_version_id => v_target_ver_id,
    p_governance_link_state => 'linked',
    p_scope_en => 'All inpatient and surgical sterilization suites.',
    p_scope_ar => 'جميع أجنحة التعقيم الجراحي وأقسام التنويم.',
    p_department_id => v_dept_id,
    p_criticality_level => 'high',
    p_confidentiality_level => 'internal',
    p_training_required => true,
    p_acknowledgment_required => true,
    p_competency_assessment_required => true,
    p_acknowledgment_sla_days => 14,
    p_training_renewal_months => 6,
    p_content_mode => 'structured',
    p_procedure_sections => jsonb_build_array(
      jsonb_build_object(
        'client_key', 'sec_decon',
        'sequence_number', 1,
        'title_en', 'Decontamination & Pre-Cleaning',
        'title_ar', 'التطهير والتنظيف المبدئي',
        'description_en', 'Automated ultrasonic cleaning and enzyme soak protocol.',
        'description_ar', 'بروتوكول التنظيف بالموجات فوق الصوتية والنقع الإنزيمي.'
      ),
      jsonb_build_object(
        'client_key', 'sec_autoclave',
        'sequence_number', 2,
        'title_en', 'Autoclave Sterilization & Biological Indication',
        'title_ar', 'التعقيم بالبخار المضغوط والمؤشرات الحيوية',
        'description_en', 'High pressure steam cycle validation.',
        'description_ar', 'التحقق من دورة البخار عالي الضغط.'
      )
    ),
    p_procedure_steps => jsonb_build_array(
      jsonb_build_object(
        'client_key', 'step_decon_1',
        'section_client_key', 'sec_decon',
        'sequence_number', 1,
        'action_instruction_en', 'Inspect all surgical instruments under 5x magnification lamp.',
        'action_instruction_ar', 'فحص جميع الأدوات الجراحية تحت عدسة تكبير 5x.',
        'timing_sla_en', '15 minutes per tray',
        'timing_sla_ar', '15 دقيقة لكل صينية',
        'is_decision_point', true,
        'decision_criteria_en', 'If bioburden residue detected, return for manual enzymatic re-wash.',
        'decision_criteria_ar', 'في حال وجود بقايا بيولوجية، يعاد للغسيل الإنزيمي اليدوي.',
        'criticality', 'high',
        'escalation_trigger_en', 'Repeated soil residue after ultrasonic cycle',
        'escalation_trigger_ar', 'تكرار وجود شوائب بعد دورة التنظيف',
        'escalation_destination_role', 'quality_officer',
        'raci_assignments', jsonb_build_array(
          jsonb_build_object('raci_type', 'R', 'role_name', 'cssd_technician', 'job_title', 'CSSD Specialist', 'sequence_number', 1),
          jsonb_build_object('raci_type', 'A', 'role_name', 'cssd_supervisor', 'job_title', 'CSSD Supervisor', 'sequence_number', 2),
          jsonb_build_object('raci_type', 'C', 'role_name', 'infection_control_officer', 'job_title', 'Infection Preventionist', 'sequence_number', 3),
          jsonb_build_object('raci_type', 'I', 'role_name', 'or_charge_nurse', 'job_title', 'Operating Room Nurse', 'sequence_number', 4)
        )
      )
    ),
    p_department_scopes => ARRAY[v_dept_id],
    p_role_scopes => jsonb_build_array(
      jsonb_build_object('role_name', 'cssd_technician', 'job_title', 'Sterilization Technician'),
      jsonb_build_object('role_name', 'cssd_supervisor', 'job_title', 'Sterilization Unit Head')
    ),
    p_definitions => jsonb_build_array(
      jsonb_build_object(
        'term_en', 'Biological Indicator',
        'term_ar', 'المؤشر الحيوي',
        'definition_en', 'Geobacillus stearothermophilus spore vial used to test autoclave lethality.',
        'definition_ar', 'أنبوبة أبواغ لاختبار كفاءة التعقيم بالبخار.',
        'abbreviation', 'BI',
        'sequence_number', 1
      )
    ),
    p_role_responsibilities => jsonb_build_array(
      jsonb_build_object(
        'sequence_number', 1,
        'role_name', 'cssd_technician',
        'job_title', 'Sterilization Specialist',
        'responsibility_en', 'Perform daily chemical and biological test runs on sterilizers.',
        'responsibility_ar', 'إجراء الاختبارات الكيميائية والحيوية اليومية لأجهزة التعقيم.',
        'accountable_for_en', 'Daily autoclave log sheet completeness',
        'accountable_for_ar', 'اكتمال سجل التعقيم اليومي'
      )
    ),
    p_monitoring_kpis => jsonb_build_array(
      jsonb_build_object(
        'sequence_number', 1,
        'kpi_name_en', 'Biological Indicator Pass Rate',
        'kpi_name_ar', 'نسبة اجتياز اختبار المؤشر الحيوي',
        'target_value', '100%',
        'measurement_frequency', 'daily',
        'owner_id', v_kpi_owner_id,
        'description_en', 'Percentage of sterilization cycles meeting biological kill criteria without failure.',
        'description_ar', 'نسبة دورات التعقيم المطابقة لمعايير القضاء الحيوي دون فشل.'
      )
    ),
    p_risk_links => jsonb_build_array(
      jsonb_build_object(
        'sequence_number', 1,
        'risk_id', v_risk_id,
        'relationship_type', 'mitigates',
        'context_note_en', 'Biological daily challenge run mitigates occult sterilizer chamber temperature drops.',
        'context_note_ar', 'اختبار التحدي الحيوي اليومي يحد من مخاطر انخفاض حرارة غرفة التعقيم غير المكتشفة.'
      )
    ),
    p_accreditation_links => jsonb_build_array(
      jsonb_build_object(
        'sequence_number', 1,
        'clause_id', v_clause_id,
        'link_strength', 'primary',
        'context_note_en', 'Full compliance with national CBAHI hospital sterilization standard IPC-04.1.',
        'context_note_ar', 'التزام كامل بمعيار سباهي الوطني لتعقيم المستشفيات IPC-04.1.'
      )
    ),
    p_version_links => jsonb_build_array(
      jsonb_build_object(
        'sequence_number', 1,
        'target_version_id', v_target_ver_id,
        'relationship_type', 'implements_policy',
        'context_note_en', 'Direct operational procedure implementing the hospital sterilization policy.',
        'context_note_ar', 'الإجراء التشغيلي المباشر لتنفيذ سياسة تعقيم المستشفى.'
      )
    )
  );

  v_doc_id := (v_save_result->>'document_id')::uuid;
  v_version_id := (v_save_result->>'version_id')::uuid;

  IF v_doc_id IS NULL OR v_version_id IS NULL THEN
    RAISE EXCEPTION 'TEST 01 FAILED: create_governed_sop_draft did not return document_id and version_id';
  END IF;

  -- --------------------------------------------------------------------------
  -- TEST 02: Verification of Role Scope Persistence (role_name, job_title)
  -- --------------------------------------------------------------------------
  RAISE NOTICE 'TEST 02: Verification of Role Scope Persistence (role_name, job_title)';
  SELECT count(*) INTO v_cnt FROM public.document_version_role_scope
  WHERE version_id = v_version_id AND role_name = 'cssd_technician' AND job_title = 'Sterilization Technician';
  IF v_cnt <> 1 THEN RAISE EXCEPTION 'TEST 02 FAILED: Role scope cssd_technician not persisted correctly'; END IF;

  -- --------------------------------------------------------------------------
  -- TEST 03: Verification of Role Responsibility Persistence (accountable_for)
  -- --------------------------------------------------------------------------
  RAISE NOTICE 'TEST 03: Verification of Role Responsibility Persistence (accountable_for)';
  SELECT accountable_for_en INTO v_text_val FROM public.sop_role_responsibilities
  WHERE sop_version_id = v_version_id AND sequence_number = 1;
  IF v_text_val <> 'Daily autoclave log sheet completeness' THEN
    RAISE EXCEPTION 'TEST 03 FAILED: Role responsibility accountable_for_en not persisted. Found: %', v_text_val;
  END IF;

  -- --------------------------------------------------------------------------
  -- TEST 04: Verification of KPI Persistence (target_value, owner_id, descriptions)
  -- --------------------------------------------------------------------------
  RAISE NOTICE 'TEST 04: Verification of KPI Persistence (target_value, owner_id, descriptions)';
  SELECT target_value, owner_id, description_en INTO v_text_val, v_uuid_val, v_text_val
  FROM public.sop_monitoring_kpis
  WHERE sop_version_id = v_version_id AND sequence_number = 1;
  IF v_text_val <> 'Percentage of sterilization cycles meeting biological kill criteria without failure.' OR v_uuid_val <> v_kpi_owner_id THEN
    RAISE EXCEPTION 'TEST 04 FAILED: KPI target_value/owner_id/description not persisted';
  END IF;

  -- --------------------------------------------------------------------------
  -- TEST 05: Verification of Risk Link Persistence (relationship_type, context notes)
  -- --------------------------------------------------------------------------
  RAISE NOTICE 'TEST 05: Verification of Risk Link Persistence (relationship_type, context notes)';
  SELECT relationship_type, context_note_en INTO v_text_val, v_text_val
  FROM public.sop_version_risk_links
  WHERE sop_version_id = v_version_id AND risk_id = v_risk_id;
  IF v_text_val <> 'Biological daily challenge run mitigates occult sterilizer chamber temperature drops.' THEN
    RAISE EXCEPTION 'TEST 05 FAILED: Risk link context_note_en not persisted';
  END IF;

  -- --------------------------------------------------------------------------
  -- TEST 06: Verification of Accreditation Link Persistence (clause_id, link_strength, context notes)
  -- --------------------------------------------------------------------------
  RAISE NOTICE 'TEST 06: Verification of Accreditation Link Persistence (clause_id, link_strength, context notes)';
  SELECT link_strength, context_note_en INTO v_text_val, v_text_val
  FROM public.sop_version_accreditation_links
  WHERE sop_version_id = v_version_id AND clause_id = v_clause_id;
  IF v_text_val <> 'Full compliance with national CBAHI hospital sterilization standard IPC-04.1.' THEN
    RAISE EXCEPTION 'TEST 06 FAILED: Accreditation link context_note_en not persisted';
  END IF;

  -- --------------------------------------------------------------------------
  -- TEST 07: Verification of Governed Version Link Persistence
  -- --------------------------------------------------------------------------
  RAISE NOTICE 'TEST 07: Verification of Governed Version Link Persistence';
  SELECT relationship_type, context_note_en INTO v_text_val, v_text_val
  FROM public.governed_document_version_links
  WHERE source_version_id = v_version_id AND target_version_id = v_target_ver_id;
  IF v_text_val <> 'Direct operational procedure implementing the hospital sterilization policy.' THEN
    RAISE EXCEPTION 'TEST 07 FAILED: Governed version link context_note_en not persisted';
  END IF;

  -- --------------------------------------------------------------------------
  -- TEST 08: Verification of Step Procedure & RACI Persistence
  -- --------------------------------------------------------------------------
  RAISE NOTICE 'TEST 08: Verification of Step Procedure & RACI Persistence';
  SELECT responsible_role, is_decision_point INTO v_text_val, v_bool_val
  FROM public.sop_procedure_steps
  WHERE sop_version_id = v_version_id AND sequence_number = 1;
  IF v_text_val <> 'cssd_technician' OR v_bool_val <> true THEN
    RAISE EXCEPTION 'TEST 08 FAILED: Step responsible_role or decision_point not persisted';
  END IF;

  SELECT count(*) INTO v_cnt FROM public.sop_procedure_step_raci_assignments
  WHERE sop_version_id = v_version_id;
  IF v_cnt <> 4 THEN
    RAISE EXCEPTION 'TEST 08 FAILED: Step RACI assignments count mismatch. Expected 4, found %', v_cnt;
  END IF;

  -- --------------------------------------------------------------------------
  -- TEST 09: Start Revision Deep-Clone Preserves All Production Schema Fields
  -- --------------------------------------------------------------------------
  RAISE NOTICE 'TEST 09: Start Revision Deep-Clone Preserves All Production Schema Fields';
  
  -- Lock/approve version 1 first so a revision can be started
  UPDATE public.document_versions SET approved_at = now(), locked_at = now() WHERE id = v_version_id;
  UPDATE public.controlled_documents SET document_status = 'approved' WHERE id = v_doc_id;

  v_rev_result := public.start_governed_document_revision(
    p_actor_id => v_actor_id,
    p_source_version_id => v_version_id,
    p_revision_type => 'minor',
    p_revision_reason => 'Annual CSSD procedure update'
  );

  v_new_ver_id := (v_rev_result->>'new_version_id')::uuid;
  IF v_new_ver_id IS NULL THEN
    RAISE EXCEPTION 'TEST 09 FAILED: start_governed_document_revision did not return new_version_id';
  END IF;

  -- Verify cloned role scope
  SELECT count(*) INTO v_cnt FROM public.document_version_role_scope
  WHERE version_id = v_new_ver_id AND role_name = 'cssd_technician';
  IF v_cnt <> 1 THEN RAISE EXCEPTION 'TEST 09 FAILED: Cloned role scope missing'; END IF;

  -- Verify cloned role responsibilities with accountable_for
  SELECT accountable_for_en INTO v_text_val FROM public.sop_role_responsibilities
  WHERE sop_version_id = v_new_ver_id AND sequence_number = 1;
  IF v_text_val <> 'Daily autoclave log sheet completeness' THEN
    RAISE EXCEPTION 'TEST 09 FAILED: Cloned role responsibility accountable_for mismatch';
  END IF;

  -- Verify cloned KPI with target_value & owner_id
  SELECT target_value, owner_id INTO v_text_val, v_uuid_val
  FROM public.sop_monitoring_kpis
  WHERE sop_version_id = v_new_ver_id AND sequence_number = 1;
  IF v_text_val <> '100%' OR v_uuid_val <> v_kpi_owner_id THEN
    RAISE EXCEPTION 'TEST 09 FAILED: Cloned KPI target_value/owner mismatch';
  END IF;

  -- Verify cloned risk link
  SELECT count(*) INTO v_cnt FROM public.sop_version_risk_links
  WHERE sop_version_id = v_new_ver_id AND risk_id = v_risk_id AND relationship_type = 'mitigates';
  IF v_cnt <> 1 THEN RAISE EXCEPTION 'TEST 09 FAILED: Cloned risk link missing'; END IF;

  -- Verify cloned accreditation link
  SELECT count(*) INTO v_cnt FROM public.sop_version_accreditation_links
  WHERE sop_version_id = v_new_ver_id AND clause_id = v_clause_id AND link_strength = 'primary';
  IF v_cnt <> 1 THEN RAISE EXCEPTION 'TEST 09 FAILED: Cloned accreditation link missing'; END IF;

  -- Verify cloned version link
  SELECT count(*) INTO v_cnt FROM public.governed_document_version_links
  WHERE source_version_id = v_new_ver_id AND target_version_id = v_target_ver_id;
  IF v_cnt <> 1 THEN RAISE EXCEPTION 'TEST 09 FAILED: Cloned version link missing'; END IF;

  -- Verify cloned steps and RACI
  SELECT count(*) INTO v_cnt FROM public.sop_procedure_step_raci_assignments
  WHERE sop_version_id = v_new_ver_id;
  IF v_cnt <> 4 THEN
    RAISE EXCEPTION 'TEST 09 FAILED: Cloned step RACI count mismatch. Expected 4, found %', v_cnt;
  END IF;

  RAISE NOTICE '============================================================';
  RAISE NOTICE 'ALL MIGRATION 207 INVARIANT TESTS DETERMINISTICALLY PASSED!';
  RAISE NOTICE '============================================================';
END $$;
