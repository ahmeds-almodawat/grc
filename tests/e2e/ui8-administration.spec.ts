import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { PAGE_LOCATION_REGISTRY } from '../../src/routes/pageLocation';
import { installPatch83vBackend, type Patch83vBackend, type Patch83vRole } from './patch83vTestHarness';
import { startPatch83uTestServer, type Patch83uTestServer } from './patch83uTestServer';
import { installUi8FixtureData, type Ui8FixtureProof } from './ui8Fixtures';

let server: Patch83uTestServer | null = null;
let baseUrl = '';

async function prepare(
  page: Page,
  role: Patch83vRole = 'super_admin',
): Promise<{ backend: Patch83vBackend; fixture: Ui8FixtureProof }> {
  const backend = await installPatch83vBackend(page, role);
  const fixture = await installUi8FixtureData(page);
  await page.addInitScript(() => {
    localStorage.setItem('grc-language', 'en');
    localStorage.setItem('grc-theme', 'light');
    localStorage.removeItem('grc-sidebar-collapsed');
  });
  return { backend, fixture };
}

async function openAdministration(page: Page) {
  await page.goto(`${baseUrl}/?page=${PAGE_LOCATION_REGISTRY.adminHub}`);
  await expect(page.getByTestId('ui8-administration-center')).toBeVisible();
  await expect(page.getByTestId('ui8-admin-overview')).toBeVisible();
}

async function capture(page: Page, testInfo: TestInfo, name: string) {
  await page.screenshot({ path: testInfo.outputPath(`${name}.png`), animations: 'disabled', fullPage: true });
}

async function noOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
}

async function tab(page: Page, name: string, testId: string) {
  await page.getByRole('navigation', { name: 'Administration views' }).getByRole('button', { name, exact: true }).click();
  await expect(page.getByTestId(testId)).toBeVisible();
}

test.describe('UI-8 governed Administration', () => {
  test.describe.configure({ mode: 'serial' });
  test.setTimeout(300_000);

  test.beforeAll(async () => {
    server = await startPatch83uTestServer({
      VITE_PATCH83U_CREDENTIAL_GOVERNANCE_ENABLED: 'true',
      VITE_PATCH83T_USER_EXCEL_IMPORT_ENABLED: 'true',
    });
    baseUrl = server.baseUrl;
  });

  test.afterAll(() => {
    server?.stop();
    server = null;
  });

  test('covers the complete 15-series in light, dark, responsive and RTL states', async ({ page }, testInfo) => {
    const { backend, fixture } = await prepare(page);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await openAdministration(page);
    await expect(page.getByText('Total users').locator('..')).toContainText('11');
    await expect(page.getByText('Recent administrative activity')).toBeVisible();
    await noOverflow(page);
    await capture(page, testInfo, '01-admin-overview-light-1440');

    await page.getByRole('combobox', { name: 'Appearance theme' }).selectOption('dark');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await capture(page, testInfo, '02-admin-overview-dark-1440');
    await page.getByRole('combobox', { name: 'Appearance theme' }).selectOption('light');

    await page.setViewportSize({ width: 1024, height: 900 });
    await noOverflow(page);
    await capture(page, testInfo, '03-admin-overview-1024');
    await page.setViewportSize({ width: 768, height: 900 });
    await noOverflow(page);
    await capture(page, testInfo, '04-admin-overview-768');
    await page.setViewportSize({ width: 390, height: 844 });
    await noOverflow(page);
    await capture(page, testInfo, '05-admin-overview-mobile-390');
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.locator('.topbar-language').click();
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByText('النشاط الإداري الأخير')).toBeVisible();
    await noOverflow(page);
    await capture(page, testInfo, '06-admin-overview-arabic-rtl-390');
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.locator('.topbar-language').click();
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');

    await tab(page, 'Users & Access', 'ui8-admin-users');
    await expect(page.getByText('Maha Al Harbi', { exact: true })).toBeVisible();
    await expect(page.getByText('Password Change Required', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create user' })).toBeDisabled();
    await capture(page, testInfo, '07-user-register');
    await page.getByRole('combobox', { name: 'Filter by lifecycle status' }).selectOption('inactive');
    await expect(page.getByText('Lina Al Shammari', { exact: true })).toBeVisible();
    await capture(page, testInfo, '08-user-register-inactive');
    await page.getByRole('combobox', { name: 'Filter by lifecycle status' }).selectOption('all');
    await page.locator('tr').filter({ hasText: 'Abeer Al Anazi' }).getByRole('button', { name: 'View details' }).click();
    await expect(page.getByTestId('ui8-user-detail')).toBeVisible();
    await expect(page.getByText('Employee Id Managed', { exact: true })).toBeVisible();
    await capture(page, testInfo, '09-user-details');
    await page.getByRole('button', { name: 'Close' }).click();
    await page.getByRole('combobox', { name: 'Appearance theme' }).selectOption('dark');
    await page.locator('tr').filter({ hasText: 'Abeer Al Anazi' }).getByRole('button', { name: 'View details' }).click();
    await capture(page, testInfo, '10-user-details-dark');
    await page.getByRole('button', { name: 'Close' }).click();
    await page.getByRole('combobox', { name: 'Appearance theme' }).selectOption('light');

    await tab(page, 'Roles & Permissions', 'ui8-admin-roles');
    await expect(page.locator('.ui8-role-grid article')).toHaveCount(12);
    await expect(page.getByText('Last-admin protected')).toBeVisible();
    await expect(page.getByText('Department Manager', { exact: true }).first()).toBeVisible();
    await capture(page, testInfo, '11-role-scope-governance');
    await page.setViewportSize({ width: 390, height: 844 });
    await noOverflow(page);
    await capture(page, testInfo, '12-role-scope-mobile-390');

    await page.setViewportSize({ width: 1440, height: 1000 });
    await tab(page, 'Organizations', 'ui8-admin-organization');
    await expect(page.getByText('Clinical Affairs', { exact: true })).toBeVisible();
    await expect(page.getByText('Legacy Operations', { exact: true })).toBeVisible();
    await capture(page, testInfo, '13-organization-division-department');
    await page.locator('.topbar-language').click();
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await page.setViewportSize({ width: 390, height: 844 });
    await noOverflow(page);
    await capture(page, testInfo, '14-organization-arabic-rtl-390');
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.locator('.topbar-language').click();

    await tab(page, 'Integrations', 'ui8-admin-integrations');
    await expect(page.getByText('External provider administration')).toBeVisible();
    await expect(page.locator('[data-actionability="disabled_with_reason"]').first()).toBeVisible();
    await capture(page, testInfo, '15-integrations-safe-metadata');
    await tab(page, 'System Settings', 'ui8-admin-settings');
    await expect(page.getByText('Build-time configuration is read-only and is not a runtime Admin toggle.')).toBeVisible();
    await capture(page, testInfo, '16-system-settings-read-only');
    await tab(page, 'Notifications', 'ui8-admin-notifications');
    await expect(page.getByText('System notification policy')).toBeVisible();
    await capture(page, testInfo, '17-notifications-disabled-reason');
    await tab(page, 'Audit Logs', 'ui8-admin-audit');
    await expect(page.getByText('Credential Provisioning Prepared', { exact: true })).toBeVisible();
    await capture(page, testInfo, '18-administrative-history');
    await tab(page, 'Data Management', 'ui8-admin-data');
    await expect(page.getByText('User onboarding')).toBeVisible();
    await expect(page.getByText('Dry-run and validation')).toBeVisible();
    await capture(page, testInfo, '19-controlled-import-onboarding');
    await page.getByRole('combobox', { name: 'Appearance theme' }).selectOption('dark');
    await capture(page, testInfo, '20-controlled-import-dark');
    await page.getByRole('combobox', { name: 'Appearance theme' }).selectOption('light');
    await tab(page, 'System Information', 'ui8-admin-system');
    await expect(page.getByText('216_ui7_my_work_training_read_contract.sql')).toBeVisible();
    await capture(page, testInfo, '21-system-information');

    await page.getByRole('navigation', { name: 'Administration views' }).getByRole('button', { name: 'System Overview' }).focus();
    await expect(page.getByRole('navigation', { name: 'Administration views' }).getByRole('button', { name: 'System Overview' })).toBeFocused();
    await capture(page, testInfo, '22-keyboard-focus');

    await page.goto(`${baseUrl}/?page=${PAGE_LOCATION_REGISTRY.admin}`);
    await expect(page.getByText('Maha Al Harbi', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'More actions for Maha Al Harbi' }).click();
    await page.getByRole('button', { name: 'Deactivate user' }).click();
    await expect(page.getByRole('dialog', { name: 'Confirm user lifecycle action' })).toBeVisible();
    await expect(page.getByText(/Hard user deletion is not used/)).toBeVisible();
    await capture(page, testInfo, '25-dangerous-user-lifecycle-confirmation');
    await page.getByRole('dialog', { name: 'Confirm user lifecycle action' }).getByRole('button', { name: 'Cancel' }).click();

    await page.getByRole('button', { name: 'Import Excel' }).click();
    const importDialog = page.getByRole('dialog', { name: 'Preview User Excel Import' });
    await expect(importDialog.locator('#user-workbook-input')).toBeEnabled();
    await importDialog.locator('#user-workbook-input').setInputFiles({
      name: 'invalid-ui8-users.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: Buffer.from('not a valid workbook'),
    });
    await expect(importDialog).toContainText('corrupt or is not a valid Excel .xlsx workbook');
    await capture(page, testInfo, '26-import-validation-error');

    expect(fixture.protectedReadHeaders.length).toBeGreaterThan(0);
    expect(fixture.protectedReadHeaders.every((value) => value === 'patch83u-frontend-auth-first-v1')).toBe(true);
    expect(backend.proof.writeRequests).toEqual([]);
    expect(backend.proof.pageErrors).toEqual([]);
    expect(backend.proof.consoleProblems).toEqual([]);
    const body = await page.locator('body').innerText();
    expect(body).not.toMatch(/service[- ]role|refresh token|access token|jwt signing|database password/i);
  });

  test('governance admin remains action-scoped and safety controls stay permission-gated', async ({ page }, testInfo) => {
    const { backend } = await prepare(page, 'governance_admin');
    await page.setViewportSize({ width: 1440, height: 1000 });
    await openAdministration(page);
    await tab(page, 'Audit Logs', 'ui8-admin-audit');
    await expect(page.getByText('Permission-gated')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Open safety console' })).toHaveCount(0);
    await capture(page, testInfo, '23-governance-admin-permission-gate');
    expect(backend.proof.writeRequests).toEqual([]);
  });

  test('viewer cannot open Administration even with a known canonical URL', async ({ page }, testInfo) => {
    const { backend } = await prepare(page, 'viewer');
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(`${baseUrl}/?page=${PAGE_LOCATION_REGISTRY.adminHub}`);
    await expect(page.getByTestId('ui8-administration-center')).toHaveCount(0);
    await expect(page).toHaveURL(new RegExp(`[?&]page=${PAGE_LOCATION_REGISTRY.home}`));
    await capture(page, testInfo, '24-viewer-admin-route-denied');
    expect(backend.proof.writeRequests).toEqual([]);
  });
});
