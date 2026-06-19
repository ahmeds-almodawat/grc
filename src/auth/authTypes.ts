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
  | 'loading'
  | 'authenticated'
  | 'unauthenticated'
  | 'inactive'
  | 'configuration_error'
  | 'profile_missing'
  | 'error';

export interface AuthProfile {
  id: string;
  email: string;
  fullNameEn: string;
  fullNameAr?: string | null;
  organizationId?: string | null;
  divisionId?: string | null;
  departmentId?: string | null;
  unitId?: string | null;
  isActive: boolean;
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
  message?: string;
  isLocalBypass?: boolean;
}
