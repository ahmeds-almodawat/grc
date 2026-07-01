import type { AccessScope, AppRole } from '../types/domain';
import { invokePrivilegedAction } from './privilegedAction';
import { isSupabaseConfigured, supabase } from './supabase';
import {
  configurationErrorResult,
  emptyResult,
  liveResult,
  queryErrorResult,
  type LiveResult,
} from './liveResult';

export type UserStatus = 'active' | 'inactive' | 'archived' | 'invited' | 'locked';
export type UserType = 'employee' | 'contractor' | 'vendor' | 'external_auditor' | 'service_account';

export const userStatusOptions: UserStatus[] = ['active', 'inactive', 'archived', 'invited', 'locked'];
export const userTypeOptions: UserType[] = ['employee', 'contractor', 'vendor', 'external_auditor', 'service_account'];
export const userRoleOptions: AppRole[] = [
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
];

export type UserManagementRole = {
  user_role_id: string;
  role: AppRole;
  scope: AccessScope;
  organization_id: string | null;
  department_id: string | null;
  is_active: boolean;
  assigned_at: string | null;
};

export type UserManagementUserRow = {
  organization_id: string | null;
  user_id: string;
  employee_no: string | null;
  full_name_en: string;
  full_name_ar: string | null;
  email: string;
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
};

export type ParsedUserImportRow = {
  row_number: number;
  full_name_ar: string;
  full_name_en: string;
  email: string;
  department: string;
  department_id?: string | null;
  job_title: string;
  role: string;
  status: string;
  employee_no: string;
  user_type: string;
  validation_status?: 'valid' | 'error';
  validation_errors?: string[];
  validation_warnings?: string[];
  matched_user_id?: string | null;
};

export type UserImportValidationResult = {
  rows: ParsedUserImportRow[];
  rowCount: number;
  validCount: number;
  invalidCount: number;
  duplicateEmailCount: number;
  unknownDepartmentCount: number;
  unknownRoleCount: number;
};

export type ApplyImportResult = {
  batch_id: string;
  updated_count: number;
  pending_account_creation_count: number;
};

function configuredOrResult<T>(message: string): LiveResult<T> | null {
  if (!isSupabaseConfigured || !supabase) {
    return configurationErrorResult<T>(message);
  }
  return null;
}

function csvEscape(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function normalizeKey(value: string): string {
  return value.trim().toLowerCase().replace(/[\s/-]+/g, '_');
}

function normalizeRole(value: string): AppRole | null {
  const normalized = normalizeKey(value);
  return userRoleOptions.find(role => role === normalized) ?? null;
}

function normalizeStatus(value: string): UserStatus | null {
  const normalized = normalizeKey(value || 'active');
  return userStatusOptions.find(status => status === normalized) ?? null;
}

function normalizeUserType(value: string): UserType {
  const normalized = normalizeKey(value || 'employee');
  return userTypeOptions.find(type => type === normalized) ?? 'employee';
}

function splitCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === ',' && !quoted) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  values.push(current.trim());
  return values;
}

function valueFor(record: Record<string, string>, keys: string[]): string {
  for (const key of keys) {
    const value = record[key];
    if (value) return value.trim();
  }
  return '';
}

const PATCH19_PROFILE_COMPAT_MESSAGE = 'Showing existing People/profiles because Patch 19 user management views are not available yet. Apply migration 080 to enable lifecycle audit, import batches, and full role linkage.';

function errorText(error: unknown): string {
  if (!error || typeof error !== 'object') return String(error ?? '');
  const record = error as { code?: string; message?: string; details?: string | null; hint?: string | null };
  return `${record.code ?? ''} ${record.message ?? ''} ${record.details ?? ''} ${record.hint ?? ''}`.toLowerCase();
}

function isMissingPatch19ProfileColumn(error: unknown): boolean {
  const text = errorText(error);
  return ['user_status', 'user_type', 'last_login_at', 'last_reviewed_at', 'deactivated_at'].some(column => text.includes(column))
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
    department_id: role.department_id as string | null | undefined ?? null,
    is_active: Boolean(role.is_active),
    assigned_at: role.assigned_at as string | null | undefined ?? null,
  }));
}

function applyClientFilters(rows: UserManagementUserRow[], filters: UserManagementFilters): UserManagementUserRow[] {
  const query = filters.search?.trim().toLowerCase();
  return rows.filter(row => {
    const roleNames = row.roles?.map(role => role.role).join(' ') ?? '';
    const matchesSearch = !query || [
      row.full_name_en,
      row.full_name_ar,
      row.email,
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
        ? row.active_role_count === 0
        : row.roles?.some(role => role.is_active && role.role === filters.role));
    return matchesSearch
      && matchesDepartment
      && matchesStatus
      && matchesType
      && matchesRole
      && (!filters.missingDepartment || !row.department_id)
      && (!filters.missingRole || row.active_role_count === 0)
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
    active_role_count: Number(row.active_role_count ?? roles.filter(role => role.is_active).length),
    roles,
    linked_project_count: Number(row.owned_open_projects ?? 0),
    linked_task_count: Number(row.open_tasks ?? 0),
    linked_approval_count: Number(row.pending_approvals ?? 0),
    linked_evidence_count: 0,
    open_project_count: Number(row.owned_open_projects ?? 0),
    open_task_count: Number(row.open_tasks ?? 0),
    pending_approval_count: Number(row.pending_approvals ?? 0),
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
    .select('id,user_id,role,scope,organization_id,department_id,is_active,assigned_at')
    .in('user_id', userIds)
    .limit(5000);
  if (error) return rolesByUser;
  (data ?? []).forEach((row: any) => {
    const userId = safeString(row.user_id);
    const role: UserManagementRole = {
      user_role_id: safeString(row.id),
      role: toAppRole(row.role),
      scope: toAccessScope(row.scope),
      organization_id: row.organization_id ?? null,
      department_id: row.department_id ?? null,
      is_active: Boolean(row.is_active),
      assigned_at: row.assigned_at ?? null,
    };
    rolesByUser.set(userId, [...(rolesByUser.get(userId) ?? []), role]);
  });
  return rolesByUser;
}

async function readProfileRowsForCompatibility(): Promise<any[]> {
  const patch19Select = 'id,organization_id,employee_no,full_name_en,full_name_ar,email,phone,job_title,division_id,department_id,unit_id,is_active,created_at,updated_at,user_status,user_type,last_login_at,last_reviewed_at,deactivated_at,deactivated_by,deactivation_reason';
  const legacySelect = 'id,organization_id,employee_no,full_name_en,full_name_ar,email,phone,job_title,division_id,department_id,unit_id,is_active,created_at,updated_at';
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
    };
  });
}

async function readCompatibilityUserRows(): Promise<UserManagementUserRow[]> {
  const accessMatrixRows = await readRowsFromAccessMatrix();
  if (accessMatrixRows?.length) return accessMatrixRows;
  return readRowsFromProfiles();
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
    missing_role_users: nonArchivedRows.filter(row => row.active_role_count === 0).length,
    pending_setup_users: nonArchivedRows.filter(row => row.user_status === 'invited' || (!row.department_id && !row.department_name) || row.active_role_count === 0).length,
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

async function updateProfileViaCompatibility(input: {
  userId: string;
  fullNameEn: string;
  fullNameAr?: string | null;
  employeeNo?: string | null;
  jobTitle?: string | null;
  userType?: UserType;
}) {
  const legacyPatch = {
    full_name_en: input.fullNameEn.trim(),
    full_name_ar: input.fullNameAr?.trim() || null,
    employee_no: input.employeeNo?.trim() || null,
    job_title: input.jobTitle?.trim() || null,
  };
  await updateProfilePatchViaRls(input.userId, {
    ...legacyPatch,
    user_type: input.userType ?? 'employee',
  }, legacyPatch);
}

async function updateDepartmentViaCompatibility(userId: string, departmentId: string | null) {
  await updateProfilePatchViaRls(userId, { department_id: departmentId || null });
}

async function updateLifecycleViaCompatibility(userId: string, action: LifecycleCompatibilityAction, reason: string) {
  const active = action === 'reactivate' || action === 'unarchive';
  const status: UserStatus = action === 'archive' ? 'archived' : active ? 'active' : 'inactive';
  const legacyPatch = { is_active: active };
  await updateProfilePatchViaRls(userId, {
    ...legacyPatch,
    user_status: status,
    deactivated_at: active ? null : new Date().toISOString(),
    deactivation_reason: active ? null : reason,
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

  const rows = applyClientFilters((data ?? []) as UserManagementUserRow[], filters);

  return rows.length
    ? liveResult(rows)
    : emptyResult<UserManagementUserRow[]>('No users match the selected filters.');
}

export async function getUserManagementSummary(): Promise<LiveResult<UserManagementSummary>> {
  const notConfigured = configuredOrResult<UserManagementSummary>('Supabase is not configured for user management summary.');
  if (notConfigured) return notConfigured;

  const { data, error } = await supabase!
    .from('v_user_management_summary')
    .select('*')
    .limit(1);

  if (error) return getSummaryFromCompatibilitySources(error);
  const row = data?.[0] as UserManagementSummary | undefined;
  return row ? liveResult(row) : getSummaryFromCompatibilitySources();
}

export async function getUserManagementDepartments(): Promise<LiveResult<DepartmentLookup[]>> {
  const notConfigured = configuredOrResult<DepartmentLookup[]>('Supabase is not configured for department lookup.');
  if (notConfigured) return notConfigured;

  const { data, error } = await supabase!
    .from('departments')
    .select('id,code,name_en,name_ar')
    .eq('is_active', true)
    .order('name_en', { ascending: true });

  if (error) return queryErrorResult<DepartmentLookup[]>(error, 'Unable to load departments for user management.');
  const rows = (data ?? []) as DepartmentLookup[];
  return rows.length ? liveResult(rows) : emptyResult<DepartmentLookup[]>('No active departments are available.');
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

export function parseUserImportCsv(text: string): ParsedUserImportRow[] {
  const lines = text.split(/\r?\n/).filter(line => line.trim());
  if (lines.length < 2) return [];
  const headers = splitCsvLine(lines[0]).map(normalizeKey);

  return lines.slice(1).map((line, index) => {
    const values = splitCsvLine(line);
    const record: Record<string, string> = {};
    headers.forEach((header, valueIndex) => {
      record[header] = values[valueIndex] ?? '';
    });
    return {
      row_number: index + 2,
      full_name_ar: valueFor(record, ['arabic_name', 'full_name_ar', 'name_ar']),
      full_name_en: valueFor(record, ['english_name', 'full_name_en', 'name_en', 'name']),
      email: valueFor(record, ['email', 'email_address']),
      department: valueFor(record, ['department_code', 'department_name', 'department']),
      job_title: valueFor(record, ['job_title', 'title']),
      role: valueFor(record, ['role', 'app_role']),
      status: valueFor(record, ['status', 'user_status']),
      employee_no: valueFor(record, ['employee_id', 'employee_no', 'employee_number']),
      user_type: valueFor(record, ['user_type', 'type']),
    };
  });
}

export async function validateImportRows(rows: ParsedUserImportRow[]): Promise<UserImportValidationResult> {
  const [usersResult, departmentsResult] = await Promise.all([
    listUsersWithFilters({}),
    getUserManagementDepartments(),
  ]);

  if (usersResult.status === 'query_error' || departmentsResult.status === 'query_error') {
    throw new Error(usersResult.message ?? departmentsResult.message ?? 'Unable to validate import rows.');
  }

  const users = usersResult.status === 'live' ? usersResult.data : [];
  const departments = departmentsResult.status === 'live' ? departmentsResult.data : [];
  const usersByEmail = new Map(users.map(user => [user.email.toLowerCase(), user]));
  const departmentsByKey = new Map<string, DepartmentLookup>();
  departments.forEach(department => {
    if (department.code) departmentsByKey.set(department.code.toLowerCase(), department);
    departmentsByKey.set(department.name_en.toLowerCase(), department);
    if (department.name_ar) departmentsByKey.set(department.name_ar.toLowerCase(), department);
  });

  const emailCounts = new Map<string, number>();
  rows.forEach(row => {
    const email = row.email.trim().toLowerCase();
    if (email) emailCounts.set(email, (emailCounts.get(email) ?? 0) + 1);
  });

  let duplicateEmailCount = 0;
  let unknownDepartmentCount = 0;
  let unknownRoleCount = 0;

  const validatedRows = rows.map(row => {
    const errors: string[] = [];
    const warnings: string[] = [];
    const email = row.email.trim().toLowerCase();
    const role = row.role ? normalizeRole(row.role) : null;
    const status = normalizeStatus(row.status);
    const userType = normalizeUserType(row.user_type);
    const department = row.department ? departmentsByKey.get(row.department.trim().toLowerCase()) : null;

    if (!row.full_name_en.trim()) errors.push('English name is required.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push('Valid email is required.');
    if (email && (emailCounts.get(email) ?? 0) > 1) {
      errors.push('Duplicate email in uploaded file.');
      duplicateEmailCount += 1;
    }
    if (row.department && !department) {
      errors.push('Unknown department code or name.');
      unknownDepartmentCount += 1;
    }
    if (row.role && !role) {
      errors.push('Unknown role.');
      unknownRoleCount += 1;
    }
    if (!status) errors.push('Invalid status.');
    if (email && !usersByEmail.has(email)) {
      warnings.push('No existing app profile found; row will be tracked for account creation, not created from the browser.');
    }

    return {
      ...row,
      email,
      role: role ?? row.role,
      status: status ?? row.status,
      user_type: userType,
      department_id: department?.id ?? null,
      matched_user_id: usersByEmail.get(email)?.user_id ?? null,
      validation_status: errors.length ? 'error' as const : 'valid' as const,
      validation_errors: errors,
      validation_warnings: warnings,
    };
  });

  const invalidCount = validatedRows.filter(row => row.validation_status === 'error').length;
  return {
    rows: validatedRows,
    rowCount: validatedRows.length,
    validCount: validatedRows.length - invalidCount,
    invalidCount,
    duplicateEmailCount,
    unknownDepartmentCount,
    unknownRoleCount,
  };
}

export async function applyImportBatch(fileName: string, validation: UserImportValidationResult): Promise<ApplyImportResult> {
  try {
    const result = await invokePrivilegedAction<ApplyImportResult>('patch19_apply_import_batch', {
      file_name: fileName,
      rows: validation.rows,
      valid_count: validation.validCount,
      invalid_count: validation.invalidCount,
      duplicate_email_count: validation.duplicateEmailCount,
      unknown_department_count: validation.unknownDepartmentCount,
      unknown_role_count: validation.unknownRoleCount,
      validation_summary: {
        row_count: validation.rowCount,
        valid_count: validation.validCount,
        invalid_count: validation.invalidCount,
      },
    });
    return result;
  } catch (error) {
    if (!isPatch19UnavailableError(error)) throw error;
    let updatedCount = 0;
    let pendingAccountCreationCount = 0;
    for (const row of validation.rows.filter(item => item.validation_status === 'valid')) {
      if (!row.matched_user_id) {
        pendingAccountCreationCount += 1;
        continue;
      }
      await updateProfileViaCompatibility({
        userId: row.matched_user_id,
        fullNameEn: row.full_name_en,
        fullNameAr: row.full_name_ar,
        employeeNo: row.employee_no,
        jobTitle: row.job_title,
        userType: normalizeUserType(row.user_type),
      });
      if (row.department_id !== undefined) await updateDepartmentViaCompatibility(row.matched_user_id, row.department_id ?? null);
      if (row.status) await updateLifecycleViaCompatibility(row.matched_user_id, toUserStatus(row.status) === 'active' ? 'reactivate' : toUserStatus(row.status) === 'archived' ? 'archive' : 'deactivate', 'CSV import compatibility update');
      const role = normalizeRole(row.role);
      if (role) {
        await assignRoleViaCompatibility({
          userId: row.matched_user_id,
          role,
          scope: row.department_id ? 'department' : 'assigned_only',
          departmentId: row.department_id ?? null,
          reason: 'CSV import compatibility update',
        });
      }
      updatedCount += 1;
    }
    return {
      batch_id: `compat-${Date.now()}`,
      updated_count: updatedCount,
      pending_account_creation_count: pendingAccountCreationCount,
    };
  }
}

export async function updateUserProfile(input: {
  userId: string;
  fullNameEn: string;
  fullNameAr?: string | null;
  employeeNo?: string | null;
  jobTitle?: string | null;
  userType: UserType;
  reason?: string;
}) {
  try {
    await invokePrivilegedAction('patch19_update_user_profile', {
      user_id: input.userId,
      full_name_en: input.fullNameEn,
      full_name_ar: input.fullNameAr ?? null,
      employee_no: input.employeeNo ?? null,
      job_title: input.jobTitle ?? null,
      user_type: input.userType,
      reason: input.reason ?? null,
    });
  } catch (error) {
    if (!isPatch19UnavailableError(error)) throw error;
    await updateProfileViaCompatibility(input);
  }
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

export function exportUsers(rows: UserManagementUserRow[]): string {
  const headers = [
    'English Name',
    'Arabic Name',
    'Email',
    'Employee ID',
    'Department',
    'Job Title',
    'Roles',
    'Status',
    'User Type',
    'Last Login',
    'Created Date',
  ];
  const body = rows.map(row => [
    row.full_name_en,
    row.full_name_ar ?? '',
    row.email,
    row.employee_no ?? '',
    row.department_name ?? '',
    row.job_title ?? '',
    row.roles?.filter(role => role.is_active).map(role => role.role).join('; ') ?? '',
    row.user_status,
    row.user_type,
    row.last_login_at ?? '',
    row.created_at,
  ]);
  return [headers, ...body].map(values => values.map(csvEscape).join(',')).join('\n');
}

export function exportUserImportTemplate(): string {
  const headers = [
    'Arabic Name',
    'English Name',
    'Email',
    'Department Code',
    'Job Title',
    'Role',
    'Status',
    'Employee ID',
    'User Type',
  ];
  return `${headers.map(csvEscape).join(',')}\n`;
}

export function exportValidationErrors(rows: ParsedUserImportRow[]): string {
  const headers = ['Row Number', 'Email', 'Errors', 'Warnings'];
  const body = rows
    .filter(row => row.validation_errors?.length || row.validation_warnings?.length)
    .map(row => [
      row.row_number,
      row.email,
      row.validation_errors?.join('; ') ?? '',
      row.validation_warnings?.join('; ') ?? '',
    ]);
  return [headers, ...body].map(values => values.map(csvEscape).join(',')).join('\n');
}
