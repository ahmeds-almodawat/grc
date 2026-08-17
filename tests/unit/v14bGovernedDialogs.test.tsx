import React from 'react';
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../../src/i18n/I18nContext';
import { GovernedDecisionDialog } from '../../src/components/GovernedDecisionDialog';
import { Approvals } from '../../src/pages/Approvals';
import { Risks } from '../../src/pages/Risks';
import { Evidence } from '../../src/pages/Evidence';
import type { ApprovalRow, EvidenceClosureGateStatusRow, EvidenceGapDashboardRow, EvidenceGateWaiverRow, RiskRow } from '../../src/types/domain';

const apiMocks = vi.hoisted(() => ({
  decideApproval: vi.fn(async () => ({})),
  getApprovals: vi.fn(async () => []),
  getEvidenceForItem: vi.fn(async () => []),
  getRisks: vi.fn(async () => []),
  getRiskWorkflowQueue: vi.fn(async () => []),
  getRiskAppetiteBreaches: vi.fn(async () => []),
  getRiskTreatmentQueue: vi.fn(async () => []),
  getRiskKriAlerts: vi.fn(async () => []),
  getExecutiveRiskEscalations: vi.fn(async () => []),
  getRiskClosureBlockers: vi.fn(async () => []),
  getRiskReassessmentHistory: vi.fn(async () => []),
  getRiskWorkflowEvents: vi.fn(async () => []),
  getDepartments: vi.fn(async () => [{ id: 'dept-1', name_en: 'Quality Department' }]),
  getProfiles: vi.fn(async () => [{ id: 'user-1', full_name_en: 'Admin User' }]),
  getOrganizations: vi.fn(async () => [{ id: 'org-1', name_en: 'Al Modawat Hospital' }]),
  updateRiskAssessment: vi.fn(async () => ({})),
  requestRiskAcceptance: vi.fn(async () => ({})),
  approveRiskAcceptance: vi.fn(async () => ({})),
  rejectRiskAcceptance: vi.fn(async () => ({})),
  updateRiskTreatment: vi.fn(async () => ({})),
  completeRiskTreatment: vi.fn(async () => ({})),
  requestRiskClosure: vi.fn(async () => ({})),
  approveRiskClosure: vi.fn(async () => ({})),
  reopenRiskWithReason: vi.fn(async () => ({})),
  linkRiskSource: vi.fn(async () => ({})),
  markDuplicateRisk: vi.fn(async () => ({})),
  getEvidenceQueue: vi.fn(async () => []),
  getEvidenceReviewQueue: vi.fn(async () => []),
  getEvidenceGapDashboard: vi.fn(async () => []),
  getEvidenceClosureGateStatus: vi.fn(async () => []),
  getEvidencePackIndex: vi.fn(async () => []),
  getSensitiveEvidenceRegister: vi.fn(async () => []),
  getEvidenceGateWaivers: vi.fn(async () => []),
  getEvidenceChainOfCustody: vi.fn(async () => []),
  requestEvidenceGateWaiver: vi.fn(async () => ({})),
  approveEvidenceGateWaiver: vi.fn(async () => ({})),
  rejectEvidenceGateWaiver: vi.fn(async () => ({})),
  reviewEvidence: vi.fn(async () => ({})),
  rejectEvidence: vi.fn(async () => ({})),
  requestEvidenceRevision: vi.fn(async () => ({})),
  supersedeEvidence: vi.fn(async () => ({})),
  lockEvidence: vi.fn(async () => ({})),
  submitEvidenceForReview: vi.fn(async () => ({})),
  acceptEvidence: vi.fn(async () => ({})),
}));

vi.mock('../../src/lib/grcApi', () => ({
  decideApproval: apiMocks.decideApproval,
  getApprovals: apiMocks.getApprovals,
  getEvidenceForItem: apiMocks.getEvidenceForItem,
  getRisks: apiMocks.getRisks,
  getRiskWorkflowQueue: apiMocks.getRiskWorkflowQueue,
  getRiskAppetiteBreaches: apiMocks.getRiskAppetiteBreaches,
  getRiskTreatmentQueue: apiMocks.getRiskTreatmentQueue,
  getRiskKriAlerts: apiMocks.getRiskKriAlerts,
  getExecutiveRiskEscalations: apiMocks.getExecutiveRiskEscalations,
  getRiskClosureBlockers: apiMocks.getRiskClosureBlockers,
  getRiskReassessmentHistory: apiMocks.getRiskReassessmentHistory,
  getRiskWorkflowEvents: apiMocks.getRiskWorkflowEvents,
  getDepartments: apiMocks.getDepartments,
  getProfiles: apiMocks.getProfiles,
  getOrganizations: apiMocks.getOrganizations,
  updateRiskAssessment: apiMocks.updateRiskAssessment,
  requestRiskAcceptance: apiMocks.requestRiskAcceptance,
  approveRiskAcceptance: apiMocks.approveRiskAcceptance,
  rejectRiskAcceptance: apiMocks.rejectRiskAcceptance,
  updateRiskTreatment: apiMocks.updateRiskTreatment,
  completeRiskTreatment: apiMocks.completeRiskTreatment,
  requestRiskClosure: apiMocks.requestRiskClosure,
  approveRiskClosure: apiMocks.approveRiskClosure,
  reopenRiskWithReason: apiMocks.reopenRiskWithReason,
  linkRiskSource: apiMocks.linkRiskSource,
  markDuplicateRisk: apiMocks.markDuplicateRisk,
  getEvidenceQueue: apiMocks.getEvidenceQueue,
  getEvidenceReviewQueue: apiMocks.getEvidenceReviewQueue,
  getEvidenceGapDashboard: apiMocks.getEvidenceGapDashboard,
  getEvidenceClosureGateStatus: apiMocks.getEvidenceClosureGateStatus,
  getEvidencePackIndex: apiMocks.getEvidencePackIndex,
  getSensitiveEvidenceRegister: apiMocks.getSensitiveEvidenceRegister,
  getEvidenceGateWaivers: apiMocks.getEvidenceGateWaivers,
  getEvidenceChainOfCustody: apiMocks.getEvidenceChainOfCustody,
  requestEvidenceGateWaiver: apiMocks.requestEvidenceGateWaiver,
  approveEvidenceGateWaiver: apiMocks.approveEvidenceGateWaiver,
  rejectEvidenceGateWaiver: apiMocks.rejectEvidenceGateWaiver,
  reviewEvidence: apiMocks.reviewEvidence,
  rejectEvidence: apiMocks.rejectEvidence,
  requestEvidenceRevision: apiMocks.requestEvidenceRevision,
  supersedeEvidence: apiMocks.supersedeEvidence,
  lockEvidence: apiMocks.lockEvidence,
  submitEvidenceForReview: apiMocks.submitEvidenceForReview,
  acceptEvidence: apiMocks.acceptEvidence,
}));

vi.mock('../../src/auth/AuthProvider', () => ({
  useAuth: () => ({
    session: { user: { id: 'user-1' } },
    profile: { id: 'user-1', full_name_en: 'Admin User' },
    roles: [{ role: 'super_admin', scope: 'global' }],
  }),
}));

vi.mock('../../src/components/ScenarioFillButton', () => ({
  ScenarioFillButton: () => null,
}));

const renderWithProviders = (ui: React.ReactElement) => {
  return render(<I18nProvider>{ui}</I18nProvider>);
};

describe('GRC v1.4-B Governed Workflow Dialogs & Waiver Remediation', () => {
  let promptSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();
    promptSpy = vi.spyOn(window, 'prompt').mockImplementation(() => {
      throw new Error('window.prompt() must NOT be called in governed workflows!');
    });
  });

  afterEach(() => {
    cleanup();
    promptSpy.mockRestore();
  });

  describe('1. GovernedDecisionDialog Core Component', () => {
    it('renders title, context items, and fields correctly', () => {
      const handleClose = vi.fn();
      const handleSubmit = vi.fn();

      renderWithProviders(
        <GovernedDecisionDialog
          open={true}
          title="Sample Governed Decision"
          subtitle="Governed validation subtitle"
          contextItems={[
            { label: 'Risk Code', value: 'RSK-2026-001' },
            { label: 'Owner', value: 'Dr. Sarah' },
          ]}
          fields={[
            { id: 'reason', label: 'Decision Reason', type: 'textarea', required: true },
            { id: 'impact', label: 'Impact Score', type: 'number', min: 1, max: 5, defaultValue: 3 },
          ]}
          onClose={handleClose}
          onSubmit={handleSubmit}
        />
      );

      expect(screen.getByText('Sample Governed Decision')).toBeInTheDocument();
      expect(screen.getByText('Governed validation subtitle')).toBeInTheDocument();
      expect(screen.getByText('Risk Code')).toBeInTheDocument();
      expect(screen.getByText('RSK-2026-001')).toBeInTheDocument();
      expect(screen.getByLabelText(/Decision Reason/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Impact Score/i)).toHaveValue(3);
    });

    it('enforces required field validation before dispatching onSubmit', async () => {
      const handleSubmit = vi.fn();

      renderWithProviders(
        <GovernedDecisionDialog
          open={true}
          title="Validation Check"
          fields={[
            { id: 'mandatoryNote', label: 'Mandatory Note', type: 'textarea', required: true },
          ]}
          onClose={vi.fn()}
          onSubmit={handleSubmit}
        />
      );

      const submitButton = screen.getByRole('button', { name: /Confirm decision/i });
      fireEvent.click(submitButton);

      expect(handleSubmit).not.toHaveBeenCalled();
      expect(screen.getByText(/Mandatory Note: This field is required/i)).toBeInTheDocument();
    });

    it('handles successful submit and calls onClose', async () => {
      const handleClose = vi.fn();
      const handleSubmit = vi.fn(async () => {});

      renderWithProviders(
        <GovernedDecisionDialog
          open={true}
          title="Submit Check"
          fields={[
            { id: 'note', label: 'Note', type: 'text', defaultValue: 'Default Text' },
          ]}
          onClose={handleClose}
          onSubmit={handleSubmit}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /Confirm decision/i }));

      await waitFor(() => {
        expect(handleSubmit).toHaveBeenCalledWith({ note: 'Default Text' });
        expect(handleClose).toHaveBeenCalled();
      });
    });

    it('displays error notice and preserves state when onSubmit throws', async () => {
      const handleClose = vi.fn();
      const handleSubmit = vi.fn(async () => {
        throw new Error('Database governance constraint violation');
      });

      renderWithProviders(
        <GovernedDecisionDialog
          open={true}
          title="Error Check"
          fields={[
            { id: 'note', label: 'Note', type: 'text', defaultValue: 'Retryable note' },
          ]}
          onClose={handleClose}
          onSubmit={handleSubmit}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /Confirm decision/i }));

      await waitFor(() => {
        expect(screen.getByText('Database governance constraint violation')).toBeInTheDocument();
        expect(handleClose).not.toHaveBeenCalled();
      });
    });
  });

  describe('2. Governed Approvals Decision Dialogs (Approvals.tsx)', () => {
    const mockApprovalRow: ApprovalRow = {
      id: 'appr-101',
      organization_id: 'org-1',
      item_type: 'project',
      item_id: 'proj-1',
      item_title: 'MOH Hospital Safety Upgrade',
      requested_by: 'user-2',
      requested_by_name: 'Eng. Ahmed',
      approver_id: 'user-1',
      approver_name: 'Admin User',
      requested_at: '2026-08-10T10:00:00Z',
      decided_at: null,
      status: 'pending',
      note: null,
    };

    it('opens approve dialog without calling window.prompt and submits approval', async () => {
      apiMocks.getApprovals.mockResolvedValueOnce([mockApprovalRow]);

      renderWithProviders(<Approvals />);

      await waitFor(() => {
        expect(screen.getByText('MOH Hospital Safety Upgrade')).toBeInTheDocument();
      });

      const approveBtn = screen.getByRole('button', { name: /^Approve$/i });
      fireEvent.click(approveBtn);

      // Verify modal opened
      expect(screen.getByText('Approve Governed Request')).toBeInTheDocument();
      expect(screen.getAllByText('MOH Hospital Safety Upgrade').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Eng. Ahmed').length).toBeGreaterThan(0);
      expect(promptSpy).not.toHaveBeenCalled();

      // Submit approval with default note
      const confirmApproveBtn = screen.getAllByRole('button', { name: /^Approve$/i }).find(b => b.classList.contains('primary-button'));
      expect(confirmApproveBtn).toBeDefined();
      fireEvent.click(confirmApproveBtn!);

      await waitFor(() => {
        expect(apiMocks.decideApproval).toHaveBeenCalledWith(
          'appr-101',
          'approved',
          'Approved from approval center.'
        );
      });
      expect(promptSpy).not.toHaveBeenCalled();
    });

    it('opens reject dialog, requires mandatory rejection reason, and submits rejection', async () => {
      apiMocks.getApprovals.mockResolvedValueOnce([mockApprovalRow]);

      renderWithProviders(<Approvals />);

      await waitFor(() => {
        expect(screen.getByText('MOH Hospital Safety Upgrade')).toBeInTheDocument();
      });

      const rejectBtn = screen.getByRole('button', { name: /^Reject$/i });
      fireEvent.click(rejectBtn);

      // Verify modal opened
      expect(screen.getByText('Reject Governed Request')).toBeInTheDocument();
      expect(promptSpy).not.toHaveBeenCalled();

      const confirmRejectBtn = screen.getAllByRole('button', { name: /^Reject$/i }).find(b => b.classList.contains('primary-button'));
      expect(confirmRejectBtn).toBeDefined();

      // Click submit while reason is empty -> validation triggers
      fireEvent.click(confirmRejectBtn!);
      expect(apiMocks.decideApproval).not.toHaveBeenCalled();
      expect(screen.getByText(/Rejection reason: This field is required/i)).toBeInTheDocument();

      // Enter rejection reason and submit
      const reasonInput = screen.getByLabelText(/Rejection reason \*/i);
      fireEvent.change(reasonInput, { target: { value: 'Evidence insufficient for gate pass' } });
      fireEvent.click(confirmRejectBtn!);

      await waitFor(() => {
        expect(apiMocks.decideApproval).toHaveBeenCalledWith(
          'appr-101',
          'rejected',
          'Evidence insufficient for gate pass'
        );
      });
      expect(promptSpy).not.toHaveBeenCalled();
    });
  });

  describe('3. Governed Risk Decisions (Risks.tsx)', () => {
    const mockRiskRow: RiskRow = {
      id: 'risk-101',
      organization_id: 'org-1',
      risk_code: 'RSK-2026-0001',
      title: 'Medication Storage Temperature Breach',
      category: 'clinical',
      likelihood: 4,
      impact: 4,
      inherent_score: 16,
      residual_likelihood: 3,
      residual_impact: 3,
      residual_score: 9,
      appetite_threshold: 12,
      appetite_breached: false,
      treatment_status: 'in_progress',
      treatment_plan_summary: 'Install secondary backup chiller',
      treatment_due_date: '2026-09-01',
      acceptance_expiry_date: '2026-11-01',
      owner_id: 'user-1',
      owner_name: 'Dr. Sarah',
      department_id: 'dept-1',
      department_name: 'Pharmacy',
      status: 'open',
      created_at: '2026-08-01T00:00:00Z',
    };

    it('opens reassessment dialog, validates inputs, and updates score without prompt', async () => {
      apiMocks.getRisks.mockResolvedValueOnce([mockRiskRow]);

      renderWithProviders(<Risks />);

      await waitFor(() => {
        expect(screen.getByText('Medication Storage Temperature Breach')).toBeInTheDocument();
      });

      // Open detail modal via workflow button
      fireEvent.click(screen.getByRole('button', { name: /Workflow/i }));

      await waitFor(() => {
        expect(screen.getByText('Reassess risk')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Reassess risk'));

      // Verify Governed Decision Dialog opens
      expect(screen.getByText('Reassess Residual Risk Score')).toBeInTheDocument();
      expect(promptSpy).not.toHaveBeenCalled();

      // Enter reason and change scores
      const likelihoodSelect = screen.getByLabelText(/Residual likelihood \(1-5\)/i);
      const impactSelect = screen.getByLabelText(/Residual impact \(1-5\)/i);
      const reasonInput = screen.getByLabelText(/Reason for score change \*/i);

      fireEvent.change(likelihoodSelect, { target: { value: '2' } });
      fireEvent.change(impactSelect, { target: { value: '2' } });
      fireEvent.change(reasonInput, { target: { value: 'Secondary chiller active and validated.' } });

      fireEvent.click(screen.getByRole('button', { name: /Confirm decision/i }));

      await waitFor(() => {
        expect(apiMocks.updateRiskAssessment).toHaveBeenCalledWith({
          risk_id: 'risk-101',
          likelihood: 4,
          impact: 4,
          residual_likelihood: 2,
          residual_impact: 2,
          appetite_threshold: 12,
          change_reason: 'Secondary chiller active and validated.',
        });
      });
      expect(promptSpy).not.toHaveBeenCalled();
    });

    it('opens acceptance request dialog and submits reason and expiry date', async () => {
      apiMocks.getRisks.mockResolvedValueOnce([mockRiskRow]);

      renderWithProviders(<Risks />);

      await waitFor(() => {
        expect(screen.getByText('Medication Storage Temperature Breach')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /Workflow/i }));

      await waitFor(() => {
        expect(screen.getByText('Request acceptance')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Request acceptance'));

      expect(screen.getByText('Request Risk Acceptance')).toBeInTheDocument();
      expect(promptSpy).not.toHaveBeenCalled();

      const reasonInput = screen.getByLabelText(/Acceptance reason \*/i);
      fireEvent.change(reasonInput, { target: { value: 'Accepted pending full HVAC replacement project.' } });

      fireEvent.click(screen.getByRole('button', { name: /Confirm decision/i }));

      await waitFor(() => {
        expect(apiMocks.requestRiskAcceptance).toHaveBeenCalledWith({
          risk_id: 'risk-101',
          reason: 'Accepted pending full HVAC replacement project.',
          acceptance_expiry_date: expect.any(String),
        });
      });
    });

    it('opens link source dialog and submits updated references', async () => {
      apiMocks.getRisks.mockResolvedValueOnce([mockRiskRow]);

      renderWithProviders(<Risks />);

      await waitFor(() => {
        expect(screen.getByText('Medication Storage Temperature Breach')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /Workflow/i }));

      await waitFor(() => {
        expect(screen.getByText('Link source')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Link source'));
      expect(screen.getByText('Link Risk References & Sources')).toBeInTheDocument();
      const ovrInput = screen.getByLabelText(/Source OVR ID/i);
      fireEvent.change(ovrInput, { target: { value: 'OVR-2026-0001' } });
      fireEvent.click(screen.getByRole('button', { name: /Confirm decision/i }));

      await waitFor(() => {
        expect(apiMocks.linkRiskSource).toHaveBeenCalledWith(expect.objectContaining({
          risk_id: 'risk-101',
          source_ovr_id: 'OVR-2026-0001',
        }));
      });
      expect(promptSpy).not.toHaveBeenCalled();
    });

    it('opens mark duplicate dialog and submits target risk ID', async () => {
      apiMocks.getRisks.mockResolvedValueOnce([mockRiskRow]);

      renderWithProviders(<Risks />);

      await waitFor(() => {
        expect(screen.getByText('Medication Storage Temperature Breach')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /Workflow/i }));

      await waitFor(() => {
        expect(screen.getByText('Mark duplicate')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Mark duplicate'));
      expect(screen.getByText('Mark Duplicate or Related Risk')).toBeInTheDocument();
      const dupIdInput = screen.getByLabelText(/Master \/ Related Risk ID \*/i);
      fireEvent.change(dupIdInput, { target: { value: 'risk-master-001' } });
      fireEvent.click(screen.getByRole('button', { name: /Confirm decision/i }));

      await waitFor(() => {
        expect(apiMocks.markDuplicateRisk).toHaveBeenCalledWith(expect.objectContaining({
          risk_id: 'risk-101',
          duplicate_of_risk_id: 'risk-master-001',
        }));
      });
      expect(promptSpy).not.toHaveBeenCalled();
    });

    it('opens closure request dialog and submits reason', async () => {
      apiMocks.getRisks.mockResolvedValueOnce([mockRiskRow]);

      renderWithProviders(<Risks />);

      await waitFor(() => {
        expect(screen.getByText('Medication Storage Temperature Breach')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /Workflow/i }));

      await waitFor(() => {
        expect(screen.getByText('Request closure')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Request closure'));
      expect(screen.getByText('Request Risk Closure')).toBeInTheDocument();
      const closeReasonInput = screen.getByLabelText(/Closure justification/i);
      fireEvent.change(closeReasonInput, { target: { value: 'All treatment controls verified.' } });
      fireEvent.click(screen.getByRole('button', { name: /Confirm decision/i }));

      await waitFor(() => {
        expect(apiMocks.requestRiskClosure).toHaveBeenCalledWith({
          risk_id: 'risk-101',
          reason: 'All treatment controls verified.',
        });
      });
      expect(promptSpy).not.toHaveBeenCalled();
    });

    it('opens reopen dialog and submits reopen reason', async () => {
      apiMocks.getRisks.mockResolvedValueOnce([mockRiskRow]);

      renderWithProviders(<Risks />);

      await waitFor(() => {
        expect(screen.getByText('Medication Storage Temperature Breach')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /Workflow/i }));

      await waitFor(() => {
        expect(screen.getByText('Reopen with reason')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Reopen with reason'));
      expect(screen.getByText('Reopen Risk with Reason')).toBeInTheDocument();
      const reopenReasonInput = screen.getByLabelText(/Reopen reason/i);
      fireEvent.change(reopenReasonInput, { target: { value: 'Recurrence during audit inspection.' } });
      fireEvent.click(screen.getByRole('button', { name: /Confirm decision/i }));

      await waitFor(() => {
        expect(apiMocks.reopenRiskWithReason).toHaveBeenCalledWith({
          risk_id: 'risk-101',
          reason: 'Recurrence during audit inspection.',
        });
      });
      expect(promptSpy).not.toHaveBeenCalled();
    });
  });

  describe('4. Evidence Waiver Decisions (Evidence.tsx)', () => {
    const mockGapRow: EvidenceGapDashboardRow = {
      requirement_id: 'req-101',
      requirement_title: 'Fire Safety Certificate',
      linked_item_type: 'project',
      linked_item_id: 'proj-001-guid',
      required_for_gate: 'closure',
      accepted_evidence_count: 0,
      minimum_accepted_files: 1,
      gate_status: 'blocked',
      gap_reason: 'missing_evidence',
    };

    const mockGateRow: EvidenceClosureGateStatusRow = {
      requirement_id: 'req-101',
      requirement_title: 'Fire Safety Certificate',
      linked_item_type: 'project',
      linked_item_id: 'proj-001-guid',
      required_for_gate: 'closure',
      accepted_evidence_count: 0,
      minimum_accepted_files: 1,
      waiver_active: false,
      can_close: false,
      gate_status: 'blocked',
    };

    const mockWaiverRow: EvidenceGateWaiverRow = {
      id: 'waiver-guid-555',
      organization_id: 'org-1',
      requirement_id: 'req-101',
      linked_item_type: 'project',
      linked_item_id: 'proj-001-guid',
      waiver_reason: 'Awaiting civil defense inspection report',
      requested_by: 'user-2',
      requested_at: '2026-08-11T12:00:00Z',
      approved_by: null,
      approved_at: null,
      status: 'requested',
      expiry_date: '2026-11-11',
      audit_note: null,
    };

    it('submits waiver request with reason and expiry date', async () => {
      apiMocks.getEvidenceGapDashboard.mockResolvedValueOnce([mockGapRow]);
      apiMocks.getEvidenceClosureGateStatus.mockResolvedValueOnce([mockGateRow]);
      apiMocks.getEvidenceGateWaivers.mockResolvedValueOnce([]);

      renderWithProviders(<Evidence />);

      await waitFor(() => {
        expect(screen.getAllByText('Fire Safety Certificate').length).toBeGreaterThan(0);
      });

      // Click "Request" in gap table
      const requestBtn = screen.getByRole('button', { name: /Request/i });
      fireEvent.click(requestBtn);

      expect(screen.getByText('Request evidence waiver')).toBeInTheDocument();
      const reasonInput = screen.getByLabelText(/Waiver reason \*/i);
      fireEvent.change(reasonInput, { target: { value: 'Civil defense audit postponed to next month' } });

      fireEvent.click(screen.getByRole('button', { name: /Confirm action/i }));

      await waitFor(() => {
        expect(apiMocks.requestEvidenceGateWaiver).toHaveBeenCalledWith({
          requirement_id: 'req-101',
          linked_item_type: 'project',
          linked_item_id: 'proj-001-guid',
          waiver_reason: 'Civil defense audit postponed to next month',
          expiry_date: expect.any(String),
          audit_note: 'Civil defense audit postponed to next month',
        });
      });
    });

    it('binds active waiver and approves waiver on closure gate row', async () => {
      apiMocks.getEvidenceGapDashboard.mockResolvedValueOnce([]);
      apiMocks.getEvidenceClosureGateStatus.mockResolvedValueOnce([mockGateRow]);
      apiMocks.getEvidenceGateWaivers.mockResolvedValueOnce([mockWaiverRow]);

      renderWithProviders(<Evidence />);

      await waitFor(() => {
        expect(screen.getAllByText('Fire Safety Certificate').length).toBeGreaterThan(0);
      });

      const approveWaiverBtn = screen.getByTitle('Approve waiver by ID');
      fireEvent.click(approveWaiverBtn);

      // Verify modal opened with context and pre-bound waiver
      expect(screen.getByText('Approve evidence waiver')).toBeInTheDocument();
      expect(screen.getByText('Awaiting civil defense inspection report')).toBeInTheDocument();

      const confirmApproveBtn = screen.getAllByRole('button', { name: /Approve/i }).find(b => b.classList.contains('primary-button'));
      expect(confirmApproveBtn).toBeDefined();
      fireEvent.click(confirmApproveBtn!);

      await waitFor(() => {
        expect(apiMocks.approveEvidenceGateWaiver).toHaveBeenCalledWith({
          waiver_id: 'waiver-guid-555',
          audit_note: 'Waiver approved by governance lead',
        });
      });
    });

    it('binds active waiver and rejects waiver with required rejection reason', async () => {
      apiMocks.getEvidenceGapDashboard.mockResolvedValueOnce([]);
      apiMocks.getEvidenceClosureGateStatus.mockResolvedValueOnce([mockGateRow]);
      apiMocks.getEvidenceGateWaivers.mockResolvedValueOnce([mockWaiverRow]);

      renderWithProviders(<Evidence />);

      await waitFor(() => {
        expect(screen.getAllByText('Fire Safety Certificate').length).toBeGreaterThan(0);
      });

      const rejectWaiverBtn = screen.getByTitle('Reject waiver by ID');
      fireEvent.click(rejectWaiverBtn);

      expect(screen.getByText('Reject evidence waiver')).toBeInTheDocument();
      expect(screen.getByText('Awaiting civil defense inspection report')).toBeInTheDocument();

      const confirmRejectBtn = screen.getAllByRole('button', { name: /Reject/i }).find(b => b.classList.contains('primary-button'));
      expect(confirmRejectBtn).toBeDefined();

      // Submit while reason is empty -> validation fails
      fireEvent.click(confirmRejectBtn!);
      expect(apiMocks.rejectEvidenceGateWaiver).not.toHaveBeenCalled();

      // Enter rejection note
      const reasonInput = screen.getByLabelText(/Rejection reason \*/i);
      fireEvent.change(reasonInput, { target: { value: 'Statutory life safety certificate cannot be waived.' } });
      fireEvent.click(confirmRejectBtn!);

      await waitFor(() => {
        expect(apiMocks.rejectEvidenceGateWaiver).toHaveBeenCalledWith({
          waiver_id: 'waiver-guid-555',
          audit_note: 'Statutory life safety certificate cannot be waived.',
        });
      });
    });

    it('fails closed with warning notice and disabled submit when multiple requested waivers exist for a requirement', async () => {
      const duplicateWaiverRow: EvidenceGateWaiverRow = {
        ...mockWaiverRow,
        id: 'waiver-guid-999',
        requested_at: '2026-08-11T13:00:00Z',
        waiver_reason: 'Second conflicting requested waiver',
      };

      apiMocks.getEvidenceGapDashboard.mockResolvedValueOnce([]);
      apiMocks.getEvidenceClosureGateStatus.mockResolvedValueOnce([mockGateRow]);
      apiMocks.getEvidenceGateWaivers.mockResolvedValueOnce([mockWaiverRow, duplicateWaiverRow]);

      renderWithProviders(<Evidence />);

      await waitFor(() => {
        expect(screen.getAllByText('Fire Safety Certificate').length).toBeGreaterThan(0);
      });

      const approveWaiverBtn = screen.getByTitle('Approve waiver by ID');
      fireEvent.click(approveWaiverBtn);

      // Verify modal opened with ambiguity warning banner
      expect(screen.getByText('Approve evidence waiver')).toBeInTheDocument();
      expect(screen.getByText(/Multiple pending waiver requests detected for this requirement/i)).toBeInTheDocument();

      // Submit button should be disabled
      const confirmApproveBtn = screen.getAllByRole('button', { name: /Approve/i }).find(b => b.classList.contains('primary-button'));
      expect(confirmApproveBtn).toBeDefined();
      expect(confirmApproveBtn).toBeDisabled();
      expect(apiMocks.approveEvidenceGateWaiver).not.toHaveBeenCalled();
    });

    it('allows manual waiver ID input when 0 pending requested waivers exist', async () => {
      apiMocks.getEvidenceGapDashboard.mockResolvedValueOnce([]);
      apiMocks.getEvidenceClosureGateStatus.mockResolvedValueOnce([mockGateRow]);
      apiMocks.getEvidenceGateWaivers.mockResolvedValueOnce([]);

      renderWithProviders(<Evidence />);

      await waitFor(() => {
        expect(screen.getAllByText('Fire Safety Certificate').length).toBeGreaterThan(0);
      });

      const approveWaiverBtn = screen.getByTitle('Approve waiver by ID');
      fireEvent.click(approveWaiverBtn);

      expect(screen.getByText('Approve evidence waiver')).toBeInTheDocument();
      // Manual waiver ID field should be rendered
      const waiverIdInput = screen.getByLabelText(/Waiver ID \*/i);
      expect(waiverIdInput).toBeInTheDocument();

      fireEvent.change(waiverIdInput, { target: { value: 'custom-waiver-uuid-123' } });

      const confirmApproveBtn = screen.getAllByRole('button', { name: /Approve/i }).find(b => b.classList.contains('primary-button'));
      fireEvent.click(confirmApproveBtn!);

      await waitFor(() => {
        expect(apiMocks.approveEvidenceGateWaiver).toHaveBeenCalledWith({
          waiver_id: 'custom-waiver-uuid-123',
          audit_note: 'Waiver approved by governance lead',
        });
      });
    });

    it('maps PATCH23_EVIDENCE_WAIVER_ALREADY_REQUESTED error to bilingual message when requesting a duplicate waiver', async () => {
      apiMocks.getEvidenceGapDashboard.mockResolvedValueOnce([mockGapRow]);
      apiMocks.getEvidenceClosureGateStatus.mockResolvedValueOnce([mockGateRow]);
      apiMocks.getEvidenceGateWaivers.mockResolvedValueOnce([]);
      apiMocks.requestEvidenceGateWaiver.mockRejectedValueOnce(
        new Error('Database error: PATCH23_EVIDENCE_WAIVER_ALREADY_REQUESTED')
      );

      renderWithProviders(<Evidence />);

      await waitFor(() => {
        expect(screen.getAllByText('Fire Safety Certificate').length).toBeGreaterThan(0);
      });

      const requestBtn = screen.getByRole('button', { name: /Request/i });
      fireEvent.click(requestBtn);

      const reasonInput = screen.getByLabelText(/Waiver reason \*/i);
      fireEvent.change(reasonInput, { target: { value: 'Already requested waiver test' } });

      fireEvent.click(screen.getByRole('button', { name: /Confirm action/i }));

      await waitFor(() => {
        expect(screen.getByText(/A waiver request is already pending for this evidence requirement/i)).toBeInTheDocument();
      });
    });
  });
});
