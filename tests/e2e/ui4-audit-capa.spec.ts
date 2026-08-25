import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { PAGE_LOCATION_REGISTRY, type PageKey } from '../../src/routes/pageLocation';
import { installPatch83vBackend, waitForActivePatch83vUser } from './patch83vTestHarness';
import { startPatch83uTestServer, type Patch83uTestServer } from './patch83uTestServer';
import { installUi2FixtureData } from './ui2Fixtures';
import { installUi3FixtureData } from './ui3Fixtures';
import { installUi4FixtureData } from './ui4Fixtures';

let server: Patch83uTestServer | null = null;
let baseUrl = '';

async function prepare(page: Page, theme: 'light' | 'dark' = 'light') {
  const backend = await installPatch83vBackend(page);
  await installUi2FixtureData(page);
  await installUi3FixtureData(page);
  await installUi4FixtureData(page);
  await page.addInitScript((themeValue) => {
    localStorage.setItem('grc-language', 'en');
    localStorage.setItem('grc-theme', themeValue);
    localStorage.removeItem('grc-sidebar-collapsed');
  }, theme);
  return backend;
}

async function openPage(page: Page, key: PageKey) {
  await page.goto(`${baseUrl}/?page=${PAGE_LOCATION_REGISTRY[key]}`);
  if ((page.viewportSize()?.width ?? 1440) > 900) await waitForActivePatch83vUser(page);
  else await expect(page.locator('.auth-user-pill')).toBeAttached();
  await expect(page.locator('.modern-main-content')).toBeVisible();
}

async function capture(page: Page, testInfo: TestInfo, name: string) {
  await page.screenshot({ path: testInfo.outputPath(`${name}.png`), animations: 'disabled' });
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
}

test.describe('UI-4 Audit and CAPA twenty-view visual evidence', () => {
  test.describe.configure({ mode: 'serial' });
  test.setTimeout(120_000);

  test.beforeAll(async () => {
    server = await startPatch83uTestServer({ VITE_PATCH83U_CREDENTIAL_GOVERNANCE_ENABLED: 'true' });
    baseUrl = server.baseUrl;
  });

  test.afterAll(() => {
    server?.stop();
    server = null;
  });

  test('07A-07J Audit locked workspace views', async ({ page }, testInfo) => {
    const backend = await prepare(page);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await openPage(page, 'audit');
    await expect(page.getByTestId('ui4-audit-dashboard')).toBeVisible();
    await expect(page.getByText('IT General Controls', { exact: true }).first()).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await capture(page, testInfo, '07A-audit-dashboard');

    await page.getByRole('button', { name: 'Audit register', exact: true }).click();
    await expect(page.getByTestId('ui4-audit-register')).toBeVisible();
    await capture(page, testInfo, '07B-audit-register');

    await page.getByText('IT General Controls', { exact: true }).first().click();
    await expect(page.getByTestId('ui4-audit-engagement')).toBeVisible();
    await capture(page, testInfo, '07C-audit-engagement');

    await page.getByRole('button', { name: 'Planning', exact: true }).click();
    await expect(page.getByTestId('ui4-audit-planning')).toBeVisible();
    await capture(page, testInfo, '07D-audit-planning');

    await page.getByRole('button', { name: 'Program', exact: true }).click();
    await expect(page.getByTestId('ui4-audit-program')).toBeVisible();
    await capture(page, testInfo, '07E-audit-program');

    await page.getByRole('button', { name: 'Findings', exact: true }).click();
    await expect(page.getByTestId('ui4-audit-findings')).toBeVisible();
    await capture(page, testInfo, '07F-audit-findings');

    await page.getByText('F-2026-001', { exact: true }).click();
    await expect(page.getByTestId('ui4-audit-finding-detail')).toBeVisible();
    await expect(page.getByText('POL-IT-004 Requirement 4.2 · Quarterly access review', { exact: true })).toBeVisible();
    await expect(page.getByText('SOP-IT-009 Step 03 · Identity population reconciliation', { exact: true })).toBeVisible();
    await expect(page.getByText('Append-only response trail', { exact: true })).toBeVisible();
    await capture(page, testInfo, '07G-audit-finding-detail');
    await page.getByText('POL-IT-004 Requirement 4.2 · Quarterly access review', { exact: true }).scrollIntoViewIfNeeded();
    await capture(page, testInfo, '07G2-audit-criteria-governance-basis');
    await page.getByText('Append-only response trail', { exact: true }).scrollIntoViewIfNeeded();
    await capture(page, testInfo, '07G3-audit-management-response-dispute');

    await page.getByRole('button', { name: 'Report', exact: true }).click();
    await expect(page.getByTestId('ui4-audit-report')).toBeVisible();
    await capture(page, testInfo, '07H-audit-report');

    await page.getByRole('button', { name: 'Follow-up', exact: true }).click();
    await expect(page.getByTestId('ui4-audit-followup')).toBeVisible();
    await capture(page, testInfo, '07I-audit-followup');

    await page.getByRole('button', { name: 'Review', exact: true }).click();
    await expect(page.getByTestId('ui4-audit-review')).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await capture(page, testInfo, '07J-audit-review');

    await page.getByRole('combobox', { name: 'Appearance theme' }).selectOption('dark');
    await page.getByRole('button', { name: 'Audit register', exact: true }).click();
    await expect(page.getByTestId('ui4-audit-register')).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await capture(page, testInfo, '07B2-audit-register-dark');

    await page.setViewportSize({ width: 390, height: 844 });
    await expectNoHorizontalOverflow(page);
    await capture(page, testInfo, '07B3-audit-register-mobile-dark');

    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.getByRole('button', { name: 'AR', exact: true }).click();
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await page.setViewportSize({ width: 390, height: 844 });
    await expectNoHorizontalOverflow(page);
    await capture(page, testInfo, '07B4-audit-register-mobile-ar-rtl');
    expect(backend.proof.pageErrors).toEqual([]);
    expect(backend.proof.writeRequests).toEqual([]);
  });

  test('08A-08J CAPA locked workspace views', async ({ page }, testInfo) => {
    const backend = await prepare(page);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await openPage(page, 'capa');
    await expect(page.getByTestId('ui4-capa-dashboard')).toBeVisible();
    await expect(page.getByRole('button', { name: /Access control review CAPA-2026-001/ })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await capture(page, testInfo, '08A-capa-dashboard');

    await page.getByRole('button', { name: 'CAPA register', exact: true }).click();
    await expect(page.getByTestId('ui4-capa-register')).toBeVisible();
    await capture(page, testInfo, '08B-capa-register');

    await page.getByText('CAPA-2026-001', { exact: true }).click();
    await expect(page.getByTestId('ui4-capa-detail')).toBeVisible();
    await expect(page.getByText('POL-IT-004 Requirement 4.2 · Quarterly access review', { exact: true })).toBeVisible();
    await expect(page.getByText('SOP-IT-009 Step 03 · Identity population reconciliation', { exact: true })).toBeVisible();
    await expect(page.getByText('Source inheritance and supplemental criteria', { exact: true })).toBeVisible();
    await capture(page, testInfo, '08C-capa-detail');
    await page.getByText('POL-IT-004 Requirement 4.2 · Quarterly access review', { exact: true }).scrollIntoViewIfNeeded();
    await capture(page, testInfo, '08C2-capa-source-governance-linkage');

    await page.getByRole('button', { name: 'Plan', exact: true }).click();
    await expect(page.getByTestId('ui4-capa-plan')).toBeVisible();
    await capture(page, testInfo, '08D-capa-plan');

    await page.getByRole('button', { name: 'Implementation', exact: true }).click();
    await expect(page.getByTestId('ui4-capa-implementation')).toBeVisible();
    await capture(page, testInfo, '08E-capa-implementation');

    await page.getByRole('combobox', { name: 'Appearance theme' }).selectOption('dark');
    await page.getByRole('button', { name: 'Verification', exact: true }).click();
    await expect(page.getByTestId('ui4-capa-verification')).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await capture(page, testInfo, '08F-capa-verification-dark');

    await page.getByRole('button', { name: 'Closure', exact: true }).click();
    await expect(page.getByTestId('ui4-capa-closure')).toBeVisible();
    await capture(page, testInfo, '08G-capa-closure-dark');

    await page.getByRole('button', { name: 'Report', exact: true }).click();
    await expect(page.getByTestId('ui4-capa-report')).toBeVisible();
    await capture(page, testInfo, '08H-capa-report-dark');

    await page.getByRole('button', { name: 'Analytics', exact: true }).click();
    await expect(page.getByTestId('ui4-capa-analytics')).toBeVisible();
    await capture(page, testInfo, '08I-capa-analytics-dark');

    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('button', { name: 'Review', exact: true }).click();
    await expect(page.getByTestId('ui4-capa-review')).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await capture(page, testInfo, '08J-capa-review-mobile-dark');

    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.getByRole('button', { name: 'AR', exact: true }).click();
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await page.setViewportSize({ width: 390, height: 844 });
    await expectNoHorizontalOverflow(page);
    await capture(page, testInfo, '08J2-capa-review-mobile-ar-rtl');
    expect(backend.proof.pageErrors).toEqual([]);
    expect(backend.proof.writeRequests).toEqual([]);
  });
});
