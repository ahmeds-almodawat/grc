import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { PAGE_LOCATION_REGISTRY, type PageKey } from '../../src/routes/pageLocation';
import { installPatch83vBackend, type Patch83vRole } from './patch83vTestHarness';
import { startPatch83uTestServer, type Patch83uTestServer } from './patch83uTestServer';
import { installUi2FixtureData } from './ui2Fixtures';
import { installUi3FixtureData } from './ui3Fixtures';
import { installUi4FixtureData } from './ui4Fixtures';
import { installUi5FixtureData } from './ui5Fixtures';
import { installUi6FixtureData } from './ui6Fixtures';

let server: Patch83uTestServer | null = null;
let baseUrl = '';

async function prepare(page: Page, theme: 'light' | 'dark' = 'light', role: Patch83vRole = 'super_admin') {
  const backend = await installPatch83vBackend(page, role);
  await installUi2FixtureData(page);
  await installUi3FixtureData(page);
  await installUi4FixtureData(page);
  await installUi5FixtureData(page);
  await installUi6FixtureData(page);
  await page.addInitScript((themeValue) => {
    localStorage.setItem('grc-language', 'en');
    localStorage.setItem('grc-theme', themeValue);
    localStorage.removeItem('grc-sidebar-collapsed');
  }, theme);
  return backend;
}

async function openPage(page: Page, key: PageKey) {
  await page.goto(`${baseUrl}/?page=${PAGE_LOCATION_REGISTRY[key]}`);
  if ((page.viewportSize()?.width ?? 1440) > 900) await expect(page.locator('.auth-user-pill')).toBeVisible();
  else await expect(page.locator('.auth-user-pill')).toBeAttached();
  await expect(page.locator('.modern-main-content')).toBeVisible();
}

async function capture(page: Page, testInfo: TestInfo, name: string) {
  await page.screenshot({ path: testInfo.outputPath(`${name}.png`), animations: 'disabled', fullPage: true });
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
}

test.describe('UI-6 Projects and Evidence locked workspace', () => {
  test.describe.configure({ mode: 'serial' });
  test.setTimeout(240_000);

  test.beforeAll(async () => {
    server = await startPatch83uTestServer({ VITE_PATCH83U_CREDENTIAL_GOVERNANCE_ENABLED: 'true' });
    baseUrl = server.baseUrl;
  });

  test.afterAll(() => {
    server?.stop();
    server = null;
  });

  test('11A-11J Projects portfolio, Gantt, details, lineage, evidence, mobile and RTL', async ({ page }, testInfo) => {
    const backend = await prepare(page);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await openPage(page, 'projects');
    await expect(page.getByTestId('ui6-project-overview')).toBeVisible();
    await expect(page.getByText('Enterprise Clinical Governance Upgrade', { exact: true }).first()).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await capture(page, testInfo, '11A-project-overview-light');

    await page.getByRole('button', { name: 'Project Register', exact: true }).click();
    await expect(page.getByTestId('ui6-project-register')).toBeVisible();
    await expect(page.getByText('CAPA-0042 Corrective Action Delivery', { exact: true })).toBeVisible();
    await capture(page, testInfo, '11B-project-register-light');

    await page.getByRole('button', { name: 'Programs & Portfolios', exact: true }).click();
    await expect(page.getByTestId('ui6-programs')).toBeVisible();
    await expect(page.getByText('Supported portfolio group', { exact: true }).first()).toBeVisible();
    await capture(page, testInfo, '11C-programs-portfolios-light');

    await page.getByRole('button', { name: 'Timeline / Gantt', exact: true }).click();
    await expect(page.getByTestId('ui6-project-gantt')).toBeVisible();
    await expect(page.locator('.grc-gantt__bar')).toHaveCount(8);
    await capture(page, testInfo, '11D-strategic-gantt-light');
    await page.getByRole('combobox', { name: 'Appearance theme' }).selectOption('dark');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await capture(page, testInfo, '11D2-strategic-gantt-dark');

    await page.locator('.grc-gantt__project').filter({ hasText: 'Regulatory Obligations Data Renewal' }).click();
    await expect(page.getByTestId('ui6-project-detail')).toBeVisible();
    await expect(page.getByText('Delay reason', { exact: true })).toBeVisible();
    await expect(page.getByText(/Regulator source-file mapping/)).toBeVisible();
    await capture(page, testInfo, '11D3-delayed-project-detail');

    await page.getByRole('button', { name: 'Milestones', exact: true }).click();
    await expect(page.getByTestId('ui6-project-milestones')).toBeVisible();
    await expect(page.getByText('Dependent source mapping has not passed owner validation.', { exact: true })).toBeVisible();
    await capture(page, testInfo, '11E-project-milestones');

    await page.getByRole('button', { name: 'Tasks', exact: true }).click();
    await expect(page.getByTestId('ui6-project-tasks')).toBeVisible();
    await expect(page.getByText('Source-owner validation is incomplete and escalation remains open.', { exact: true })).toBeVisible();
    await capture(page, testInfo, '11F-project-tasks');

    await page.getByRole('button', { name: 'Governance', exact: true }).click();
    await expect(page.getByTestId('ui6-project-source')).toBeVisible();
    await expect(page.getByTestId('ui6-project-source').getByText(/Compliance remediation/).last()).toBeVisible();
    await capture(page, testInfo, '11G-project-source-governance');

    await page.getByRole('button', { name: 'Project register', exact: true }).click();
    await page.getByText('CAPA-0042 Corrective Action Delivery', { exact: true }).click();
    await page.getByRole('button', { name: 'Governance', exact: true }).click();
    await expect(page.getByText('CAPA-0042 · Medication control corrective action', { exact: true })).toBeVisible();
    await capture(page, testInfo, '11G2-capa-project-lineage');

    await page.getByRole('button', { name: 'Evidence', exact: true }).click();
    await expect(page.getByTestId('ui6-project-evidence')).toBeVisible();
    await expect(page.getByText('EVD-0046 · CAPA Implementation Completion Set', { exact: true })).toBeVisible();
    await capture(page, testInfo, '11H-project-evidence');

    await page.getByRole('button', { name: 'Project register', exact: true }).click();
    await page.getByRole('button', { name: 'Analytics', exact: true }).click();
    await expect(page.getByTestId('ui6-project-analytics')).toBeVisible();
    await capture(page, testInfo, '11I-project-analytics-dark');
    await page.getByRole('button', { name: 'Review & Approval', exact: true }).click();
    await expect(page.getByTestId('ui6-project-approval')).toBeVisible();
    await expect(page.getByText('Internal Audit Finding Remediation', { exact: true })).toBeVisible();
    await capture(page, testInfo, '11J-project-review-approval');

    await page.getByRole('button', { name: 'Project Register', exact: true }).click();
    await page.setViewportSize({ width: 390, height: 844 });
    await expectNoHorizontalOverflow(page);
    await capture(page, testInfo, '11B2-project-register-mobile-dark');

    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.getByRole('combobox', { name: 'Appearance theme' }).selectOption('light');
    await page.getByRole('button', { name: 'AR', exact: true }).click();
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await page.setViewportSize({ width: 390, height: 844 });
    await expectNoHorizontalOverflow(page);
    await capture(page, testInfo, '11B3-project-mobile-ar-rtl');
    expect(backend.proof.pageErrors).toEqual([]);
    expect(backend.proof.writeRequests).toEqual([]);
  });

  test('12A-12J Evidence repository, review states, relationships, restricted access, mobile and RTL', async ({ page }, testInfo) => {
    const backend = await prepare(page);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await openPage(page, 'evidence');
    await expect(page.getByTestId('ui6-evidence-overview')).toBeVisible();
    await expect(page.getByText(/Medication Control Validation Pack/).first()).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await capture(page, testInfo, '12A-evidence-overview-light');

    await page.getByRole('button', { name: 'Evidence Repository', exact: true }).click();
    await expect(page.getByTestId('ui6-evidence-repository')).toBeVisible();
    await expect(page.getByText(/Restricted Patient Safety Investigation/).first()).toBeVisible();
    await capture(page, testInfo, '12B-evidence-repository-light');

    await page.getByRole('button', { name: 'Evidence Status', exact: true }).click();
    await expect(page.getByTestId('ui6-evidence-status')).toBeVisible();
    await expect(page.getByText(/Regulatory Mapping Workbook/).first()).toBeVisible();
    await capture(page, testInfo, '12C-evidence-status-light');

    await page.getByRole('button', { name: 'Categories', exact: true }).click();
    await expect(page.getByTestId('ui6-evidence-categories')).toBeVisible();
    await capture(page, testInfo, '12D-evidence-categories');
    await page.getByRole('button', { name: 'Retention & Validity', exact: true }).click();
    await expect(page.getByTestId('ui6-evidence-retention')).toBeVisible();
    await expect(page.getByText('Expired', { exact: true }).first()).toBeVisible();
    await capture(page, testInfo, '12E-evidence-retention-validity');

    await page.getByRole('button', { name: 'Requests', exact: true }).click();
    await expect(page.getByTestId('ui6-evidence-requests')).toBeVisible();
    await expect(page.getByText('Approved regulatory mapping evidence', { exact: true })).toBeVisible();
    await capture(page, testInfo, '12F-evidence-requests');
    await page.getByRole('button', { name: 'Collections', exact: true }).click();
    await expect(page.getByTestId('ui6-evidence-collections')).toBeVisible();
    await capture(page, testInfo, '12G-evidence-collections');
    await page.getByRole('button', { name: 'Storage & Access', exact: true }).click();
    await expect(page.getByTestId('ui6-evidence-storage')).toBeVisible();
    await expect(page.getByText('Storage paths remain private', { exact: true })).toBeVisible();
    await capture(page, testInfo, '12H-evidence-storage-access');

    await page.getByRole('button', { name: 'Quick Actions', exact: true }).click();
    await expect(page.getByTestId('ui6-evidence-actions')).toBeVisible();
    await expect(page.getByTestId('ui6-evidence-actions').getByRole('button', { name: /Upload evidence/ })).toBeEnabled();
    await capture(page, testInfo, '12I-evidence-quick-actions');
    await page.getByRole('button', { name: 'Search', exact: true }).click();
    await expect(page.getByTestId('ui6-evidence-search')).toBeVisible();
    await capture(page, testInfo, '12J-evidence-search');

    await page.getByRole('button', { name: 'Evidence Repository', exact: true }).click();
    await page.locator('.ui6-evidence-row').filter({ hasText: 'Medication Control Validation Pack' }).click();
    await expect(page.getByTestId('ui6-evidence-detail')).toBeVisible();
    await expect(page.getByTestId('ui6-evidence-relationships')).toBeVisible();
    await expect(page.getByTestId('ui6-evidence-relationships').locator('.ui6-lineage-list > div')).toHaveCount(3);
    await expect(page.getByText(/RISK-0018 · Medication verification control/)).toBeVisible();
    await expect(page.getByText(/CAPA-0042 · Medication control corrective action/)).toBeVisible();
    await capture(page, testInfo, '12C2-evidence-multi-source-detail');

    await page.getByRole('button', { name: 'Evidence Repository', exact: true }).click();
    await page.locator('.ui6-evidence-row').filter({ hasText: 'Restricted Patient Safety Investigation' }).click();
    await expect(page.getByText('Restricted evidence metadata is shown only within the authorized evidence record scope.', { exact: true })).toBeVisible();
    await expect(page.getByText('Restricted', { exact: true }).first()).toBeVisible();
    await capture(page, testInfo, '12C3-restricted-evidence-state');

    await page.getByRole('button', { name: 'Evidence Repository', exact: true }).click();
    await page.locator('.ui6-evidence-row').filter({ hasText: 'Regulatory Mapping Workbook' }).click();
    await expect(page.getByText('Replacement or revision required', { exact: true })).toBeVisible();
    await expect(page.getByText(/does not silently overwrite/)).toBeVisible();
    await capture(page, testInfo, '12C4-evidence-rejection-replacement-history');

    await page.getByRole('button', { name: 'Evidence Repository', exact: true }).click();
    await page.getByRole('combobox', { name: 'Appearance theme' }).selectOption('dark');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await capture(page, testInfo, '12B2-evidence-repository-dark');
    await page.setViewportSize({ width: 390, height: 844 });
    await expectNoHorizontalOverflow(page);
    await capture(page, testInfo, '12B3-evidence-mobile-dark');

    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.getByRole('combobox', { name: 'Appearance theme' }).selectOption('light');
    await page.getByRole('button', { name: 'AR', exact: true }).click();
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await page.setViewportSize({ width: 390, height: 844 });
    await expectNoHorizontalOverflow(page);
    await capture(page, testInfo, '12B4-evidence-mobile-ar-rtl');
    expect(backend.proof.pageErrors).toEqual([]);
    expect(backend.proof.writeRequests).toEqual([]);
  });

  test('viewer remains read-only across Projects and Evidence', async ({ page }) => {
    const backend = await prepare(page, 'light', 'viewer');
    await page.setViewportSize({ width: 1440, height: 1000 });
    await openPage(page, 'projects');
    await expect(page.getByRole('button', { name: 'New project', exact: true })).toHaveCount(0);
    await openPage(page, 'evidence');
    await expect(page.getByRole('button', { name: 'Upload evidence', exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Quick Actions', exact: true }).click();
    await expect(page.getByTestId('ui6-evidence-actions').getByRole('button', { name: /Upload evidence/ })).toBeDisabled();
    expect(backend.proof.writeRequests).toEqual([]);
  });
});
