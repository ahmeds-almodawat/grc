import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  isPostPasswordRoleActivationRecoveryCandidate,
} from '../../src/pages/UserManagementCenter';
import type { UserProvisioningRow } from '../../src/lib/userCredentialApi';
import type { UserManagementUserRow } from '../../src/lib/userManagementApi';

const root = process.cwd();

function source(relativePath: string) {
  return readFileSync(path.join(root, relativePath), 'utf8').replace(/\r\n/g, '\n');
}

const ui = source('src/pages/UserManagementCenter.tsx');
const credentialApi = source('src/lib/userCredentialApi.ts');
const modal = source('src/components/Modal.tsx');
const styles = source('src/styles.css');
const translations = source('src/i18n/I18nContext.tsx');

function provisioningQueueSection() {
  const start = ui.indexOf('<Modal\n        open={provisioningOpen}');
  const end = ui.indexOf('<Modal\n        open={Boolean(resetUser)}', start);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  return ui.slice(start, end);
}

const organizationId = '11111111-1111-4111-8111-111111111111';
const userId = '22222222-2222-4222-8222-222222222222';

function recoveryRow(overrides: Partial<UserProvisioningRow> = {}): UserProvisioningRow {
  return {
    id: '33333333-3333-4333-8333-333333333333',
    import_batch_id: '44444444-4444-4444-8444-444444444444',
    import_row_id: '55555555-5555-4555-8555-555555555555',
    employee_id: 'H3-EMPLOYEE',
    auth_email: 'h3-employee@example.test',
    contact_email: null,
    account_action: 'create',
    full_name_en: 'H3 Employee',
    full_name_ar: null,
    phone: null,
    department_id: '66666666-6666-4666-8666-666666666666',
    department_code: 'H3',
    job_title: 'Employee',
    requested_role: 'employee',
    requested_scope: 'assigned_only',
    requested_user_type: 'employee',
    requested_lifecycle: 'active',
    provisioning_status: 'initial_change_required',
    attempt_count: 1,
    last_error_code: null,
    last_error_message: null,
    profile_id: userId,
    created_at: '2026-08-08T00:00:00.000Z',
    updated_at: '2026-08-08T00:00:00.000Z',
    ...overrides,
  };
}

function recoveryUser(overrides: Partial<UserManagementUserRow> = {}): UserManagementUserRow {
  return {
    organization_id: organizationId,
    user_id: userId,
    employee_no: 'H3-EMPLOYEE',
    full_name_en: 'H3 Employee',
    full_name_ar: null,
    email: 'h3-employee@example.test',
    auth_email: 'h3-employee@example.test',
    contact_email: null,
    phone: null,
    job_title: 'Employee',
    user_type: 'employee',
    user_status: 'invited',
    is_active: true,
    created_at: '2026-08-08T00:00:00.000Z',
    updated_at: null,
    last_login_at: null,
    last_reviewed_at: null,
    deactivated_at: null,
    deactivated_by: null,
    deactivation_reason: null,
    division_id: null,
    division_name: null,
    department_id: '66666666-6666-4666-8666-666666666666',
    department_code: 'H3',
    department_name: 'H3',
    department_name_ar: null,
    unit_id: null,
    unit_name: null,
    active_role_count: 0,
    roles: [{
      user_role_id: '77777777-7777-4777-8777-777777777777',
      role: 'employee',
      scope: 'assigned_only',
      organization_id: organizationId,
      division_id: null,
      department_id: null,
      unit_id: null,
      is_active: false,
      assigned_at: '2026-08-08T00:00:00.000Z',
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
    synthetic_auth_email: 'h3-employee@example.test',
    credential_state: 'active',
    credential_version: 3,
    must_change_password: false,
    last_password_reset_at: null,
    last_password_changed_at: '2026-08-08T00:00:00.000Z',
    provisioning_state: 'initial_change_required',
    credential_proof_available: true,
    ...overrides,
  };
}

describe('Patch 83U Provisioning Queue UI contract', () => {
  it('uses the existing i18n context and exact required Arabic labels', () => {
    expect(ui).toContain('const { language, direction, t } = useI18n();');
    expect(translations).toContain(
      "'userManagement.provisioningQueue.title': { en: 'Provisioning Queue', ar: 'قائمة تجهيز حسابات المستخدمين' }",
    );
    expect(translations).toContain(
      "'userManagement.provisioningQueue.close': { en: 'Close', ar: 'إغلاق' }",
    );
    expect(translations).toContain(
      "'userManagement.provisioningQueue.warning': { en: 'Super Admin must explicitly provision or reconcile one protected record at a time.', ar: 'يجب على مدير النظام تجهيز أو مطابقة سجل محمي واحد في كل مرة.' }",
    );

    for (const arabicLabel of [
      'الموظف',
      'الرقم الوظيفي',
      'بريد تسجيل الدخول',
      'القسم',
      'الصلاحية المطلوبة',
      'إجراء الحساب',
      'حالة المستخدم',
      'الحالة',
      'المحاولات',
      'الإجراء المحمي',
      'تجهيز الحساب',
      'مطابقة الحساب',
      'قيد الانتظار',
      'يلزم تغيير كلمة المرور',
      'مكتمل',
      'نشط',
      'إنشاء',
      'موظف',
      'المسندة إليه فقط',
      'لا يوجد إجراء',
    ]) {
      expect(translations).toContain(`ar: '${arabicLabel}'`);
    }
  });

  it('keeps the requested RTL column order and translates display values only', () => {
    const queue = provisioningQueueSection();
    const headerKeys = [
      'header.employee',
      'header.employeeId',
      'header.authEmail',
      'header.department',
      'header.requestedAccess',
      'header.accountAction',
      'header.lifecycle',
      'header.status',
      'header.attempts',
      'header.controlledAction',
    ];
    let previousIndex = -1;
    for (const key of headerKeys) {
      const index = queue.indexOf(`userManagement.provisioningQueue.${key}`);
      expect(index).toBeGreaterThan(previousIndex);
      previousIndex = index;
    }

    expect(queue).toContain(
      '`userManagement.provisioningQueue.role.${row.requested_role}`',
    );
    expect(queue).toContain(
      '`userManagement.provisioningQueue.scope.${row.requested_scope}`',
    );
    expect(queue).toContain(
      '`userManagement.provisioningQueue.accountAction.${row.account_action}`',
    );
    expect(queue).toContain(
      '`userManagement.provisioningQueue.lifecycle.${row.requested_lifecycle}`',
    );
    expect(queue).toContain(
      '`userManagement.provisioningQueue.status.${row.provisioning_status}`',
    );

    expect(queue).toContain('].includes(row.provisioning_status)');
    expect(queue).toContain('chooseProvisioningAction(row, "provision")');
    expect(queue).toContain('chooseProvisioningAction(row, "reconcile")');
    expect(queue).toContain('provisioningConfirmation !== provisioningTarget.row.employee_id');
  });

  it('exposes fail-closed reconciliation for the post-password role-activation state', () => {
    const queue = provisioningQueueSection();
    expect(queue).toContain('isPostPasswordRoleActivationRecoveryCandidate(');
    expect(queue).toContain('canReconcilePostPasswordRoleActivation;');
    expect(
      isPostPasswordRoleActivationRecoveryCandidate(
        recoveryRow(),
        recoveryUser(),
        organizationId,
      ),
    ).toBe(true);
  });

  it.each([
    ['ordinary first-password state', recoveryUser({
      credential_state: 'initial_change_required',
      credential_version: 1,
      must_change_password: true,
    })],
    ['completed provisioning', recoveryUser({
      user_status: 'active',
      provisioning_state: 'completed',
      roles: [{ ...recoveryUser().roles[0], is_active: true }],
      active_role_count: 1,
    })],
    ['ambiguous matching roles', recoveryUser({
      roles: [recoveryUser().roles[0], {
        ...recoveryUser().roles[0],
        user_role_id: '88888888-8888-4888-8888-888888888888',
      }],
    })],
    ['unrelated active role', recoveryUser({
      roles: [recoveryUser().roles[0], {
        ...recoveryUser().roles[0],
        user_role_id: '88888888-8888-4888-8888-888888888888',
        role: 'viewer',
        is_active: true,
      }],
      active_role_count: 1,
    })],
  ])('does not expose the recovery action for %s', (_label, user) => {
    expect(
      isPostPasswordRoleActivationRecoveryCandidate(
        recoveryRow(),
        user,
        organizationId,
      ),
    ).toBe(false);
  });

  it.each([
    ['completed', recoveryRow({ provisioning_status: 'completed' })],
    ['queued', recoveryRow({ provisioning_status: 'queued' })],
    ['wrong role', recoveryRow({ requested_role: 'executive' })],
    ['wrong scope', recoveryRow({ requested_scope: 'global' })],
    ['error state', recoveryRow({ last_error_code: 'PATCH83U_TEST' })],
    ['wrong identity', recoveryRow({ employee_id: 'WRONG' })],
  ])('does not expose the affected-state recovery action for %s', (_label, row) => {
    expect(
      isPostPasswordRoleActivationRecoveryCandidate(
        row,
        recoveryUser(),
        organizationId,
      ),
    ).toBe(false);
  });

  it('keeps reconciliation_required on the existing protected reconciliation action', () => {
    const queue = provisioningQueueSection();
    expect(queue).toContain('"reconciliation_required",');
    expect(queue).toContain('chooseProvisioningAction(row, "reconcile")');
  });

  it('F: prevents every non-Super-Admin invocation even when a row is eligible', () => {
    expect(ui).toContain(
      'const canUsePatch83uProvisioning =\n    hasAuthorizedSuperAdmin && patch83uProvisioningAvailable;',
    );
    expect(ui).toContain('if (!provisioningTarget || !canUsePatch83uProvisioning) return;');
    expect(provisioningQueueSection()).toContain(
      '{!canUsePatch83uProvisioning ? (',
    );
    expect(provisioningQueueSection()).toMatch(
      /!canUsePatch83uProvisioning[\s\S]*provisioningQueue\.action\.none[\s\S]*: canProvision/,
    );
  });

  it('G: invokes only the privileged-action reconciliation bridge', () => {
    const start = credentialApi.indexOf('export async function reconcileProvisioning(');
    const end = credentialApi.indexOf('export async function adminResetPassword(', start);
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    const reconciliation = credentialApi.slice(start, end);

    expect(reconciliation).toContain(
      'invokePrivilegedAction<ReconcileProvisioningResult>(RECONCILE_PROVISIONING_ACTION',
    );
    expect(reconciliation).not.toContain('.rpc(');
    expect(reconciliation).not.toContain('.from(');
    expect(reconciliation).toContain('provisioning_id: validated.provisioningId');
    expect(reconciliation).toContain(
      'employee_id_confirmation: validated.employeeIdConfirmation',
    );
  });

  it('H: keeps reconciliation free of password, credential, token, or secret fields', () => {
    const start = credentialApi.indexOf('export async function reconcileProvisioning(');
    const end = credentialApi.indexOf('export async function adminResetPassword(', start);
    const reconciliation = credentialApi.slice(start, end).toLowerCase();

    expect(reconciliation).not.toMatch(/password|credential|token|secret/);
    expect(provisioningQueueSection()).toMatch(
      /provisioningTarget\.action === "provision"[\s\S]*type="password"/,
    );
  });

  it('applies responsive scrolling only to the provisioning queue dialog', () => {
    const queue = provisioningQueueSection();
    expect(queue).toContain('className="provisioning-queue-dialog"');
    expect(queue).toContain('direction={direction}');
    expect(queue).toContain('className="provisioning-queue-table-scroll"');
    expect(queue).toContain('tabIndex={0}');

    expect(styles).toMatch(
      /\.provisioning-queue-dialog\s*\{[\s\S]*width:\s*min\(95vw,\s*1500px\);[\s\S]*height:\s*90dvh;[\s\S]*overflow:\s*hidden;/,
    );
    expect(styles).toMatch(
      /\.provisioning-queue-table-scroll\s*\{[\s\S]*overflow:\s*auto;/,
    );
    expect(styles).toMatch(
      /\.provisioning-queue-table th\s*\{[\s\S]*position:\s*sticky;[\s\S]*top:\s*0;/,
    );
    expect(styles).toContain('inset-inline-start: 0;');
    expect(styles).toContain('inset-inline-end: 0;');
    expect(styles).toContain('@media (max-width: 640px)');
    expect(styles).toContain('width: calc(100vw - 12px);');
  });

  it('extends the shared Modal only through optional, backward-compatible props', () => {
    expect(modal).toContain('className?: string;');
    expect(modal).toContain('closeLabel?: string;');
    expect(modal).toContain("direction?: 'ltr' | 'rtl';");
    expect(modal).toContain('headerDescription?: ReactNode;');
    expect(modal).toContain("className = ''");
    expect(modal).toContain('closeLabel?: string;');
    expect(modal).toContain("const resolvedCloseLabel = closeLabel ?? i18n.t('common.close');");
    expect(modal).toContain('aria-label={resolvedCloseLabel}');
    expect(modal).toContain('{resolvedCloseLabel}');
  });
});
