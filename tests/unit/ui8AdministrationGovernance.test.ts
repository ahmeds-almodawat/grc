import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { canAccessPageForUser } from '../../src/auth/authAccess';
import type { AuthRoleAssignment } from '../../src/auth/authTypes';
import {
  UI8_ADMIN_VIEWS,
  UI8_ROLE_DEFINITIONS,
  countActiveSuperAdmins,
  isUi8RoleScopeValid,
  ui8Actionability,
  ui8AdminPermissions,
} from '../../src/lib/ui8AdministrationModel';
import type { UserManagementUserRow } from '../../src/lib/userManagementApi';

function assignment(role: AuthRoleAssignment['role'], scope: AuthRoleAssignment['scope']): AuthRoleAssignment {
  return { role, scope, organizationId: 'organization-a' };
}

function userWithRole(role: string, active = true): UserManagementUserRow {
  return {
    user_id: `user-${role}`,
    organization_id: 'organization-a',
    employee_no: '100001',
    full_name_en: 'Review User',
    full_name_ar: null,
    email: 'review@example.test',
    auth_email: '100001@example.test',
    contact_email: null,
    phone: null,
    job_title: null,
    user_type: 'employee',
    user_status: active ? 'active' : 'inactive',
    is_active: active,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: null,
    last_login_at: null,
    last_reviewed_at: null,
    deactivated_at: null,
    deactivated_by: null,
    deactivation_reason: null,
    division_id: null,
    division_name: null,
    department_id: null,
    department_code: null,
    department_name: null,
    department_name_ar: null,
    unit_id: null,
    unit_name: null,
    active_role_count: 1,
    roles: [{
      user_role_id: `role-${role}`,
      role: role as UserManagementUserRow['roles'][number]['role'],
      scope: 'global',
      organization_id: 'organization-a',
      division_id: null,
      department_id: null,
      unit_id: null,
      is_active: true,
      assigned_at: '2026-01-01T00:00:00.000Z',
    }],
    linked_project_count: 0,
    linked_task_count: 0,
    linked_approval_count: 0,
    linked_evidence_count: 0,
    open_project_count: 0,
    open_task_count: 0,
    pending_approval_count: 0,
    managed_identity: true,
    identity_mode: 'employee_id_managed',
    synthetic_auth_email: '100001@example.test',
    credential_state: 'active',
    credential_version: 1,
    must_change_password: false,
    last_password_reset_at: null,
    last_password_changed_at: null,
    provisioning_state: 'completed',
    credential_proof_available: true,
  };
}

describe('UI-8 Administration governance', () => {
  it('maps every locked 15-series view without adding routes or aliases', () => {
    expect(UI8_ADMIN_VIEWS).toEqual([
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
    ]);
    const appSource = readFileSync('src/App.tsx', 'utf8');
    expect(appSource).toContain('case "adminHub":');
    expect(appSource).toContain('<AdministrationCenter setPage={setPage} />');
  });

  it('preserves the exact 12-role and scope architecture', () => {
    expect(UI8_ROLE_DEFINITIONS.map((definition) => definition.role)).toEqual([
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
    ]);
    expect(isUi8RoleScopeValid('super_admin', 'global')).toBe(true);
    expect(isUi8RoleScopeValid('super_admin', 'department')).toBe(false);
    expect(isUi8RoleScopeValid('division_head', 'division')).toBe(true);
    expect(isUi8RoleScopeValid('department_manager', 'department')).toBe(true);
    expect(isUi8RoleScopeValid('viewer', 'assigned_only')).toBe(true);
  });

  it('keeps action-level authority narrower than Admin route access', () => {
    const superPermissions = ui8AdminPermissions([assignment('super_admin', 'global')]);
    expect(superPermissions).toEqual({
      canManageUsers: true,
      canManageRoles: true,
      canManageStructure: true,
      canManageCredentials: true,
      canOpenSafetyConsole: true,
    });

    const governancePermissions = ui8AdminPermissions([assignment('governance_admin', 'global')]);
    expect(governancePermissions.canManageUsers).toBe(true);
    expect(governancePermissions.canManageCredentials).toBe(false);
    expect(governancePermissions.canOpenSafetyConsole).toBe(false);
    expect(ui8Actionability(true, false)).toBe('permission_gated');
    expect(ui8Actionability(false, true)).toBe('disabled_with_reason');
    expect(ui8Actionability(true, true, false)).toBe('not_applicable');
  });

  it('denies known Admin routes to viewer and employee roles', () => {
    expect(canAccessPageForUser('adminHub', [assignment('viewer', 'assigned_only')])).toBe(false);
    expect(canAccessPageForUser('adminHub', [assignment('employee', 'assigned_only')])).toBe(false);
    expect(canAccessPageForUser('adminHub', [assignment('governance_admin', 'global')])).toBe(true);
  });

  it('surfaces last-Super-Admin posture without implementing a frontend bypass', () => {
    expect(countActiveSuperAdmins([userWithRole('super_admin')])).toBe(1);
    expect(countActiveSuperAdmins([userWithRole('super_admin', false)])).toBe(0);
    const patch19 = readFileSync('supabase/migrations/080_patch19_professional_user_management_center.sql', 'utf8');
    const patch83u = readFileSync('supabase/migrations/174_patch83u_employee_id_auth_and_credential_governance.sql', 'utf8');
    expect(patch19).toContain('PATCH19_LAST_SUPER_ADMIN_DEACTIVATION_DENIED');
    expect(patch83u).toContain('PATCH83U_LAST_SUPER_ADMIN_ROLE_DEACTIVATION_DENIED');
    expect(patch83u).toContain('PATCH83U_LAST_SUPER_ADMIN_PROFILE_DEACTIVATION_DENIED');
  });

  it('keeps UI-8 reads organization-filtered and introduces no browser privileged DML', () => {
    const apiSource = readFileSync('src/lib/ui8AdministrationApi.ts', 'utf8');
    const pageSource = readFileSync('src/pages/AdministrationCenter.tsx', 'utf8');
    expect(apiSource).toContain(".eq('organization_id', organizationId)");
    expect(apiSource).not.toMatch(/\.(?:insert|update|upsert|delete)\s*\(/);
    expect(pageSource).not.toContain('invokePrivilegedAction');
    expect(pageSource).not.toMatch(/service[_-]?role|VITE_SUPABASE_ANON_KEY|VITE_SUPABASE_SERVICE/i);
    expect(pageSource).toContain('No governed secret-management workflow exists in this release.');
  });

  it('retains explicit confirmation for governed user import and server-side protection contracts', () => {
    const userApi = readFileSync('src/lib/userManagementApi.ts', 'utf8');
    const importValidation = readFileSync('src/utils/userImportValidation.ts', 'utf8');
    expect(userApi).toContain("USER_IMPORT_EXECUTION_CONFIRMATION = 'EXECUTE USER IMPORT'");
    expect(userApi).toContain('execution_confirmation: executionConfirmation');
    expect(importValidation).toContain('cross-organization role anomaly');
  });
});

