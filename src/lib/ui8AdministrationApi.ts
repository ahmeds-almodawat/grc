import { isSupabaseConfigured, supabase } from './supabase';
import {
  getUserManagementSummary,
  listUsersWithFilters,
  readAuditHistory,
  type UserManagementAuditRow,
  type UserManagementSummary,
  type UserManagementUserRow,
} from './userManagementApi';

export interface Ui8OrganizationRow {
  id: string;
  name_en: string;
  name_ar: string | null;
  is_active: boolean;
}

export interface Ui8DivisionRow {
  id: string;
  organization_id: string;
  code: string | null;
  name_en: string;
  name_ar: string | null;
  is_active: boolean;
}

export interface Ui8DepartmentRow {
  id: string;
  organization_id: string;
  division_id: string | null;
  code: string | null;
  name_en: string;
  name_ar: string | null;
  is_active: boolean;
  archived_at: string | null;
}

export interface Ui8AdministrationSnapshot {
  users: UserManagementUserRow[];
  summary: UserManagementSummary | null;
  audit: UserManagementAuditRow[];
  organization: Ui8OrganizationRow | null;
  divisions: Ui8DivisionRow[];
  departments: Ui8DepartmentRow[];
  messages: string[];
  loadedAt: string;
}

function messageFor(source: string, status: string, fallback?: string) {
  if (status === 'live') return null;
  return `${source}: ${fallback || 'governed data is not available for the current session.'}`;
}

export async function loadUi8AdministrationSnapshot(
  organizationId: string | null | undefined,
): Promise<Ui8AdministrationSnapshot> {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('The governed administration data boundary is not configured.');
  }
  if (!organizationId) {
    throw new Error('The signed-in profile has no organization scope.');
  }

  const [usersResult, summaryResult, auditResult, organizationResult, divisionsResult, departmentsResult] = await Promise.all([
    listUsersWithFilters({ page: 1, pageSize: 50 }),
    getUserManagementSummary(),
    readAuditHistory(),
    supabase
      .from('organizations')
      .select('id,name_en,name_ar,is_active')
      .eq('id', organizationId)
      .limit(1)
      .maybeSingle(),
    supabase
      .from('divisions')
      .select('id,organization_id,code,name_en,name_ar,is_active')
      .eq('organization_id', organizationId)
      .order('name_en', { ascending: true })
      .limit(500),
    supabase
      .from('departments')
      .select('id,organization_id,division_id,code,name_en,name_ar,is_active,archived_at')
      .eq('organization_id', organizationId)
      .order('name_en', { ascending: true })
      .limit(1000),
  ]);

  const messages = [
    messageFor('User register', usersResult.status, usersResult.message),
    messageFor('User summary', summaryResult.status, summaryResult.message),
    messageFor('Administrative history', auditResult.status, auditResult.message),
    organizationResult.error ? 'Organization: governed data is not available for the current session.' : null,
    divisionsResult.error ? 'Divisions: governed data is not available for the current session.' : null,
    departmentsResult.error ? 'Departments: governed data is not available for the current session.' : null,
  ].filter((message): message is string => Boolean(message));

  return {
    users: usersResult.status === 'live' ? usersResult.data : [],
    summary: summaryResult.status === 'live' ? summaryResult.data : null,
    audit: auditResult.status === 'live' ? auditResult.data : [],
    organization: organizationResult.error
      ? null
      : (organizationResult.data as Ui8OrganizationRow | null),
    divisions: divisionsResult.error ? [] : (divisionsResult.data as Ui8DivisionRow[] ?? []),
    departments: departmentsResult.error ? [] : (departmentsResult.data as Ui8DepartmentRow[] ?? []),
    messages,
    loadedAt: new Date().toISOString(),
  };
}

