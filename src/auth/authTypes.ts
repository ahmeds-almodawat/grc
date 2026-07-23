import type { Patch83uCapabilities } from '../lib/userCredentialApi';

export type AuthRole =
  | 'super_admin'
  | 'executive'
  | 'governance_admin'
  | 'division_head'
  | 'department_manager'
  | 'project_owner'
  | 'milestone_owner'
  | 'task_owner'
  | 'auditor'
  | 'compliance_officer'
  | 'viewer'
  | 'employee';

export type AccessScope = 'global' | 'division' | 'department' | 'unit' | 'assigned_only';

export type AuthStatus =
  | 'initializing'
  | 'unauthenticated'
  | 'authenticating'
  | 'authenticated_checking_capabilities'
  | 'authenticated_checking_credential_state'
  | 'authenticated_loading_authorization'
  | 'authenticated_password_change_required'
  | 'authenticated_active'
  | 'authenticated_deployment_incompatible'
  | 'authenticated_reconciliation_required'
  | 'authenticated_access_denied'
  | 'signing_out'
  | 'configuration_error'
  | 'error';

export type AuthUserStatus = 'active' | 'inactive' | 'archived' | 'invited' | 'locked';

export type AuthCredentialState =
  | 'legacy_unmanaged'
  | 'active'
  | 'password_change_required'
  | 'reconciliation_required'
  | 'blocked';

export interface AuthProfile {
  id: string;
  email: string;
  fullNameEn: string;
  fullNameAr?: string | null;
  organizationId?: string | null;
  organizationName?: string | null;
  divisionId?: string | null;
  departmentId?: string | null;
  unitId?: string | null;
  isActive: boolean;
  userStatus?: AuthUserStatus;
}

export interface AuthRoleAssignment {
  role: AuthRole;
  scope: AccessScope;
  organizationId?: string | null;
  divisionId?: string | null;
  departmentId?: string | null;
  unitId?: string | null;
}

export interface AuthUserState {
  status: AuthStatus;
  profile: AuthProfile | null;
  roles: AuthRoleAssignment[];
  primaryRole: AuthRole | null;
  credentialState?: AuthCredentialState;
  credentialVersion?: number;
  message?: string;
  notice?: string;
  deploymentErrorCode?: string;
  compatibilityRetryCount?: number;
  compatibilityRetryAvailableAt?: number;
  patch83uCapabilities?: Patch83uCapabilities;
  isLocalBypass?: boolean;
}
