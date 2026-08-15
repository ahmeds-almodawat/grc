import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { canControlProjectByRelationship, ProjectDetail } from '../../src/components/ProjectDetail';
import type { ProjectRow } from '../../src/types/domain';

type MockAuthState = {
  profile: {
    organizationName: string;
    fullNameEn: string;
    fullNameAr: string;
    email: string;
  };
  roles: Array<{ role: string; scope: string; organizationId?: string | null; divisionId?: string | null }>;
  primaryRole: string;
  isLocalBypass: boolean;
  signOut: ReturnType<typeof vi.fn>;
};

const authState = vi.hoisted<MockAuthState>(() => ({
  profile: {
    organizationName: 'Synthetic Organization',
    fullNameEn: 'Synthetic User',
    fullNameAr: 'مستخدم تجريبي',
    email: 'synthetic@example.invalid',
  },
  roles: [],
  primaryRole: 'employee',
  isLocalBypass: false,
  signOut: vi.fn(),
}));

const i18nState = vi.hoisted(() => ({
  language: 'en' as 'en' | 'ar',
  direction: 'ltr' as 'ltr' | 'rtl',
}));
const translationByKey: Record<string, string> = {
  'assignment.pending': 'Pending acceptance',
  'assignment.accepted': 'Accepted',
};

const asyncFixture = vi.hoisted(() => ({
  milestones: [
    {
      id: 'm1',
      organization_id: 'org1',
      project_id: 'p1',
      title: 'M1',
      description: null,
      owner_id: 'owner-m1',
      start_date: null,
      due_date: null,
      status: 'not_started',
      progress_percent: 10,
      evidence_required: true,
      delay_reason: null,
      owner: {
        full_name_en: 'Milestone Owner',
        full_name_ar: null,
      },
    },
  ],
  tasks: [
    {
      id: 't1',
      organization_id: 'org1',
      project_id: 'p1',
      milestone_id: null,
      title: 'T1',
      description: null,
      owner_id: 'owner-t1',
      assigned_to: null,
      start_date: null,
      due_date: null,
      status: 'not_started',
      progress_percent: 0,
      evidence_required: true,
      delay_reason: null,
      owner: {
        full_name_en: 'Task Owner',
        full_name_ar: null,
      },
      assignee: {
        full_name_en: 'Task Assignee',
        full_name_ar: null,
      },
    },
  ],
  assignments: [],
}));
const evidenceRows: unknown[] = [];

let asyncDataCall = 0;

let currentAssignments: {
  item_type: 'project' | 'milestone' | 'task';
  item_id: string;
  assignment_id: string;
  assignee_id: string;
  assignee_name: string;
  assignment_status: 'pending' | 'accepted';
  assigned_at: string;
  responded_at: string | null;
  decline_reason: string | null;
  assigned_by_name: string;
}[] = [];

vi.mock('../../src/auth/AuthProvider', () => ({ useAuth: () => ({ ...authState, session: { user: { id: 'p3' } } }) }));
vi.mock('../../src/i18n/I18nContext', () => ({
  useI18n: () => ({
    ...i18nState,
    toggleLanguage: vi.fn(),
    t: (key: string, fallback?: string) => translationByKey[key] ?? (fallback ?? key),
  }),
}));
vi.mock('../../src/theme/ThemeContext', () => ({
  useTheme: () => ({ preference: 'light', setPreference: vi.fn() }),
}));
vi.mock('../../src/hooks/useAsyncData', () => ({
  useAsyncData: vi.fn(() => {
    const callIndex = asyncDataCall;
    asyncDataCall += 1;

    if (callIndex === 0) return { data: asyncFixture.milestones, loading: false, error: null, refresh: vi.fn() };
    if (callIndex === 1) return { data: asyncFixture.tasks, loading: false, error: null, refresh: vi.fn() };
    if (callIndex === 2) return { data: currentAssignments, loading: false, error: null, refresh: vi.fn() };
    return { data: evidenceRows, loading: false, error: null, refresh: vi.fn() };
  }),
}));
vi.mock('../../src/components/WorkItemControls', () => ({
  WorkControlButtons: () => <button type="button">Project controls</button>,
  StatusUpdateForm: () => <div>Project status update</div>,
  EvidenceUploadForm: () => <div>Project evidence upload</div>,
  ApprovalRequestForm: () => <div>Project approval form</div>,
  AssignmentManagementForm: () => <div>Project assignment manager</div>,
}));
vi.mock('../../src/components/GrcForms', () => ({
  MilestoneForm: () => <div>Milestone form</div>,
  TaskForm: () => <div>Task form</div>,
}));
vi.mock('../../src/components/Modal', () => ({
  Modal: ({ open, children }: { open: boolean; children: React.ReactNode }) => (
    <div style={{ display: open ? 'block' : 'none' }}>{children}</div>
  ),
}));
vi.mock('../../src/components/GovernedEvidenceAccess', () => ({
  GovernedEvidenceAccess: () => <div>Evidence file</div>,
}));
vi.mock('../../src/lib/grcApi', () => {
  return {
    getProjectMilestones: vi.fn(async () => asyncFixture.milestones),
    getProjectTasks: vi.fn(async () => asyncFixture.tasks),
    getProjectWorkAssignments: vi.fn(async () => currentAssignments),
    getEvidenceForItem: vi.fn(async () => evidenceRows),
  };
});

const root = resolve(import.meta.dirname, '../..');
const readSource = (path: string) => readFileSync(resolve(root, path), 'utf8');
const renderProjectDetail = (project: ProjectRow) => render(<ProjectDetail project={project} />);
const getMiniCard = (labelText: string) => {
  const matches = screen.getAllByText(labelText).filter((node) => node.closest('.mini-card') !== null);
  expect(matches.length).toBe(1);
  return matches[0]?.closest('.mini-card');
};

describe('F4 H5 project owner display guardrails', () => {
  beforeEach(() => {
    i18nState.language = 'en';
    i18nState.direction = 'ltr';
    asyncDataCall = 0;
    currentAssignments = [];
    authState.signOut.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  it('shows only Unassigned owner in Owner card when owner_id null, owner null, pending project assignment exists', () => {
    currentAssignments = [{
      item_type: 'project',
      item_id: 'p1',
      assignment_id: 'a1',
      assignee_id: 'p3',
      assignee_name: 'Pending P3',
      assignment_status: 'pending',
      assigned_at: '2026-01-01T00:00:00Z',
      responded_at: null,
      decline_reason: null,
      assigned_by_name: 'Super Admin',
    }];

    const project: ProjectRow = {
      id: 'p1',
      organization_id: 'org1',
      division_id: null,
      department_id: null,
      unit_id: null,
      title: 'Corrective Project',
      description: 'Pending test project',
      category: 'risk_response',
      source_type: 'audit_finding',
      owner_id: null,
      sponsor_id: 'p2',
      created_by: 'p2',
      start_date: '2026-01-01',
      target_end_date: '2026-03-01',
      priority: 'medium',
      risk_level: 'medium',
      status: 'draft',
      progress_percent: 10,
      evidence_required: true,
      closure_approval_required: true,
      delay_reason: null,
      owner: null,
    };

    renderProjectDetail(project);

    const ownerCard = getMiniCard('Owner');
    const assignmentCard = getMiniCard('Assignment');

    expect(ownerCard?.querySelector('strong')?.textContent).toBe('Unassigned');
    expect(assignmentCard?.querySelector('strong')?.textContent).toBe('Pending acceptance');
    expect(screen.queryByText('Manage assignment')).toBeNull();
    expect(screen.queryByText('Add Milestone')).toBeNull();
    expect(screen.queryByText('Add Task')).toBeNull();
    expect(canControlProjectByRelationship('p3', project, currentAssignments[0])).toBe(false);
  });

  it('displays accepted owner name after real accepted owner assignment is persisted', () => {
    currentAssignments = [{
      item_type: 'project',
      item_id: 'p1',
      assignment_id: 'a1',
      assignee_id: 'p3',
      assignee_name: 'P3 Owner',
      assignment_status: 'accepted',
      assigned_at: '2026-01-01T00:00:00Z',
      responded_at: '2026-01-02T00:00:00Z',
      decline_reason: null,
      assigned_by_name: 'Super Admin',
    }];

    const project: ProjectRow = {
      id: 'p1',
      organization_id: 'org1',
      division_id: null,
      department_id: null,
      unit_id: null,
      title: 'Corrective Project',
      description: 'Accepted owner test',
      category: 'risk_response',
      source_type: 'audit_finding',
      owner_id: 'p3',
      sponsor_id: 'p2',
      created_by: 'p2',
      start_date: '2026-01-01',
      target_end_date: '2026-03-01',
      priority: 'medium',
      risk_level: 'medium',
      status: 'draft',
      progress_percent: 10,
      evidence_required: true,
      closure_approval_required: true,
      delay_reason: null,
      owner: {
        full_name_en: 'P3 Owner',
        full_name_ar: null,
      },
    };

    renderProjectDetail(project);

    const ownerCard = getMiniCard('Owner');
    const assignmentCard = getMiniCard('Assignment');

    expect(ownerCard?.querySelector('strong')?.textContent).toBe('P3 Owner');
    expect(assignmentCard?.querySelector('strong')?.textContent).toBe('Accepted');
    expect(screen.getAllByText('Manage assignment')[0]).toBeTruthy();
  });

  it('does not grant project control on a pending assignment', () => {
    currentAssignments = [{
      item_type: 'project',
      item_id: 'p1',
      assignment_id: 'a1',
      assignee_id: 'p3',
      assignee_name: 'Pending P3',
      assignment_status: 'pending',
      assigned_at: '2026-01-01T00:00:00Z',
      responded_at: null,
      decline_reason: null,
      assigned_by_name: 'Super Admin',
    }];

    const project: ProjectRow = {
      id: 'p1',
      organization_id: 'org1',
      division_id: null,
      department_id: null,
      unit_id: null,
      title: 'Control Safety Project',
      description: null,
      category: 'risk_response',
      source_type: 'audit_finding',
      owner_id: null,
      sponsor_id: 'p2',
      created_by: 'p2',
      start_date: '2026-01-01',
      target_end_date: '2026-03-01',
      priority: 'medium',
      risk_level: 'medium',
      status: 'active',
      progress_percent: 25,
      evidence_required: true,
      closure_approval_required: true,
      delay_reason: null,
      owner: null,
    };

    renderProjectDetail(project);

    expect(screen.queryByText('Manage assignment')).toBeNull();
    expect(screen.queryByText('Add Milestone')).toBeNull();
    expect(screen.queryByText('Add Task')).toBeNull();
    expect(canControlProjectByRelationship('p3', project, currentAssignments[0])).toBe(false);
  });

  it('keeps milestone/task rendering on owner and assignee from row owners (unchanged behavior)', () => {
    const source = readSource('src/components/ProjectDetail.tsx');

    expect(source).toContain("personName(row.owner, currentAssignment('milestone', row.id))");
    expect(source).toContain("personName(row.assignee || row.owner, currentAssignment('task', row.id))");

    renderProjectDetail({
      id: 'p1',
      organization_id: 'org1',
      division_id: null,
      department_id: null,
      unit_id: null,
      title: 'Render Stability Project',
      description: null,
      category: 'risk_response',
      source_type: 'audit_finding',
      owner_id: 'p3',
      sponsor_id: 'p2',
      created_by: 'p2',
      start_date: '2026-01-01',
      target_end_date: '2026-03-01',
      priority: 'medium',
      risk_level: 'medium',
      status: 'active',
      progress_percent: 25,
      evidence_required: true,
      closure_approval_required: true,
      delay_reason: null,
      owner: {
        full_name_en: 'Project Owner',
        full_name_ar: null,
      },
    });

    expect(screen.getAllByText('Milestone Owner').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Task Assignee').length).toBeGreaterThan(0);
  });
});
