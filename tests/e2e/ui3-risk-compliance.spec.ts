import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { PAGE_LOCATION_REGISTRY, type PageKey } from '../../src/routes/pageLocation';
import { installPatch83vBackend, waitForActivePatch83vUser } from './patch83vTestHarness';
import { startPatch83uTestServer, type Patch83uTestServer } from './patch83uTestServer';
import { installUi2FixtureData } from './ui2Fixtures';
import { installUi3FixtureData } from './ui3Fixtures';

let server: Patch83uTestServer | null = null;
let baseUrl = '';

async function prepare(page: Page, language: 'en' | 'ar' = 'en', theme: 'light' | 'dark' = 'light') {
  const backend = await installPatch83vBackend(page);
  await installUi2FixtureData(page);
  await installUi3FixtureData(page);
  await page.addInitScript(({ languageValue, themeValue }) => {
    localStorage.setItem('grc-language', languageValue);
    localStorage.setItem('grc-theme', themeValue);
    localStorage.removeItem('grc-sidebar-collapsed');
  }, { languageValue: language, themeValue: theme });
  return backend;
}

async function openPage(page: Page, key: PageKey) {
  await page.goto(`${baseUrl}/?page=${PAGE_LOCATION_REGISTRY[key]}`);
  if ((page.viewportSize()?.width ?? 1440) > 900) await waitForActivePatch83vUser(page);
  else await expect(page.locator('.auth-user-pill')).toBeAttached();
  await expect(page.locator('.modern-main-content')).toBeVisible();
}

async function capture(page: Page, testInfo: TestInfo, name: string) {
  await page.screenshot({ path: testInfo.outputPath(`${name}.png`), animations: 'disabled', fullPage: true });
}

async function expectNoOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
}

test.describe('UI-3 populated Risk and Compliance visual evidence', () => {
  test.describe.configure({ mode: 'serial' });
  test.setTimeout(90_000);

  test.beforeAll(async () => {
    server = await startPatch83uTestServer({ VITE_PATCH83U_CREDENTIAL_GOVERNANCE_ENABLED: 'true' });
    baseUrl = server.baseUrl;
  });

  test.afterAll(() => {
    server?.stop();
    server = null;
  });

  test('Risk desktop light and dark workspaces', async ({ page }, testInfo) => {
    const backend = await prepare(page);
    await page.setViewportSize({ width: 1440, height: 1000 });

    await openPage(page, 'risks');
    await expect(page.getByTestId('ui3-risk-register')).toBeVisible();
    await expect(page.getByText('RISK-CLN-014', { exact: true })).toBeVisible();
    await expectNoOverflow(page);
    await capture(page, testInfo, '01-risk-register-desktop-light');

    await page.getByText('RISK-CLN-014', { exact: true }).click();
    await expect(page.getByTestId('ui3-risk-detail')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Medication administration error' })).toBeVisible();
    await expectNoOverflow(page);
    await capture(page, testInfo, '03-risk-details-light');

    await page.getByRole('button', { name: 'Governance Context', exact: true }).click();
    await expect(page.getByTestId('governance-criteria-linkage')).toBeVisible();
    await expect(page.getByText('Related Policies', { exact: true })).toBeVisible();
    await expect(page.getByText('Related SOPs', { exact: true })).toBeVisible();
    await capture(page, testInfo, '04-risk-governance-context');
    await page.locator('.ui3-link-register').scrollIntoViewIfNeeded();
    await expect(page.getByText('Restricted governance document')).toBeVisible();
    await capture(page, testInfo, '04b-risk-governance-relationships');

    await page.getByRole('button', { name: 'Assessment', exact: true }).click();
    await expect(page.getByText('Select an immutable scoring snapshot')).toBeVisible();
    await expect(page.getByText('Exact-version snapshot')).toBeVisible();
    await capture(page, testInfo, '05-risk-assessment-review');

    await page.getByRole('button', { name: 'Controls', exact: true }).click();
    await expect(page.getByText('CTRL-MED-02', { exact: true })).toBeVisible();
    await capture(page, testInfo, '06-risk-controls');

    await page.getByRole('button', { name: 'Treatment', exact: true }).click();
    await expect(page.getByText('Electronic independent-check hard stop')).toBeVisible();
    await capture(page, testInfo, '07-risk-treatment-context');

    await page.getByRole('combobox', { name: 'Appearance theme' }).selectOption('dark');
    await page.locator('.ui3-back-button').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(page.getByText('RISK-CLN-014', { exact: true })).toBeVisible();
    await expectNoOverflow(page);
    await capture(page, testInfo, '02-risk-register-desktop-dark');
    expect(backend.proof.pageErrors).toEqual([]);
    expect(backend.proof.writeRequests).toEqual([]);
  });

  test('Risk 390px and Arabic RTL', async ({ page }, testInfo) => {
    const backend = await prepare(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await openPage(page, 'risks');
    await expect(page.getByTestId('ui3-risk-register')).toBeVisible();
    await expectNoOverflow(page);
    await capture(page, testInfo, '08-risk-mobile-390');

    await page.locator('.topbar-language').evaluate((element: HTMLButtonElement) => element.click());
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.getByRole('heading', { name: 'سجل مخاطر المنشأة' })).toBeVisible();
    await expectNoOverflow(page);
    await capture(page, testInfo, '09-risk-arabic-rtl');
    expect(backend.proof.pageErrors).toEqual([]);
  });

  test('Compliance desktop light and dark workspaces', async ({ page }, testInfo) => {
    const backend = await prepare(page);
    await page.setViewportSize({ width: 1440, height: 1000 });

    await openPage(page, 'compliance');
    await expect(page.getByTestId('ui3-compliance-register')).toBeVisible();
    await expect(page.getByText('OBL-CBAHI-MM-05', { exact: true })).toBeVisible();
    await expectNoOverflow(page);
    await capture(page, testInfo, '10-compliance-register-desktop-light');

    await page.getByText('OBL-CBAHI-MM-05', { exact: true }).click();
    await expect(page.getByTestId('ui3-compliance-detail')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Safe medication administration and independent verification' })).toBeVisible();
    await expectNoOverflow(page);
    await capture(page, testInfo, '12-compliance-obligation-details');

    await page.getByRole('button', { name: 'Assessments', exact: true }).click();
    await expect(page.getByText('ASM-2026-001', { exact: false })).toBeVisible();
    await capture(page, testInfo, '13-compliance-assessment');

    await page.getByRole('button', { name: 'Findings', exact: true }).click();
    await expect(page.getByText('FND-CMP-2026-017', { exact: true })).toBeVisible();
    await capture(page, testInfo, '14-compliance-finding');

    await page.getByRole('button', { name: 'Obligation and Internal Governance Basis', exact: true }).click();
    await expect(page.getByTestId('governance-criteria-linkage')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Finding and Internal Governance Basis' })).toBeVisible();
    await expect(page.getByText('Related Policies', { exact: true })).toBeVisible();
    await expect(page.getByText('Related SOPs', { exact: true })).toBeVisible();
    await expect(page.getByText('v2.0 · Jan 15, 2026')).toBeVisible();
    await expect(page.getByText('v3.0 · Feb 01, 2026')).toBeVisible();
    await capture(page, testInfo, '15-compliance-governance-basis');
    await page.locator('.ui3-link-register').scrollIntoViewIfNeeded();
    await expect(page.getByText('OBL-CBAHI-MM-05 · Safe medication administration')).toBeVisible();
    await capture(page, testInfo, '15b-compliance-governance-relationships');

    await page.getByRole('button', { name: 'Remediation', exact: true }).click();
    await expect(page.getByText('REM-2026-031', { exact: false })).toBeVisible();
    await capture(page, testInfo, '16-compliance-remediation');

    await page.getByRole('combobox', { name: 'Appearance theme' }).selectOption('dark');
    await page.locator('.ui3-back-button').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expectNoOverflow(page);
    await capture(page, testInfo, '11-compliance-register-desktop-dark');
    expect(backend.proof.pageErrors).toEqual([]);
    expect(backend.proof.writeRequests).toEqual([]);
  });

  test('Compliance 390px and Arabic RTL', async ({ page }, testInfo) => {
    const backend = await prepare(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await openPage(page, 'compliance');
    await expect(page.getByTestId('ui3-compliance-register')).toBeVisible();
    await expectNoOverflow(page);
    await capture(page, testInfo, '17-compliance-mobile-390');

    await page.locator('.topbar-language').evaluate((element: HTMLButtonElement) => element.click());
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.getByRole('heading', { name: 'سجل التزامات الامتثال' })).toBeVisible();
    await expectNoOverflow(page);
    await capture(page, testInfo, '18-compliance-arabic-rtl');
    expect(backend.proof.pageErrors).toEqual([]);
  });
});
