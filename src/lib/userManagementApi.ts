import type { AccessScope, AppRole } from '../types/domain';
import {
  userRoleOptions,
  userStatusOptions,
  userTypeOptions,
  type ParsedUserImportRow,
  type UserImportValidationResult,
  type UserStatus,
  type UserType,
} from '../utils/userWorkbook';
import {
  validateUserImportRows,
  type UserImportAuthIdentity,
  type UserImportOpenProvisioningIdentity,
  type UserImportProfileIdentity,
} from '../utils/userImportValidation';
import { invokePrivilegedAction } from './privilegedAction';
import {
  patch83tPrivilegedActionOptions,
  requireCompatiblePatch83tUserImportCapability,
  rethrowPatch83tDeploymentCompatibilityError,
  type Patch83tUserImportCapabilities,
} from './userImportCompatibility';
import { isSupabaseConfigured, supabase } from './supabase';
import {
  configurationErrorResult,
  emptyResult,
  liveResult,
  queryErrorResult,
  type LiveResult,
} from './liveResult';

export { userRoleOptions, userStatusOptions, userTypeOptions };
export type { ParsedUserImportRow, UserImportValidationResult, UserStatus, UserType };

export type UserManagementRole = {
  user_role_id: string;
  role: AppRole;
  scope: AccessScope;
  organization_id: string | null;
  division_id: string | null;
  department_id: string | null;
  unit_id: string | null;
  is_active: boolean;
  assigned_at: string | null;
};

export type UserManagementUserRow = {
  organization_id: string | null;
  user_id: string;
  employee_no: string | null;
  full_name_en: string;
  full_name_ar: string | null;
  /** Profile email. Managed profiles mirror the synthetic Auth address; legacy rows may drift. */
  email: string;
  /** Canonical Auth sign-in email from protected credential state when available. */
  auth_email: string | null;
  contact_email: string | null;
  phone: string | null;
  job_title: string | null;
  user_type: UserType;
  user_status: UserStatus;
  is_active: boolean;
  created_at: string;
  updated_at: string | null;
  last_login_at: string | null;
  last_reviewed_at: string | null;
  deactivated_at: string | null;
  deactivated_by: string | null;
  deactivation_reason: string | null;
  division_id: string | null;
  division_name: string | null;
  department_id: string | null;
  department_code: string | null;
  department_name: string | null;
  department_name_ar: string | null;
  unit_id: string | null;
  unit_name: string | null;
  active_role_count: number;
  roles: UserManagementRole[];
  linked_project_count: number;
  linked_task_count: number;
  linked_approval_count: number;
  linked_evidence_count: number;
  open_project_count: number;
  open_task_count: number;
  pending_approval_count: number;
  managed_identity: boolean;
  identity_mode: 'employee_id_managed' | 'legacy_verified' | 'unverified' | null;
  synthetic_auth_email: string | null;
  credential_state: string | null;
  credential_version: number | null;
  must_change_password: boolean;
  last_password_reset_at: string | null;
  last_password_changed_at: string | null;
  provisioning_state: string | null;
  credential_proof_available: boolean;
};

export type UserManagementSummary = {
  organization_id: string;
  total_users: number;
  active_users: number;
  inactive_users: number;
  archived_users: number;
  invited_users: number;
  locked_users: number;
  missing_department_users: number;
  missing_role_users: number;
  pending_setup_users: number;
};

export type UserManagementAuditRow = {
  id: string;
  organization_id: string;
  target_user_id: string | null;
  actor_id: string | null;
  action: string;
  reason: string | null;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  linked_record_count: number;
  created_at: string;
};

export type UserManagementFilters = {
  search?: string;
  departmentId?: string;
  role?: AppRole | 'all' | 'missing';
  status?: UserStatus | 'all';
  userType?: UserType | 'all';
  missingDepartment?: boolean;
  missingRole?: boolean;
  neverLoggedIn?: boolean;
};

export type DepartmentLookup = {
  id: string;
  code: string | null;
  name_en: string;
  name_ar: string | null;
  division_id?: string | null;
};

export type ApplyImportResult = {
  batch_id: string;
  updated_count: number;
  pending_account_creation_count: number;
  provisioning_ids: string[];
  database_proof: {
    import_row_count: number;
    provisioning_record_count: number;
    audit_record_count: number;
    payload_sha256: string;
  };
};

type UserImportIdentityReferenceResult = {
  auth_identities: Array<{
    employee_id: string;
    auth_email: string;
    auth_user_id: string | null;
    organization_match: boolean | null;
  }>;
  profile_identities: Array<{
    employee_id: string;
    auth_email: string;
    profile_id: string | null;
    organization_match: boolean;
    employee_id_match: boolean;
    employee_id_case_insensitive_match: boolean;
    auth_email_match: boolean;
    has_cross_org_active_role: boolean;
  }>;
  provisioning_identities: Array<{
    employee_id: string;
    auth_email: string;
    provisioning_id: string | null;
    status: string | null;
    organization_match: boolean | null;
  }>;
};

export const USER_IMPORT_EXECUTION_CONFIRMATION = 'EXECUTE USER IMPORT';

const USER_IMPORT_EMPLOYEE_ID_PATTERN = /^[A-Za-z0-9._-]{1,64}$/;
const USER_IMPORT_UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const USER_IMPORT_SHA256_PATTERN = /^[0-9a-f]{64}$/;

function configuredOrResult<T>(message: string): LiveResult<T> | null {
  if (!isSupabaseConfigured || !supabase) {
    return configurationErrorResult<T>(message);
  }
  return null;
}


const PATCH19_PROFILE_COMPAT_MESSAGE = 'Showing existing People/profiles because Patch 19 user management views are not available yet. Apply migration 080 to enable lifecycle audit, import batches, and full role linkage.';

function errorText(error: unknown): string {
  if (!error || typeof error !== 'object') return String(error ?? '');
  const record = error as { code?: string; message?: string; details?: string | null; hint?: string | null };
  return `${record.code ?? ''} ${record.message ?? ''} ${record.details ?? ''} ${record.hint ?? ''}`.toLowerCase();
}

function isMissingPatch19ProfileColumn(error: unknown): boolean {
  const text = errorText(error);
  return ['contact_email', 'user_status', 'user_type', 'last_login_at', 'last_reviewed_at', 'deactivated_at'].some(column => text.includes(column))
    && (text.includes('does not exist') || text.includes('could not find') || text.includes('schema cache') || text.includes('42703') || text.includes('pgrst204'));
}

function isPatch19UnavailableError(error: unknown): boolean {
  const text = errorText(error);
  return text.includes('patch19')
    && (text.includes('does not exist') || text.includes('could not find') || text.includes('schema cache') || text.includes('not find the function') || text.includes('pgrst202') || text.includes('42703'));
}

function toUserStatus(value: unknown, fallbackActive: unknown = true): UserStatus {
  return typeof value === 'string' && userStatusOptions.includes(value as UserStatus)
    ? value as UserStatus
    : fallbackActive === false ? 'inactive' : 'active';
}

function toUserType(value: unknown): UserType {
  return typeof value === 'string' && userTypeOptions.includes(value as UserType) ? value as UserType : 'employee';
}

function toAppRole(value: unknown): AppRole {
  return typeof value === 'string' && userRoleOptions.includes(value as AppRole) ? value as AppRole : 'employee';
}

function toAccessScope(value: unknown): AccessScope {
  return ['global', 'division', 'department', 'unit', 'assigned_only'].includes(String(value))
    ? value as AccessScope
    : 'assigned_only';
}

function safeString(value: unknown, fallback = ''): string {
  return value === null || value === undefined ? fallback : String(value);
}

function parseRoles(value: unknown): UserManagementRole[] {
  const raw = typeof value === 'string'
    ? (() => {
        try {
          return JSON.parse(value) as unknown;
        } catch {
          return [];
        }
      })()
    : value;
  if (!Array.isArray(raw)) return [];
  return raw.map((role: any) => ({
    user_role_id: safeString(role.user_role_id ?? role.id),
    role: toAppRole(role.role),
    scope: toAccessScope(role.scope),
    organization_id: role.organization_id as string | null | undefined ?? null,
    division_id: role.division_id as string | null | undefined ?? null,
    department_id: role.department_id as string | null | undefined ?? null,
    unit_id: role.unit_id as string | null | undefined ?? null,
    is_active: Boolean(role.is_active),
    assigned_at: role.assigned_at as string | null | undefined ?? null,
  }));
}

function activeRoleCount(row: Pick<UserManagementUserRow, 'active_role_count' | 'roles'>): number {
  const roleRows = row.roles?.filter(role => role.is_active).length ?? 0;
  return Math.max(row.active_role_count ?? 0, roleRows);
}

function mergeAccessMatrixRoleData(profileRows: UserManagementUserRow[], accessRows: UserManagementUserRow[]): UserManagementUserRow[] {
  const byUserId = new Map(accessRows.map(row => [row.user_id, row]));
  const byEmail = new Map(accessRows.map(row => [row.email.toLowerCase(), row]));
  return profileRows.map(row => {
    if (activeRoleCount(row) > 0) return row;
    const accessRow = byUserId.get(row.user_id) ?? byEmail.get(row.email.toLowerCase());
    if (!accessRow || activeRoleCount(accessRow) === 0) return row;
    return {
      ...row,
      roles: accessRow.roles,
      active_role_count: activeRoleCount(accessRow),
      linked_project_count: accessRow.linked_project_count,
      linked_task_count: accessRow.linked_task_count,
      linked_approval_count: accessRow.linked_approval_count,
      linked_evidence_count: accessRow.linked_evidence_count,
      open_project_count: accessRow.open_project_count,
      open_task_count: accessRow.open_task_count,
      pending_approval_count: accessRow.pending_approval_count,
    };
  });
}

function applyClientFilters(rows: UserManagementUserRow[], filters: UserManagementFilters): UserManagementUserRow[] {
  const query = filters.search?.trim().toLowerCase();
  return rows.filter(row => {
    const roleNames = row.roles?.map(role => role.role).join(' ') ?? '';
    const matchesSearch = !query || [
      row.full_name_en,
      row.full_name_ar,
      row.email,
      row.auth_email,
      row.contact_email,
      row.phone,
      row.synthetic_auth_email,
      row.employee_no,
      row.department_name,
      row.job_title,
      roleNames,
    ].filter(Boolean).join(' ').toLowerCase().includes(query);
    const matchesDepartment = !filters.departmentId || row.department_id === filters.departmentId;
    const matchesStatus = !filters.status || filters.status === 'all' || row.user_status === filters.status;
    const matchesType = !filters.userType || filters.userType === 'all' || row.user_type === filters.userType;
    const matchesRole = !filters.role || filters.role === 'all'
      || (filters.role === 'missing'
        ? activeRoleCount(row) === 0
        : row.roles?.some(role => role.is_active && role.role === filters.role));
    return matchesSearch
      && matchesDepartment
      && matchesStatus
      && matchesType
      && matchesRole
      && (!filters.missingDepartment || !row.department_id)
      && (!filters.missingRole || activeRoleCount(row) === 0)
      && (!filters.neverLoggedIn || !row.last_login_at);
  });
}

function accessMatrixRowToUserManagementRow(row: any): UserManagementUserRow {
  const roles = parseRoles(row.roles);
  const isActive = row.user_active !== false;
  return {
    organization_id: row.organization_id ?? null,
    user_id: safeString(row.user_id),
    employee_no: row.employee_no ?? null,
    full_name_en: safeString(row.full_name_en, row.email ?? 'User'),
    full_name_ar: row.full_name_ar ?? null,
    email: safeString(row.email),
    auth_email: null,
    contact_email: null,
    phone: null,
    job_title: row.job_title ?? null,
    user_type: 'employee',
    user_status: toUserStatus(null, isActive),
    is_active: isActive,
    created_at: new Date(0).toISOString(),
    updated_at: null,
    last_login_at: null,
    last_reviewed_at: null,
    deactivated_at: null,
    deactivated_by: null,
    deactivation_reason: null,
    division_id: null,
    division_name: row.division_name ?? null,
    department_id: null,
    department_code: null,
    department_name: row.department_name ?? null,
    department_name_ar: null,
    unit_id: null,
    unit_name: row.unit_name ?? null,
    active_role_count: Math.max(Number(row.active_role_count ?? 0), roles.filter(role => role.is_active).length),
    roles,
    linked_project_count: Number(row.owned_open_projects ?? 0),
    linked_task_count: Number(row.open_tasks ?? 0),
    linked_approval_count: Number(row.pending_approvals ?? 0),
    linked_evidence_count: 0,
    open_project_count: Number(row.owned_open_projects ?? 0),
    open_task_count: Number(row.open_tasks ?? 0),
    pending_approval_count: Number(row.pending_approvals ?? 0),
    managed_identity: false,
    identity_mode: null,
    synthetic_auth_email: null,
    credential_state: null,
    credential_version: null,
    must_change_password: false,
    last_password_reset_at: null,
    last_password_changed_at: null,
    provisioning_state: null,
    credential_proof_available: false,
  };
}

function bridgeRowToUserManagementRow(row: any): UserManagementUserRow {
  const roles = parseRoles(row.roles);
  const isActive = row.is_active !== false;
  return {
    organization_id: row.organization_id ?? null,
    user_id: safeString(row.user_id),
    employee_no: row.employee_no ?? null,
    full_name_en: safeString(row.full_name_en, row.email ?? 'User'),
    full_name_ar: row.full_name_ar ?? null,
    email: safeString(row.email),
    auth_email: typeof row.auth_email === 'string' && row.auth_email.trim()
      ? row.auth_email.trim().toLowerCase()
      : null,
    contact_email: row.contact_email ?? null,
    phone: row.phone ?? null,
    job_title: row.job_title ?? null,
    user_type: toUserType(row.user_type),
    user_status: toUserStatus(row.user_status, isActive),
    is_active: isActive,
    created_at: row.created_at ?? new Date(0).toISOString(),
    updated_at: row.updated_at ?? null,
    last_login_at: row.last_login_at ?? null,
    last_reviewed_at: row.last_reviewed_at ?? null,
    deactivated_at: row.deactivated_at ?? null,
    deactivated_by: row.deactivated_by ?? null,
    deactivation_reason: row.deactivation_reason ?? null,
    division_id: row.division_id ?? null,
    division_name: row.division_name ?? null,
    department_id: row.department_id ?? null,
    department_code: row.department_code ?? null,
    department_name: row.department_name ?? null,
    department_name_ar: row.department_name_ar ?? null,
    unit_id: row.unit_id ?? null,
    unit_name: row.unit_name ?? null,
    active_role_count: Math.max(Number(row.active_role_count ?? 0), roles.filter(role => role.is_active).length),
    roles,
    linked_project_count: Number(row.linked_project_count ?? 0),
    linked_task_count: Number(row.linked_task_count ?? 0),
    linked_approval_count: Number(row.linked_approval_count ?? 0),
    linked_evidence_count: Number(row.linked_evidence_count ?? 0),
    open_project_count: Number(row.open_project_count ?? 0),
    open_task_count: Number(row.open_task_count ?? 0),
    pending_approval_count: Number(row.pending_approval_count ?? 0),
    managed_identity: row.managed_identity === true,
    identity_mode: ['employee_id_managed', 'legacy_verified', 'unverified'].includes(String(row.identity_mode ?? ''))
      ? row.identity_mode
      : null,
    synthetic_auth_email: row.synthetic_auth_email ?? null,
    credential_state: row.credential_state ?? null,
    credential_version: Number.isInteger(Number(row.credential_version)) ? Number(row.credential_version) : null,
    must_change_password: row.must_change_password === true,
    last_password_reset_at: row.last_password_reset_at ?? null,
    last_password_changed_at: row.last_password_changed_at ?? null,
    provisioning_state: row.provisioning_state ?? null,
    credential_proof_available: row.credential_proof_available === true,
  };
}

async function readRowsFromAccessMatrix(): Promise<UserManagementUserRow[] | null> {
  const { data, error } = await supabase!
    .from('v_access_control_matrix')
    .select('*')
    .order('full_name_en', { ascending: true })
    .limit(2000);
  if (error || !data?.length) return null;
  return (data as any[]).map(accessMatrixRowToUserManagementRow);
}

async function readRowsFromServerBridge(): Promise<UserManagementUserRow[] | null> {
  try {
    const rows = await invokePrivilegedAction<unknown[]>('list_user_management_roster', {});
    return Array.isArray(rows) ? rows.map(bridgeRowToUserManagementRow) : null;
  } catch {
    return null;
  }
}

async function readLookupRows() {
  const [departmentsResult, divisionsResult, unitsResult] = await Promise.all([
    supabase!.from('departments').select('id,code,name_en,name_ar').limit(2000),
    supabase!.from('divisions').select('id,name_en').limit(1000),
    supabase!.from('units').select('id,name_en').limit(2000),
  ]);
  return {
    departments: new Map((departmentsResult.error ? [] : departmentsResult.data ?? []).map((row: any) => [row.id, row])),
    divisions: new Map((divisionsResult.error ? [] : divisionsResult.data ?? []).map((row: any) => [row.id, row])),
    units: new Map((unitsResult.error ? [] : unitsResult.data ?? []).map((row: any) => [row.id, row])),
  };
}

async function readRoleRowsByUser(userIds: string[]): Promise<Map<string, UserManagementRole[]>> {
  const rolesByUser = new Map<string, UserManagementRole[]>();
  if (!userIds.length) return rolesByUser;
  const { data, error } = await supabase!
    .from('user_roles')
    .select('id,user_id,role,scope,organization_id,division_id,department_id,unit_id,is_active,assigned_at')
    .in('user_id', userIds)
    .limit(5000);
  if (error) throw error;
  (data ?? []).forEach((row: any) => {
    const userId = safeString(row.user_id);
    const role: UserManagementRole = {
      user_role_id: safeString(row.id),
      role: toAppRole(row.role),
      scope: toAccessScope(row.scope),
      organization_id: row.organization_id ?? null,
      division_id: row.division_id ?? null,
      department_id: row.department_id ?? null,
      unit_id: row.unit_id ?? null,
      is_active: Boolean(row.is_active),
      assigned_at: row.assigned_at ?? null,
    };
    rolesByUser.set(userId, [...(rolesByUser.get(userId) ?? []), role]);
  });
  return rolesByUser;
}

async function readProfileRowsForCompatibility(): Promise<any[]> {
  const patch83tSelect = 'id,organization_id,employee_no,full_name_en,full_name_ar,email,contact_email,phone,job_title,division_id,department_id,unit_id,is_active,created_at,updated_at,user_status,user_type,last_login_at,last_reviewed_at,deactivated_at,deactivated_by,deactivation_reason';
  const patch19Select = 'id,organization_id,employee_no,full_name_en,full_name_ar,email,phone,job_title,division_id,department_id,unit_id,is_active,created_at,updated_at,user_status,user_type,last_login_at,last_reviewed_at,deactivated_at,deactivated_by,deactivation_reason';
  const legacySelect = 'id,organization_id,employee_no,full_name_en,full_name_ar,email,phone,job_title,division_id,department_id,unit_id,is_active,created_at,updated_at';
  const patch83tResult = await supabase!
    .from('profiles')
    .select(patch83tSelect)
    .order('full_name_en', { ascending: true })
    .limit(2000);
  if (!patch83tResult.error) return patch83tResult.data ?? [];
  if (!isMissingPatch19ProfileColumn(patch83tResult.error)) throw patch83tResult.error;

  const patch19Result = await supabase!
    .from('profiles')
    .select(patch19Select)
    .order('full_name_en', { ascending: true })
    .limit(2000);
  if (!patch19Result.error) return patch19Result.data ?? [];
  if (!isMissingPatch19ProfileColumn(patch19Result.error)) throw patch19Result.error;

  const legacyResult = await supabase!
    .from('profiles')
    .select(legacySelect)
    .order('full_name_en', { ascending: true })
    .limit(2000);
  if (legacyResult.error) throw legacyResult.error;
  return legacyResult.data ?? [];
}

async function readRowsFromProfiles(): Promise<UserManagementUserRow[]> {
  const profiles = await readProfileRowsForCompatibility();
  const [lookups, rolesByUser] = await Promise.all([
    readLookupRows(),
    readRoleRowsByUser(profiles.map((profile: any) => safeString(profile.id)).filter(Boolean)),
  ]);

  return profiles.map((profile: any) => {
    const userId = safeString(profile.id);
    const roles = rolesByUser.get(userId) ?? [];
    const department = profile.department_id ? lookups.departments.get(profile.department_id) as any | undefined : undefined;
    const division = profile.division_id ? lookups.divisions.get(profile.division_id) as any | undefined : undefined;
    const unit = profile.unit_id ? lookups.units.get(profile.unit_id) as any | undefined : undefined;
    return {
      organization_id: profile.organization_id ?? null,
      user_id: userId,
      employee_no: profile.employee_no ?? null,
      full_name_en: safeString(profile.full_name_en, profile.email ?? 'User'),
      full_name_ar: profile.full_name_ar ?? null,
      email: safeString(profile.email),
      auth_email: null,
      contact_email: profile.contact_email ?? null,
      phone: profile.phone ?? null,
      job_title: profile.job_title ?? null,
      user_type: toUserType(profile.user_type),
      user_status: toUserStatus(profile.user_status, profile.is_active !== false),
      is_active: profile.is_active !== false,
      created_at: profile.created_at ?? new Date(0).toISOString(),
      updated_at: profile.updated_at ?? null,
      last_login_at: profile.last_login_at ?? null,
      last_reviewed_at: profile.last_reviewed_at ?? null,
      deactivated_at: profile.deactivated_at ?? null,
      deactivated_by: profile.deactivated_by ?? null,
      deactivation_reason: profile.deactivation_reason ?? null,
      division_id: profile.division_id ?? null,
      division_name: division?.name_en ?? null,
      department_id: profile.department_id ?? null,
      department_code: department?.code ?? null,
      department_name: department?.name_en ?? null,
      department_name_ar: department?.name_ar ?? null,
      unit_id: profile.unit_id ?? null,
      unit_name: unit?.name_en ?? null,
      active_role_count: roles.filter(role => role.is_active).length,
      roles,
      linked_project_count: 0,
      linked_task_count: 0,
      linked_approval_count: 0,
      linked_evidence_count: 0,
      open_project_count: 0,
      open_task_count: 0,
      pending_approval_count: 0,
      managed_identity: false,
      identity_mode: null,
      synthetic_auth_email: null,
      credential_state: null,
      credential_version: null,
      must_change_password: false,
      last_password_reset_at: null,
      last_password_changed_at: null,
      provisioning_state: null,
      credential_proof_available: false,
    };
  });
}

async function readCompatibilityUserRows(): Promise<UserManagementUserRow[]> {
  try {
    const profileRows = await readRowsFromProfiles();
    if (profileRows.length) {
      const needsRoleSupplementalCheck = profileRows.some(row => activeRoleCount(row) === 0);
      if (!needsRoleSupplementalCheck) return profileRows;
      const accessMatrixRows = await readRowsFromAccessMatrix();
      return accessMatrixRows?.length ? mergeAccessMatrixRoleData(profileRows, accessMatrixRows) : profileRows;
    }
  } catch {
    // Fall back to the legacy access matrix only when direct profile/role reads are unavailable.
  }
  const accessMatrixRows = await readRowsFromAccessMatrix();
  return accessMatrixRows ?? [];
}

async function listUsersFromCompatibilitySources(filters: UserManagementFilters, originalError?: unknown): Promise<LiveResult<UserManagementUserRow[]>> {
  try {
    const rows = applyClientFilters(await readCompatibilityUserRows(), filters);
    return rows.length
      ? liveResult(rows, 'supabase', PATCH19_PROFILE_COMPAT_MESSAGE)
      : emptyResult<UserManagementUserRow[]>(`No users match the selected filters. ${PATCH19_PROFILE_COMPAT_MESSAGE}`);
  } catch (compatibilityError) {
    return queryErrorResult<UserManagementUserRow[]>(originalError ?? compatibilityError, 'Unable to load user management roster or existing profiles.');
  }
}

function summaryFromRows(rows: UserManagementUserRow[]): UserManagementSummary {
  const visibleRows = rows.filter(row => row.user_id);
  const nonArchivedRows = visibleRows.filter(row => row.user_status !== 'archived');
  return {
    organization_id: visibleRows.find(row => row.organization_id)?.organization_id ?? 'visible-profile-scope',
    total_users: visibleRows.length,
    active_users: visibleRows.filter(row => row.user_status === 'active').length,
    inactive_users: visibleRows.filter(row => row.user_status === 'inactive').length,
    archived_users: visibleRows.filter(row => row.user_status === 'archived').length,
    invited_users: visibleRows.filter(row => row.user_status === 'invited').length,
    locked_users: visibleRows.filter(row => row.user_status === 'locked').length,
    missing_department_users: nonArchivedRows.filter(row => !row.department_id && !row.department_name).length,
    missing_role_users: nonArchivedRows.filter(row => activeRoleCount(row) === 0).length,
    pending_setup_users: nonArchivedRows.filter(row => row.user_status === 'invited' || (!row.department_id && !row.department_name) || activeRoleCount(row) === 0).length,
  };
}

async function getSummaryFromCompatibilitySources(originalError?: unknown): Promise<LiveResult<UserManagementSummary>> {
  try {
    const rows = await readCompatibilityUserRows();
    return rows.length
      ? liveResult(summaryFromRows(rows), 'supabase', PATCH19_PROFILE_COMPAT_MESSAGE)
      : emptyResult<UserManagementSummary>(`No visible profiles are available. ${PATCH19_PROFILE_COMPAT_MESSAGE}`);
  } catch (compatibilityError) {
    return queryErrorResult<UserManagementSummary>(originalError ?? compatibilityError, 'Unable to load user management summary or existing profile counts.');
  }
}

async function updateProfilePatchViaRls(
  userId: string,
  patch: Record<string, unknown>,
  legacyPatch: Record<string, unknown> = patch,
) {
  if (!supabase) throw new Error('Supabase is not configured for user management updates.');
  const { error } = await supabase.from('profiles').update(patch).eq('id', userId);
  if (!error) return;
  if (isMissingPatch19ProfileColumn(error) && legacyPatch !== patch) {
    const retry = await supabase.from('profiles').update(legacyPatch).eq('id', userId);
    if (!retry.error) return;
    throw new Error(retry.error.message);
  }
  throw new Error(error.message);
}

async function updateDepartmentViaCompatibility(userId: string, departmentId: string | null) {
  await updateProfilePatchViaRls(userId, { department_id: departmentId || null });
}

async function updateLifecycleViaCompatibility(userId: string, action: LifecycleCompatibilityAction, reason: string) {
  const active = action === 'reactivate' || action === 'unarchive';
  const status: UserStatus = action === 'archive' ? 'archived' : active ? 'active' : 'inactive';
  const legacyPatch = { is_active: active };
  const normalizedReason = reason.trim();
  let deactivatedBy: string | null = null;
  if (!active) {
    if (!normalizedReason) throw new Error('A deactivation reason is required.');
    if (!supabase) throw new Error('Supabase is not configured for user management updates.');
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user?.id) throw new Error('Unable to verify the lifecycle action actor.');
    deactivatedBy = data.user.id;
  }
  await updateProfilePatchViaRls(userId, {
    ...legacyPatch,
    user_status: status,
    // The profile trigger supplies a database timestamp for blocked states.
    deactivated_at: null,
    deactivated_by: deactivatedBy,
    deactivation_reason: active ? null : normalizedReason,
  }, legacyPatch);
}

type LifecycleCompatibilityAction = 'deactivate' | 'reactivate' | 'archive' | 'unarchive';

async function assignRoleViaCompatibility(input: {
  userId: string;
  role: AppRole;
  scope: AccessScope;
  departmentId?: string | null;
  reason?: string;
}) {
  const result = await invokePrivilegedAction<{ id: string }>('assign_user_role', {
    user_id: input.userId,
    role: input.role,
    scope: input.scope,
    organization_id: null,
    division_id: null,
    department_id: input.departmentId ?? null,
    unit_id: null,
    reason: input.reason ?? null,
  });
  return result.id;
}

async function deactivateVisibleRoleAssignments(roles: UserManagementRole[], reason: string) {
  const roleIds = roles.filter(role => role.is_active && role.user_role_id).map(role => role.user_role_id);
  await Promise.all(roleIds.map(roleId => invokePrivilegedAction('deactivate_user_role', {
    user_role_id: roleId,
    reason,
  })));
}

export async function listUsersWithFilters(filters: UserManagementFilters = {}): Promise<LiveResult<UserManagementUserRow[]>> {
  const notConfigured = configuredOrResult<UserManagementUserRow[]>('Supabase is not configured for user management.');
  if (notConfigured) return notConfigured;

  const bridgeRows = await readRowsFromServerBridge();
  if (bridgeRows) {
    const rows = applyClientFilters(bridgeRows, filters);
    return rows.length
      ? liveResult(rows, 'supabase', 'Showing admin user roster through the authenticated server bridge.')
      : emptyResult<UserManagementUserRow[]>('No users match the selected filters.');
  }

  let query = supabase!
    .from('v_user_management_roster')
    .select('*')
    .order('full_name_en', { ascending: true })
    .limit(2000);

  if (filters.status && filters.status !== 'all') query = query.eq('user_status', filters.status);
  if (filters.userType && filters.userType !== 'all') query = query.eq('user_type', filters.userType);
  if (filters.departmentId) query = query.eq('department_id', filters.departmentId);
  if (filters.missingDepartment) query = query.is('department_id', null);
  if (filters.neverLoggedIn) query = query.is('last_login_at', null);
  if (filters.search?.trim()) {
    const term = filters.search.trim().replaceAll('%', '').replaceAll(',', ' ');
    query = query.or(`full_name_en.ilike.%${term}%,full_name_ar.ilike.%${term}%,email.ilike.%${term}%,employee_no.ilike.%${term}%`);
  }

  const { data, error } = await query;
  if (error) return listUsersFromCompatibilitySources(filters, error);

  const rawRows = (data ?? []).map(bridgeRowToUserManagementRow);
  let rows = applyClientFilters(rawRows, filters);
  if (rows.some(row => activeRoleCount(row) === 0)) {
    try {
      const compatibilityRows = await readCompatibilityUserRows();
      if (compatibilityRows.length) {
        rows = applyClientFilters(mergeAccessMatrixRoleData(rawRows, compatibilityRows), filters);
      }
    } catch {
      // Keep the primary roster result if compatibility role enrichment is unavailable.
    }
  }

  return rows.length
    ? liveResult(rows)
    : emptyResult<UserManagementUserRow[]>('No users match the selected filters.');
}

export async function getUserManagementSummary(): Promise<LiveResult<UserManagementSummary>> {
  const notConfigured = configuredOrResult<UserManagementSummary>('Supabase is not configured for user management summary.');
  if (notConfigured) return notConfigured;

  const bridgeRows = await readRowsFromServerBridge();
  if (bridgeRows) return liveResult(summaryFromRows(bridgeRows), 'supabase', 'Showing admin user summary through the authenticated server bridge.');

  const { data, error } = await supabase!
    .from('v_user_management_summary')
    .select('*')
    .limit(1);

  if (error) return getSummaryFromCompatibilitySources(error);
  const row = data?.[0] as UserManagementSummary | undefined;
  if (row && row.missing_role_users > 0) {
    const compatibilitySummary = await getSummaryFromCompatibilitySources();
    if (
      compatibilitySummary.status === 'live'
      && compatibilitySummary.data
      && compatibilitySummary.data.missing_role_users < row.missing_role_users
    ) {
      return compatibilitySummary;
    }
  }
  return row ? liveResult(row) : getSummaryFromCompatibilitySources();
}

export async function getUserManagementDepartments(): Promise<LiveResult<DepartmentLookup[]>> {
  const notConfigured = configuredOrResult<DepartmentLookup[]>('Supabase is not configured for department lookup.');
  if (notConfigured) return notConfigured;

  const { data, error } = await supabase!
    .from('departments')
    .select('id,code,name_en,name_ar,division_id')
    .eq('is_active', true)
    .is('archived_at', null)
    .order('name_en', { ascending: true });

  if (error) return queryErrorResult<DepartmentLookup[]>(error, 'Unable to load departments for user management.');
  const rows = (data ?? []) as DepartmentLookup[];
  return rows.length ? liveResult(rows) : emptyResult<DepartmentLookup[]>('No active departments are available.');
}

export async function getArchivedUserManagementDepartments(): Promise<LiveResult<DepartmentLookup[]>> {
  const notConfigured = configuredOrResult<DepartmentLookup[]>('Supabase is not configured for archived department lookup.');
  if (notConfigured) return notConfigured;
  const { data, error } = await supabase!
    .from('departments')
    .select('id,code,name_en,name_ar,division_id')
    .or('is_active.eq.false,archived_at.not.is.null')
    .order('name_en', { ascending: true });
  if (error) return queryErrorResult<DepartmentLookup[]>(error, 'Unable to validate archived departments for user import.');
  const rows = (data ?? []) as DepartmentLookup[];
  return rows.length ? liveResult(rows) : emptyResult<DepartmentLookup[]>('No archived departments exist.');
}

function departmentLookupMap(departments: DepartmentLookup[]) {
  const map = new Map<string, DepartmentLookup>();
  departments.forEach(department => {
    if (department.code) map.set(department.code.trim().toLowerCase(), department);
    map.set(department.name_en.trim().replace(/\s+/g, ' ').toLowerCase(), department);
    if (department.name_ar) map.set(department.name_ar.trim().replace(/\s+/g, ' ').toLowerCase(), department);
  });
  return map;
}

export function classifyUserImportDepartment(
  reference: string,
  activeDepartments: DepartmentLookup[],
  archivedDepartments: DepartmentLookup[],
) {
  const key = reference.trim().replace(/\s+/g, ' ').toLowerCase();
  if (!key) return { status: 'none' as const, department: null };
  const active = departmentLookupMap(activeDepartments).get(key);
  if (active) return { status: 'active' as const, department: active };
  const archived = departmentLookupMap(archivedDepartments).get(key);
  if (archived) return { status: 'archived' as const, department: archived };
  return { status: 'unknown' as const, department: null };
}

export async function readAuditHistory(userId?: string): Promise<LiveResult<UserManagementAuditRow[]>> {
  const notConfigured = configuredOrResult<UserManagementAuditRow[]>('Supabase is not configured for user audit history.');
  if (notConfigured) return notConfigured;

  let query = supabase!
    .from('user_management_audit_history')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200);

  if (userId) query = query.eq('target_user_id', userId);

  const { data, error } = await query;
  if (error) return queryErrorResult<UserManagementAuditRow[]>(error, 'Unable to load user management audit history.');
  const rows = (data ?? []) as UserManagementAuditRow[];
  return rows.length ? liveResult(rows) : emptyResult<UserManagementAuditRow[]>('No user management audit history is available yet.');
}

export async function validateImportRows(
  rows: ParsedUserImportRow[],
  parserErrorsByRow: Record<number, string[]>,
  capabilityProof: Patch83tUserImportCapabilities,
): Promise<UserImportValidationResult> {
  requireCompatiblePatch83tUserImportCapability(capabilityProof);
  const employeeIds = [
    ...new Map(
      rows
        .map((row) => row.employee_no.trim())
        .filter((employeeId) => USER_IMPORT_EMPLOYEE_ID_PATTERN.test(employeeId))
        .map((employeeId) => [employeeId.toLowerCase(), employeeId]),
    ).values(),
  ];
  const identityReferencesPromise = employeeIds.length
    ? invokePrivilegedAction<UserImportIdentityReferenceResult>('patch83t_user_import_identity_references', {
        employee_ids: employeeIds,
      }, patch83tPrivilegedActionOptions()).catch((error) => {
        rethrowPatch83tDeploymentCompatibilityError(error);
      })
    : Promise.resolve<UserImportIdentityReferenceResult>({
        auth_identities: [],
        profile_identities: [],
        provisioning_identities: [],
      });

  const [usersResult, departmentsResult, archivedDepartmentsResult, identityReferences, actorResult] = await Promise.all([
    listUsersWithFilters({}),
    getUserManagementDepartments(),
    getArchivedUserManagementDepartments(),
    identityReferencesPromise,
    supabase!.auth.getUser(),
  ]);

  if (usersResult.status === 'query_error' || departmentsResult.status === 'query_error' || archivedDepartmentsResult.status === 'query_error') {
    throw new Error(usersResult.message ?? departmentsResult.message ?? archivedDepartmentsResult.message ?? 'Unable to validate import rows.');
  }

  const users = usersResult.status === 'live' ? usersResult.data : [];
  const departments = departmentsResult.status === 'live' ? departmentsResult.data : [];
  const archivedDepartments = archivedDepartmentsResult.status === 'live' ? archivedDepartmentsResult.data : [];
  if (
    !Array.isArray(identityReferences.auth_identities)
    || !Array.isArray(identityReferences.profile_identities)
    || !Array.isArray(identityReferences.provisioning_identities)
    || identityReferences.profile_identities.some((identity) => (
      typeof identity.organization_match !== 'boolean'
      || typeof identity.employee_id_match !== 'boolean'
      || typeof identity.employee_id_case_insensitive_match !== 'boolean'
      || typeof identity.auth_email_match !== 'boolean'
      || typeof identity.has_cross_org_active_role !== 'boolean'
    ))
  ) {
    throw new Error('Protected User Import identity-reference proof is incomplete. Deployment must include matching Patch 83T database and Edge contracts.');
  }
  const authIdentities: UserImportAuthIdentity[] = identityReferences.auth_identities
    .filter((identity) => Boolean(identity.auth_user_id))
    .map((identity) => ({
      auth_user_id: identity.auth_user_id!,
      email: identity.auth_email,
      profile_user_id: identity.auth_user_id,
      label: `${identity.auth_email} (${identity.auth_user_id})${identity.organization_match === false ? ' — not organization-aligned' : ''}`,
    }));
  const profileIdentities: UserImportProfileIdentity[] = identityReferences.profile_identities
    .filter((identity) => Boolean(identity.profile_id))
    .map((identity) => ({
      profile_id: identity.profile_id!,
      employee_no: identity.employee_id,
      auth_email: identity.auth_email,
      organization_match: identity.organization_match,
      employee_id_match: identity.employee_id_match,
      employee_id_case_insensitive_match: identity.employee_id_case_insensitive_match,
      auth_email_match: identity.auth_email_match,
      has_cross_org_active_role: identity.has_cross_org_active_role,
    }));
  const openProvisioningIdentities: UserImportOpenProvisioningIdentity[] = identityReferences.provisioning_identities
    .filter((identity) => Boolean(identity.provisioning_id))
    .map((identity) => ({
      provisioning_id: identity.provisioning_id!,
      employee_no: identity.employee_id,
      auth_email: identity.auth_email,
      state: identity.status,
    }));
  if (actorResult.error || !actorResult.data.user?.id) {
    throw new Error('The authenticated actor could not be verified for User Import preview.');
  }
  const actor = users.find((user) => user.user_id === actorResult.data.user.id);
  const actorIsSuperAdmin = Boolean(actor?.roles.some((role) => (
    role.is_active
    && role.role === 'super_admin'
    && role.scope === 'global'
    && (role.organization_id === null || role.organization_id === actor.organization_id)
    && role.division_id === null
    && role.department_id === null
    && role.unit_id === null
  )));
  return validateUserImportRows(rows, {
    users: users.map((user) => ({
      user_id: user.user_id,
      organization_id: user.organization_id,
      employee_no: user.employee_no,
      full_name_en: user.full_name_en,
      email: user.email,
      contact_email: user.contact_email,
      roles: user.roles,
    })),
    authIdentities,
    profileIdentities,
    openProvisioningIdentities,
    actorIsSuperAdmin,
    activeDepartments: departments,
    archivedDepartments,
  }, parserErrorsByRow);
}

export async function applyImportBatch(
  fileName: string,
  validation: UserImportValidationResult,
  executionConfirmation: string,
  capabilityProof: Patch83tUserImportCapabilities,
): Promise<ApplyImportResult> {
  requireCompatiblePatch83tUserImportCapability(capabilityProof);
  if (executionConfirmation !== USER_IMPORT_EXECUTION_CONFIRMATION) {
    throw new Error(`Type ${USER_IMPORT_EXECUTION_CONFIRMATION} exactly before executing the import.`);
  }
  if (
    validation.rowCount < 1
    || validation.invalidCount !== 0
    || validation.validCount !== validation.rowCount
    || validation.rows.some((row) => (
      row.validation_status !== 'valid'
      || !row.planned_action
      || row.planned_action === 'rejected'
    ))
  ) {
    throw new Error('Only a non-empty, fully valid User Import preview can be executed.');
  }
  const result = await invokePrivilegedAction<ApplyImportResult>('patch83t_apply_user_excel_import', {
    file_name: fileName,
    source_format: 'xlsx',
    execution_confirmation: executionConfirmation,
    rows: validation.rows.map((row) => ({
      row_number: row.row_number,
      employee_id: row.employee_no,
      full_name_en: row.full_name_en,
      full_name_ar: row.full_name_ar,
      contact_email: row.contact_email || null,
      phone: row.phone_normalized,
      department_code: row.department,
      job_title: row.job_title,
      role: row.role,
      role_scope: row.role_scope,
      status: row.status,
      user_type: row.user_type,
      account_action: row.account_action,
      validation_status: row.validation_status,
      expected_matched_user_id: row.matched_user_id ?? null,
      expected_planned_action: row.planned_action,
      expected_active_role_ids: row.matched_active_role_ids ?? [],
    })),
    valid_count: validation.validCount,
    invalid_count: validation.invalidCount,
    duplicate_employee_id_count: validation.duplicateEmployeeIdCount,
    duplicate_contact_email_count: validation.duplicateContactEmailCount,
    unknown_department_count: validation.unknownDepartmentCount,
    unknown_role_count: validation.unknownRoleCount,
    invalid_phone_count: validation.invalidPhoneCount,
    validation_summary: {
      row_count: validation.rowCount,
      valid_count: validation.validCount,
      invalid_count: validation.invalidCount,
      existing_user_update_count: validation.existingUserUpdateCount,
      pending_account_creation_count: validation.pendingAccountCreationCount,
    },
  }, patch83tPrivilegedActionOptions()).catch((error) => {
    rethrowPatch83tDeploymentCompatibilityError(error);
  });
  const proof = result?.database_proof;
  const provisioningIds = Array.isArray(result?.provisioning_ids) ? result.provisioning_ids : [];
  if (
    !result
    || !USER_IMPORT_UUID_PATTERN.test(result.batch_id)
    || !Number.isInteger(result.updated_count)
    || result.updated_count !== validation.existingUserUpdateCount
    || !Number.isInteger(result.pending_account_creation_count)
    || result.pending_account_creation_count !== validation.pendingAccountCreationCount
    || provisioningIds.length !== validation.pendingAccountCreationCount
    || provisioningIds.some((id) => typeof id !== 'string' || !USER_IMPORT_UUID_PATTERN.test(id))
    || new Set(provisioningIds).size !== provisioningIds.length
    || !proof
    || !Number.isInteger(proof.import_row_count)
    || proof.import_row_count !== validation.rowCount
    || !Number.isInteger(proof.provisioning_record_count)
    || proof.provisioning_record_count !== validation.pendingAccountCreationCount
    || !Number.isInteger(proof.audit_record_count)
    || proof.audit_record_count !== validation.existingUserUpdateCount
    || typeof proof.payload_sha256 !== 'string'
    || !USER_IMPORT_SHA256_PATTERN.test(proof.payload_sha256)
  ) {
    throw new Error('The database did not return complete, internally consistent Patch 83T import proof. Treat the execution outcome as unverified and reconcile before retrying.');
  }
  return result;
}

export async function updateUserProfile(input: {
  userId: string;
  fullNameEn: string;
  fullNameAr?: string | null;
  employeeNo?: string | null;
  contactEmail?: string | null;
  phone?: string | null;
  jobTitle?: string | null;
  userType: UserType;
  reason?: string;
}) {
  await invokePrivilegedAction('patch19_update_user_profile', {
    user_id: input.userId,
    full_name_en: input.fullNameEn,
    full_name_ar: input.fullNameAr ?? null,
    employee_id: input.employeeNo ?? null,
    contact_email: input.contactEmail?.trim() || null,
    phone: input.phone?.trim() || null,
    job_title: input.jobTitle ?? null,
    user_type: input.userType,
    reason: input.reason ?? null,
  });
}

export async function updateUserDepartment(input: { userId: string; departmentId: string | null; reason?: string }) {
  try {
    await invokePrivilegedAction('patch19_update_user_department', {
      user_id: input.userId,
      department_id: input.departmentId,
      reason: input.reason ?? null,
    });
  } catch (error) {
    if (!isPatch19UnavailableError(error)) throw error;
    await updateDepartmentViaCompatibility(input.userId, input.departmentId);
  }
}

export async function updateUserRole(input: {
  userId: string;
  role: AppRole;
  scope: AccessScope;
  departmentId?: string | null;
  reason?: string;
}) {
  try {
    const result = await invokePrivilegedAction<{ id: string }>('patch19_assign_user_role', {
      user_id: input.userId,
      role: input.role,
      scope: input.scope,
      department_id: input.departmentId ?? null,
      reason: input.reason ?? null,
    });
    return result.id;
  } catch (error) {
    if (!isPatch19UnavailableError(error)) throw error;
    return assignRoleViaCompatibility(input);
  }
}

export async function deactivateUser(userId: string, reason: string, roles: UserManagementRole[] = []) {
  try {
    await invokePrivilegedAction('patch19_deactivate_user', { user_id: userId, reason });
  } catch (error) {
    if (!isPatch19UnavailableError(error)) throw error;
    await updateLifecycleViaCompatibility(userId, 'deactivate', reason);
    await deactivateVisibleRoleAssignments(roles, reason);
  }
}

export async function reactivateUser(userId: string, reason: string) {
  try {
    await invokePrivilegedAction('patch19_reactivate_user', { user_id: userId, reason });
  } catch (error) {
    if (!isPatch19UnavailableError(error)) throw error;
    await updateLifecycleViaCompatibility(userId, 'reactivate', reason);
  }
}

export async function archiveUser(userId: string, reason: string, roles: UserManagementRole[] = []) {
  try {
    await invokePrivilegedAction('patch19_archive_user', { user_id: userId, reason });
  } catch (error) {
    if (!isPatch19UnavailableError(error)) throw error;
    await updateLifecycleViaCompatibility(userId, 'archive', reason);
    await deactivateVisibleRoleAssignments(roles, reason);
  }
}

export async function unarchiveUser(userId: string, reason: string) {
  try {
    await invokePrivilegedAction('patch19_unarchive_user', { user_id: userId, reason });
  } catch (error) {
    if (!isPatch19UnavailableError(error)) throw error;
    await updateLifecycleViaCompatibility(userId, 'unarchive', reason);
  }
}
