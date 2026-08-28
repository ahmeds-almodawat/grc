import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { canAccessPageForUser, pageGroups } from '../../src/auth/authAccess';
import type { AuthRoleAssignment } from '../../src/auth/authTypes';
import { PAGE_LOCATION_REGISTRY } from '../../src/routes/pageLocation';
import type { PageKey } from '../../src/components/Layout';

const employeeRoles: AuthRoleAssignment[] = [{
  role: 'employee',
  scope: 'assigned_only',
}];

const employeePages = (Object.keys(PAGE_LOCATION_REGISTRY) as PageKey[])
  .filter((page) => canAccessPageForUser(page, employeeRoles));

function source(relativePath: string) {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
}

describe('Patch 83U Employee Arabic localization contract', () => {
  it('derives the complete Employee surface from the canonical access registry', () => {
    expect(employeePages).toEqual([
      'home',
      'myWork',
      'projects',
      'ovr',
      'approvals',
      'evidence',
      'userGuide',
      'globalSearch',
    ]);
    expect(employeePages.map((page) => pageGroups[page])).toEqual([
      'home',
      'personal',
      'work',
      'personal',
      'personal',
      'personal',
      'personal',
      'personal',
    ]);
  });

  it('keeps route, role and stored-value contracts separate from display translations', () => {
    const translations = source('src/i18n/I18nContext.tsx');
    const layout = source('src/components/Layout.tsx');

    expect(translations).toContain("'role.employee': { en: 'Employee', ar: 'موظف' }");
    expect(translations).toContain("'navTree.item.myWork': { en: 'My Work', ar: 'أعمالي' }");
    expect(translations).toContain("'navTree.item.ovr': { en: 'OVR / Incidents', ar: 'بلاغات OVR / الحوادث' }");
    expect(translations).toContain("'status.queued': { en: 'Queued', ar: 'قيد الانتظار' }");
    expect(layout).toContain('t(item.labelKey ?? `navTree.item.${item.key}`, item.label)');
    expect(layout).toContain('t(`role.${auth.primaryRole}`');
    expect(layout).not.toContain('language === "ar" ? "خروج" : "Sign out"');
  });

  it('records the pre-edit inventory before the localized source correction', () => {
    const audit = source('release/patch83u/employee-arabic-localization-audit.md');

    // This file is an immutable pre-v1.3 inventory. Projects entered the
    // assigned Employee surface later through ACC-05 and is covered by the
    // current stabilization contract instead of rewriting historical evidence.
    for (const page of employeePages.filter(page => page !== 'projects')) {
      expect(audit).toContain(`\`${page}\``);
    }
    expect(audit).toContain('**268**');
    expect(audit).toContain('pre-edit Phase 1 inventory');
  });

  it('provides RTL direction and bounded Employee-surface overflow rules', () => {
    const styles = source('src/styles.css');
    const modal = source('src/components/Modal.tsx');

    expect(styles).toContain('PATCH 83U Phase 1: Employee Arabic/RTL presentation only.');
    expect(styles).toContain('.rtl-shell .sidebar-nav-tree button');
    expect(styles).toContain('overscroll-behavior-inline: contain');
    expect(modal).toContain("closeLabel ?? i18n.t('common.close')");
    expect(modal).toContain('direction ?? i18n.direction');
  });
});
