import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { PAGE_LOCATION_REGISTRY, type PageKey } from '../../src/routes/pageLocation';
import { installPatch83vBackend, waitForActivePatch83vUser } from './patch83vTestHarness';
import { startPatch83uTestServer, type Patch83uTestServer } from './patch83uTestServer';
import { installUi2FixtureData } from './ui2Fixtures';
import { installUi3FixtureData } from './ui3Fixtures';
import { installUi4FixtureData } from './ui4Fixtures';
import { installUi5FixtureData } from './ui5Fixtures';

let server: Patch83uTestServer | null = null;
let baseUrl = '';

async function prepare(page: Page, theme: 'light' | 'dark' = 'light') {
  const backend = await installPatch83vBackend(page);
  await installUi2FixtureData(page);
  await installUi3FixtureData(page);
  await installUi4FixtureData(page);
  await installUi5FixtureData(page);
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

test.describe('UI-5 Training and OVR thirty-view visual evidence', () => {
  test.describe.configure({ mode: 'serial' });
  test.setTimeout(180_000);

  test.beforeAll(async () => {
    server = await startPatch83uTestServer({ VITE_PATCH83U_CREDENTIAL_GOVERNANCE_ENABLED: 'true' });
    baseUrl = server.baseUrl;
  });

  test.afterAll(() => {
    server?.stop();
    server = null;
  });

  test('09A-09J Training and Competency locked workspace views', async ({ page }, testInfo) => {
    const backend = await prepare(page);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await openPage(page, 'trainingGovernance');
    await expect(page.getByTestId('ui5-training-dashboard')).toBeVisible();
    await expect(page.getByText('Compliance by department', { exact: true })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await capture(page, testInfo, '09A-training-dashboard-light');

    await page.getByRole('button', { name: 'Training Register', exact: true }).click();
    await expect(page.getByTestId('ui5-training-register')).toBeVisible();
    await expect(page.getByText('SOP-linked obligation', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Policy-linked obligation', { exact: true }).first()).toBeVisible();
    await capture(page, testInfo, '09B-training-register-light');

    await page.locator('.ui5-training-table .ui5-table-row').first().click();
    await expect(page.getByTestId('ui5-training-detail')).toBeVisible();
    await expect(page.getByText('Training completion', { exact: true })).toBeVisible();
    await expect(page.getByText('Version acknowledgment', { exact: true })).toBeVisible();
    await expect(page.getByText('Competency assessment', { exact: true })).toBeVisible();
    await expect(page.getByText('Governed source version', { exact: true })).toBeVisible();
    await expect(page.getByText('SOP-001 / 2.0', { exact: true })).toBeVisible();
    await capture(page, testInfo, '09C-training-obligation-detail');
    await page.getByText('Completion evidence', { exact: true }).scrollIntoViewIfNeeded();
    await capture(page, testInfo, '09C2-training-completion-ack-competency-evidence');

    await page.getByRole('button', { name: 'Learning Catalog', exact: true }).click();
    await expect(page.getByTestId('ui5-training-catalog')).toBeVisible();
    await expect(page.getByText('SOP-001', { exact: true })).toBeVisible();
    await capture(page, testInfo, '09D-learning-catalog-matrix');

    await page.getByRole('button', { name: 'My Obligations', exact: true }).click();
    await expect(page.getByTestId('ui5-training-my')).toBeVisible();
    await expect(page.getByText('SOP acknowledgments', { exact: true })).toBeVisible();
    await capture(page, testInfo, '09E-my-obligations-acknowledgment');

    await page.getByRole('combobox', { name: 'Appearance theme' }).selectOption('dark');
    await page.getByRole('button', { name: 'Competency Framework', exact: true }).click();
    await expect(page.getByTestId('ui5-training-framework')).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await capture(page, testInfo, '09F-competency-framework-dark');

    await page.getByRole('button', { name: 'Assessments', exact: true }).click();
    await expect(page.getByTestId('ui5-training-assessments')).toBeVisible();
    await expect(page.getByText('failed', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('needs_retraining', { exact: true }).first()).toBeVisible();
    await capture(page, testInfo, '09G-competency-assessments-dark');

    await page.getByRole('button', { name: 'Competency Profile', exact: true }).click();
    await expect(page.getByTestId('ui5-training-profile')).toBeVisible();
    await capture(page, testInfo, '09H-competency-profile-dark');

    await page.getByRole('button', { name: 'Reports', exact: true }).click();
    await expect(page.getByTestId('ui5-training-reports')).toBeVisible();
    await expect(page.getByText('Independent obligation metrics', { exact: true })).toBeVisible();
    await capture(page, testInfo, '09I-training-analytics-dark');

    await page.getByRole('button', { name: 'Governance Review', exact: true }).click();
    await expect(page.getByTestId('ui5-training-review')).toBeVisible();
    await capture(page, testInfo, '09J-training-governance-review-dark');

    await page.getByRole('button', { name: 'Training Register', exact: true }).click();
    await page.setViewportSize({ width: 390, height: 844 });
    await expectNoHorizontalOverflow(page);
    await capture(page, testInfo, '09B2-training-register-mobile-dark');

    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.getByRole('combobox', { name: 'Appearance theme' }).selectOption('light');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await page.setViewportSize({ width: 390, height: 844 });
    await expectNoHorizontalOverflow(page);
    await capture(page, testInfo, '09B3-training-register-mobile-light');

    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.getByRole('button', { name: 'AR', exact: true }).click();
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await page.setViewportSize({ width: 390, height: 844 });
    await expectNoHorizontalOverflow(page);
    await capture(page, testInfo, '09B4-training-mobile-ar-rtl');
    expect(backend.proof.pageErrors).toEqual([]);
    expect(backend.proof.writeRequests).toEqual([]);
  });

  test('10A-10J OVR locked workspace and governance linkage views', async ({ page }, testInfo) => {
    const backend = await prepare(page);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await openPage(page, 'ovr');
    await expect(page.getByTestId('ui5-ovr-dashboard')).toBeVisible();
    await expect(page.getByText('18', { exact: true }).first()).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await capture(page, testInfo, '10A-ovr-dashboard-light');

    await page.getByRole('button', { name: 'OVR Register', exact: true }).click();
    await expect(page.getByTestId('ui5-ovr-register')).toBeVisible();
    await expect(page.getByText('OVR-2026-001', { exact: true })).toBeVisible();
    await capture(page, testInfo, '10B-ovr-register-light');

    await page.getByRole('button', { name: 'Open workflow', exact: true }).first().click();
    await expect(page.getByTestId('ui5-ovr-detail')).toBeVisible();
    await expect(page.getByText('Criteria and Governance Basis', { exact: true })).toBeVisible();
    await capture(page, testInfo, '10C-ovr-details');

    const governance = page.getByTestId('governance-criteria-linkage');
    await governance.scrollIntoViewIfNeeded();
    await expect(governance.getByText('Governance Linkage Review', { exact: true })).toBeVisible();
    await expect(governance.getByText('Related Policies', { exact: true })).toBeVisible();
    await expect(governance.getByText('Related SOPs', { exact: true })).toBeVisible();
    await expect(governance.getByText('Exact-version snapshot', { exact: true })).toBeVisible();
    await expect(governance.getByText('POL-001 Requirement 03 · Independent verification governance', { exact: true })).toBeVisible();
    await expect(governance.getByText('SOP-001 Step 03 · Independent double-check', { exact: true })).toBeVisible();
    await capture(page, testInfo, '10C2-ovr-governance-linkage-review');

    await governance.getByTitle('View requirements').first().click();
    await expect(governance.getByText('Add requirement', { exact: true }).first()).toBeVisible();
    await capture(page, testInfo, '10C3-ovr-policy-requirement-drilldown');
    await governance.getByRole('button', { name: 'Close drill-down' }).click();
    await governance.getByTitle('View procedure steps').first().click();
    await expect(governance.getByText('Add step', { exact: true }).first()).toBeVisible();
    await capture(page, testInfo, '10C4-ovr-sop-step-drilldown');
    await governance.getByRole('button', { name: 'Close drill-down' }).click();

    await page.getByRole('button', { name: 'Report Incident', exact: true }).click();
    await expect(page.getByTestId('ui5-ovr-report')).toBeVisible();
    await expect(page.getByText('Related Policy and SOP suggestions', { exact: true })).toBeVisible();
    await expect(page.getByText('Related Policies', { exact: true })).toBeVisible();
    await expect(page.getByText('Related SOPs', { exact: true })).toBeVisible();
    await expect(page.getByText('I am uncertain which governed documents apply', { exact: true })).toBeVisible();
    await capture(page, testInfo, '10D-initial-ovr-report-form');
    const reportGovernance = page.locator('.ui5-reporter-suggestions');
    await reportGovernance.locator('fieldset').nth(0).getByRole('checkbox').first().check();
    await reportGovernance.locator('fieldset').nth(1).getByRole('checkbox').first().check();
    await reportGovernance.getByRole('checkbox', { name: 'I am uncertain which governed documents apply' }).check();
    await capture(page, testInfo, '10D2-potentially-related-governance-documents');

    await page.getByRole('button', { name: 'Investigations', exact: true }).click();
    await expect(page.getByTestId('ui5-ovr-investigations').first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'New OVR Report', exact: true })).toBeVisible();
    await capture(page, testInfo, '10E-ovr-investigations');

    await page.getByRole('combobox', { name: 'Appearance theme' }).selectOption('dark');
    await page.getByRole('button', { name: 'Root Cause Analysis', exact: true }).click();
    await expect(page.getByTestId('ui5-ovr-root_cause')).toBeVisible();
    await expect(page.getByText('Root cause and contributing factors', { exact: true })).toBeVisible();
    await expect(page.getByText(/Root cause remains separate/)).toBeVisible();
    await capture(page, testInfo, '10F-ovr-root-cause-dark');

    await page.getByRole('button', { name: 'Actions', exact: true }).click();
    await expect(page.getByTestId('ui5-ovr-actions')).toBeVisible();
    await capture(page, testInfo, '10G-ovr-actions-lineage-dark');

    await page.getByRole('button', { name: 'Reports', exact: true }).click();
    await expect(page.getByTestId('ui5-ovr-reports')).toBeVisible();
    await capture(page, testInfo, '10H-ovr-reports-dark');

    await page.getByRole('button', { name: 'Analytics', exact: true }).click();
    await expect(page.getByTestId('ui5-ovr-analytics')).toBeVisible();
    await capture(page, testInfo, '10I-ovr-analytics-dark');

    await page.getByRole('button', { name: 'Review', exact: true }).click();
    await expect(page.getByTestId('ui5-ovr-review')).toBeVisible();
    await expect(page.getByText('Governance review complete', { exact: true })).toBeVisible();
    await capture(page, testInfo, '10J-ovr-review-closure-dark');

    await page.getByRole('button', { name: 'OVR Register', exact: true }).click();
    await page.setViewportSize({ width: 390, height: 844 });
    await expectNoHorizontalOverflow(page);
    await capture(page, testInfo, '10B2-ovr-register-mobile-dark');

    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.getByRole('combobox', { name: 'Appearance theme' }).selectOption('light');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await page.setViewportSize({ width: 390, height: 844 });
    await expectNoHorizontalOverflow(page);
    await capture(page, testInfo, '10B3-ovr-register-mobile-light');

    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.getByRole('button', { name: 'AR', exact: true }).click();
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await page.setViewportSize({ width: 390, height: 844 });
    await expectNoHorizontalOverflow(page);
    await capture(page, testInfo, '10B4-ovr-mobile-ar-rtl');
    expect(backend.proof.pageErrors).toEqual([]);
    const mutatingRequests = backend.proof.writeRequests.filter(request => !request.includes('f1r2_get_evidence_pack'));
    expect(mutatingRequests).toEqual([]);
  });
});
