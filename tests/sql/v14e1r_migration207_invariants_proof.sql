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

SET request.jwt.claim.role = 'service_role';
SET request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
SET request.jwt.claims = '{"role":"service_role","sub":"22222222-2222-2222-2222-222222222222"}';

DO $$
DECLARE
  v_org_id uuid := '11111111-1111-1111-1111-111111111111'::uuid;
  v_actor_id uuid := '22222222-2222-2222-2222-222222222222'::uuid;
  v_kpi_owner_id uuid := '33333333-3333-3333-3333-333333333333'::uuid;
  v_dept_id uuid := '44444444-4444-4444-4444-444444444444'::uuid;
  v_risk_id uuid := '55555555-5555-5555-5555-555555555555'::uuid;
  v_std_id uuid := '66666666-6666-6666-6666-666666666660'::uuid;
  v_clause_id uuid := '66666666-6666-6666-6666-666666666666'::uuid;
  v_target_doc_id uuid := '77777777-7777-7777-7777-777777777777'::uuid;
  v_target_ver_id uuid := '88888888-8888-8888-8888-888888888888'::uuid;

  v_doc_id uuid;
  v_version_id uuid;
  v_save_result jsonb;
  v_rev_result jsonb;
  v_new_ver_id uuid;

  -- Role Scope Dedicated Variables
  v_role_name text;
  v_job_title text;

  -- Role Responsibility Dedicated Variables
  v_resp_role_name text;
  v_resp_job_title text;
  v_resp_en text;
  v_resp_ar text;
  v_resp_acc_en text;
  v_resp_acc_ar text;
  v_resp_seq integer;

  -- KPI Dedicated Variables
  v_kpi_name_en text;
  v_kpi_name_ar text;
  v_kpi_target text;
  v_kpi_freq text;
  v_kpi_owner uuid;
  v_kpi_description_en text;
  v_kpi_description_ar text;
  v_kpi_seq integer;

  -- Risk Link Dedicated Variables
  v_risk_relationship text;
  v_risk_context_en text;
  v_risk_context_ar text;
  v_risk_seq integer;

  -- Accreditation Link Dedicated Variables
  v_acc_clause_id uuid;
  v_acc_strength text;
  v_acc_context_en text;
  v_acc_context_ar text;
  v_acc_seq integer;

  -- Version Link Dedicated Variables
  v_ver_target_id uuid;
  v_ver_relationship text;
  v_ver_context_en text;
  v_ver_context_ar text;
  v_ver_seq integer;

  -- Procedure Step Dedicated Variables
  v_step_resp_role text;
  v_step_inst_en text;
  v_step_inst_ar text;
  v_step_sla_en text;
  v_step_sla_ar text;
  v_step_is_decision boolean;
  v_step_dec_en text;
  v_step_dec_ar text;
  v_step_criticality text;
  v_step_esc_trigger_en text;
  v_step_esc_trigger_ar text;
  v_step_esc_dest text;

  -- RACI Dedicated Variables
  v_raci_r_role text;
  v_raci_r_title text;
  v_raci_a_role text;
  v_raci_a_title text;
  v_raci_c_role text;
  v_raci_c_title text;
  v_raci_i_role text;
  v_raci_i_title text;

  -- Section Dedicated Variables
  v_sec_title_en text;
  v_sec_title_ar text;
  v_sec_desc_en text;
  v_sec_desc_ar text;
  v_sec_seq integer;

  v_cnt integer;
BEGIN
  PERFORM set_config('request.jwt.claim.role', 'service_role', true);
  PERFORM set_config('request.jwt.claim.sub', v_actor_id::text, true);
  PERFORM set_config('request.jwt.claims', jsonb_build_object('role', 'service_role', 'sub', v_actor_id::text)::text, true);

  RAISE NOTICE '============================================================';
  RAISE NOTICE 'STARTING MIGRATION 207 RUNTIME CONTRACT REMEDIATION PROOF';
  RAISE NOTICE '============================================================';

  -- --------------------------------------------------------------------------
  -- Setup Synthetic Tenant & Master Records matching Actual Production Schema
  -- --------------------------------------------------------------------------
  INSERT INTO public.organizations (id, name_en, name_ar, is_active)
  VALUES (v_org_id, 'Al Modawat Health Test Org', 'شركة المداواة الطبية', true)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.departments (id, organization_id, code, name_en, name_ar, is_active)
  VALUES (v_dept_id, v_org_id, 'CQD', 'Clinical Quality Department', 'قسم الجودة الإكلينيكية', true)
  ON CONFLICT (id) DO NOTHING;

  -- Insert auth.users if auth schema is present
  BEGIN
    INSERT INTO auth.users (id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
    VALUES
      (v_actor_id, 'authenticated', 'authenticated', 'author.m207@almodawat.test', now(), '{"provider":"email"}'::jsonb, '{}'::jsonb, now(), now()),
      (v_kpi_owner_id, 'authenticated', 'authenticated', 'kpi.owner@almodawat.test', now(), '{"provider":"email"}'::jsonb, '{}'::jsonb, now(), now())
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION WHEN undefined_table THEN
    -- In standalone non-Supabase PG environments where auth schema is omitted
    NULL;
  END;

  INSERT INTO public.profiles (id, organization_id, department_id, email, full_name_en, full_name_ar, is_active, user_status)
  VALUES
    (v_actor_id, v_org_id, v_dept_id, 'author.m207@almodawat.test', 'Governance Author', 'معد الحوكمة', true, 'active'),
    (v_kpi_owner_id, v_org_id, v_dept_id, 'kpi.owner@almodawat.test', 'KPI Owner', 'مسؤول المؤشر', true, 'active')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.risks (id, organization_id, risk_code, title, status, likelihood, impact)
  VALUES (v_risk_id, v_org_id, 'RSK-CLIN-001', 'Clinical Protocol Deviation Hazard', 'draft', 3, 3)
  ON CONFLICT (id) DO NOTHING;

  -- Create Accreditation Standard parent & Clause row
  INSERT INTO public.accreditation_standards (id, code, name_en, name_ar, standard_code, standard_name, standard_name_ar, framework, active)
  VALUES (v_std_id, 'CBAHI-HOSP', 'National Hospital Standards', 'المعايير الوطنية للمستشفيات', 'CBAHI-HOSP', 'National Hospital Standards', 'المعايير الوطنية للمستشفيات', 'CBAHI', true)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.accreditation_clauses (id, standard_id, clause_code, clause_title, clause_title_ar, active)
  VALUES (v_clause_id, v_std_id, 'IPC-04.1', 'Sterile Supply and Hand Hygiene Protocol', 'بروتوكول التعقيم ونظافة الأيدي', true)
  ON CONFLICT (id) DO NOTHING;

  -- Create Target Policy Document and Version for version link
  INSERT INTO public.controlled_documents (id, organization_id, document_code, document_title, document_type, document_status, created_by, updated_by)
  VALUES (v_target_doc_id, v_org_id, 'POL-CQD-001', 'Clinical Sterilization Master Policy', 'policy', 'approved', v_actor_id, v_actor_id)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.document_versions (id, document_id, version_number, version_label, approved_at, prepared_by)
  VALUES (v_target_ver_id, v_target_doc_id, 1, '1.0', now(), v_actor_id)
  ON CONFLICT (id) DO NOTHING;

  -- --------------------------------------------------------------------------
  -- TEST 01: All Families Simultaneous Persistence in Production Schema
  -- --------------------------------------------------------------------------
  RAISE NOTICE 'TEST 01: All Families Simultaneous Persistence in Production Schema';

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
          jsonb_build_object('raci_type', 'R', 'role_name', 'cssd_technician', 'role_label_ar', 'فني تعقيم', 'job_title', 'CSSD Specialist', 'sequence_number', 1),
          jsonb_build_object('raci_type', 'A', 'role_name', 'cssd_supervisor', 'role_label_ar', 'مشرف تعقيم', 'job_title', 'CSSD Supervisor', 'sequence_number', 2),
          jsonb_build_object('raci_type', 'C', 'role_name', 'infection_control_officer', 'role_label_ar', 'مسؤول مكافحة العدوى', 'job_title', 'Infection Preventionist', 'sequence_number', 3),
          jsonb_build_object('raci_type', 'I', 'role_name', 'or_charge_nurse', 'role_label_ar', 'ممرض العمليات', 'job_title', 'Operating Room Nurse', 'sequence_number', 4)
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
  SELECT role_name, job_title INTO v_role_name, v_job_title
  FROM public.document_version_role_scope
  WHERE version_id = v_version_id AND role_name = 'cssd_technician';

  IF v_role_name <> 'cssd_technician' THEN
    RAISE EXCEPTION 'TEST 02 FAILED: Role scope role_name mismatch. Expected cssd_technician, found: %', v_role_name;
  END IF;
  IF v_job_title <> 'Sterilization Technician' THEN
    RAISE EXCEPTION 'TEST 02 FAILED: Role scope job_title mismatch. Expected Sterilization Technician, found: %', v_job_title;
  END IF;

  -- --------------------------------------------------------------------------
  -- TEST 03: Verification of Role Responsibility Persistence (all fields)
  -- --------------------------------------------------------------------------
  RAISE NOTICE 'TEST 03: Verification of Role Responsibility Persistence';
  SELECT role_name, job_title, responsibility_en, responsibility_ar, accountable_for_en, accountable_for_ar, sequence_number
  INTO v_resp_role_name, v_resp_job_title, v_resp_en, v_resp_ar, v_resp_acc_en, v_resp_acc_ar, v_resp_seq
  FROM public.sop_role_responsibilities
  WHERE sop_version_id = v_version_id AND sequence_number = 1;

  IF v_resp_role_name <> 'cssd_technician' THEN RAISE EXCEPTION 'TEST 03 FAILED: resp role_name mismatch: %', v_resp_role_name; END IF;
  IF v_resp_job_title <> 'Sterilization Specialist' THEN RAISE EXCEPTION 'TEST 03 FAILED: resp job_title mismatch: %', v_resp_job_title; END IF;
  IF v_resp_en <> 'Perform daily chemical and biological test runs on sterilizers.' THEN RAISE EXCEPTION 'TEST 03 FAILED: resp_en mismatch: %', v_resp_en; END IF;
  IF v_resp_ar <> 'إجراء الاختبارات الكيميائية والحيوية اليومية لأجهزة التعقيم.' THEN RAISE EXCEPTION 'TEST 03 FAILED: resp_ar mismatch: %', v_resp_ar; END IF;
  IF v_resp_acc_en <> 'Daily autoclave log sheet completeness' THEN RAISE EXCEPTION 'TEST 03 FAILED: resp accountable_for_en mismatch: %', v_resp_acc_en; END IF;
  IF v_resp_acc_ar <> 'اكتمال سجل التعقيم اليومي' THEN RAISE EXCEPTION 'TEST 03 FAILED: resp accountable_for_ar mismatch: %', v_resp_acc_ar; END IF;
  IF v_resp_seq <> 1 THEN RAISE EXCEPTION 'TEST 03 FAILED: resp sequence_number mismatch: %', v_resp_seq; END IF;

  -- --------------------------------------------------------------------------
  -- TEST 04: Verification of KPI Persistence (all fields)
  -- --------------------------------------------------------------------------
  RAISE NOTICE 'TEST 04: Verification of KPI Persistence';
  SELECT kpi_name_en, kpi_name_ar, target_value, measurement_frequency, owner_id, description_en, description_ar, sequence_number
  INTO v_kpi_name_en, v_kpi_name_ar, v_kpi_target, v_kpi_freq, v_kpi_owner, v_kpi_description_en, v_kpi_description_ar, v_kpi_seq
  FROM public.sop_monitoring_kpis
  WHERE sop_version_id = v_version_id AND sequence_number = 1;

  IF v_kpi_name_en <> 'Biological Indicator Pass Rate' THEN RAISE EXCEPTION 'TEST 04 FAILED: kpi_name_en mismatch: %', v_kpi_name_en; END IF;
  IF v_kpi_name_ar <> 'نسبة اجتياز اختبار المؤشر الحيوي' THEN RAISE EXCEPTION 'TEST 04 FAILED: kpi_name_ar mismatch: %', v_kpi_name_ar; END IF;
  IF v_kpi_target <> '100%' THEN RAISE EXCEPTION 'TEST 04 FAILED: kpi target_value mismatch: %', v_kpi_target; END IF;
  IF v_kpi_freq <> 'daily' THEN RAISE EXCEPTION 'TEST 04 FAILED: kpi measurement_frequency mismatch: %', v_kpi_freq; END IF;
  IF v_kpi_owner <> v_kpi_owner_id THEN RAISE EXCEPTION 'TEST 04 FAILED: kpi owner_id mismatch: %', v_kpi_owner; END IF;
  IF v_kpi_description_en <> 'Percentage of sterilization cycles meeting biological kill criteria without failure.' THEN RAISE EXCEPTION 'TEST 04 FAILED: kpi description_en mismatch: %', v_kpi_description_en; END IF;
  IF v_kpi_description_ar <> 'نسبة دورات التعقيم المطابقة لمعايير القضاء الحيوي دون فشل.' THEN RAISE EXCEPTION 'TEST 04 FAILED: kpi description_ar mismatch: %', v_kpi_description_ar; END IF;
  IF v_kpi_seq <> 1 THEN RAISE EXCEPTION 'TEST 04 FAILED: kpi sequence_number mismatch: %', v_kpi_seq; END IF;

  -- --------------------------------------------------------------------------
  -- TEST 05: Verification of Risk Link Persistence (all fields)
  -- --------------------------------------------------------------------------
  RAISE NOTICE 'TEST 05: Verification of Risk Link Persistence';
  SELECT relationship_type, context_note_en, context_note_ar, sequence_number
  INTO v_risk_relationship, v_risk_context_en, v_risk_context_ar, v_risk_seq
  FROM public.sop_version_risk_links
  WHERE sop_version_id = v_version_id AND risk_id = v_risk_id;

  IF v_risk_relationship <> 'mitigates' THEN RAISE EXCEPTION 'TEST 05 FAILED: risk relationship_type mismatch: %', v_risk_relationship; END IF;
  IF v_risk_context_en <> 'Biological daily challenge run mitigates occult sterilizer chamber temperature drops.' THEN RAISE EXCEPTION 'TEST 05 FAILED: risk context_note_en mismatch: %', v_risk_context_en; END IF;
  IF v_risk_context_ar <> 'اختبار التحدي الحيوي اليومي يحد من مخاطر انخفاض حرارة غرفة التعقيم غير المكتشفة.' THEN RAISE EXCEPTION 'TEST 05 FAILED: risk context_note_ar mismatch: %', v_risk_context_ar; END IF;
  IF v_risk_seq <> 1 THEN RAISE EXCEPTION 'TEST 05 FAILED: risk sequence_number mismatch: %', v_risk_seq; END IF;

  -- --------------------------------------------------------------------------
  -- TEST 06: Verification of Accreditation Link Persistence (all fields)
  -- --------------------------------------------------------------------------
  RAISE NOTICE 'TEST 06: Verification of Accreditation Link Persistence';
  SELECT clause_id, link_strength, context_note_en, context_note_ar, sequence_number
  INTO v_acc_clause_id, v_acc_strength, v_acc_context_en, v_acc_context_ar, v_acc_seq
  FROM public.sop_version_accreditation_links
  WHERE sop_version_id = v_version_id AND clause_id = v_clause_id;

  IF v_acc_clause_id <> v_clause_id THEN RAISE EXCEPTION 'TEST 06 FAILED: acc clause_id mismatch: %', v_acc_clause_id; END IF;
  IF v_acc_strength <> 'primary' THEN RAISE EXCEPTION 'TEST 06 FAILED: acc link_strength mismatch: %', v_acc_strength; END IF;
  IF v_acc_context_en <> 'Full compliance with national CBAHI hospital sterilization standard IPC-04.1.' THEN RAISE EXCEPTION 'TEST 06 FAILED: acc context_note_en mismatch: %', v_acc_context_en; END IF;
  IF v_acc_context_ar <> 'التزام كامل بمعيار سباهي الوطني لتعقيم المستشفيات IPC-04.1.' THEN RAISE EXCEPTION 'TEST 06 FAILED: acc context_note_ar mismatch: %', v_acc_context_ar; END IF;
  IF v_acc_seq <> 1 THEN RAISE EXCEPTION 'TEST 06 FAILED: acc sequence_number mismatch: %', v_acc_seq; END IF;

  -- --------------------------------------------------------------------------
  -- TEST 07: Verification of Governed Version Link Persistence (all fields)
  -- --------------------------------------------------------------------------
  RAISE NOTICE 'TEST 07: Verification of Governed Version Link Persistence';
  SELECT target_version_id, relationship_type, context_note_en, context_note_ar, sequence_number
  INTO v_ver_target_id, v_ver_relationship, v_ver_context_en, v_ver_context_ar, v_ver_seq
  FROM public.governed_document_version_links
  WHERE source_version_id = v_version_id AND target_version_id = v_target_ver_id;

  IF v_ver_target_id <> v_target_ver_id THEN RAISE EXCEPTION 'TEST 07 FAILED: ver target_version_id mismatch: %', v_ver_target_id; END IF;
  IF v_ver_relationship <> 'implements_policy' THEN RAISE EXCEPTION 'TEST 07 FAILED: ver relationship_type mismatch: %', v_ver_relationship; END IF;
  IF v_ver_context_en <> 'Direct operational procedure implementing the hospital sterilization policy.' THEN RAISE EXCEPTION 'TEST 07 FAILED: ver context_note_en mismatch: %', v_ver_context_en; END IF;
  IF v_ver_context_ar <> 'الإجراء التشغيلي المباشر لتنفيذ سياسة تعقيم المستشفى.' THEN RAISE EXCEPTION 'TEST 07 FAILED: ver context_note_ar mismatch: %', v_ver_context_ar; END IF;
  IF v_ver_seq <> 1 THEN RAISE EXCEPTION 'TEST 07 FAILED: ver sequence_number mismatch: %', v_ver_seq; END IF;

  -- --------------------------------------------------------------------------
  -- TEST 08: Verification of Procedure Sections, Steps & RACI Persistence
  -- --------------------------------------------------------------------------
  RAISE NOTICE 'TEST 08: Verification of Procedure Sections, Steps & RACI Persistence';

  -- Sections
  SELECT title_en, title_ar, description_en, description_ar, sequence_number
  INTO v_sec_title_en, v_sec_title_ar, v_sec_desc_en, v_sec_desc_ar, v_sec_seq
  FROM public.sop_procedure_sections
  WHERE sop_version_id = v_version_id AND sequence_number = 1;

  IF v_sec_title_en <> 'Decontamination & Pre-Cleaning' THEN RAISE EXCEPTION 'TEST 08 FAILED: section title_en mismatch: %', v_sec_title_en; END IF;
  IF v_sec_title_ar <> 'التطهير والتنظيف المبدئي' THEN RAISE EXCEPTION 'TEST 08 FAILED: section title_ar mismatch: %', v_sec_title_ar; END IF;
  IF v_sec_desc_en <> 'Automated ultrasonic cleaning and enzyme soak protocol.' THEN RAISE EXCEPTION 'TEST 08 FAILED: section description_en mismatch: %', v_sec_desc_en; END IF;
  IF v_sec_desc_ar <> 'بروتوكول التنظيف بالموجات فوق الصوتية والنقع الإنزيمي.' THEN RAISE EXCEPTION 'TEST 08 FAILED: section description_ar mismatch: %', v_sec_desc_ar; END IF;
  IF v_sec_seq <> 1 THEN RAISE EXCEPTION 'TEST 08 FAILED: section sequence_number mismatch: %', v_sec_seq; END IF;

  -- Steps
  SELECT responsible_role, action_instruction_en, action_instruction_ar, timing_sla_en, timing_sla_ar,
         is_decision_point, decision_criteria_en, decision_criteria_ar, criticality,
         escalation_trigger_en, escalation_trigger_ar, escalation_destination_role
  INTO v_step_resp_role, v_step_inst_en, v_step_inst_ar, v_step_sla_en, v_step_sla_ar,
       v_step_is_decision, v_step_dec_en, v_step_dec_ar, v_step_criticality,
       v_step_esc_trigger_en, v_step_esc_trigger_ar, v_step_esc_dest
  FROM public.sop_procedure_steps
  WHERE sop_version_id = v_version_id AND sequence_number = 1;

  IF v_step_resp_role <> 'cssd_technician' THEN RAISE EXCEPTION 'TEST 08 FAILED: step responsible_role mismatch: %', v_step_resp_role; END IF;
  IF v_step_inst_en <> 'Inspect all surgical instruments under 5x magnification lamp.' THEN RAISE EXCEPTION 'TEST 08 FAILED: step action_instruction_en mismatch: %', v_step_inst_en; END IF;
  IF v_step_inst_ar <> 'فحص جميع الأدوات الجراحية تحت عدسة تكبير 5x.' THEN RAISE EXCEPTION 'TEST 08 FAILED: step action_instruction_ar mismatch: %', v_step_inst_ar; END IF;
  IF v_step_sla_en <> '15 minutes per tray' THEN RAISE EXCEPTION 'TEST 08 FAILED: step timing_sla_en mismatch: %', v_step_sla_en; END IF;
  IF v_step_sla_ar <> '15 دقيقة لكل صينية' THEN RAISE EXCEPTION 'TEST 08 FAILED: step timing_sla_ar mismatch: %', v_step_sla_ar; END IF;
  IF v_step_is_decision <> true THEN RAISE EXCEPTION 'TEST 08 FAILED: step is_decision_point mismatch: %', v_step_is_decision; END IF;
  IF v_step_dec_en <> 'If bioburden residue detected, return for manual enzymatic re-wash.' THEN RAISE EXCEPTION 'TEST 08 FAILED: step decision_criteria_en mismatch: %', v_step_dec_en; END IF;
  IF v_step_dec_ar <> 'في حال وجود بقايا بيولوجية، يعاد للغسيل الإنزيمي اليدوي.' THEN RAISE EXCEPTION 'TEST 08 FAILED: step decision_criteria_ar mismatch: %', v_step_dec_ar; END IF;
  IF v_step_criticality <> 'high' THEN RAISE EXCEPTION 'TEST 08 FAILED: step criticality mismatch: %', v_step_criticality; END IF;
  IF v_step_esc_trigger_en <> 'Repeated soil residue after ultrasonic cycle' THEN RAISE EXCEPTION 'TEST 08 FAILED: step escalation_trigger_en mismatch: %', v_step_esc_trigger_en; END IF;
  IF v_step_esc_trigger_ar <> 'تكرار وجود شوائب بعد دورة التنظيف' THEN RAISE EXCEPTION 'TEST 08 FAILED: step escalation_trigger_ar mismatch: %', v_step_esc_trigger_ar; END IF;
  IF v_step_esc_dest <> 'quality_officer' THEN RAISE EXCEPTION 'TEST 08 FAILED: step escalation_destination_role mismatch: %', v_step_esc_dest; END IF;

  -- RACI Assignments (all 4 rows)
  SELECT role_name, job_title INTO v_raci_r_role, v_raci_r_title
  FROM public.sop_procedure_step_raci_assignments
  WHERE sop_version_id = v_version_id AND raci_type = 'R';
  IF v_raci_r_role <> 'cssd_technician' OR v_raci_r_title <> 'CSSD Specialist' THEN
    RAISE EXCEPTION 'TEST 08 FAILED: RACI R mismatch. Role: %, Title: %', v_raci_r_role, v_raci_r_title;
  END IF;

  SELECT role_name, job_title INTO v_raci_a_role, v_raci_a_title
  FROM public.sop_procedure_step_raci_assignments
  WHERE sop_version_id = v_version_id AND raci_type = 'A';
  IF v_raci_a_role <> 'cssd_supervisor' OR v_raci_a_title <> 'CSSD Supervisor' THEN
    RAISE EXCEPTION 'TEST 08 FAILED: RACI A mismatch. Role: %, Title: %', v_raci_a_role, v_raci_a_title;
  END IF;

  SELECT role_name, job_title INTO v_raci_c_role, v_raci_c_title
  FROM public.sop_procedure_step_raci_assignments
  WHERE sop_version_id = v_version_id AND raci_type = 'C';
  IF v_raci_c_role <> 'infection_control_officer' OR v_raci_c_title <> 'Infection Preventionist' THEN
    RAISE EXCEPTION 'TEST 08 FAILED: RACI C mismatch. Role: %, Title: %', v_raci_c_role, v_raci_c_title;
  END IF;

  SELECT role_name, job_title INTO v_raci_i_role, v_raci_i_title
  FROM public.sop_procedure_step_raci_assignments
  WHERE sop_version_id = v_version_id AND raci_type = 'I';
  IF v_raci_i_role <> 'or_charge_nurse' OR v_raci_i_title <> 'Operating Room Nurse' THEN
    RAISE EXCEPTION 'TEST 08 FAILED: RACI I mismatch. Role: %, Title: %', v_raci_i_role, v_raci_i_title;
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

  -- Cloned Role Scope
  SELECT role_name, job_title INTO v_role_name, v_job_title
  FROM public.document_version_role_scope
  WHERE version_id = v_new_ver_id AND role_name = 'cssd_technician';
  IF v_role_name <> 'cssd_technician' OR v_job_title <> 'Sterilization Technician' THEN
    RAISE EXCEPTION 'TEST 09 FAILED: Cloned role scope mismatch';
  END IF;

  -- Cloned Role Responsibility
  SELECT accountable_for_en, accountable_for_ar INTO v_resp_acc_en, v_resp_acc_ar
  FROM public.sop_role_responsibilities
  WHERE sop_version_id = v_new_ver_id AND sequence_number = 1;
  IF v_resp_acc_en <> 'Daily autoclave log sheet completeness' OR v_resp_acc_ar <> 'اكتمال سجل التعقيم اليومي' THEN
    RAISE EXCEPTION 'TEST 09 FAILED: Cloned role responsibility accountable_for mismatch';
  END IF;

  -- Cloned KPI
  SELECT target_value, owner_id, description_en INTO v_kpi_target, v_kpi_owner, v_kpi_description_en
  FROM public.sop_monitoring_kpis
  WHERE sop_version_id = v_new_ver_id AND sequence_number = 1;
  IF v_kpi_target <> '100%' OR v_kpi_owner <> v_kpi_owner_id OR v_kpi_description_en <> 'Percentage of sterilization cycles meeting biological kill criteria without failure.' THEN
    RAISE EXCEPTION 'TEST 09 FAILED: Cloned KPI fields mismatch';
  END IF;

  -- Cloned Risk Link
  SELECT relationship_type, context_note_en INTO v_risk_relationship, v_risk_context_en
  FROM public.sop_version_risk_links
  WHERE sop_version_id = v_new_ver_id AND risk_id = v_risk_id;
  IF v_risk_relationship <> 'mitigates' OR v_risk_context_en <> 'Biological daily challenge run mitigates occult sterilizer chamber temperature drops.' THEN
    RAISE EXCEPTION 'TEST 09 FAILED: Cloned risk link mismatch';
  END IF;

  -- Cloned Accreditation Link
  SELECT link_strength, context_note_en INTO v_acc_strength, v_acc_context_en
  FROM public.sop_version_accreditation_links
  WHERE sop_version_id = v_new_ver_id AND clause_id = v_clause_id;
  IF v_acc_strength <> 'primary' OR v_acc_context_en <> 'Full compliance with national CBAHI hospital sterilization standard IPC-04.1.' THEN
    RAISE EXCEPTION 'TEST 09 FAILED: Cloned accreditation link mismatch';
  END IF;

  -- Cloned Version Link
  SELECT relationship_type, context_note_en INTO v_ver_relationship, v_ver_context_en
  FROM public.governed_document_version_links
  WHERE source_version_id = v_new_ver_id AND target_version_id = v_target_ver_id;
  IF v_ver_relationship <> 'implements_policy' OR v_ver_context_en <> 'Direct operational procedure implementing the hospital sterilization policy.' THEN
    RAISE EXCEPTION 'TEST 09 FAILED: Cloned version link mismatch';
  END IF;

  -- Cloned RACI (4 rows)
  SELECT count(*) INTO v_cnt FROM public.sop_procedure_step_raci_assignments
  WHERE sop_version_id = v_new_ver_id;
  IF v_cnt <> 4 THEN
    RAISE EXCEPTION 'TEST 09 FAILED: Cloned step RACI count mismatch. Expected 4, found %', v_cnt;
  END IF;

  RAISE NOTICE '============================================================';
  RAISE NOTICE 'ALL MIGRATION 207 INVARIANT TESTS DETERMINISTICALLY PASSED!';
  RAISE NOTICE '============================================================';
END $$;
