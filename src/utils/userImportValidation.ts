import type { AccessScope, AppRole } from '../types/domain';
import {
  deriveSyntheticAuthEmail,
  userImportAccountActionOptions,
  userImportScopeOptions,
  userRoleOptions,
  userStatusOptions,
  userTypeOptions,
  type ParsedUserImportRow,
  type UserImportAccountAction,
  type UserImportValidationResult,
  type UserStatus,
  type UserType,
} from './userWorkbook';

export type UserImportExistingUser = {
  user_id: string;
  organization_id?: string | null;
  employee_no: string | null;
  full_name_en: string;
  email: string;
  contact_email?: string | null;
  roles?: Array<{
    user_role_id: string;
    role: string;
    scope: string;
    organization_id: string | null;
    division_id?: string | null;
    department_id: string | null;
    unit_id?: string | null;
    is_active: boolean;
  }>;
};

export type UserImportAuthIdentity = {
  auth_user_id: string;
  email: string;
  profile_user_id?: string | null;
  label?: string | null;
};

export type UserImportProfileIdentity = {
  profile_id: string;
  employee_no: string;
  auth_email: string;
  organization_match: boolean;
  employee_id_match: boolean;
  employee_id_case_insensitive_match: boolean;
  auth_email_match: boolean;
  has_cross_org_active_role: boolean;
};

export type UserImportOpenProvisioningIdentity = {
  provisioning_id: string;
  employee_no: string;
  auth_email: string;
  state?: string | null;
};

export type UserImportDepartment = {
  id: string;
  code: string | null;
  name_en: string;
  name_ar: string | null;
  division_id?: string | null;
};

export type UserImportReferenceData = {
  users: UserImportExistingUser[];
  authIdentities?: UserImportAuthIdentity[];
  profileIdentities?: UserImportProfileIdentity[];
  openProvisioningIdentities?: UserImportOpenProvisioningIdentity[];
  actorIsSuperAdmin?: boolean;
  activeDepartments: UserImportDepartment[];
  archivedDepartments: UserImportDepartment[];
};

function addToMap<T>(map: Map<string, T[]>, key: string, value: T) {
  if (!key) return;
  map.set(key, [...(map.get(key) ?? []), value]);
}

function departmentMap(departments: UserImportDepartment[]) {
  const map = new Map<string, UserImportDepartment>();
  departments.forEach((department) => {
    if (department.code) map.set(department.code.trim().toLowerCase(), department);
  });
  return map;
}

export function normalizeSaudiPhone(value: string): string | null {
  const phone = value.trim();
  if (!phone) return null;
  if (/^05\d{8}$/.test(phone)) return `+966${phone.slice(1)}`;
  if (/^9665\d{8}$/.test(phone)) return `+${phone}`;
  if (/^009665\d{8}$/.test(phone)) return `+${phone.slice(2)}`;
  if (/^\+9665\d{8}$/.test(phone)) return phone;
  return null;
}

function isSupportedRole(value: string): value is AppRole {
  return userRoleOptions.includes(value as AppRole);
}

function isSupportedScope(value: string): value is AccessScope {
  return userImportScopeOptions.includes(value as AccessScope);
}

function isSupportedStatus(value: string): value is UserStatus {
  return userStatusOptions.includes(value as UserStatus);
}

function isSupportedUserType(value: string): value is UserType {
  return userTypeOptions.includes(value as UserType);
}

function isSupportedAccountAction(value: string): value is UserImportAccountAction {
  return userImportAccountActionOptions.includes(value as UserImportAccountAction);
}

const controlledImportScopesByRole: Partial<Record<AppRole, AccessScope>> = {
  super_admin: 'global',
  executive: 'global',
  governance_admin: 'global',
  department_manager: 'department',
  project_owner: 'assigned_only',
  milestone_owner: 'assigned_only',
  task_owner: 'assigned_only',
  auditor: 'global',
  compliance_officer: 'global',
  viewer: 'assigned_only',
  employee: 'assigned_only',
};

export function controlledUserImportRoleScopeError(
  role: AppRole,
  scope: AccessScope,
): string | null {
  if (role === 'division_head') {
    return 'division_head is not supported by this import because division scope and a division reference are required.';
  }
  const requiredScope = controlledImportScopesByRole[role];
  if (!requiredScope || scope !== requiredScope) {
    return `${role} requires ${requiredScope ?? 'a supported'} role scope in controlled User Excel Import.`;
  }
  return null;
}

function matchedLabel(user: UserImportExistingUser | null) {
  if (!user) return null;
  return `${user.full_name_en} (${user.email})`;
}

function matchedAuthIdentityLabel(identity: UserImportAuthIdentity | null) {
  if (!identity) return null;
  return identity.label?.trim() || identity.email;
}

function matchedProvisioningLabel(identity: UserImportOpenProvisioningIdentity | null) {
  if (!identity) return null;
  return `${identity.employee_no} (${identity.auth_email})${identity.state ? ` — ${identity.state}` : ''}`;
}

function distinctById<T>(values: T[], getId: (value: T) => string): T[] {
  return [...new Map(values.map((value) => [getId(value), value])).values()];
}

export function validateUserImportRows(
  rows: ParsedUserImportRow[],
  references: UserImportReferenceData,
  parserErrorsByRow: Record<number, string[]> = {},
): UserImportValidationResult {
  const usersByEmployeeId = new Map<string, UserImportExistingUser[]>();
  const usersByAuthEmail = new Map<string, UserImportExistingUser[]>();
  references.users.forEach((user) => {
    addToMap(usersByEmployeeId, user.employee_no?.trim() ?? '', user);
    addToMap(usersByAuthEmail, user.email.trim().toLowerCase(), user);
  });

  const authIdentitiesByEmail = new Map<string, UserImportAuthIdentity[]>();
  (references.authIdentities ?? []).forEach((identity) => {
    addToMap(authIdentitiesByEmail, identity.email.trim().toLowerCase(), identity);
  });

  const profileIdentitiesByEmployeeId = new Map<string, UserImportProfileIdentity[]>();
  const profileIdentitiesByAuthEmail = new Map<string, UserImportProfileIdentity[]>();
  (references.profileIdentities ?? []).forEach((identity) => {
    if (identity.employee_id_case_insensitive_match) {
      addToMap(profileIdentitiesByEmployeeId, identity.employee_no.trim().toLowerCase(), identity);
    }
    if (identity.auth_email_match) {
      addToMap(profileIdentitiesByAuthEmail, identity.auth_email.trim().toLowerCase(), identity);
    }
  });

  const provisioningByEmployeeId = new Map<string, UserImportOpenProvisioningIdentity[]>();
  const provisioningByAuthEmail = new Map<string, UserImportOpenProvisioningIdentity[]>();
  (references.openProvisioningIdentities ?? []).forEach((identity) => {
    addToMap(provisioningByEmployeeId, identity.employee_no.trim(), identity);
    addToMap(provisioningByAuthEmail, identity.auth_email.trim().toLowerCase(), identity);
  });

  const employeeCounts = new Map<string, number>();
  const authAliasCounts = new Map<string, number>();
  const contactEmailCounts = new Map<string, number>();
  rows.forEach((row) => {
    const employeeId = row.employee_no.trim();
    const contactEmail = row.contact_email.trim().toLowerCase();
    if (employeeId) {
      employeeCounts.set(employeeId, (employeeCounts.get(employeeId) ?? 0) + 1);
      const authAlias = employeeId.toLowerCase();
      authAliasCounts.set(authAlias, (authAliasCounts.get(authAlias) ?? 0) + 1);
    }
    if (contactEmail) contactEmailCounts.set(contactEmail, (contactEmailCounts.get(contactEmail) ?? 0) + 1);
  });

  const activeDepartments = departmentMap(references.activeDepartments);
  const archivedDepartments = departmentMap(references.archivedDepartments);
  let duplicateEmployeeIdCount = 0;
  let duplicateContactEmailCount = 0;
  let unknownDepartmentCount = 0;
  let unknownRoleCount = 0;
  let invalidPhoneCount = 0;
  let existingUserUpdateCount = 0;
  let pendingAccountCreationCount = 0;

  const validatedRows = rows.map((sourceRow) => {
    const row: ParsedUserImportRow = {
      ...sourceRow,
      employee_no: sourceRow.employee_no.trim(),
      full_name_en: sourceRow.full_name_en.trim(),
      full_name_ar: sourceRow.full_name_ar.trim(),
      contact_email: sourceRow.contact_email.trim().toLowerCase(),
      synthetic_auth_email: deriveSyntheticAuthEmail(sourceRow.employee_no),
      phone_original: sourceRow.phone_original.trim(),
      department: sourceRow.department.trim(),
      job_title: sourceRow.job_title.trim(),
      role: sourceRow.role.trim(),
      role_scope: sourceRow.role_scope.trim(),
      status: sourceRow.status.trim(),
      user_type: sourceRow.user_type.trim(),
      account_action: sourceRow.account_action.trim(),
    };
    const errors = [...(parserErrorsByRow[row.row_number] ?? [])];
    const warnings: string[] = [];
    const employeeId = row.employee_no;
    const contactEmail = row.contact_email;
    const syntheticAuthEmail = row.synthetic_auth_email;
    const phoneNormalized = normalizeSaudiPhone(row.phone_original);
    const role = isSupportedRole(row.role) ? row.role : null;
    const scope = isSupportedScope(row.role_scope) ? row.role_scope : null;
    const status = isSupportedStatus(row.status) ? row.status : null;
    const userType = isSupportedUserType(row.user_type) ? row.user_type : null;
    const accountAction = isSupportedAccountAction(row.account_action) ? row.account_action : null;
    const departmentKey = row.department.toLowerCase();
    const department = activeDepartments.get(departmentKey) ?? null;
    const archivedDepartment = archivedDepartments.get(departmentKey) ?? null;

    if (!employeeId) errors.push('Employee ID is required.');
    if (!row.full_name_en) errors.push('English name is required.');
    if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
      errors.push('Contact email must be a valid email address when populated.');
    }
    if (!row.department) errors.push('Department code is required.');
    if (!row.job_title) errors.push('Job title is required.');
    if (!row.role) errors.push('Role is required.');
    if (!row.role_scope) errors.push('Role scope is required.');
    if (!row.status) errors.push('Status is required.');
    if (!row.user_type) errors.push('User type is required.');
    if (!row.account_action) errors.push('Account action is required.');

    if (userType === 'employee' && !row.full_name_ar) {
      errors.push('Arabic name is required for employee users.');
    }
    if (employeeId && (employeeCounts.get(employeeId) ?? 0) > 1) {
      errors.push('Duplicate Employee ID in uploaded workbook.');
      duplicateEmployeeIdCount += 1;
    }
    if (contactEmail && (contactEmailCounts.get(contactEmail) ?? 0) > 1) duplicateContactEmailCount += 1;
    if (archivedDepartment) {
      errors.push('Archived department cannot be assigned. Restore it explicitly from Department Management before importing.');
    } else if (row.department && !department) {
      errors.push('Unknown active department code.');
      unknownDepartmentCount += 1;
    }
    if (row.role && !role) {
      errors.push('Unknown role. Use an exact supported app role value.');
      unknownRoleCount += 1;
    }
    if (row.role_scope && !scope) {
      errors.push('Invalid role scope. Use global, department, or assigned_only exactly; division and unit are not supported by this import.');
    }
    if (scope === 'department' && !department) {
      errors.push('Department scope requires a valid active department code.');
    }
    if (role && scope) {
      const roleScopeError = controlledUserImportRoleScopeError(role, scope);
      if (roleScopeError) errors.push(roleScopeError);
    }
    if (
      role
      && ['super_admin', 'executive', 'governance_admin'].includes(role)
      && references.actorIsSuperAdmin !== true
    ) {
      errors.push('Only an organization-aligned global Super Admin may import Super Admin, Executive, or Governance Admin access.');
    }
    if (row.status && !status) errors.push('Invalid status. Use an exact supported status value.');
    if (row.user_type && !userType) errors.push('Invalid user type. Use an exact supported user_type value.');
    if (row.account_action && !accountAction) {
      errors.push('Invalid account action. Use create, update, or create_or_update exactly.');
    }
    if (row.phone_original && !phoneNormalized) {
      errors.push('Invalid Saudi mobile number. Use 0501234567, 966501234567, 00966501234567, or +966501234567.');
    }
    if (
      errors.some((error) => error.toLowerCase().includes('phone'))
      && (row.phone_original || (parserErrorsByRow[row.row_number] ?? []).some((error) => error.toLowerCase().includes('phone')))
    ) {
      invalidPhoneCount += 1;
    }

    if (employeeId && (authAliasCounts.get(employeeId.toLowerCase()) ?? 0) > 1) {
      errors.push('Employee IDs must also be unique case-insensitively because they produce the same authentication email.');
    }
    if (
      employeeId
      && (
        employeeId.length > 64
        || !/^[A-Za-z0-9._-]+$/.test(employeeId)
      )
    ) {
      errors.push('Employee ID may contain only letters, digits, period, underscore, and hyphen, with a maximum length of 64 characters.');
    }

    const employeeMatches = employeeId ? usersByEmployeeId.get(employeeId) ?? [] : [];
    const authEmailProfileMatches = syntheticAuthEmail ? usersByAuthEmail.get(syntheticAuthEmail) ?? [] : [];
    const visibleProfileMatches = distinctById(
      [...employeeMatches, ...authEmailProfileMatches],
      (user) => user.user_id,
    );
    const protectedProfileMatches = distinctById(
      [
        ...(employeeId ? profileIdentitiesByEmployeeId.get(employeeId.toLowerCase()) ?? [] : []),
        ...(syntheticAuthEmail ? profileIdentitiesByAuthEmail.get(syntheticAuthEmail) ?? [] : []),
      ],
      (identity) => identity.profile_id,
    );
    const profileMatchIds = [...new Set([
      ...visibleProfileMatches.map((user) => user.user_id),
      ...protectedProfileMatches.map((identity) => identity.profile_id),
    ])];
    const employeeProfileMatchIds = [...new Set([
      ...employeeMatches.map((user) => user.user_id),
      ...(employeeId ? (profileIdentitiesByEmployeeId.get(employeeId.toLowerCase()) ?? []).map((identity) => identity.profile_id) : []),
    ])];
    const authEmailProfileMatchIds = [...new Set([
      ...authEmailProfileMatches.map((user) => user.user_id),
      ...(syntheticAuthEmail ? (profileIdentitiesByAuthEmail.get(syntheticAuthEmail) ?? []).map((identity) => identity.profile_id) : []),
    ])];
    if (employeeProfileMatchIds.length > 1) errors.push('Ambiguous Employee ID: more than one existing profile has this Employee ID.');
    if (authEmailProfileMatchIds.length > 1) {
      errors.push('Ambiguous synthetic Auth email: more than one existing profile has this authentication email.');
    }
    if (profileMatchIds.length > 1) {
      errors.push('Employee ID and synthetic Auth email resolve to different existing profiles. Resolve the identity conflict before importing.');
    }
    const matchedProfileId = profileMatchIds.length === 1 ? profileMatchIds[0] : null;
    const matchedUser = matchedProfileId
      ? visibleProfileMatches.find((user) => user.user_id === matchedProfileId) ?? null
      : null;
    const matchedProtectedProfile = matchedProfileId
      ? protectedProfileMatches.find((identity) => identity.profile_id === matchedProfileId) ?? null
      : null;
    if (protectedProfileMatches.some((identity) => (
      identity.employee_id_case_insensitive_match && !identity.employee_id_match
    ))) {
      errors.push('An existing profile has this Employee ID with different letter casing. Employee ID text and case cannot be changed implicitly.');
    }
    if (matchedProtectedProfile?.organization_match === false) {
      errors.push('The Employee ID or synthetic Auth email belongs to a profile outside the authorized organization. Organization-crossing import is forbidden.');
    } else if (matchedProfileId && !matchedUser) {
      errors.push('The protected profile identity could not be resolved in the authorized organization roster. Import is blocked pending reconciliation.');
    }
    if (matchedProtectedProfile?.has_cross_org_active_role === true) {
      errors.push('The matched profile has an active role assignment outside its organization. Resolve the cross-organization role anomaly before importing.');
    }
    if (
      matchedUser
      && accountAction !== 'create'
      && references.actorIsSuperAdmin !== true
      && (matchedUser.roles ?? []).some((assignment) => (
        assignment.is_active
        && ['super_admin', 'executive', 'governance_admin'].includes(assignment.role)
      ))
    ) {
      errors.push('Only an organization-aligned global Super Admin may replace or deactivate an existing privileged role assignment.');
    }
    if (matchedUser?.employee_no?.trim() && matchedUser.employee_no.trim() !== employeeId) {
      errors.push('The synthetic Auth email belongs to a profile with a different exact Employee ID. Employee ID text and case cannot be changed implicitly.');
    }

    const authMatches = syntheticAuthEmail ? authIdentitiesByEmail.get(syntheticAuthEmail) ?? [] : [];
    if (authMatches.length > 1) {
      errors.push('Ambiguous Auth identity: more than one Auth user has the derived synthetic Auth email.');
    }
    const matchedAuthIdentity = authMatches.length === 1 ? authMatches[0] : null;
    if (
      matchedAuthIdentity?.profile_user_id
      && matchedUser
      && matchedAuthIdentity.profile_user_id !== matchedUser.user_id
    ) {
      errors.push('The matched profile and Auth identity do not belong to the same user. Reconcile the identity before importing.');
    }

    const provisioningMatches = distinctById(
      [
        ...(employeeId ? provisioningByEmployeeId.get(employeeId) ?? [] : []),
        ...(syntheticAuthEmail ? provisioningByAuthEmail.get(syntheticAuthEmail) ?? [] : []),
      ],
      (identity) => identity.provisioning_id,
    );
    if (provisioningMatches.length > 1) {
      errors.push('Ambiguous open provisioning identity: more than one protected provisioning record matches this Employee ID or Auth email.');
    }
    const matchedProvisioning = provisioningMatches.length === 1 ? provisioningMatches[0] : null;

    if (accountAction === 'create') {
      if (profileMatchIds.length) errors.push('account_action create is not allowed because an existing profile matches this identity.');
      if (authMatches.length) errors.push('account_action create is not allowed because the synthetic Auth identity already exists.');
      if (provisioningMatches.length) errors.push('account_action create is not allowed because an open provisioning identity already exists.');
    } else if (accountAction === 'update') {
      if (profileMatchIds.length !== 1 || !matchedUser) {
        errors.push('account_action update requires exactly one existing profile match and never creates an account or provisioning record.');
      }
      if (matchedProvisioning) {
        errors.push('account_action update is blocked because an open provisioning identity already exists; reconcile it before updating the profile.');
      }
    } else if (accountAction === 'create_or_update' && profileMatchIds.length === 0) {
      if (authMatches.length) {
        errors.push('account_action create_or_update cannot create because the synthetic Auth identity exists without one exact profile match; reconcile it first.');
      }
      if (provisioningMatches.length) {
        errors.push('account_action create_or_update cannot create a duplicate open provisioning identity; reconcile the existing record first.');
      }
    } else if (accountAction === 'create_or_update' && !matchedUser) {
      errors.push('account_action create_or_update cannot update a protected profile outside the authorized organization roster.');
    }

    let matchedActiveRoleIds: string[] = [];

    if (matchedUser && role && scope && status) {
      const activeRoles = (matchedUser.roles ?? []).filter((assignment) => (
        assignment.is_active
        && (
          matchedUser.organization_id === undefined
          || assignment.organization_id === null
          || assignment.organization_id === matchedUser.organization_id
        )
      ));
      matchedActiveRoleIds = activeRoles.map((assignment) => assignment.user_role_id).filter(Boolean);
      const rolesToDeactivate = activeRoles.filter((assignment) => {
        if (status === 'inactive' || status === 'archived' || status === 'locked') return true;
        const sameOrganization = matchedUser.organization_id === undefined
          || assignment.organization_id === matchedUser.organization_id;
        const sameDepartment = scope === 'department'
          ? assignment.department_id === department?.id
          : assignment.department_id === null;
        return !(
          assignment.role === role
          && assignment.scope === scope
          && sameOrganization
          && sameDepartment
        );
      });
      if (rolesToDeactivate.length) {
        const assignments = rolesToDeactivate
          .map((assignment) => `${assignment.role} (${assignment.scope})`)
          .join(', ');
        warnings.push(
          status === 'inactive' || status === 'archived' || status === 'locked'
            ? `Execution will deactivate all active role assignments for lifecycle status ${status}: ${assignments}.`
            : `The workbook role/scope is authoritative. Execution will deactivate these non-matching active assignments: ${assignments}.`,
        );
      }
    }

    const plannedAction = errors.length
      ? 'rejected' as const
      : accountAction === 'update'
        ? 'update_existing_profile' as const
        : accountAction === 'create'
          ? 'pending_account_creation' as const
          : matchedUser
            ? 'update_existing_profile' as const
            : 'pending_account_creation' as const;
    if (plannedAction === 'pending_account_creation') {
      warnings.push('This row will create a protected provisioning record for separate controlled account creation; no Supabase Auth account will be created from the browser.');
    }

    return {
      ...row,
      phone_normalized: phoneNormalized,
      department_id: department?.id ?? null,
      department_name: department?.name_en ?? null,
      department_division_id: department?.division_id ?? null,
      role: role ?? row.role,
      role_scope: scope ?? row.role_scope,
      status: status ?? row.status,
      user_type: userType ?? row.user_type,
      matched_user_id: matchedUser?.user_id ?? null,
      matched_user_label: matchedLabel(matchedUser)
        ?? (matchedProtectedProfile
          ? matchedProtectedProfile.organization_match
            ? 'Existing organization profile (protected identity match)'
            : 'Existing profile outside authorized organization'
          : null),
      matched_auth_user_id: matchedAuthIdentity?.auth_user_id ?? null,
      matched_auth_identity_label: matchedAuthIdentityLabel(matchedAuthIdentity),
      matched_provisioning_id: matchedProvisioning?.provisioning_id ?? null,
      matched_provisioning_label: matchedProvisioningLabel(matchedProvisioning),
      matched_active_role_ids: matchedActiveRoleIds,
      planned_action: plannedAction,
      validation_status: errors.length ? 'error' as const : 'valid' as const,
      validation_errors: errors,
      validation_warnings: warnings,
    };
  });

  const targetUserCounts = new Map<string, number>();
  validatedRows.forEach((row) => {
    if (!row.matched_user_id) return;
    targetUserCounts.set(row.matched_user_id, (targetUserCounts.get(row.matched_user_id) ?? 0) + 1);
  });
  const finalizedRows = validatedRows.map((row) => {
    if (!row.matched_user_id || (targetUserCounts.get(row.matched_user_id) ?? 0) <= 1) return row;
    return {
      ...row,
      planned_action: 'rejected' as const,
      validation_status: 'error' as const,
      validation_errors: [
        ...(row.validation_errors ?? []),
        'Multiple workbook rows resolve to the same existing user. Keep only one row per existing profile.',
      ],
    };
  });

  existingUserUpdateCount = finalizedRows.filter((row) => row.planned_action === 'update_existing_profile').length;
  pendingAccountCreationCount = finalizedRows.filter((row) => row.planned_action === 'pending_account_creation').length;
  const invalidCount = finalizedRows.filter((row) => row.validation_status === 'error').length;
  return {
    rows: finalizedRows,
    rowCount: finalizedRows.length,
    validCount: finalizedRows.length - invalidCount,
    invalidCount,
    duplicateEmployeeIdCount,
    duplicateContactEmailCount,
    unknownDepartmentCount,
    unknownRoleCount,
    invalidPhoneCount,
    existingUserUpdateCount,
    pendingAccountCreationCount,
  };
}
