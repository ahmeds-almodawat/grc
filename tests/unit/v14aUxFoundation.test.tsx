import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../../src/i18n/I18nContext';
import { Modal } from '../../src/components/Modal';
import { ActionPlanForm } from '../../src/components/ActionPlanForm';
import { RiskForm, ComplianceForm, MilestoneForm, TaskForm } from '../../src/components/GrcForms';
import { OVR } from '../../src/pages/OVR';
import { Risks } from '../../src/pages/Risks';
import { Compliance } from '../../src/pages/Compliance';
import { Governance } from '../../src/pages/Governance';
import { Audit } from '../../src/pages/Audit';
import { ProjectDetail } from '../../src/components/ProjectDetail';
import type { ProjectRow } from '../../src/types/domain';

const apiMocks = vi.hoisted(() => ({
  createProject: vi.fn(),
  createRisk: vi.fn(),
  createComplianceItem: vi.fn(),
  createMilestone: vi.fn(),
  createTask: vi.fn(),
  createOvrReport: vi.fn(),
  createAuditFinding: vi.fn(),
  createGovernanceDecision: vi.fn(),
  getOvrSummary: vi.fn(async () => ({ total_reports: 1, open_reports: 1, under_quality_review: 0, corrective_actions_required: 0, sentinel_events: 0, near_miss_level_1: 0 })),
  getOvrWorkflowControlSummary: vi.fn(async () => ({ pending_supervisor_review: 0, pending_quality_review: 0, returned_for_clarification: 0, pending_evidence_review: 0, major_open_ovrs: 0, overdue_ovr_workflow_items: 0 })),
  getOvrWorkflowQueue: vi.fn(async () => []),
  getOvrReports: vi.fn(async () => []),
  getOrganizations: vi.fn(async () => [{ id: 'org-1', name_en: 'Al Modawat Hospital' }]),
  getDepartments: vi.fn(async () => [{ id: 'dept-1', name_en: 'Quality Department' }]),
  getProfiles: vi.fn(async () => [{ id: 'user-1', full_name_en: 'Dr. Sarah Smith' }]),
  searchEligibleWorkParticipants: vi.fn(async () => [{ id: 'user-1', full_name_en: 'Dr. Sarah Smith' }]),
  getRisks: vi.fn(async () => []),
  getRiskWorkflowQueue: vi.fn(async () => []),
  getRiskAppetiteBreaches: vi.fn(async () => []),
  getRiskTreatmentQueue: vi.fn(async () => []),
  getRiskKriAlerts: vi.fn(async () => []),
  getRiskExecutiveEscalations: vi.fn(async () => []),
  getRiskClosureBlockers: vi.fn(async () => []),
  getComplianceItems: vi.fn(async () => []),
  getGovernanceDecisions: vi.fn(async () => []),
  getAuditFindings: vi.fn(async () => []),
  getAuditFindingWorkflowQueue: vi.fn(async () => []),
  getOverdueAuditFindings: vi.fn(async () => []),
  getRepeatAuditFindings: vi.fn(async () => []),
  getAuditClosureGateStatus: vi.fn(async () => []),
  getAuditExecutiveEscalations: vi.fn(async () => []),
  getAuditClosurePackIndex: vi.fn(async () => []),
  getAuditFindingValidationEvents: vi.fn(async () => []),
  getProjectMilestones: vi.fn(async () => []),
  getProjectTasks: vi.fn(async () => []),
  getProjectWorkAssignments: vi.fn(async () => []),
  getEvidenceForItem: vi.fn(async () => []),
}));

vi.mock('../../src/lib/grcApi', () => ({
  createProject: apiMocks.createProject,
  createRisk: apiMocks.createRisk,
  createComplianceItem: apiMocks.createComplianceItem,
  createAuditFinding: apiMocks.createAuditFinding,
  createGovernanceDecision: apiMocks.createGovernanceDecision,
  createMilestone: apiMocks.createMilestone,
  createTask: apiMocks.createTask,
  createOvrReport: apiMocks.createOvrReport,
  getOvrSummary: apiMocks.getOvrSummary,
  getOvrWorkflowControlSummary: apiMocks.getOvrWorkflowControlSummary,
  getOvrWorkflowQueue: apiMocks.getOvrWorkflowQueue,
  getOvrReports: apiMocks.getOvrReports,
  getOrganizations: apiMocks.getOrganizations,
  getDepartments: apiMocks.getDepartments,
  getProfiles: apiMocks.getProfiles,
  searchEligibleWorkParticipants: apiMocks.searchEligibleWorkParticipants,
  getRisks: apiMocks.getRisks,
  getRiskWorkflowQueue: apiMocks.getRiskWorkflowQueue,
  getRiskAppetiteBreaches: apiMocks.getRiskAppetiteBreaches,
  getRiskTreatmentQueue: apiMocks.getRiskTreatmentQueue,
  getRiskKriAlerts: apiMocks.getRiskKriAlerts,
  getRiskExecutiveEscalations: apiMocks.getRiskExecutiveEscalations,
  getExecutiveRiskEscalations: apiMocks.getRiskExecutiveEscalations,
  getRiskClosureBlockers: apiMocks.getRiskClosureBlockers,
  getComplianceItems: apiMocks.getComplianceItems,
  getGovernanceDecisions: apiMocks.getGovernanceDecisions,
  getAuditFindings: apiMocks.getAuditFindings,
  getAuditFindingWorkflowQueue: apiMocks.getAuditFindingWorkflowQueue,
  getOverdueAuditFindings: apiMocks.getOverdueAuditFindings,
  getRepeatAuditFindings: apiMocks.getRepeatAuditFindings,
  getAuditClosureGateStatus: apiMocks.getAuditClosureGateStatus,
  getAuditExecutiveEscalations: apiMocks.getAuditExecutiveEscalations,
  getAuditClosurePackIndex: apiMocks.getAuditClosurePackIndex,
  getAuditFindingValidationEvents: apiMocks.getAuditFindingValidationEvents,
  getProjectMilestones: apiMocks.getProjectMilestones,
  getProjectTasks: apiMocks.getProjectTasks,
  getProjectWorkAssignments: apiMocks.getProjectWorkAssignments,
  getEvidenceForItem: apiMocks.getEvidenceForItem,
}));

vi.mock('../../src/auth/AuthProvider', () => ({
  useAuth: () => ({
    session: { user: { id: 'user-1' } },
    profile: { id: 'user-1', full_name_en: 'Admin' },
    roles: [{ role: 'super_admin', scope: 'global' }],
  }),
}));

vi.mock('../../src/components/ScenarioFillButton', () => ({
  ScenarioFillButton: () => null,
}));

vi.mock('../../src/lib/scenarioLab', () => ({
  createScenarioLabScenario: vi.fn(),
  V99_SCENARIO_TAG: 'V99_SCENARIO',
}));

const renderWithProviders = (ui: React.ReactElement) => {
  return render(<I18nProvider>{ui}</I18nProvider>);
};

const mockProject: ProjectRow = {
  id: 'proj-1',
  organization_id: 'org-1',
  title: 'Controlled Accreditation Project',
  description: 'Test Project',
  status: 'planning',
  priority: 'high',
  start_date: '2026-08-01',
  target_end_date: '2026-12-31',
  created_at: '2026-08-01T00:00:00Z',
  created_by: 'user-1',
};

describe('GRC v1.4-A Foundation & Form Safety', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  describe('Modal Safe-Dismiss & Dirty State Protection', () => {
    it('allows clean backdrop dismissal directly when not dirty', () => {
      const handleClose = vi.fn();
      renderWithProviders(
        <Modal title="Clean Modal" open onClose={handleClose}>
          <div>Clean Content</div>
        </Modal>,
      );

      const backdrop = document.querySelector('.modal-backdrop');
      expect(backdrop).toBeTruthy();
      fireEvent.mouseDown(backdrop!);
      fireEvent.click(backdrop!);

      expect(handleClose).toHaveBeenCalledTimes(1);
    });

    it('blocks backdrop dismissal and shows discard confirmation when dirty', () => {
      const handleClose = vi.fn();
      renderWithProviders(
        <Modal title="Dirty Modal" open isDirty onClose={handleClose}>
          <div>Draft Content</div>
        </Modal>,
      );

      const backdrop = document.querySelector('.modal-backdrop');
      fireEvent.mouseDown(backdrop!);
      fireEvent.click(backdrop!);

      expect(handleClose).not.toHaveBeenCalled();
      expect(screen.getByRole('alertdialog')).toBeTruthy();
      expect(screen.getByText(/Discard unsaved changes/i)).toBeTruthy();
    });

    it('returns to editing when Keep Editing is clicked in discard confirmation', () => {
      const handleClose = vi.fn();
      renderWithProviders(
        <Modal title="Dirty Modal" open isDirty onClose={handleClose}>
          <div>Draft Content</div>
        </Modal>,
      );

      const closeBtn = screen.getByRole('button', { name: /Close|إغلاق|common\.close/i });
      fireEvent.click(closeBtn);
      expect(screen.getByRole('alertdialog')).toBeTruthy();

      fireEvent.click(screen.getByRole('button', { name: /Keep editing|متابعة التعديل/i }));
      expect(screen.queryByRole('alertdialog')).toBeNull();
      expect(handleClose).not.toHaveBeenCalled();
    });

    it('discards and closes when Discard Changes is confirmed', () => {
      const handleClose = vi.fn();
      renderWithProviders(
        <Modal title="Dirty Modal" open isDirty onClose={handleClose}>
          <div>Draft Content</div>
        </Modal>,
      );

      const closeBtn = screen.getByRole('button', { name: /Close|إغلاق|common\.close/i });
      fireEvent.click(closeBtn);
      fireEvent.click(screen.getByRole('button', { name: /Discard changes|تجاهل التغييرات/i }));

      expect(handleClose).toHaveBeenCalledTimes(1);
    });

    it('intercepts Escape key when dirty and prompts discard confirmation', () => {
      const handleClose = vi.fn();
      renderWithProviders(
        <Modal title="Escape Guard" open isDirty onClose={handleClose}>
          <div>Draft Content</div>
        </Modal>,
      );

      const card = screen.getByRole('dialog');
      fireEvent.keyDown(card, { key: 'Escape' });

      expect(handleClose).not.toHaveBeenCalled();
      expect(screen.getByRole('alertdialog')).toBeTruthy();

      fireEvent.keyDown(card, { key: 'Escape' });
      expect(screen.queryByRole('alertdialog')).toBeNull();
      expect(handleClose).not.toHaveBeenCalled();
    });

    it('does not dismiss when mouse down starts inside modal card and releases on backdrop (drag distinction)', () => {
      const handleClose = vi.fn();
      renderWithProviders(
        <Modal title="Drag Test" open onClose={handleClose}>
          <div>Drag Content</div>
        </Modal>,
      );

      const card = screen.getByRole('dialog');
      const backdrop = document.querySelector('.modal-backdrop')!;

      fireEvent.mouseDown(card);
      fireEvent.click(backdrop);

      expect(handleClose).not.toHaveBeenCalled();
    });

    it('blocks dismissal completely while isSubmitting is true', () => {
      const handleClose = vi.fn();
      renderWithProviders(
        <Modal title="Submitting Modal" open isSubmitting onClose={handleClose}>
          <div>Saving in progress...</div>
        </Modal>,
      );

      const backdrop = document.querySelector('.modal-backdrop')!;
      fireEvent.mouseDown(backdrop);
      fireEvent.click(backdrop);
      expect(handleClose).not.toHaveBeenCalled();

      const card = screen.getByRole('dialog');
      fireEvent.keyDown(card, { key: 'Escape' });
      expect(handleClose).not.toHaveBeenCalled();

      const closeBtn = screen.getByRole('button', { name: /Close|إغلاق|common\.close/i }) as HTMLButtonElement;
      expect(closeBtn.disabled).toBe(true);
      fireEvent.click(closeBtn);
      expect(handleClose).not.toHaveBeenCalled();
    });
  });

  describe('Double-Submit / Concurrency Locking', () => {
    it('guards ActionPlanForm against rapid double submission', async () => {
      apiMocks.createProject.mockImplementation(() => new Promise(resolve => setTimeout(() => resolve({ id: 'p1' }), 50)));

      renderWithProviders(
        <ActionPlanForm
          organizationId="org-1"
          departments={[{ id: 'dept-1', name_en: 'Quality' }]}
          onCreated={vi.fn()}
          onCancel={vi.fn()}
        />,
      );

      fireEvent.change(screen.getByLabelText(/Action plan title/), { target: { value: 'Governance Project Plan' } });

      const form = screen.getByRole('button', { name: 'Create Draft Action Plan' }).closest('form')!;

      fireEvent.submit(form);
      fireEvent.submit(form);

      await waitFor(() => expect(apiMocks.createProject).toHaveBeenCalledTimes(1));
    });

    it('guards RiskForm against rapid double submission', async () => {
      apiMocks.createRisk.mockImplementation(() => new Promise(resolve => setTimeout(() => resolve({ id: 'r1' }), 50)));

      renderWithProviders(
        <RiskForm
          organizationId="org-1"
          departments={[{ id: 'dept-1', name_en: 'Quality' }]}
          profiles={[{ id: 'user-1', full_name_en: 'Dr. Sarah Smith' }]}
          onCreated={vi.fn()}
          onCancel={vi.fn()}
        />,
      );

      fireEvent.change(screen.getByLabelText(/Risk title/), { target: { value: 'Operational delay risk' } });

      const form = screen.getByRole('button', { name: 'Create Risk' }).closest('form')!;
      fireEvent.submit(form);
      fireEvent.submit(form);

      await waitFor(() => expect(apiMocks.createRisk).toHaveBeenCalledTimes(1));
    });

    it('releases submission lock on error to allow retrying', async () => {
      apiMocks.createRisk.mockRejectedValueOnce(new Error('Network error on first attempt'));

      renderWithProviders(
        <RiskForm
          organizationId="org-1"
          departments={[{ id: 'dept-1', name_en: 'Quality' }]}
          profiles={[{ id: 'user-1', full_name_en: 'Dr. Sarah Smith' }]}
          onCreated={vi.fn()}
          onCancel={vi.fn()}
        />,
      );

      fireEvent.change(screen.getByLabelText(/Risk title/), { target: { value: 'Operational delay risk' } });
      const form = screen.getByRole('button', { name: 'Create Risk' }).closest('form')!;

      fireEvent.submit(form);

      expect(await screen.findByText('Network error on first attempt')).toBeTruthy();

      apiMocks.createRisk.mockResolvedValueOnce({ id: 'r1' });
      fireEvent.submit(form);

      await waitFor(() => expect(apiMocks.createRisk).toHaveBeenCalledTimes(2));
    });
  });

  describe('Form Label & Accessibility Associations', () => {
    it('provides distinct, unique accessible labels for composite search-select fields in ActionPlanForm', () => {
      renderWithProviders(
        <ActionPlanForm
          organizationId="org-1"
          departments={[{ id: 'dept-1', name_en: 'Quality' }]}
          onCreated={vi.fn()}
          onCancel={vi.fn()}
        />,
      );

      const ownerSearch = screen.getByLabelText('Search eligible owner');
      const ownerSelect = screen.getByLabelText('Owner');
      const sponsorSearch = screen.getByLabelText('Search eligible sponsor');
      const sponsorSelect = screen.getByLabelText('Sponsor');

      expect(ownerSearch.tagName).toBe('INPUT');
      expect(ownerSelect.tagName).toBe('SELECT');
      expect(sponsorSearch.tagName).toBe('INPUT');
      expect(sponsorSelect.tagName).toBe('SELECT');

      expect(ownerSearch.id).not.toBe(ownerSelect.id);
      expect(sponsorSearch.id).not.toBe(sponsorSelect.id);
    });

    it('provides distinct accessible labels for TaskForm search and select inputs', () => {
      renderWithProviders(
        <TaskForm
          organizationId="org-1"
          projectId="proj-1"
          onCreated={vi.fn()}
          onCancel={vi.fn()}
        />,
      );

      const searchInput = screen.getByLabelText('Search eligible participant');
      const ownerSelect = screen.getByLabelText('Owner');
      const assignedSelect = screen.getByLabelText('Assigned to');

      expect(searchInput.tagName).toBe('INPUT');
      expect(ownerSelect.tagName).toBe('SELECT');
      expect(assignedSelect.tagName).toBe('SELECT');

      expect(searchInput.id).not.toBe(ownerSelect.id);
      expect(ownerSelect.id).not.toBe(assignedSelect.id);
    });
  });

  describe('Reactive Date-Range Constraints', () => {
    it('rejects target end date before start date in ActionPlanForm', async () => {
      renderWithProviders(
        <ActionPlanForm
          organizationId="org-1"
          departments={[{ id: 'dept-1', name_en: 'Quality' }]}
          onCreated={vi.fn()}
          onCancel={vi.fn()}
        />,
      );

      fireEvent.change(screen.getByLabelText(/Action plan title/), { target: { value: 'Date test project' } });
      fireEvent.change(screen.getByLabelText(/Start date/), { target: { value: '2026-09-15' } });
      fireEvent.change(screen.getByLabelText(/Target end date/), { target: { value: '2026-09-01' } });

      const form = screen.getByRole('button', { name: 'Create Draft Action Plan' }).closest('form')!;
      fireEvent.submit(form);

      expect(await screen.findByText('Target end date cannot precede the project start date.')).toBeTruthy();
      expect(apiMocks.createProject).not.toHaveBeenCalled();
    });

    it('clears target end date when start date is advanced beyond current target end date', () => {
      renderWithProviders(
        <ActionPlanForm
          organizationId="org-1"
          departments={[{ id: 'dept-1', name_en: 'Quality' }]}
          onCreated={vi.fn()}
          onCancel={vi.fn()}
        />,
      );

      const startInput = screen.getByLabelText(/Start date/) as HTMLInputElement;
      const targetInput = screen.getByLabelText(/Target end date/) as HTMLInputElement;

      fireEvent.change(startInput, { target: { value: '2026-09-01' } });
      fireEvent.change(targetInput, { target: { value: '2026-09-10' } });
      expect(targetInput.value).toBe('2026-09-10');

      fireEvent.change(startInput, { target: { value: '2026-09-15' } });
      expect(targetInput.value).toBe('');
    });

    it('rejects expiry date before due date in ComplianceForm', async () => {
      renderWithProviders(
        <ComplianceForm
          organizationId="org-1"
          departments={[{ id: 'dept-1', name_en: 'Quality' }]}
          profiles={[{ id: 'user-1', full_name_en: 'Dr. Sarah Smith' }]}
          onCreated={vi.fn()}
          onCancel={vi.fn()}
        />,
      );

      fireEvent.change(screen.getByLabelText(/Requirement title/), { target: { value: 'Fire Safety License' } });
      fireEvent.change(screen.getByLabelText(/Due date/), { target: { value: '2026-10-01' } });
      fireEvent.change(screen.getByLabelText(/Expiry date/), { target: { value: '2026-09-01' } });

      const form = screen.getByRole('button', { name: 'Create Obligation' }).closest('form')!;
      fireEvent.submit(form);

      expect(await screen.findByText('Expiry date cannot precede due date.')).toBeTruthy();
      expect(apiMocks.createComplianceItem).not.toHaveBeenCalled();
    });
  });

  describe('OVR Create-Form Reset Safety', () => {
    it('resets form draft and pre-occurrence flags completely upon closing and reopening', async () => {
      renderWithProviders(<OVR />);

      const openBtn = await screen.findByRole('button', { name: /New OVR Report|New Report|بلاغ جديد/i });
      fireEvent.click(openBtn);

      const descInput = screen.getByLabelText(/Summary facts|Facts|ملخص/i);
      fireEvent.change(descInput, { target: { value: 'Initial draft incident description' } });

      const flagCheckbox = screen.getByLabelText(/Sedated|تحت التخدير/i);
      fireEvent.click(flagCheckbox);
      expect((flagCheckbox as HTMLInputElement).checked).toBe(true);

      const cancelBtn = screen.getAllByRole('button', { name: /Cancel|إلغاء/i })[0];
      fireEvent.click(cancelBtn);

      const reopenBtn = screen.getByRole('button', { name: /New OVR Report|New Report|بلاغ جديد/i });
      fireEvent.click(reopenBtn);

      const freshDescInput = screen.getByLabelText(/Summary facts|Facts|ملخص/i) as HTMLTextAreaElement;
      const freshFlagCheckbox = screen.getByLabelText(/Sedated|تحت التخدير/i) as HTMLInputElement;

      expect(freshDescInput.value).toBe('');
      expect(freshFlagCheckbox.checked).toBe(false);
    });
  });

  describe('Host-Level Modal Dirty & Submitting Wiring', () => {
    it('propagates dirty state from RiskForm to Modal in Risks page and resets on discard', async () => {
      renderWithProviders(<Risks />);

      const newRiskBtn = await screen.findByRole('button', { name: /New Risk|سجل خطر جديد|risks\.new/i });
      fireEvent.click(newRiskBtn);

      const titleInput = screen.getByLabelText(/Risk title/i);
      fireEvent.change(titleInput, { target: { value: 'Draft Risk Description' } });

      const backdrop = document.querySelector('.modal-backdrop')!;
      fireEvent.mouseDown(backdrop);
      fireEvent.click(backdrop);

      expect(screen.getByRole('alertdialog')).toBeTruthy();
      expect(screen.getByText(/Discard unsaved changes/i)).toBeTruthy();

      fireEvent.click(screen.getByRole('button', { name: /Discard changes|تجاهل التغييرات/i }));
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('propagates dirty state from ComplianceForm to Modal in Compliance page', async () => {
      renderWithProviders(<Compliance />);

      const newBtn = await screen.findByRole('button', { name: /New Obligation|متطلب جديد|compliance\.new/i });
      fireEvent.click(newBtn);

      const titleInput = screen.getByLabelText(/Requirement title/i);
      fireEvent.change(titleInput, { target: { value: 'New License Requirement' } });

      const backdrop = document.querySelector('.modal-backdrop')!;
      fireEvent.mouseDown(backdrop);
      fireEvent.click(backdrop);

      expect(screen.getByRole('alertdialog')).toBeTruthy();
      fireEvent.click(screen.getByRole('button', { name: /Keep editing|متابعة التعديل/i }));
      expect(screen.queryByRole('alertdialog')).toBeNull();
      expect(screen.getByRole('dialog')).toBeTruthy();

      fireEvent.click(screen.getByRole('button', { name: /Close|إغلاق|common\.close/i }));
      fireEvent.click(screen.getByRole('button', { name: /Discard changes|تجاهل التغييرات/i }));
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('propagates dirty state from DecisionForm to Modal in Governance page', async () => {
      renderWithProviders(<Governance />);

      const newBtn = await screen.findByRole('button', { name: /New Decision|قرار جديد/i });
      fireEvent.click(newBtn);

      const titleInput = screen.getByLabelText(/Decision title/i);
      fireEvent.change(titleInput, { target: { value: 'Board Resolution on Policy' } });

      const dialog = screen.getByRole('dialog');
      fireEvent.keyDown(dialog, { key: 'Escape' });

      expect(screen.getByRole('alertdialog')).toBeTruthy();
      fireEvent.click(screen.getByRole('button', { name: /Discard changes|تجاهل التغييرات/i }));
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('propagates dirty state from AuditFindingForm to Modal in Audit page', async () => {
      renderWithProviders(<Audit />);

      const newBtn = await screen.findByRole('button', { name: /New Finding|تسجيل ملاحظة|audit\.newFinding/i });
      fireEvent.click(newBtn);

      const titleInput = screen.getByLabelText(/Finding title/i);
      fireEvent.change(titleInput, { target: { value: 'Audit discrepancy in logs' } });

      const closeBtn = screen.getByRole('button', { name: /Close|إغلاق|common\.close/i });
      fireEvent.click(closeBtn);

      expect(screen.getByRole('alertdialog')).toBeTruthy();
      fireEvent.click(screen.getByRole('button', { name: /Discard changes|تجاهل التغييرات/i }));
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('propagates dirty state from MilestoneForm to Modal in ProjectDetail', async () => {
      renderWithProviders(<ProjectDetail project={mockProject} />);

      const addMilestoneBtn = await screen.findByRole('button', { name: /Add Milestone/i });
      fireEvent.click(addMilestoneBtn);

      const titleInput = screen.getByLabelText(/Milestone title/i);
      fireEvent.change(titleInput, { target: { value: 'Phase 1 Delivery' } });

      const backdrop = document.querySelector('.modal-backdrop')!;
      fireEvent.mouseDown(backdrop);
      fireEvent.click(backdrop);

      expect(screen.getByRole('alertdialog')).toBeTruthy();
      fireEvent.click(screen.getByRole('button', { name: /Discard changes|تجاهل التغييرات/i }));
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('propagates dirty state from TaskForm to Modal in ProjectDetail', async () => {
      renderWithProviders(<ProjectDetail project={mockProject} />);

      const addTaskBtn = await screen.findByRole('button', { name: /Add Task/i });
      fireEvent.click(addTaskBtn);

      const titleInput = screen.getByLabelText(/Task title/i);
      fireEvent.change(titleInput, { target: { value: 'Execute unit test review' } });

      const backdrop = document.querySelector('.modal-backdrop')!;
      fireEvent.mouseDown(backdrop);
      fireEvent.click(backdrop);

      expect(screen.getByRole('alertdialog')).toBeTruthy();
      fireEvent.click(screen.getByRole('button', { name: /Discard changes|تجاهل التغييرات/i }));
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('maintains strict isolation between Milestone and Task modals in ProjectDetail', async () => {
      renderWithProviders(<ProjectDetail project={mockProject} />);

      // Open Milestone modal and make it dirty
      const addMilestoneBtn = await screen.findByRole('button', { name: /Add Milestone/i });
      fireEvent.click(addMilestoneBtn);

      fireEvent.change(screen.getByLabelText(/Milestone title/i), { target: { value: 'Draft Milestone' } });

      // Discard Milestone modal
      const backdrop1 = document.querySelector('.modal-backdrop')!;
      fireEvent.mouseDown(backdrop1);
      fireEvent.click(backdrop1);
      fireEvent.click(screen.getByRole('button', { name: /Discard changes|تجاهل التغييرات/i }));
      expect(screen.queryByRole('dialog')).toBeNull();

      // Open Task modal: must start clean (not dirty)
      const addTaskBtn = screen.getByRole('button', { name: /Add Task/i });
      fireEvent.click(addTaskBtn);

      // Clean task modal should close directly without discard prompt
      const backdrop2 = document.querySelector('.modal-backdrop')!;
      fireEvent.mouseDown(backdrop2);
      fireEvent.click(backdrop2);

      expect(screen.queryByRole('alertdialog')).toBeNull();
      expect(screen.queryByRole('dialog')).toBeNull();
    });
  });
});
