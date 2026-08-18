import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import * as fs from 'fs';
import * as path from 'path';
import { I18nProvider } from '../../src/i18n/I18nContext';
import { SopRegister } from '../../src/components/policy-sop/SopRegister';
import { SopProcedureBuilder } from '../../src/components/policy-sop/SopProcedureBuilder';
import { SopDefinitionsBuilder } from '../../src/components/policy-sop/SopDefinitionsBuilder';
import { SopResponsibilitiesBuilder } from '../../src/components/policy-sop/SopResponsibilitiesBuilder';
import { SopMonitoringKpisBuilder } from '../../src/components/policy-sop/SopMonitoringKpisBuilder';
import { SopPreviewModal } from '../../src/components/policy-sop/SopPreviewModal';
import { SopEditor } from '../../src/components/policy-sop/SopEditor';
import type { 
  GovernedSopCatalogRow, 
  DetailedSopRecord, 
  SopProcedureStep,
  SopDefinition,
  SopRoleResponsibility,
  SopMonitoringKpi,
  EligibleGoverningPolicy 
} from '../../src/lib/policySopApi';
import * as policySopApi from '../../src/lib/policySopApi';

const mockDepartments = [
  { id: 'dept-1', name: 'Clinical Pharmacy', code: 'PHARM' },
  { id: 'dept-2', name: 'Emergency Medicine', code: 'ER' },
];

const mockProfiles = [
  { id: 'prof-1', full_name: 'Dr. Sarah Connor', email: 's.connor@hospital.org', job_title: 'Chief Medical Officer' },
  { id: 'prof-2', full_name: 'Ahmed Al-Mansoor', email: 'a.mansoor@hospital.org', job_title: 'Quality Director' },
];

const mockControls = [
  { id: 'ctrl-1', code: 'CTL-MED-001', title: 'High-Alert Medication Dual Verification' },
  { id: 'ctrl-2', code: 'CTL-HYG-002', title: 'Aseptic Hand Hygiene Compliance' },
];

const mockEligiblePolicies: EligibleGoverningPolicy[] = [
  {
    version_id: 'pol-ver-1',
    document_id: 'pol-doc-1',
    document_code: 'POL-MED-2026-0001',
    title_en: 'Medication Safety & Administration Policy',
    title_ar: 'سياسة سلامة وإعطاء الأدوية',
    version_label: '1.0',
    document_status: 'active',
    effective_date: '2026-01-01'
  },
  {
    version_id: 'pol-ver-2',
    document_id: 'pol-doc-2',
    document_code: 'POL-CLN-2026-0002',
    title_en: 'Infection Prevention and Hygiene Policy',
    title_ar: 'سياسة مكافحة العدوى والتعقيم',
    version_label: '2.0',
    document_status: 'approved',
    effective_date: '2026-02-01'
  }
];

const mockSops: GovernedSopCatalogRow[] = [
  {
    document_id: 'sop-1',
    document_code: 'SOP-PHARM-2026-0001',
    document_title: 'Inpatient Chemotherapy Dispensing SOP',
    document_type: 'sop',
    document_status: 'active',
    effective_date: '2026-01-15',
    next_review_date: '2027-01-15',
    department_id: 'dept-1',
    department_name: 'Clinical Pharmacy',
    document_owner_id: 'prof-1',
    document_owner_name: 'Dr. Sarah Connor',
    version_id: 'sop-ver-1',
    version_number: 1,
    version_label: '1.0',
    is_current_version: true,
    version_title_en: 'Inpatient Chemotherapy Dispensing SOP',
    version_title_ar: 'إجراء صرف العلاج الكيماوي للمرضى الداخليين',
    title_en: 'Inpatient Chemotherapy Dispensing SOP',
    title_ar: 'إجراء صرف العلاج الكيماوي للمرضى الداخليين',
    process_name_en: 'Chemotherapy Dispensing',
    process_name_ar: 'صرف العلاج الكيماوي',
    process_owner_id: 'prof-1',
    process_owner_name: 'Dr. Sarah Connor',
    purpose_en: 'Ensure safe and accurate dispensing of chemotherapy medications.',
    purpose_ar: 'ضمان الصرف الآمن والدقيق لأدوية العلاج الكيماوي.',
    scope_en: 'Applies to all inpatient pharmacy staff.',
    scope_ar: 'ينطبق على جميع صيادلة القسم الداخلي.',
    primary_policy_version_id: 'pol-ver-1',
    primary_policy_document_code: 'POL-MED-2026-0001',
    primary_policy_document_title: 'Medication Safety & Administration Policy',
    primary_policy_version_number: 1,
    governance_link_state: 'linked',
    training_required: true,
    acknowledgment_required: true,
    competency_assessment_required: true,
    acknowledgment_sla_days: 30,
    training_renewal_months: 12,
    content_mode: 'structured',
    transcription_status: 'not_required',
    step_count: 5,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-15T00:00:00Z',
  },
  {
    document_id: 'sop-2',
    document_code: 'SOP-ER-2026-0002',
    document_title: 'Emergency Triage Rapid Assessment SOP',
    document_type: 'sop',
    document_status: 'draft',
    effective_date: null,
    next_review_date: null,
    department_id: 'dept-2',
    department_name: 'Emergency Medicine',
    document_owner_id: 'prof-2',
    document_owner_name: 'Ahmed Al-Mansoor',
    version_id: 'sop-ver-2',
    version_number: 1,
    version_label: '1.0',
    is_current_version: true,
    version_title_en: 'Emergency Triage Rapid Assessment SOP',
    version_title_ar: 'إجراء الفرز والتقييم السريع في الطوارئ',
    title_en: 'Emergency Triage Rapid Assessment SOP',
    title_ar: 'إجراء الفرز والتقييم السريع في الطوارئ',
    process_name_en: 'Emergency Patient Intake',
    process_name_ar: 'استقبال وتصنيف مرضى الطوارئ',
    process_owner_id: 'prof-2',
    process_owner_name: 'Ahmed Al-Mansoor',
    purpose_en: 'Rapid categorization of patient acuity upon ER arrival.',
    purpose_ar: 'تصنيف سرعة استجابة ورعاية المرضى عند الوصول للطوارئ.',
    scope_en: 'Emergency department triage desk.',
    scope_ar: 'مكتب فرز قسم الطوارئ.',
    primary_policy_version_id: null,
    primary_policy_document_code: null,
    primary_policy_document_title: null,
    primary_policy_version_number: null,
    governance_link_state: 'legacy_pending',
    training_required: false,
    acknowledgment_required: false,
    competency_assessment_required: false,
    acknowledgment_sla_days: null,
    training_renewal_months: null,
    content_mode: 'structured',
    transcription_status: 'not_required',
    step_count: 3,
    created_at: '2026-02-01T00:00:00Z',
    updated_at: '2026-02-01T00:00:00Z',
  }
];

const mockDetailedSop: DetailedSopRecord = {
  document_id: 'sop-1',
  organization_id: 'org-1',
  document_code: 'SOP-PHARM-2026-0001',
  document_title: 'Inpatient Chemotherapy Dispensing SOP',
  document_description: null,
  document_status: 'draft',
  workflow_stage: 'draft',
  department_id: 'dept-1',
  department_name: 'Clinical Pharmacy',
  document_owner_id: 'prof-1',
  document_owner_name: 'Dr. Sarah Connor',
  effective_date: '2026-01-15',
  next_review_date: '2027-01-15',
  expiry_date: null,
  criticality_level: 'critical',
  confidentiality_level: 'internal',
  active_flag: true,
  version_id: 'sop-ver-1',
  version_number: 1,
  version_label: '1.0',
  is_current_version: true,
  approved_by: null,
  approved_at: null,
  locked_by: null,
  locked_at: null,
  revision_reason: 'Initial creation',
  supersedes_version_id: null,
  title_en: 'Inpatient Chemotherapy Dispensing SOP',
  title_ar: 'إجراء صرف العلاج الكيماوي للمرضى الداخليين',
  process_name_en: 'Chemotherapy Dispensing',
  process_name_ar: 'صرف العلاج الكيماوي',
  process_owner_id: 'prof-1',
  process_owner_name: 'Dr. Sarah Connor',
  purpose_en: 'Ensure safe and accurate dispensing of chemotherapy medications.',
  purpose_ar: 'ضمان الصرف الآمن والدقيق لأدوية العلاج الكيماوي.',
  scope_en: 'Applies to all inpatient pharmacy staff.',
  scope_ar: 'ينطبق على جميع صيادلة القسم الداخلي.',
  primary_policy_version_id: 'pol-ver-1',
  primary_policy_document_code: 'POL-MED-2026-0001',
  primary_policy_document_title: 'Medication Safety & Administration Policy',
  primary_policy_version_label: '1.0',
  governance_link_state: 'linked',
  training_required: true,
  acknowledgment_required: true,
  competency_assessment_required: true,
  acknowledgment_sla_days: 30,
  training_renewal_months: 12,
  content_mode: 'structured',
  transcription_status: 'not_required',
  procedure_steps: [
    {
      id: 'step-1',
      sequence_number: 1,
      responsible_role: 'Clinical Pharmacist',
      action_instruction_en: 'Verify the oncologist electronic prescription against BSA calculator.',
      action_instruction_ar: 'مطابقة الوصفة الإلكترونية الصادرة من استشاري الأورام مع حاسبة مساحة سطح الجسم.',
      required_control_id: 'ctrl-1',
      required_control_code: 'CTL-MED-001',
      required_control_title: 'High-Alert Medication Dual Verification',
      expected_evidence_record_en: 'Dual pharmacist sign-off timestamp in EHR.',
      expected_evidence_record_ar: 'توثيق توقيع الصيدلي المزدوج في النظام الصحي الإلكتروني.',
      timing_sla_en: 'Within 30 minutes of prescription order',
      timing_sla_ar: 'خلال 30 دقيقة من صدور أمر الوصفة',
      is_decision_point: true,
      decision_criteria_en: 'If dose deviation > 5%, hold order and escalate to prescriber.',
      decision_criteria_ar: 'إذا تجاوز انحراف الجرعة 5%، يتم إيقاف الأمر والتصعيد للطبيب الواصف.',
      criticality: 'critical',
      escalation_trigger_en: 'Unresolved dosage conflict after 15 min',
      escalation_trigger_ar: 'عدم حل التعارض في الجرعة خلال 15 دقيقة',
      escalation_destination_role: 'Chief Medical Officer / Pharmacy Director'
    },
    {
      id: 'step-2',
      sequence_number: 2,
      responsible_role: 'Pharmacy Cleanroom Technician',
      action_instruction_en: 'Perform aseptic compounding inside biological safety cabinet class II.',
      action_instruction_ar: 'تحضير الدواء في بيئة معقمة داخل كابينة الأمان الحيوي من الفئة الثانية.',
      required_control_id: 'ctrl-2',
      required_control_code: 'CTL-HYG-002',
      required_control_title: 'Aseptic Hand Hygiene Compliance',
      expected_evidence_record_en: 'Cleanroom batch preparation log sheet.',
      expected_evidence_record_ar: 'سجل تحضير الدفعة في الغرفة المعقمة.',
      timing_sla_en: 'Standard compounding time: 20 minutes',
      timing_sla_ar: 'وقت التحضير المعياري: 20 دقيقة',
      is_decision_point: false,
      decision_criteria_en: null,
      decision_criteria_ar: null,
      criticality: 'high',
      escalation_trigger_en: 'Airflow filter alarm or containment leak',
      escalation_trigger_ar: 'إنذار تدفق الهواء أو تسرب الاحتواء',
      escalation_destination_role: 'Cleanroom Supervisor'
    }
  ],
  definitions: [
    {
      id: 'def-1',
      sequence_number: 1,
      term_en: 'Body Surface Area',
      term_ar: 'مساحة سطح الجسم',
      abbreviation: 'BSA',
      definition_en: 'Measured or calculated surface of a human body used for chemotherapy dosage calculations.',
      definition_ar: 'المساحة المحسوبة لجسم المريض المستخدمة لاحتساب جرعات العلاج الكيماوي بدقة.'
    },
    {
      id: 'def-2',
      sequence_number: 2,
      term_en: 'Electronic Health Record',
      term_ar: 'السجل الصحي الإلكتروني',
      abbreviation: 'EHR',
      definition_en: 'Authoritative digital clinical information system recording medication orders and verification.',
      definition_ar: 'النظام السريري الرقمي المعتمد لتوثيق أوامر الأدوية والتحقق منها.'
    }
  ],
  role_responsibilities: [
    {
      id: 'resp-1',
      sequence_number: 1,
      role_name: 'Clinical Pharmacist',
      job_title: 'Specialist Inpatient Pharmacist',
      responsibility_en: 'Verify chemotherapy calculations, check laboratory markers, and approve final dispensing.',
      responsibility_ar: 'مطابقة حسابات الجرعات والتحقق من المؤشرات المخبرية والاعتماد النهائي لصرف الدواء.',
      accountable_for_en: 'Dual-check verification entry sign-off in EHR.',
      accountable_for_ar: 'التوقيع النهائي لسجل التحقق المزدوج في النظام الإلكتروني.'
    },
    {
      id: 'resp-2',
      sequence_number: 2,
      role_name: 'Pharmacy Cleanroom Technician',
      job_title: 'Certified Compounding Tech',
      responsibility_en: 'Prepare aseptic IV admixture in compliance with cleanroom environmental protocols.',
      responsibility_ar: 'تحضير المحاليل الوريدية المعقمة وفق بروتوكولات البيئة المعقمة المعتمدة.',
      accountable_for_en: 'Cleanroom log completion and particle counter baseline.',
      accountable_for_ar: 'اكتمال سجل الغرفة المعقمة ومطابقة قراءات عداد الجسيمات.'
    }
  ],
  monitoring_kpis: [
    {
      id: 'kpi-1',
      sequence_number: 1,
      kpi_name_en: 'Dual-Pharmacist Verification Compliance Rate',
      kpi_name_ar: 'نسبة الالتزام بالتحقق المزدوج لجرعات الكيماوي',
      target_value: '100%',
      measurement_frequency: 'Monthly',
      owner_id: 'prof-1',
      owner_name: 'Dr. Sarah Connor',
      description_en: 'Percentage of chemotherapy orders with completed dual independent verification timestamps.',
      description_ar: 'نسبة أوامر العلاج الكيماوي المكتملة بأختام التحقق المزدوج المستقل.'
    }
  ],
  department_scopes: ['dept-1'],
  role_scopes: [{ id: 'role-1', role_name: 'Clinical Pharmacist', job_title: 'Inpatient Pharmacist' }],
  review_events: [],
  exceptions: [],
  review_triggers: [],
  all_versions: [
    {
      id: 'sop-ver-1',
      version_number: 1,
      version_label: '1.0',
      is_current_version: true,
      effective_date: '2026-01-15',
      expiry_date: null,
      approved_at: null,
      locked_at: null,
      prepared_by: 'prof-1',
      revision_reason: 'Initial creation'
    }
  ]
};

describe('GRC v1.4-E1 / E1R Governed SOP Register & Structured Content Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Migration 203 Static Contract & Schema Verification', () => {
    const migrationPath = path.resolve(
      process.cwd(),
      'supabase/migrations/203_governed_sop_structured_content_expansion.sql'
    );

    it('verifies migration 203 file exists and contains essential structured tables', () => {
      expect(fs.existsSync(migrationPath)).toBe(true);
      const sql = fs.readFileSync(migrationPath, 'utf8');
      expect(sql.length).toBeGreaterThan(1000);
      
      // Table definitions
      expect(sql).toMatch(/create table if not exists public\.sop_definitions/i);
      expect(sql).toMatch(/create table if not exists public\.sop_role_responsibilities/i);
      expect(sql).toMatch(/create table if not exists public\.sop_monitoring_kpis/i);

      // Check constraints
      expect(sql).toMatch(/check \(sequence_number >= 1\)/i);
      expect(sql).toMatch(/nullif\(trim\(coalesce\(term_en, ''\)\), ''\) is not null/i);
      expect(sql).toMatch(/nullif\(trim\(coalesce\(role_name, ''\)\), ''\) is not null/i);
    });

    it('verifies RLS security and trigger attachments for immutability and document type', () => {
      const sql = fs.readFileSync(migrationPath, 'utf8');
      
      // RLS enabled
      expect(sql).toMatch(/alter table public\.sop_definitions enable row level security/i);
      expect(sql).toMatch(/alter table public\.sop_role_responsibilities enable row level security/i);
      expect(sql).toMatch(/alter table public\.sop_monitoring_kpis enable row level security/i);

      // Trigger attachment for immutability
      expect(sql).toMatch(/trg_immutability_sop_definitions/i);
      expect(sql).toMatch(/trg_immutability_sop_role_responsibilities/i);
      expect(sql).toMatch(/trg_immutability_sop_monitoring_kpis/i);

      // Trigger attachment for SOP version type
      expect(sql).toMatch(/trg_validate_sop_definitions_type/i);
      expect(sql).toMatch(/trg_validate_sop_responsibilities_type/i);
      expect(sql).toMatch(/trg_validate_sop_kpis_type/i);
    });

    it('verifies atomic save cross-version child ID denial and service-role execution grants', () => {
      const sql = fs.readFileSync(migrationPath, 'utf8');
      
      expect(sql).toMatch(/PATCH202_CROSS_VERSION_CHILD_ID_DENIED/i);
      expect(sql).toMatch(/v_seen_def_ids/i);
      expect(sql).toMatch(/v_seen_resp_ids/i);
      expect(sql).toMatch(/v_seen_kpi_ids/i);

      // Revocations and grants
      expect(sql).toMatch(/revoke all on function public\.create_governed_sop_draft/i);
      expect(sql).toMatch(/grant execute on function public\.create_governed_sop_draft/i);
      expect(sql).toMatch(/revoke all on function public\.save_governed_sop_draft/i);
      expect(sql).toMatch(/grant execute on function public\.save_governed_sop_draft/i);
    });

    it('verifies explicit drop of obsolete Migration-202 function overloads', () => {
      const sql = fs.readFileSync(migrationPath, 'utf8');
      
      // Drop 202 create overload (25 params)
      expect(sql).toMatch(/drop function if exists public\.create_governed_sop_draft\(\s*uuid,\s*uuid/i);
      // Drop 202 save overload (21 params)
      expect(sql).toMatch(/drop function if exists public\.save_governed_sop_draft\(\s*uuid,\s*uuid/i);
    });

    it('verifies cross-organization validation for KPI owner and deep revision cloning', () => {
      const sql = fs.readFileSync(migrationPath, 'utf8');
      
      // KPI owner cross-org check
      expect(sql).toMatch(/if TG_TABLE_NAME = 'sop_monitoring_kpis' then/i);
      expect(sql).toMatch(/select organization_id into v_ref_org_id\s*from public\.profiles\s*where id = NEW\.owner_id/i);
      expect(sql).toMatch(/PATCH201_CROSS_ORGANIZATION_REFERENCE_DENIED/i);

      // Deep revision cloning for structured tables
      expect(sql).toMatch(/insert into public\.sop_definitions\s*\(\s*sop_version_id,\s*sequence_number/i);
      expect(sql).toMatch(/insert into public\.sop_role_responsibilities\s*\(\s*sop_version_id,\s*sequence_number/i);
      expect(sql).toMatch(/insert into public\.sop_monitoring_kpis\s*\(\s*sop_version_id,\s*sequence_number/i);
    });
  });

  describe('2. SopRegister Component', () => {
    it('renders SOP catalog table with columns and data accurately', () => {
      const handleSelectSop = vi.fn();
      const handleCreateSop = vi.fn();

      render(
        <I18nProvider>
          <SopRegister
            sops={mockSops}
            departments={mockDepartments}
            onSelectSop={handleSelectSop}
            onCreateSop={handleCreateSop}
          />
        </I18nProvider>
      );

      expect(screen.getByText('SOP-PHARM-2026-0001')).toBeDefined();
      expect(screen.getByText('Inpatient Chemotherapy Dispensing SOP')).toBeDefined();
      expect(screen.getByText('SOP-ER-2026-0002')).toBeDefined();
      expect(screen.getByText('Emergency Triage Rapid Assessment SOP')).toBeDefined();
      expect(screen.getByText('POL-MED-2026-0001')).toBeDefined();
    });

    it('filters SOPs by search term', () => {
      render(
        <I18nProvider>
          <SopRegister
            sops={mockSops}
            departments={mockDepartments}
            onSelectSop={vi.fn()}
            onCreateSop={vi.fn()}
          />
        </I18nProvider>
      );

      const searchInput = screen.getByPlaceholderText(/Search by SOP code/i);
      fireEvent.change(searchInput, { target: { value: 'Chemotherapy' } });

      expect(screen.getByText('Inpatient Chemotherapy Dispensing SOP')).toBeDefined();
      expect(screen.queryByText('Emergency Triage Rapid Assessment SOP')).toBeNull();
    });

    it('filters SOPs by governing policy linkage state', () => {
      render(
        <I18nProvider>
          <SopRegister
            sops={mockSops}
            departments={mockDepartments}
            onSelectSop={vi.fn()}
            onCreateSop={vi.fn()}
          />
        </I18nProvider>
      );

      const linkSelect = screen.getByLabelText(/Policy Linkage/i);
      fireEvent.change(linkSelect, { target: { value: 'legacy_pending' } });

      expect(screen.queryByText('Inpatient Chemotherapy Dispensing SOP')).toBeNull();
      expect(screen.getByText('Emergency Triage Rapid Assessment SOP')).toBeDefined();
    });

    it('triggers new SOP creation callback on button click', () => {
      const handleCreateSop = vi.fn();

      render(
        <I18nProvider>
          <SopRegister
            sops={mockSops}
            departments={mockDepartments}
            onSelectSop={vi.fn()}
            onCreateSop={handleCreateSop}
          />
        </I18nProvider>
      );

      const newBtn = screen.getByRole('button', { name: /New SOP/i });
      fireEvent.click(newBtn);
      expect(handleCreateSop).toHaveBeenCalledTimes(1);
    });
  });

  describe('3. SopProcedureBuilder Component', () => {
    it('renders procedure steps with sequence, role, and critical control point badges', () => {
      const mockSteps: SopProcedureStep[] = [...mockDetailedSop.procedure_steps];
      const handleChange = vi.fn();

      render(
        <I18nProvider>
          <SopProcedureBuilder
            steps={mockSteps}
            onChange={handleChange}
            controls={mockControls}
          />
        </I18nProvider>
      );

      expect(screen.getByText('Clinical Pharmacist')).toBeDefined();
      expect(screen.getByText(/Verify the oncologist electronic prescription/i)).toBeDefined();
      expect(screen.getByText('Pharmacy Cleanroom Technician')).toBeDefined();
      expect(screen.getAllByText(/Critical Control Point/i).length).toBeGreaterThan(0);
    });

    it('supports adding a new step and re-indexing sequences', () => {
      const mockSteps: SopProcedureStep[] = [mockDetailedSop.procedure_steps[0]];
      const handleChange = vi.fn();

      render(
        <I18nProvider>
          <SopProcedureBuilder
            steps={mockSteps}
            onChange={handleChange}
            controls={mockControls}
          />
        </I18nProvider>
      );

      const addBtn = screen.getByRole('button', { name: /Add Step/i });
      fireEvent.click(addBtn);

      expect(handleChange).toHaveBeenCalledTimes(1);
      const passedSteps = handleChange.mock.calls[0][0];
      expect(passedSteps).toHaveLength(2);
      expect(passedSteps[1].sequence_number).toBe(2);
    });

    it('supports moving steps down and maintaining stable sequences', () => {
      const mockSteps: SopProcedureStep[] = [...mockDetailedSop.procedure_steps];
      const handleChange = vi.fn();

      render(
        <I18nProvider>
          <SopProcedureBuilder
            steps={mockSteps}
            onChange={handleChange}
            controls={mockControls}
          />
        </I18nProvider>
      );

      const moveDownBtns = screen.getAllByTitle(/Move down/i);
      fireEvent.click(moveDownBtns[0]);

      expect(handleChange).toHaveBeenCalledTimes(1);
      const reordered = handleChange.mock.calls[0][0];
      expect(reordered[0].id).toBe('step-2');
      expect(reordered[0].sequence_number).toBe(1);
      expect(reordered[1].id).toBe('step-1');
      expect(reordered[1].sequence_number).toBe(2);
    });
  });

  describe('4. SopDefinitionsBuilder Component', () => {
    it('renders definitions with abbreviation, term, and definition texts', () => {
      const mockDefs: SopDefinition[] = [...mockDetailedSop.definitions];
      const handleChange = vi.fn();

      render(
        <I18nProvider>
          <SopDefinitionsBuilder
            definitions={mockDefs}
            onChange={handleChange}
          />
        </I18nProvider>
      );

      expect(screen.getByDisplayValue('BSA')).toBeDefined();
      expect(screen.getByDisplayValue('Body Surface Area')).toBeDefined();
      expect(screen.getByDisplayValue('EHR')).toBeDefined();
      expect(screen.getByDisplayValue('Electronic Health Record')).toBeDefined();
    });

    it('supports adding a new definition entry', () => {
      const mockDefs: SopDefinition[] = [mockDetailedSop.definitions[0]];
      const handleChange = vi.fn();

      render(
        <I18nProvider>
          <SopDefinitionsBuilder
            definitions={mockDefs}
            onChange={handleChange}
          />
        </I18nProvider>
      );

      const addBtn = screen.getByRole('button', { name: /Add Definition/i });
      fireEvent.click(addBtn);

      expect(handleChange).toHaveBeenCalledTimes(1);
      const res = handleChange.mock.calls[0][0];
      expect(res).toHaveLength(2);
      expect(res[1].sequence_number).toBe(2);
    });

    it('supports reordering and duplicating definitions', () => {
      const mockDefs: SopDefinition[] = [...mockDetailedSop.definitions];
      const handleChange = vi.fn();

      render(
        <I18nProvider>
          <SopDefinitionsBuilder
            definitions={mockDefs}
            onChange={handleChange}
          />
        </I18nProvider>
      );

      const moveDownBtns = screen.getAllByTitle(/Move down/i);
      fireEvent.click(moveDownBtns[0]);

      expect(handleChange).toHaveBeenCalledTimes(1);
      const reordered = handleChange.mock.calls[0][0];
      expect(reordered[0].id).toBe('def-2');
      expect(reordered[0].sequence_number).toBe(1);
      expect(reordered[1].id).toBe('def-1');
      expect(reordered[1].sequence_number).toBe(2);
    });
  });

  describe('5. SopResponsibilitiesBuilder Component', () => {
    it('renders role responsibilities with role name, responsibility, and accountability', () => {
      const mockResps: SopRoleResponsibility[] = [...mockDetailedSop.role_responsibilities];
      const handleChange = vi.fn();

      render(
        <I18nProvider>
          <SopResponsibilitiesBuilder
            responsibilities={mockResps}
            onChange={handleChange}
          />
        </I18nProvider>
      );

      expect(screen.getByDisplayValue('Clinical Pharmacist')).toBeDefined();
      expect(screen.getByDisplayValue('Specialist Inpatient Pharmacist')).toBeDefined();
      expect(screen.getByDisplayValue('Pharmacy Cleanroom Technician')).toBeDefined();
    });

    it('supports adding and updating role responsibilities', () => {
      const mockResps: SopRoleResponsibility[] = [mockDetailedSop.role_responsibilities[0]];
      const handleChange = vi.fn();

      render(
        <I18nProvider>
          <SopResponsibilitiesBuilder
            responsibilities={mockResps}
            onChange={handleChange}
          />
        </I18nProvider>
      );

      const addBtn = screen.getByRole('button', { name: /Add Role Responsibility/i });
      fireEvent.click(addBtn);

      expect(handleChange).toHaveBeenCalledTimes(1);
      const res = handleChange.mock.calls[0][0];
      expect(res).toHaveLength(2);
      expect(res[1].sequence_number).toBe(2);
    });
  });

  describe('6. SopMonitoringKpisBuilder Component', () => {
    it('renders KPIs with target, frequency, and profile owner selector', () => {
      const mockKpis: SopMonitoringKpi[] = [...mockDetailedSop.monitoring_kpis];
      const handleChange = vi.fn();

      render(
        <I18nProvider>
          <SopMonitoringKpisBuilder
            kpis={mockKpis}
            profiles={mockProfiles}
            onChange={handleChange}
          />
        </I18nProvider>
      );

      expect(screen.getByDisplayValue('Dual-Pharmacist Verification Compliance Rate')).toBeDefined();
      expect(screen.getByDisplayValue('100%')).toBeDefined();
      expect(screen.getByDisplayValue('Monthly')).toBeDefined();
    });

    it('supports adding new monitoring indicators', () => {
      const mockKpis: SopMonitoringKpi[] = [mockDetailedSop.monitoring_kpis[0]];
      const handleChange = vi.fn();

      render(
        <I18nProvider>
          <SopMonitoringKpisBuilder
            kpis={mockKpis}
            profiles={mockProfiles}
            onChange={handleChange}
          />
        </I18nProvider>
      );

      const addBtn = screen.getByRole('button', { name: /Add Monitoring Indicator/i });
      fireEvent.click(addBtn);

      expect(handleChange).toHaveBeenCalledTimes(1);
      const res = handleChange.mock.calls[0][0];
      expect(res).toHaveLength(2);
      expect(res[1].sequence_number).toBe(2);
    });
  });

  describe('7. SopPreviewModal Component', () => {
    it('renders printable A4 document view with all governed structured sections', () => {
      const handleClose = vi.fn();

      render(
        <I18nProvider>
          <SopPreviewModal
            sop={mockDetailedSop}
            onClose={handleClose}
          />
        </I18nProvider>
      );

      expect(screen.getAllByText('SOP-PHARM-2026-0001').length).toBeGreaterThan(0);
      expect(screen.getByText('Inpatient Chemotherapy Dispensing SOP')).toBeDefined();
      expect(screen.getByText('POL-MED-2026-0001 - Medication Safety & Administration Policy (v1.0)')).toBeDefined();
      expect(screen.getByText('Chemotherapy Dispensing')).toBeDefined();
      expect(screen.getByText(/Body Surface Area/i)).toBeDefined();
      expect(screen.getByText(/Dual pharmacist sign-off timestamp in EHR/i)).toBeDefined();
      expect(screen.getByText(/Dual-Pharmacist Verification Compliance Rate/i)).toBeDefined();
    });
  });

  describe('8. SopEditor Full Workspace & Lifecycle Integration', () => {
    beforeEach(() => {
      vi.spyOn(policySopApi, 'listDepartments').mockResolvedValue(mockDepartments);
      vi.spyOn(policySopApi, 'listProfiles').mockResolvedValue(mockProfiles);
      vi.spyOn(policySopApi, 'listControls').mockResolvedValue(mockControls);
      vi.spyOn(policySopApi, 'listEligibleGoverningPolicies').mockResolvedValue(mockEligiblePolicies);
      vi.spyOn(policySopApi, 'getGovernedSopDetail').mockResolvedValue(mockDetailedSop);
      vi.spyOn(policySopApi, 'saveGovernedSopDraft').mockResolvedValue({ success: true, version_id: 'sop-ver-1' });
    });

    it('loads SOP detail and renders full 12-tab workspace', async () => {
      render(
        <I18nProvider>
          <SopEditor
            initialSopId="sop-1"
            onBack={vi.fn()}
          />
        </I18nProvider>
      );

      await waitFor(() => {
        expect(screen.queryByText(/Loading Governed SOP Workspace/i)).toBeNull();
      });

      expect(screen.getByDisplayValue('Inpatient Chemotherapy Dispensing SOP')).toBeDefined();
      expect(screen.getByDisplayValue('Chemotherapy Dispensing')).toBeDefined();
      expect(screen.getByText(/Document Control/i)).toBeDefined();
      expect(screen.getByText(/Governing Policy/i)).toBeDefined();
      expect(screen.getByText(/Purpose & Scope/i)).toBeDefined();
      expect(screen.getByText(/Definitions & Abbreviations/i)).toBeDefined();
      expect(screen.getByText(/Roles & Responsibilities/i)).toBeDefined();
      expect(screen.getByText(/Procedure Builder/i)).toBeDefined();
      expect(screen.getByText(/Monitoring & KPIs/i)).toBeDefined();
    });

    it('switches to Definitions tab and interacts with definitions builder', async () => {
      render(
        <I18nProvider>
          <SopEditor
            initialSopId="sop-1"
            onBack={vi.fn()}
          />
        </I18nProvider>
      );

      await waitFor(() => {
        expect(screen.queryByText(/Loading Governed SOP Workspace/i)).toBeNull();
      });

      const defsTab = screen.getByRole('button', { name: /Definitions & Abbreviations/i });
      fireEvent.click(defsTab);

      expect(screen.getByDisplayValue('BSA')).toBeDefined();
      expect(screen.getByDisplayValue('Body Surface Area')).toBeDefined();
    });

    it('triggers save draft with procedure steps, definitions, responsibilities, and KPIs', async () => {
      const saveSpy = vi.spyOn(policySopApi, 'saveGovernedSopDraft');

      render(
        <I18nProvider>
          <SopEditor
            initialSopId="sop-1"
            onBack={vi.fn()}
          />
        </I18nProvider>
      );

      await waitFor(() => {
        expect(screen.queryByText(/Loading Governed SOP Workspace/i)).toBeNull();
      });

      const titleInput = screen.getByDisplayValue('Inpatient Chemotherapy Dispensing SOP');
      fireEvent.change(titleInput, { target: { value: 'Updated Chemotherapy Dispensing SOP' } });

      const saveBtn = screen.getByRole('button', { name: /Save Draft/i });
      fireEvent.click(saveBtn);

      await waitFor(() => {
        expect(saveSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            version_id: 'sop-ver-1',
            title_en: 'Updated Chemotherapy Dispensing SOP',
            process_name_en: 'Chemotherapy Dispensing',
            primary_policy_version_id: 'pol-ver-1',
            definitions: expect.arrayContaining([
              expect.objectContaining({ term_en: 'Body Surface Area', abbreviation: 'BSA' })
            ]),
            role_responsibilities: expect.arrayContaining([
              expect.objectContaining({ role_name: 'Clinical Pharmacist' })
            ]),
            monitoring_kpis: expect.arrayContaining([
              expect.objectContaining({ kpi_name_en: 'Dual-Pharmacist Verification Compliance Rate' })
            ])
          })
        );
      });
    });

    it('loads existing SOP completely independently of master data delay, exact fetch count 1, and saves correctly', async () => {
      // 1. Arrange mocks so getGovernedSopDetail resolves, but master data is delayed
      let resolveDepartments: any;
      const deptPromise = new Promise(resolve => { resolveDepartments = resolve; });
      vi.spyOn(policySopApi, 'listDepartments').mockReturnValue(deptPromise as any);

      const getSopSpy = vi.spyOn(policySopApi, 'getGovernedSopDetail');
      const saveSpy = vi.spyOn(policySopApi, 'saveGovernedSopDraft');

      render(
        <I18nProvider>
          <SopEditor
            initialSopId="sop-1"
            onBack={vi.fn()}
          />
        </I18nProvider>
      );

      // Prove the existing SOP editor becomes usable before delayed master data promises complete
      await waitFor(() => {
        expect(screen.queryByText(/Loading Governed SOP Workspace/i)).toBeNull();
      });

      const titleInput = screen.getByDisplayValue('Inpatient Chemotherapy Dispensing SOP');
      expect(titleInput).toBeDefined();

      // Assert getGovernedSopDetail was called exactly once
      expect(getSopSpy).toHaveBeenCalledTimes(1);

      // NO SECOND LOADING FLICKER
      // Resolve delayed master data
      resolveDepartments(mockDepartments);

      // Wait a tick to ensure no re-renders wipe out the state or show loading
      await new Promise(r => setTimeout(r, 50));

      // verify the editor does NOT return to "Loading Governed SOP Workspace…"
      expect(screen.queryByText(/Loading Governed SOP Workspace/i)).toBeNull();

      // EXACT FETCH COUNT: assert it's STILL 1
      expect(getSopSpy).toHaveBeenCalledTimes(1);

      // SAVE DRAFT REMAINS AVAILABLE
      fireEvent.change(titleInput, { target: { value: 'Modified Title After Master Data' } });
      const saveBtn = screen.getByRole('button', { name: /Save Draft/i });
      fireEvent.click(saveBtn);

      // EXISTING SAVE PAYLOAD STILL WORKS
      await waitFor(() => {
        expect(saveSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            version_id: 'sop-ver-1',
            title_en: 'Modified Title After Master Data',
            process_name_en: 'Chemotherapy Dispensing',
            primary_policy_version_id: 'pol-ver-1'
          })
        );
      });
    });

    it('initializes new SOP defaults only once when master data resolves, without overwriting user changes', async () => {
      let resolveDepartments: any;
      let resolveProfiles: any;
      const deptPromise = new Promise(resolve => { resolveDepartments = resolve; });
      const profPromise = new Promise(resolve => { resolveProfiles = resolve; });

      vi.spyOn(policySopApi, 'listDepartments').mockReturnValue(deptPromise as any);
      vi.spyOn(policySopApi, 'listProfiles').mockReturnValue(profPromise as any);

      const createSpy = vi.spyOn(policySopApi, 'createGovernedSopDraft').mockResolvedValue({ document_id: 'new-doc', version_id: 'new-ver' } as any);

      render(
        <I18nProvider>
          <SopEditor
            initialSopId="new"
            onBack={vi.fn()}
          />
        </I18nProvider>
      );

      // Wait for it to render empty initially (sop fetch returns synchronously for 'new')
      await waitFor(() => {
        expect(screen.queryByText(/Loading Governed SOP Workspace/i)).toBeNull();
      });

      // User makes a change before master data is available
      const titleInput = screen.getByPlaceholderText(/e.g. Standard Procedure for Safe Medication Administration/i);
      fireEvent.change(titleInput, { target: { value: 'My Early Title' } });

      const processInput = screen.getByPlaceholderText(/e.g. Inpatient Medication Dispensing/i);
      fireEvent.change(processInput, { target: { value: 'My Early Process' } });

      // Switch to Linkage tab and set to Not Applicable to pass validation
      const allButtons = screen.getAllByRole('button');
      const linkageTab = allButtons.find(btn => btn.textContent?.includes('2.'));
      if (linkageTab) fireEvent.click(linkageTab);
      
      await waitFor(() => {
        const radios = screen.getAllByRole('radio');
        if (radios.length >= 3) {
          fireEvent.click(radios[2]);
        }
      });

      // Now resolve master data
      resolveDepartments(mockDepartments);
      resolveProfiles(mockProfiles);

      // Wait a tick for the defaults to apply
      await new Promise(r => setTimeout(r, 50));

      const saveBtn = screen.getByRole('button', { name: /Save Draft/i });
      fireEvent.click(saveBtn);

      // Validate initialization does not repeatedly overwrite subsequent user changes
      // and that master data defaults (department, owner) are applied.
      await waitFor(() => {
        expect(createSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            title_en: 'My Early Title',
            process_name_en: 'My Early Process',
            department_id: mockDepartments[0].id,
            process_owner_id: mockProfiles[0].id,
            governance_link_state: 'not_applicable'
          })
        );
      });
    });
  });
});
