import type { AuthRole, AuthRoleAssignment, AccessScope } from '../auth/authTypes';
import type { UserManagementUserRow } from './userManagementApi';

export type Ui8AdminView =
  | 'overview'
  | 'users'
  | 'roles'
  | 'organization'
  | 'integrations'
  | 'settings'
  | 'notifications'
  | 'audit'
  | 'data'
  | 'system';

export type Ui8Actionability =
  | 'connected'
  | 'permission_gated'
  | 'disabled_with_reason'
  | 'not_applicable';

export const UI8_RELEASE_BASELINE = '216_ui7_my_work_training_read_contract.sql';

export const UI8_ADMIN_VIEWS: readonly Ui8AdminView[] = [
  'overview',
  'users',
  'roles',
  'organization',
  'integrations',
  'settings',
  'notifications',
  'audit',
  'data',
  'system',
];

export interface Ui8RoleDefinition {
  role: AuthRole;
  allowedScopes: readonly AccessScope[];
  authority: 'system' | 'governance' | 'operational' | 'read_only';
}

export const UI8_ROLE_DEFINITIONS: readonly Ui8RoleDefinition[] = [
  { role: 'super_admin', allowedScopes: ['global'], authority: 'system' },
  { role: 'executive', allowedScopes: ['global'], authority: 'governance' },
  { role: 'governance_admin', allowedScopes: ['global'], authority: 'governance' },
  { role: 'division_head', allowedScopes: ['division'], authority: 'operational' },
  { role: 'department_manager', allowedScopes: ['department'], authority: 'operational' },
  { role: 'project_owner', allowedScopes: ['assigned_only'], authority: 'operational' },
  { role: 'milestone_owner', allowedScopes: ['assigned_only'], authority: 'operational' },
  { role: 'task_owner', allowedScopes: ['assigned_only'], authority: 'operational' },
  { role: 'auditor', allowedScopes: ['global'], authority: 'read_only' },
  { role: 'compliance_officer', allowedScopes: ['global'], authority: 'governance' },
  { role: 'viewer', allowedScopes: ['assigned_only'], authority: 'read_only' },
  { role: 'employee', allowedScopes: ['assigned_only'], authority: 'read_only' },
];

export interface Ui8AdminPermissions {
  canManageUsers: boolean;
  canManageRoles: boolean;
  canManageStructure: boolean;
  canManageCredentials: boolean;
  canOpenSafetyConsole: boolean;
}

export function ui8AdminPermissions(roles: AuthRoleAssignment[]): Ui8AdminPermissions {
  const hasGlobal = (role: AuthRole) => roles.some((assignment) => (
    assignment.role === role && assignment.scope === 'global'
  ));
  const superAdmin = hasGlobal('super_admin');
  const governanceAdmin = hasGlobal('governance_admin');
  return {
    canManageUsers: superAdmin || governanceAdmin,
    canManageRoles: superAdmin || governanceAdmin,
    canManageStructure: superAdmin || governanceAdmin,
    canManageCredentials: superAdmin,
    canOpenSafetyConsole: superAdmin,
  };
}

export function ui8Actionability(
  supported: boolean,
  permitted: boolean,
  applicable = true,
): Ui8Actionability {
  if (!applicable) return 'not_applicable';
  if (!supported) return 'disabled_with_reason';
  return permitted ? 'connected' : 'permission_gated';
}

export function countActiveSuperAdmins(users: UserManagementUserRow[]): number {
  return users.filter((user) => (
    user.is_active
    && user.user_status === 'active'
    && user.roles.some((assignment) => (
      assignment.is_active
      && assignment.role === 'super_admin'
      && assignment.scope === 'global'
    ))
  )).length;
}

export function countActiveRoleAssignments(users: UserManagementUserRow[]): number {
  return users.reduce((total, user) => (
    total + user.roles.filter((assignment) => assignment.is_active).length
  ), 0);
}

export function ui8RoleDefinition(role: AuthRole): Ui8RoleDefinition {
  return UI8_ROLE_DEFINITIONS.find((definition) => definition.role === role)
    ?? { role, allowedScopes: [], authority: 'read_only' };
}

export function isUi8RoleScopeValid(role: AuthRole, scope: AccessScope): boolean {
  return ui8RoleDefinition(role).allowedScopes.includes(scope);
}

export function activeUserRoles(user: UserManagementUserRow) {
  return user.roles.filter((assignment) => assignment.is_active);
}

