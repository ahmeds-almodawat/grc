import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { canAccessPageForUser } from '../../src/auth/authAccess';
import type { AuthRoleAssignment } from '../../src/auth/authTypes';
import { canControlProjectByRelationship } from '../../src/components/ProjectDetail';

const authState = vi.hoisted(() => ({
  profile: {
    email: 'synthetic@example.invalid',
    fullNameEn: 'Synthetic Compliance Reviewer',
    fullNameAr: 'مراجع امتثال تجريبي',
    organizationName: 'Synthetic Organization',
  },
  roles: [{ role: 'compliance_officer', scope: 'global' }] as AuthRoleAssignment[],
  primaryRole: 'compliance_officer' as const,
  isLocalBypass: false,
  signOut: vi.fn(),
}));

const i18nState = vi.hoisted(() => ({
  language: 'en' as 'en' | 'ar',
  direction: 'ltr' as 'ltr' | 'rtl',
}));

vi.mock('../../src/auth/AuthProvider', () => ({ useAuth: () => authState }));
vi.mock('../../src/theme/ThemeContext', () => ({
  useTheme: () => ({ preference: 'light', setPreference: vi.fn() }),
}));
vi.mock('../../src/i18n/I18nContext', () => ({
  useI18n: () => ({
    ...i18nState,
    toggleLanguage: vi.fn(),
    t: (key: string, fallback?: string) => fallback ?? key,
  }),
}));

import { Layout } from '../../src/components/Layout';

const complianceRoles: AuthRoleAssignment[] = [{
  role: 'compliance_officer',
  scope: 'global',
}];

const root = resolve(import.meta.dirname, '../..');
const source = (path: string) => readFileSync(resolve(root, path), 'utf8');

describe('F4 H3 Projects shell access alignment', () => {
  beforeEach(() => {
    i18nState.language = 'en';
    i18nState.direction = 'ltr';
  });

  afterEach(() => cleanup());

  it('allows only the Projects shell for a compliance-officer-only actor', () => {
    expect(canAccessPageForUser('projects', complianceRoles)).toBe(true);
    expect(canAccessPageForUser('dailyOperationsHub', complianceRoles)).toBe(false);
    expect(canAccessPageForUser('operations', complianceRoles)).toBe(false);
    expect(canAccessPageForUser('departments', complianceRoles)).toBe(false);
    expect(canAccessPageForUser('escalations', complianceRoles)).toBe(false);
  });

  it('does not broaden the Work group or add auditor shell access', () => {
    const authAccess = source('src/auth/authAccess.ts');
    const workManagerRoles = authAccess.slice(
      authAccess.indexOf('const WORK_MANAGER_ROLES'),
      authAccess.indexOf('const GRC_ROLES'),
    );

    expect(workManagerRoles).not.toContain('compliance_officer');
    expect(canAccessPageForUser('projects', [{ role: 'auditor', scope: 'global' }])).toBe(false);
  });

  it('preserves Projects-shell access for assignment-oriented roles', () => {
    for (const role of ['employee', 'task_owner', 'project_owner', 'milestone_owner'] as const) {
      expect(canAccessPageForUser('projects', [{ role, scope: 'assigned_only' }])).toBe(true);
    }
  });

  it('shows the allowed Projects child without redirecting through the forbidden Workspace parent', () => {
    const navigateToPage = vi.fn();
    render(<Layout page="home" navigateToPage={navigateToPage}><div>content</div></Layout>);

    const workspace = screen.getByRole('button', { name: /Workspace/ });
    expect(screen.getByRole('button', { name: /Projects/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Operations/ })).toBeNull();

    fireEvent.click(workspace);
    expect(screen.queryByRole('button', { name: /Projects/ })).toBeNull();
    fireEvent.click(workspace);

    expect(screen.getByRole('button', { name: /Projects/ })).toBeTruthy();
    expect(navigateToPage).not.toHaveBeenCalled();
  });

  it('keeps arbitrary project creation hidden from compliance officers', () => {
    const projects = source('src/pages/Projects.tsx');
    const createAuthority = projects.match(/const canCreateProject =[^;]+;/)?.[0] ?? '';

    expect(createAuthority).not.toContain('compliance_officer');
    expect(createAuthority).toContain('governance_admin');
    expect(projects).toContain('action={canCreateProject ?');
    expect(projects).toContain("'New action plan'");
  });

  it('grants an exact compliance creator relationship control without accepting P3', () => {
    const project = { owner_id: null, sponsor_id: 'p4', created_by: 'p2' };
    const pendingP3 = { assignee_id: 'p3', assignment_status: 'pending' as const };

    expect(canControlProjectByRelationship('p2', project, pendingP3)).toBe(true);
    expect(canControlProjectByRelationship('p3', project, pendingP3)).toBe(false);

    const projectDetail = source('src/components/ProjectDetail.tsx');
    expect(projectDetail).toContain('onEvidence={() => setActiveControl');
    expect(projectDetail).toContain("projectAssignment?.assignment_status === 'pending'");
    expect(projectDetail).toContain('canUpdateStatus={!projectAssignmentPending}');
  });

  it('does not grant mutation controls to a non-creator compliance role alone', () => {
    const unrelatedProject = {
      owner_id: null,
      sponsor_id: 'another-sponsor',
      created_by: 'another-creator',
    };

    expect(canControlProjectByRelationship('p2', unrelatedProject)).toBe(false);
  });

  it('preserves accepted-owner and sponsor relationships while rejecting stale ownership', () => {
    const project = { owner_id: 'p3', sponsor_id: 'p4', created_by: 'p2' };

    expect(canControlProjectByRelationship('p3', project, {
      assignee_id: 'p3',
      assignment_status: 'accepted',
    })).toBe(true);
    expect(canControlProjectByRelationship('p3', project, {
      assignee_id: 'p3',
      assignment_status: 'declined',
    })).toBe(false);
    expect(canControlProjectByRelationship('p4', project)).toBe(true);
  });

  it('retains Arabic RTL and the governed Projects child in the 390x844 mobile drawer', () => {
    i18nState.language = 'ar';
    i18nState.direction = 'rtl';
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 844 });

    const { container } = render(
      <Layout page="home" navigateToPage={vi.fn()}><div>content</div></Layout>,
    );
    expect(container.firstElementChild?.getAttribute('dir')).toBe('rtl');

    fireEvent.click(screen.getByRole('button', { name: 'Open navigation' }));
    expect(document.getElementById('primary-navigation-drawer')?.getAttribute('data-mobile-open')).toBe('true');
    expect(screen.getByRole('button', { name: /Projects/ })).toBeTruthy();
  });
});
