import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { humanize } from '../../src/lib/format';

const rootDir = path.resolve(__dirname, '../..');

function source(relativePath: string) {
  return fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
}

describe('GRC v1.4-G Arabic and RTL completion contract', () => {
  it('localizes stored workflow values without changing their persisted values', () => {
    expect(humanize('pending_review', 'en')).toBe('Pending Review');
    expect(humanize('pending_review', 'ar')).toBe('بانتظار المراجعة');
    expect(humanize('governance_admin', 'ar')).toBe('مدير الحوكمة');
    expect(humanize('assigned_only', 'ar')).toBe('المسند إليه فقط');
  });

  it('switches the document language and direction from the shared provider', () => {
    const i18n = source('src/i18n/I18nContext.tsx');
    const layout = source('src/components/Layout.tsx');

    expect(i18n).toContain("const direction = language === 'ar' ? 'rtl' : 'ltr'");
    expect(i18n).toContain('document.documentElement.dir = direction');
    expect(layout).toContain('direction === "rtl" ? "rtl-shell" : ""');
    expect(layout).toContain('dir={direction}');
  });

  it('covers representative Risk, Audit, Policy/SOP, and User Management states in Arabic', () => {
    const i18n = source('src/i18n/I18nContext.tsx');

    for (const arabicText of [
      'لا توجد عناصر في سير عمل المخاطر',
      'لا توجد عناصر متأخرة في سير عمل التدقيق',
      'جارٍ تحميل سجل إجراءات التشغيل القياسية',
      'معاينة استيراد مستخدمي Excel',
    ]) {
      expect(i18n).toContain(arabicText);
    }
  });

  it('uses localized modal, empty-state, accessibility, and directional-icon controls', () => {
    const users = source('src/pages/UserManagementCenter.tsx');
    const audit = source('src/pages/Audit.tsx');
    const styles = source('src/styles.css');

    expect(users).toContain("title={t('userManagement.importPreviewTitle')}");
    expect(users).toContain("aria-label={t('userManagement.importPreviewLabel')}");
    expect(audit).toContain("emptyTitle={t('audit.g.noOverdueItems'");
    expect(styles).toContain('[dir="rtl"] .directional-icon');
    expect(styles).toContain('transform: scaleX(-1)');
  });

  it('keeps dashboard source outside the v1.4-G implementation contract', () => {
    const changedSurface = [
      'src/pages/Governance.tsx',
      'src/pages/Risks.tsx',
      'src/pages/Audit.tsx',
      'src/pages/UserManagementCenter.tsx',
    ];

    expect(changedSurface).not.toContain('src/pages/Dashboard.tsx');
    expect(changedSurface).not.toContain('src/pages/ModernExecutiveDashboard.tsx');
    expect(source('src/pages/Dashboard.tsx')).not.toContain('v1.4-G non-dashboard localization completion');
  });
});
