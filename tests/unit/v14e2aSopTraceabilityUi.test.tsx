import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { I18nProvider } from '../../src/i18n/I18nContext';
import { SopRiskTraceabilityBuilder } from '../../src/components/policy-sop/SopRiskTraceabilityBuilder';
import { SopAccreditationTraceabilityBuilder } from '../../src/components/policy-sop/SopAccreditationTraceabilityBuilder';
import { SopPreviewModal } from '../../src/components/policy-sop/SopPreviewModal';
import { SopEditor } from '../../src/components/policy-sop/SopEditor';
import type {
  DetailedSopRecord,
  SopRiskLink,
  SopAccreditationLink,
  SopDerivedControl,
  SopInheritedAccreditation,
  EligibleGoverningPolicy
} from '../../src/lib/policySopApi';
import * as policySopApi from '../../src/lib/policySopApi';

const mockRisks = [
  {
    id: 'risk-1',
    risk_code: 'RSK-CLIN-001',
    title: 'Adverse Drug Event Hazard',
    status: 'open',
    risk_level: 'critical',
    department_name: 'Pharmacy'
  },
  {
    id: 'risk-2',
    risk_code: 'RSK-CLIN-002',
    title: 'Patient Identification Failure',
    status: 'open',
    risk_level: 'high',
    department_name: 'Nursing'
  }
];

const mockClauses = [
  {
    id: 'clause-1',
    clause_code: 'CBAHI-MM-01',
    clause_title: 'Medication Safety & High-Alert Storage',
    clause_title_ar: 'سلامة الأدوية وتخزين الأدوية عالية الخطورة',
    framework: 'CBAHI',
    standard_code: 'MM.01',
    criticality: 'critical'
  },
  {
    id: 'clause-2',
    clause_code: 'JCI-IPSG-01',
    clause_title: 'Identify Patients Correctly',
    clause_title_ar: 'التحقق الصحيح من هوية المريض',
    framework: 'JCI',
    standard_code: 'IPSG.01',
    criticality: 'critical'
  }
];

describe('GRC v1.4-E2A Governed SOP Traceability UI Components', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(policySopApi, 'fetchActiveRisks').mockResolvedValue(mockRisks);
    vi.spyOn(policySopApi, 'fetchAccreditationClauses').mockResolvedValue(mockClauses);
    vi.spyOn(policySopApi, 'listDepartments').mockResolvedValue([
      { id: 'dept-1', name: 'Clinical Pharmacy', code: 'PHARM' }
    ]);
    vi.spyOn(policySopApi, 'listProfiles').mockResolvedValue([
      { id: 'prof-1', full_name: 'Dr. Sarah Connor', email: 's.connor@hospital.org', job_title: 'CMO' }
    ]);
    vi.spyOn(policySopApi, 'listControls').mockResolvedValue([
      { id: 'ctrl-1', code: 'CTL-MED-001', title: 'High-Alert Medication Dual Verification' }
    ]);
    vi.spyOn(policySopApi, 'listEligibleGoverningPolicies').mockResolvedValue([
      {
        version_id: 'pol-ver-1',
        document_id: 'pol-doc-1',
        document_code: 'POL-MED-001',
        title_en: 'Medication Management Policy',
        title_ar: null,
        version_label: '1.0',
        document_status: 'active',
        effective_date: '2026-01-01'
      }
    ]);
  });

  it('renders SopRiskTraceabilityBuilder and opens add risk modal', async () => {
    const mockRiskLinks: SopRiskLink[] = [
      {
        id: 'link-1',
        sequence_number: 1,
        risk_id: 'risk-1',
        risk_code: 'RSK-CLIN-001',
        risk_title: 'Adverse Drug Event Hazard',
        risk_status: 'open',
        risk_level: 'critical',
        relationship_type: 'mitigates',
        context_note_en: 'Direct mitigation in step 2'
      }
    ];

    const mockDerivedControls: SopDerivedControl[] = [
      {
        control_id: 'ctrl-1',
        control_code: 'CTL-MED-001',
        control_title: 'High-Alert Medication Dual Verification',
        control_type: 'preventive',
        key_control: true,
        step_sequences: [1, 3]
      }
    ];

    const onChange = vi.fn();

    render(
      <I18nProvider>
        <SopRiskTraceabilityBuilder
          riskLinks={mockRiskLinks}
          onChangeRiskLinks={onChange}
          derivedControls={mockDerivedControls}
          organizationId="org-1"
        />
      </I18nProvider>
    );

    expect(screen.getByText('Directly Mapped Enterprise Risks')).toBeDefined();
    expect(screen.getByText('RSK-CLIN-001')).toBeDefined();
    expect(screen.getByText('Mitigates Risk')).toBeDefined();
    expect(screen.getByText('Controls Derived from Procedure Steps')).toBeDefined();
    expect(screen.getByText('CTL-MED-001')).toBeDefined();
    expect(screen.getByText('Step 1')).toBeDefined();
    expect(screen.getByText('Step 3')).toBeDefined();

    // Wait for available risks to load
    await waitFor(() => {
      expect(screen.getByText('Add Risk Mapping')).toBeDefined();
    });

    const addBtn = screen.getByText('Add Risk Mapping');
    fireEvent.click(addBtn);

    await waitFor(() => {
      expect(screen.getByText('Map Enterprise Risk')).toBeDefined();
    });
  });

  it('renders SopAccreditationTraceabilityBuilder with inherited and direct clauses', async () => {
    const mockAccLinks: SopAccreditationLink[] = [
      {
        id: 'acc-1',
        sequence_number: 1,
        clause_id: 'clause-1',
        clause_code: 'CBAHI-MM-01',
        clause_title: 'Medication Safety & High-Alert Storage',
        framework: 'CBAHI',
        standard_code: 'MM.01',
        criticality: 'critical',
        link_strength: 'primary',
        context_note_en: 'Full procedural alignment'
      }
    ];

    const mockInherited: SopInheritedAccreditation[] = [
      {
        clause_id: 'clause-2',
        clause_code: 'JCI-IPSG-01',
        clause_title: 'Identify Patients Correctly',
        framework: 'JCI',
        standard_code: 'IPSG.01',
        criticality: 'critical',
        policy_requirement_en: 'Mandatory two-patient identifiers before clinical administration'
      }
    ];

    const onChange = vi.fn();

    render(
      <I18nProvider>
        <SopAccreditationTraceabilityBuilder
          accreditationLinks={mockAccLinks}
          onChangeAccreditationLinks={onChange}
          inheritedAccreditations={mockInherited}
          primaryPolicyDocumentCode="POL-MED-001"
          primaryPolicyDocumentTitle="Medication Management Policy"
          primaryPolicyVersionLabel="1.0"
        />
      </I18nProvider>
    );

    expect(screen.getByText('Accreditation Clauses Inherited from Governing Policy')).toBeDefined();
    expect(screen.getByText('JCI-IPSG-01')).toBeDefined();
    expect(screen.getByText('Directly Mapped Accreditation Standards')).toBeDefined();
    expect(screen.getByText('CBAHI-MM-01')).toBeDefined();
    expect(screen.getByText('Primary Clause')).toBeDefined();
  });

  it('renders SopPreviewModal with structured traceability sections', () => {
    const mockSop: DetailedSopRecord = {
      document_id: 'doc-1',
      organization_id: 'org-1',
      document_code: 'SOP-CLIN-001',
      document_title: 'Clinical Medication Administration',
      document_description: null,
      document_status: 'draft',
      workflow_stage: null,
      department_id: 'dept-1',
      department_name: 'Pharmacy',
      document_owner_id: 'prof-1',
      document_owner_name: 'Dr. Sarah Connor',
      effective_date: '2026-03-01',
      next_review_date: '2027-03-01',
      expiry_date: null,
      criticality_level: 'critical',
      confidentiality_level: 'internal',
      active_flag: true,
      version_id: 'ver-1',
      version_number: 1.0,
      version_label: '1.0',
      is_current_version: false,
      approved_by: null,
      approved_at: null,
      locked_by: null,
      locked_at: null,
      revision_reason: null,
      supersedes_version_id: null,
      title_en: 'Clinical Medication Administration',
      title_ar: null,
      process_name_en: 'Medication Administration',
      process_name_ar: null,
      process_owner_id: null,
      process_owner_name: null,
      purpose_en: 'Standardize clinical medication administration.',
      purpose_ar: null,
      scope_en: 'All inpatient clinical units.',
      scope_ar: null,
      primary_policy_version_id: 'pol-ver-1',
      primary_policy_document_code: 'POL-MED-001',
      primary_policy_document_title: 'Medication Management Policy',
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
          responsible_role: 'Registered Nurse',
          action_instruction_en: 'Perform bedside two-factor patient identification',
          action_instruction_ar: null,
          required_control_id: 'ctrl-1',
          required_control_code: 'CTL-MED-001',
          required_control_title: 'Two-Factor ID',
          expected_evidence_record_en: 'EMR barcode scan log',
          expected_evidence_record_ar: null,
          timing_sla_en: 'Immediate',
          timing_sla_ar: null,
          is_decision_point: false,
          decision_criteria_en: null,
          decision_criteria_ar: null,
          criticality: 'critical',
          escalation_trigger_en: null,
          escalation_trigger_ar: null,
          escalation_destination_role: null
        }
      ],
      definitions: [],
      role_responsibilities: [],
      monitoring_kpis: [],
      risk_links: [
        {
          id: 'risk-link-1',
          sequence_number: 1,
          risk_id: 'risk-1',
          risk_code: 'RSK-CLIN-001',
          risk_title: 'Adverse Drug Event Hazard',
          risk_status: 'open',
          risk_level: 'critical',
          relationship_type: 'mitigates',
          context_note_en: 'Mitigates dosage error hazards'
        }
      ],
      accreditation_links: [
        {
          id: 'acc-link-1',
          sequence_number: 1,
          clause_id: 'clause-1',
          clause_code: 'CBAHI-MM-01',
          clause_title: 'Medication Safety & Storage',
          framework: 'CBAHI',
          standard_code: 'MM.01',
          criticality: 'critical',
          link_strength: 'primary',
          context_note_en: 'Full adherence'
        }
      ],
      derived_controls: [
        {
          control_id: 'ctrl-1',
          control_code: 'CTL-MED-001',
          control_title: 'Two-Factor ID',
          control_type: 'preventive',
          key_control: true,
          step_sequences: [1]
        }
      ],
      inherited_accreditations: [
        {
          clause_id: 'clause-2',
          clause_code: 'JCI-IPSG-01',
          clause_title: 'Identify Patients Correctly',
          framework: 'JCI',
          standard_code: 'IPSG.01',
          criticality: 'critical',
          policy_requirement_en: 'Mandatory patient identification'
        }
      ],
      department_scopes: [],
      role_scopes: [],
      review_events: [],
      exceptions: [],
      review_triggers: [],
      all_versions: []
    };

    render(
      <I18nProvider>
        <SopPreviewModal sop={mockSop} onClose={() => {}} />
      </I18nProvider>
    );

    expect(screen.getByText('5. Risks & Controls Traceability')).toBeDefined();
    expect(screen.getByText(/RSK-CLIN-001/)).toBeDefined();
    expect(screen.getByText('Two-Factor ID')).toBeDefined();
    expect(screen.getByText('6. Accreditation & Regulatory Alignment')).toBeDefined();
    expect(screen.getByText(/CBAHI-MM-01/)).toBeDefined();
    expect(screen.getByText('JCI-IPSG-01')).toBeDefined();
  });
});
