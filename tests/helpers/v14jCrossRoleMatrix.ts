import type { AuthRole, AuthRoleAssignment } from '../../src/auth/authTypes';
import type { PageKey } from '../../src/routes/pageLocation';

export const V14J_ROLES = [
  'super_admin',
  'executive',
  'governance_admin',
  'division_head',
  'department_manager',
  'project_owner',
  'milestone_owner',
  'task_owner',
  'auditor',
  'compliance_officer',
  'viewer',
  'employee',
] as const satisfies readonly AuthRole[];

export const V14J_ORGANIZATION_ID = '00000000-0000-4000-8000-000000000083';
export const V14J_DIVISION_ID = '00000000-0000-4000-8000-000000000085';
export const V14J_DEPARTMENT_ID = '00000000-0000-4000-8000-000000000086';

export type V14jRole = (typeof V14J_ROLES)[number];

export const V14J_GOVERNED_ROUTES = [
  { area: 'OVR', page: 'ovr' },
  { area: 'F1 governed work', page: 'projects' },
  { area: 'F2 governance feedback', page: 'governance' },
  { area: 'Policy/SOP', page: 'documents' },
  { area: 'Training', page: 'trainingGovernance' },
  { area: 'Evidence', page: 'evidence' },
  { area: 'Risk', page: 'risks' },
  { area: 'Audit', page: 'audit' },
  { area: 'Approvals', page: 'approvals' },
] as const satisfies ReadonlyArray<{ area: string; page: PageKey }>;

const GLOBAL_ROLES = new Set<AuthRole>([
  'super_admin',
  'executive',
  'governance_admin',
  'auditor',
  'compliance_officer',
]);

export function buildV14jRoleAssignment(role: V14jRole): AuthRoleAssignment {
  if (GLOBAL_ROLES.has(role)) {
    return {
      role,
      scope: 'global',
      organizationId: V14J_ORGANIZATION_ID,
    };
  }
  if (role === 'division_head') {
    return {
      role,
      scope: 'division',
      organizationId: V14J_ORGANIZATION_ID,
      divisionId: V14J_DIVISION_ID,
    };
  }
  if (role === 'department_manager') {
    return {
      role,
      scope: 'department',
      organizationId: V14J_ORGANIZATION_ID,
      divisionId: V14J_DIVISION_ID,
      departmentId: V14J_DEPARTMENT_ID,
    };
  }
  return {
    role,
    scope: 'assigned_only',
    organizationId: V14J_ORGANIZATION_ID,
  };
}

export function v14jRoleDisplayName(role: V14jRole): string {
  if (role === 'super_admin') return 'Patch 83V Admin';
  if (role === 'viewer') return 'Patch 83V Viewer';
  return `Patch 83V ${role.split('_').map((part) => (
    part.charAt(0).toUpperCase() + part.slice(1)
  )).join(' ')}`;
}
