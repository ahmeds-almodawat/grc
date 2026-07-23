import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();

function source(relativePath: string) {
  return readFileSync(path.join(root, relativePath), 'utf8').replace(/\r\n/g, '\n');
}

const ui = source('src/pages/UserManagementCenter.tsx');
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
