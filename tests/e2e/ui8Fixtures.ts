import type { Page, Route } from '@playwright/test';

const ORG_ID = '00000000-0000-4000-8000-000000000083';
const DIV_CLINICAL = '00000000-0000-4000-8000-000000000011';
const DIV_CORPORATE = '00000000-0000-4000-8000-000000000012';
const DEPT_QUALITY = '00000000-0000-4000-8000-000000000021';
const DEPT_CLINICAL = '00000000-0000-4000-8000-000000000022';
const DEPT_IT = '00000000-0000-4000-8000-000000000023';
const DEPT_ARCHIVED = '00000000-0000-4000-8000-000000000024';

type FixtureRole = {
  user_role_id: string;
  role: string;
  scope: string;
  organization_id: string | null;
  division_id: string | null;
  department_id: string | null;
  unit_id: string | null;
  is_active: boolean;
  assigned_at: string;
};

function role(
  id: string,
  name: string,
  scope: string,
  target: { division?: string; department?: string } = {},
): FixtureRole {
  return {
    user_role_id: id,
    role: name,
    scope,
    organization_id: scope === 'global' ? ORG_ID : ORG_ID,
    division_id: target.division ?? null,
    department_id: target.department ?? null,
    unit_id: null,
    is_active: true,
    assigned_at: '2026-08-01T08:00:00.000Z',
  };
}

function user(
  id: string,
  employeeNo: string,
  name: string,
  nameAr: string,
  status: string,
  roles: FixtureRole[],
  options: {
    departmentId?: string | null;
    department?: string | null;
    departmentAr?: string | null;
    divisionId?: string | null;
    division?: string | null;
    job?: string;
    credentialState?: string;
    mustChange?: boolean;
  } = {},
) {
  const active = status === 'active' || status === 'invited';
  return {
    organization_id: ORG_ID,
    user_id: id,
    employee_no: employeeNo,
    full_name_en: name,
    full_name_ar: nameAr,
    email: `${employeeNo}@almodawat.test`,
    auth_email: `${employeeNo}@almodawat.test`,
    contact_email: `${employeeNo}.contact@example.test`,
    phone: '+966500000000',
    job_title: options.job ?? 'Governance specialist',
    user_type: 'employee',
    user_status: status,
    is_active: active,
    created_at: '2026-01-15T08:00:00.000Z',
    updated_at: '2026-08-20T08:00:00.000Z',
    last_login_at: status === 'invited' ? null : '2026-08-22T12:15:00.000Z',
    last_reviewed_at: '2026-08-20T08:00:00.000Z',
    deactivated_at: active ? null : '2026-08-10T08:00:00.000Z',
    deactivated_by: active ? null : '00000000-0000-4000-8000-000000000099',
    deactivation_reason: active ? null : 'Employment lifecycle change approved by HR.',
    division_id: options.divisionId ?? DIV_CLINICAL,
    division_name: options.division ?? 'Clinical Affairs',
    department_id: options.departmentId === undefined ? DEPT_QUALITY : options.departmentId,
    department_code: options.departmentId === null ? null : 'QPS',
    department_name: options.department === undefined ? 'Quality & Patient Safety' : options.department,
    department_name_ar: options.departmentAr === undefined ? 'الجودة وسلامة المرضى' : options.departmentAr,
    unit_id: null,
    unit_name: null,
    active_role_count: roles.length,
    roles,
    linked_project_count: 2,
    linked_task_count: 4,
    linked_approval_count: 1,
    linked_evidence_count: 3,
    open_project_count: 1,
    open_task_count: 2,
    pending_approval_count: 1,
    managed_identity: true,
    identity_mode: 'employee_id_managed',
    synthetic_auth_email: `${employeeNo}@almodawat.test`,
    credential_state: options.credentialState ?? 'active',
    credential_version: 3,
    must_change_password: options.mustChange ?? false,
    last_password_reset_at: options.mustChange ? '2026-08-21T08:00:00.000Z' : '2026-07-10T08:00:00.000Z',
    last_password_changed_at: options.mustChange ? null : '2026-07-10T09:00:00.000Z',
    provisioning_state: options.mustChange ? 'password_change_required' : 'completed',
    credential_proof_available: true,
  };
}

export const ui8Users = [
  user('ui8-user-01', '100001', 'Maha Al Harbi', 'مها الحربي', 'active', [role('role-01', 'super_admin', 'global')], { job: 'System Administration Lead' }),
  user('ui8-user-02', '100002', 'Faisal Al Qahtani', 'فيصل القحطاني', 'active', [role('role-02', 'executive', 'global')], { job: 'Chief Executive Officer' }),
  user('ui8-user-03', '100003', 'Noura Al Otaibi', 'نورة العتيبي', 'active', [role('role-03', 'governance_admin', 'global'), role('role-04', 'auditor', 'global')], { job: 'Governance Director' }),
  user('ui8-user-04', '100004', 'Omar Al Zahrani', 'عمر الزهراني', 'active', [role('role-05', 'division_head', 'division', { division: DIV_CLINICAL })], { job: 'Clinical Affairs Director' }),
  user('ui8-user-05', '100005', 'Reem Al Ghamdi', 'ريم الغامدي', 'active', [role('role-06', 'department_manager', 'department', { department: DEPT_QUALITY })], { job: 'Quality Manager' }),
  user('ui8-user-06', '100006', 'Saad Al Mutairi', 'سعد المطيري', 'active', [role('role-07', 'project_owner', 'assigned_only'), role('role-08', 'task_owner', 'assigned_only')], { job: 'Improvement Program Manager' }),
  user('ui8-user-07', '100007', 'Lina Al Shammari', 'لينا الشمري', 'inactive', [role('role-09', 'employee', 'assigned_only')], { job: 'Quality Coordinator' }),
  user('ui8-user-08', '100008', 'Yousef Al Dosari', 'يوسف الدوسري', 'active', [role('role-10', 'viewer', 'assigned_only')], { job: 'Read-only Reviewer' }),
  user('ui8-user-09', '100009', 'Abeer Al Anazi', 'عبير العنزي', 'invited', [role('role-11', 'compliance_officer', 'global')], { job: 'Compliance Officer', credentialState: 'password_change_required', mustChange: true }),
  user('ui8-user-10', '100010', 'Hassan Al Amri', 'حسن العمري', 'locked', [role('role-12', 'milestone_owner', 'assigned_only')], { job: 'Program Analyst' }),
  user('ui8-user-11', '100011', 'Rana Al Subaie', 'رنا السبيعي', 'archived', [role('role-13', 'employee', 'assigned_only')], { job: 'Former Employee' }),
];

export const ui8Audit = [
  { id: 'audit-01', organization_id: ORG_ID, target_user_id: 'ui8-user-09', actor_id: 'ui8-user-01', action: 'credential_provisioning_prepared', reason: 'Approved onboarding batch UI8-0041.', old_data: null, new_data: null, linked_record_count: 1, created_at: '2026-08-22T14:10:00.000Z' },
  { id: 'audit-02', organization_id: ORG_ID, target_user_id: 'ui8-user-05', actor_id: 'ui8-user-03', action: 'role_assigned', reason: 'Quality department manager authority approved.', old_data: null, new_data: null, linked_record_count: 1, created_at: '2026-08-22T12:35:00.000Z' },
  { id: 'audit-03', organization_id: ORG_ID, target_user_id: 'ui8-user-07', actor_id: 'ui8-user-01', action: 'user_deactivated', reason: 'Employment lifecycle change approved by HR.', old_data: null, new_data: null, linked_record_count: 6, created_at: '2026-08-21T09:20:00.000Z' },
  { id: 'audit-04', organization_id: ORG_ID, target_user_id: 'ui8-user-06', actor_id: 'ui8-user-03', action: 'department_changed', reason: 'Operating model reassignment.', old_data: null, new_data: null, linked_record_count: 4, created_at: '2026-08-20T11:00:00.000Z' },
  { id: 'audit-05', organization_id: ORG_ID, target_user_id: 'ui8-user-03', actor_id: 'ui8-user-01', action: 'role_reviewed', reason: 'Quarterly privileged-access recertification.', old_data: null, new_data: null, linked_record_count: 2, created_at: '2026-08-19T15:30:00.000Z' },
];

export const ui8Divisions = [
  { id: DIV_CLINICAL, organization_id: ORG_ID, code: 'CLIN', name_en: 'Clinical Affairs', name_ar: 'الشؤون السريرية', is_active: true },
  { id: DIV_CORPORATE, organization_id: ORG_ID, code: 'CORP', name_en: 'Corporate Services', name_ar: 'الخدمات المؤسسية', is_active: true },
];

export const ui8Departments = [
  { id: DEPT_QUALITY, organization_id: ORG_ID, division_id: DIV_CLINICAL, code: 'QPS', name_en: 'Quality & Patient Safety', name_ar: 'الجودة وسلامة المرضى', is_active: true, archived_at: null },
  { id: DEPT_CLINICAL, organization_id: ORG_ID, division_id: DIV_CLINICAL, code: 'CLN', name_en: 'Clinical Operations', name_ar: 'العمليات السريرية', is_active: true, archived_at: null },
  { id: DEPT_IT, organization_id: ORG_ID, division_id: DIV_CORPORATE, code: 'IT', name_en: 'Information Technology', name_ar: 'تقنية المعلومات', is_active: true, archived_at: null },
  { id: DEPT_ARCHIVED, organization_id: ORG_ID, division_id: DIV_CORPORATE, code: 'LEG', name_en: 'Legacy Operations', name_ar: 'العمليات السابقة', is_active: false, archived_at: '2026-07-01T08:00:00.000Z' },
];

export interface Ui8FixtureProof {
  protectedReadHeaders: string[];
}

function parseBody(route: Route) {
  try {
    return JSON.parse(route.request().postData() ?? '{}') as Record<string, unknown>;
  } catch {
    return {};
  }
}

async function fulfill(route: Route, body: unknown) {
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    headers: { 'access-control-allow-origin': '*', 'content-range': '0-49/*' },
    body: JSON.stringify(body),
  });
}

export async function installUi8FixtureData(page: Page): Promise<Ui8FixtureProof> {
  const proof: Ui8FixtureProof = { protectedReadHeaders: [] };
  await page.route('**/functions/v1/privileged-action', async (route) => {
    const body = parseBody(route);
    if (body.action !== 'list_user_management_roster') {
      await route.fallback();
      return;
    }
    const payload = (body.payload ?? {}) as Record<string, unknown>;
    const targetUser = typeof payload.user_id === 'string' ? payload.user_id : null;
    const result = targetUser ? ui8Users.filter((row) => row.user_id === targetUser) : ui8Users;
    await fulfill(route, { ok: true, action: body.action, result });
  });

  await page.route('**/rest/v1/**', async (route) => {
    const url = new URL(route.request().url());
    const table = url.pathname.split('/').pop() ?? '';
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }
    proof.protectedReadHeaders.push(route.request().headers()['x-patch83u-frontend-contract-version'] ?? '');
    if (table === 'v_user_management_summary') {
      await fulfill(route, [{
        organization_id: ORG_ID,
        total_users: ui8Users.length,
        active_users: ui8Users.filter((row) => row.user_status === 'active').length,
        inactive_users: ui8Users.filter((row) => row.user_status === 'inactive').length,
        archived_users: ui8Users.filter((row) => row.user_status === 'archived').length,
        invited_users: ui8Users.filter((row) => row.user_status === 'invited').length,
        locked_users: ui8Users.filter((row) => row.user_status === 'locked').length,
        missing_department_users: 0,
        missing_role_users: 0,
        pending_setup_users: 1,
      }]);
      return;
    }
    if (table === 'user_management_audit_history') {
      await fulfill(route, ui8Audit);
      return;
    }
    if (table === 'organizations') {
      await fulfill(route, { id: ORG_ID, name_en: 'Al Modawat Specialized Medical Company', name_ar: 'شركة المداواة التخصصية الطبية', is_active: true });
      return;
    }
    if (table === 'divisions') {
      await fulfill(route, ui8Divisions);
      return;
    }
    if (table === 'departments') {
      await fulfill(route, ui8Departments);
      return;
    }
    await route.fallback();
  });
  return proof;
}
