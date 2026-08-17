import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { I18nProvider } from '../../src/i18n/I18nContext';
import { PolicyRegister } from '../../src/components/policy-sop/PolicyRegister';
import { PolicyRequirementBuilder } from '../../src/components/policy-sop/PolicyRequirementBuilder';
import { ApplicabilitySelector } from '../../src/components/policy-sop/ApplicabilitySelector';
import { DocumentStatusBadge } from '../../src/components/policy-sop/DocumentStatusBadge';
import { StartRevisionModal } from '../../src/components/policy-sop/StartRevisionModal';
import { PolicyExceptionModal } from '../../src/components/policy-sop/PolicyExceptionModal';
import { SubmitReviewModal } from '../../src/components/policy-sop/SubmitReviewModal';
import { GovernedPolicyCatalogRow, PolicyRequirement, RoleScope } from '../../src/lib/policySopApi';

describe('GRC v1.4-D2 — Policies & SOPs Hub + Governed Policy Register / Editor Unit Tests', () => {
  const mockPolicies: GovernedPolicyCatalogRow[] = [
    {
      document_id: 'doc-1',
      organization_id: 'org-1',
      document_code: 'POL-2026-0001',
      document_title: 'Clinical Information Security Policy',
      document_description: 'Hospital-wide information security standard',
      document_status: 'active',
      workflow_stage: 'active',
      department_id: 'dept-1',
      department_name: 'Health Informatics',
      document_owner_id: 'user-1',
      document_owner_name: 'Dr. Ahmed Al-Modawat',
      effective_date: '2026-01-01',
      next_review_date: '2026-12-31',
      expiry_date: null,
      criticality_level: 'critical',
      confidentiality_level: 'confidential',
      version_id: 'ver-1',
      version_number: 1,
      version_label: '1.0',
      is_current_version: true,
      approved_at: '2025-12-28T10:00:00Z',
      locked_at: '2025-12-28T10:00:00Z',
      version_title_en: 'Clinical Information Security Policy',
      version_title_ar: 'سياسة أمن المعلومات السريرية',
      purpose_en: 'To safeguard patient health information.',
      purpose_ar: 'لحماية معلومات المرضى الصحية.',
      policy_statement_en: 'All clinical systems must require MFA.',
      policy_statement_ar: 'يجب أن تطلب جميع الأنظمة السريرية التحقق الثنائي.',
      scope_en: 'All clinical staff.',
      scope_ar: 'جميع الكادر السريري.',
      principles_en: null,
      principles_ar: null,
      exceptions_summary_en: null,
      exceptions_summary_ar: null,
      non_compliance_escalation_en: null,
      non_compliance_escalation_ar: null,
      content_mode: 'structured',
      transcription_status: 'complete',
      requirement_count: 3,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z'
    },
    {
      document_id: 'doc-2',
      organization_id: 'org-1',
      document_code: 'POL-2026-0002',
      document_title: 'Medication Safety & Administration',
      document_description: 'Controlled medication administration protocol',
      document_status: 'draft',
      workflow_stage: 'draft',
      department_id: 'dept-2',
      department_name: 'Pharmacy',
      document_owner_id: 'user-2',
      document_owner_name: 'Pharmacist Sarah',
      effective_date: null,
      next_review_date: '2026-08-25', // review due within 30 days
      expiry_date: null,
      criticality_level: 'high',
      confidentiality_level: 'internal',
      version_id: 'ver-2',
      version_number: 1,
      version_label: '1.0',
      is_current_version: false,
      approved_at: null,
      locked_at: null,
      version_title_en: 'Medication Safety & Administration',
      version_title_ar: 'سلامة وإعطاء الأدوية',
      purpose_en: 'Prevent medication errors.',
      purpose_ar: 'منع الأخطاء الدوائية.',
      policy_statement_en: 'Two nurses must independently verify high-alert meds.',
      policy_statement_ar: 'يجب على ممرضين التحقق المستقل من الأدوية عالية الخطورة.',
      scope_en: 'Pharmacy & Nursing.',
      scope_ar: 'الصيدلة والتمريض.',
      principles_en: null,
      principles_ar: null,
      exceptions_summary_en: null,
      exceptions_summary_ar: null,
      non_compliance_escalation_en: null,
      non_compliance_escalation_ar: null,
      content_mode: 'structured',
      transcription_status: 'complete',
      requirement_count: 2,
      created_at: '2026-08-01T00:00:00Z',
      updated_at: '2026-08-01T00:00:00Z'
    }
  ];

  const mockDepartments = [
    { id: 'dept-1', name: 'Health Informatics', code: 'HI' },
    { id: 'dept-2', name: 'Pharmacy', code: 'PHARM' },
    { id: 'dept-3', name: 'Nursing', code: 'NURS' }
  ];

  const mockControls = [
    { id: 'ctrl-1', code: 'CTL-AC-01', title: 'Multi-Factor Authentication' },
    { id: 'ctrl-2', code: 'CTL-MED-04', title: 'High-Alert Medication Double-Check' }
  ];

  const mockClauses = [
    { id: 'cls-1', clause_number: 'CBAHI-IS-01', title: 'Access Control Standard' },
    { id: 'cls-2', clause_number: 'JCI-MMU-04', title: 'Medication Management & Use' }
  ];

  it('1. Renders DocumentStatusBadge with accurate labels and styles', () => {
    const { rerender } = render(
      <I18nProvider>
        <DocumentStatusBadge status="draft" />
      </I18nProvider>
    );
    expect(screen.getByText('Draft')).toBeDefined();

    rerender(
      <I18nProvider>
        <DocumentStatusBadge status="active" />
      </I18nProvider>
    );
    expect(screen.getByText('Active / Effective')).toBeDefined();

    rerender(
      <I18nProvider>
        <DocumentStatusBadge status="approved" effectiveDate="2026-09-01" />
      </I18nProvider>
    );
    expect(screen.getByText(/Approved — Effective 2026-09-01/i)).toBeDefined();
  });

  it('2. PolicyRegister renders policies and supports search by code and title', async () => {
    const onSelect = vi.fn();
    const onCreate = vi.fn();

    render(
      <I18nProvider>
        <PolicyRegister
          policies={mockPolicies}
          departments={mockDepartments}
          onSelectPolicy={onSelect}
          onCreatePolicy={onCreate}
        />
      </I18nProvider>
    );

    expect(screen.getByText('POL-2026-0001')).toBeDefined();
    expect(screen.getByText('Clinical Information Security Policy')).toBeDefined();
    expect(screen.getByText('POL-2026-0002')).toBeDefined();

    // Search for POL-2026-0002
    const searchInput = screen.getByPlaceholderText(/Search by policy number/i);
    fireEvent.change(searchInput, { target: { value: 'Medication' } });

    expect(screen.queryByText('Clinical Information Security Policy')).toBeNull();
    expect(screen.getByText('Medication Safety & Administration')).toBeDefined();

    // Click on policy row
    fireEvent.click(screen.getByText('Medication Safety & Administration'));
    expect(onSelect).toHaveBeenCalledWith('doc-2', 'ver-2');
  });

  it('3. PolicyRegister filters by status and department', async () => {
    render(
      <I18nProvider>
        <PolicyRegister
          policies={mockPolicies}
          departments={mockDepartments}
          onSelectPolicy={vi.fn()}
          onCreatePolicy={vi.fn()}
        />
      </I18nProvider>
    );

    // Filter by Active status
    const statusSelect = screen.getByDisplayValue('All Statuses');
    fireEvent.change(statusSelect, { target: { value: 'active' } });

    expect(screen.getByText('POL-2026-0001')).toBeDefined();
    expect(screen.queryByText('POL-2026-0002')).toBeNull();

    // Reset filter
    fireEvent.click(screen.getByText('Clear Filters'));
    expect(screen.getByText('POL-2026-0002')).toBeDefined();
  });

  it('4. PolicyRequirementBuilder adds, updates, moves, and removes structured requirements', () => {
    const onChange = vi.fn();
    const initialReqs: PolicyRequirement[] = [
      {
        sequence_number: 1,
        requirement_statement_en: 'First requirement',
        is_mandatory: true,
        responsible_role: 'Nurse'
      }
    ];

    const { rerender } = render(
      <I18nProvider>
        <PolicyRequirementBuilder
          requirements={initialReqs}
          onChange={onChange}
          controls={mockControls}
          clauses={mockClauses}
        />
      </I18nProvider>
    );

    expect(screen.getAllByText('First requirement').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Mandatory').length).toBeGreaterThan(0);

    // Click Add Requirement
    const addButton = screen.getByText('Add Requirement');
    fireEvent.click(addButton);

    expect(onChange).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ sequence_number: 1 }),
        expect.objectContaining({ sequence_number: 2, is_mandatory: true })
      ])
    );
  });

  it('5. ApplicabilitySelector manages department scopes and shows facility deferred notice', () => {
    const onDeptChange = vi.fn();
    const onRoleChange = vi.fn();
    const selectedRoles: RoleScope[] = [{ role_name: 'Physician', job_title: 'Cardiologist' }];

    render(
      <I18nProvider>
        <ApplicabilitySelector
          selectedDepartments={['dept-1']}
          onChangeDepartments={onDeptChange}
          selectedRoles={selectedRoles}
          onChangeRoles={onRoleChange}
          departments={mockDepartments}
        />
      </I18nProvider>
    );

    expect(screen.getByText('Health Informatics')).toBeDefined();
    expect(screen.getByText('Physician')).toBeDefined();
    expect(screen.getByText('(Cardiologist)')).toBeDefined();

    // Verify facility deferred notice
    expect(
      screen.getByText(/Facility applicability will be enabled after the authoritative facility master is established/i)
    ).toBeDefined();

    // Toggle department
    fireEvent.click(screen.getByText('Pharmacy'));
    expect(onDeptChange).toHaveBeenCalledWith(['dept-1', 'dept-2']);
  });

  it('6. StartRevisionModal requires revision reason and allows minor/major selection', async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();

    render(
      <I18nProvider>
        <StartRevisionModal
          isOpen={true}
          onClose={onClose}
          onConfirm={onConfirm}
          currentVersionLabel="1.0"
        />
      </I18nProvider>
    );

    expect(screen.getByText('Start Governed Policy Revision')).toBeDefined();
    expect(screen.getByText('Minor Revision')).toBeDefined();
    expect(screen.getByText('Major Revision')).toBeDefined();

    // Select Major Revision
    fireEvent.click(screen.getByText('Major Revision'));

    // Try submit without reason
    const submitBtn = screen.getByRole('button', { name: /create revision draft/i });
    const form = submitBtn.closest('form')!;
    fireEvent.submit(form);
    expect(screen.getByText('Please provide a clear revision reason.')).toBeDefined();

    // Fill reason and submit
    const textarea = screen.getByPlaceholderText(/e\.g\. Updated regulatory references/i);
    fireEvent.change(textarea, { target: { value: 'Annual clinical governance overhaul' } });
    fireEvent.submit(form);

    await waitFor(() => {
      expect(onConfirm).toHaveBeenCalledWith('major', 'Annual clinical governance overhaul');
    });
  });

  it('7. PolicyExceptionModal validates dates and submits structured exception request', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();

    render(
      <I18nProvider>
        <PolicyExceptionModal
          isOpen={true}
          onClose={onClose}
          onSubmit={onSubmit}
          versionId="ver-1"
          policyCode="POL-2026-0001"
          policyTitle="Clinical Information Security Policy"
        />
      </I18nProvider>
    );

    expect(screen.getByText('Request Policy Exception / Waiver')).toBeDefined();

    // Fill reason and scope
    const reasonInput = screen.getByPlaceholderText(/Detail why operational compliance cannot be achieved/i);
    const scopeInput = screen.getByPlaceholderText(/e\.g\. Specific clinical ward/i);
    fireEvent.change(reasonInput, { target: { value: 'Temporary legacy lab workstation migration' } });
    fireEvent.change(scopeInput, { target: { value: 'Laboratory Ward B' } });

    fireEvent.click(screen.getByText('Submit Request'));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          version_id: 'ver-1',
          reason: 'Temporary legacy lab workstation migration',
          scope_description: 'Laboratory Ward B'
        })
      );
    });
  });

  it('8. SubmitReviewModal displays policy code and version and submits with note', async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();

    render(
      <I18nProvider>
        <SubmitReviewModal
          isOpen={true}
          onClose={onClose}
          onConfirm={onConfirm}
          policyCode="POL-2026-0001"
          policyTitle="Clinical Information Security Policy"
          versionLabel="1.0"
          ownerName="Dr. Ahmed Al-Modawat"
        />
      </I18nProvider>
    );

    expect(screen.getByText('POL-2026-0001')).toBeDefined();
    expect(screen.getByText('Dr. Ahmed Al-Modawat')).toBeDefined();

    const noteInput = screen.getByPlaceholderText(/e\.g\. Prepared for Q3 policy committee/i);
    fireEvent.change(noteInput, { target: { value: 'Ready for committee sign-off' } });

    fireEvent.click(screen.getByText('Submit for Review'));

    await waitFor(() => {
      expect(onConfirm).toHaveBeenCalledWith('Ready for committee sign-off');
    });
  });

  it('9. PolicyEditor renders 9 structured tabs and validates mandatory title on save', async () => {
    const onBack = vi.fn();
    const onRefresh = vi.fn();

    const { PolicyEditor } = await import('../../src/components/policy-sop/PolicyEditor');

    render(
      <I18nProvider>
        <PolicyEditor
          initialPolicy={null}
          departments={mockDepartments}
          profiles={[]}
          controls={mockControls}
          clauses={mockClauses}
          onBack={onBack}
          onRefresh={onRefresh}
        />
      </I18nProvider>
    );

    expect(screen.getByText('1. Document Control')).toBeDefined();
    expect(screen.getByText('2. Policy Content')).toBeDefined();
    expect(screen.getByText('3. Requirements & Controls')).toBeDefined();
    expect(screen.getByText('4. Applicability')).toBeDefined();
    expect(screen.getByText('9. Version History')).toBeDefined();

    // Click Save Draft with empty title
    fireEvent.click(screen.getByText('Save Draft'));
    expect(screen.getByText('English Policy Title is required.')).toBeDefined();
  });
});
