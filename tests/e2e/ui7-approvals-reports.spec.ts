import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { PAGE_LOCATION_REGISTRY, type PageKey } from '../../src/routes/pageLocation';
import { installPatch83vBackend, type Patch83vBackend, type Patch83vRole } from './patch83vTestHarness';
import { startPatch83uTestServer, type Patch83uTestServer } from './patch83uTestServer';
import { installUi2FixtureData } from './ui2Fixtures';
import { installUi3FixtureData } from './ui3Fixtures';
import { installUi4FixtureData } from './ui4Fixtures';
import { installUi5FixtureData } from './ui5Fixtures';
import { installUi6FixtureData } from './ui6Fixtures';
import { installUi7FixtureData, type Ui7FixtureProof } from './ui7Fixtures';

let server: Patch83uTestServer | null = null;
let baseUrl = '';

async function prepare(
  page: Page,
  options: { theme?: 'light' | 'dark'; role?: Patch83vRole; unavailableTables?: string[] } = {},
): Promise<{ backend: Patch83vBackend; fixture: Ui7FixtureProof }> {
  const backend = await installPatch83vBackend(page, options.role ?? 'super_admin');
  await installUi2FixtureData(page);
  await installUi3FixtureData(page);
  await installUi4FixtureData(page);
  await installUi5FixtureData(page);
  await installUi6FixtureData(page);
  const fixture = await installUi7FixtureData(page, { unavailableTables: options.unavailableTables });
  await page.addInitScript((themeValue) => {
    localStorage.setItem('grc-language', 'en');
    localStorage.setItem('grc-theme', themeValue);
    localStorage.removeItem('grc-sidebar-collapsed');
  }, options.theme ?? 'light');
  return { backend, fixture };
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

test.describe('UI-7 Approvals, My Work, Reports and governed analytics', () => {
  test.describe.configure({ mode: 'serial' });
  test.setTimeout(300_000);

  test.beforeAll(async () => {
    server = await startPatch83uTestServer({ VITE_PATCH83U_CREDENTIAL_GOVERNANCE_ENABLED: 'true' });
    baseUrl = server.baseUrl;
  });

  test.afterAll(() => {
    server?.stop();
    server = null;
  });

  test('My Work and Approvals cover assignment, actionability, authority, history, dark, mobile and RTL', async ({ page }, testInfo) => {
    const { backend, fixture } = await prepare(page);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await openPage(page, 'myWork');
    await expect(page.getByTestId('ui7-my-work-overview')).toBeVisible();
    await expect(page.getByText('Annual medication safety competency', { exact: true })).toBeVisible();
    await expect(page.getByText('Validate project milestone evidence gate', { exact: true })).toBeVisible();
    await expect(page.locator('[data-actionability="blocked"]')).toContainText('Blocked until the source evidence owner');
    await expect(page.locator('[data-actionability="read_only"]').first()).toContainText('View source');
    await expectNoHorizontalOverflow(page);
    await capture(page, testInfo, '01-my-work-light');

    await page.getByRole('combobox', { name: 'Appearance theme' }).selectOption('dark');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await capture(page, testInfo, '02-my-work-dark');
    await page.getByRole('combobox', { name: 'Appearance theme' }).selectOption('light');

    await page.getByRole('button', { name: 'Overdue', exact: true }).click();
    await expect(page.getByTestId('ui7-my-work-overdue')).toBeVisible();
    await page.getByRole('combobox').filter({ has: page.locator('option[value="high"]') }).selectOption('high');
    await expect(page.getByText('Annual medication safety competency', { exact: true })).toBeVisible();
    await capture(page, testInfo, '03-my-work-overdue-filter');

    await openPage(page, 'approvals');
    await expect(page.getByTestId('ui7-approval-inbox')).toBeVisible();
    await expect(page.getByText('Approve the Clinical Governance Policy v4.2 for controlled publication', { exact: true })).toBeVisible();
    await expect(page.getByText('Risk acceptance submitted by the signed-in actor', { exact: true })).toBeVisible();
    await capture(page, testInfo, '04-approval-inbox');

    await page.getByText('Approve the Clinical Governance Policy v4.2 for controlled publication', { exact: true }).click();
    await expect(page.getByTestId('ui7-approval-detail')).toBeVisible();
    await expect(page.getByTestId('ui7-decision-workspace')).toBeVisible();
    await capture(page, testInfo, '05-approval-details');

    await page.getByTestId('ui7-decision-workspace').getByRole('button', { name: 'Approve', exact: true }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText(/server will re-check active identity/i)).toBeVisible();
    await capture(page, testInfo, '06-approval-decision-workspace');
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();

    await expect(page.getByTestId('ui7-approval-history')).toBeVisible();
    await capture(page, testInfo, '07-approval-history');
    await page.getByTestId('ui7-decision-workspace').getByRole('button', { name: 'Reject', exact: true }).click();
    await page.getByLabel(/Decision rationale/).fill('The controlled evidence gate is not yet satisfied.');
    await page.getByRole('dialog').getByRole('button', { name: 'Reject', exact: true }).click();
    await expect.poll(() => fixture.decisionRequests.length).toBe(1);
    expect((fixture.decisionRequests[0].payload as Record<string, unknown>).decision).toBe('rejected');

    await openPage(page, 'myWork');
    await page.setViewportSize({ width: 390, height: 844 });
    await expectNoHorizontalOverflow(page);
    await capture(page, testInfo, '08-my-work-mobile-390');

    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.getByRole('button', { name: 'AR', exact: true }).click();
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await page.setViewportSize({ width: 390, height: 844 });
    await expectNoHorizontalOverflow(page);
    await capture(page, testInfo, '09-my-work-arabic-rtl');

    expect(backend.proof.pageErrors).toEqual([]);
    expect(backend.proof.consoleProblems).toEqual([]);
  });

  test('Reports render every governed module, root-safe truth, filters, drill-down, dark, mobile and RTL', async ({ page }, testInfo) => {
    const { backend } = await prepare(page);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await openPage(page, 'reportsHub');
    await expect(page.getByTestId('ui7-reports-overview')).toBeVisible();
    await expect(page.getByText('Current governed pressure by module', { exact: true })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await capture(page, testInfo, '10-reports-landing-light');

    await page.getByRole('combobox', { name: 'Appearance theme' }).selectOption('dark');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await capture(page, testInfo, '11-reports-landing-dark');
    await page.getByRole('combobox', { name: 'Appearance theme' }).selectOption('light');

    await page.getByRole('combobox', { name: 'Reporting period' }).selectOption('365');
    await page.getByRole('combobox', { name: 'Department scope' }).selectOption('Quality & Patient Safety');
    await expect(page.getByText('365 days', { exact: true })).toBeVisible();
    await capture(page, testInfo, '12-executive-grc-overview-filtered');
    await page.getByTitle('Reset report filters').click();

    await page.getByRole('button', { name: 'Risk', exact: true }).click();
    await expect(page.getByTestId('ui7-risk-report')).toBeVisible();
    await expect(page.getByText('Medication verification control may fail under peak workload', { exact: true })).toBeVisible();
    await capture(page, testInfo, '13-risk-report');

    await page.getByRole('button', { name: 'Compliance', exact: true }).click();
    await expect(page.getByTestId('ui7-compliance-report')).toBeVisible();
    await capture(page, testInfo, '14-compliance-report');

    await page.getByRole('button', { name: 'Audit', exact: true }).click();
    await expect(page.getByTestId('ui7-audit-report')).toBeVisible();
    await capture(page, testInfo, '15-audit-report');

    await page.getByRole('button', { name: 'CAPA', exact: true }).click();
    await expect(page.getByTestId('ui7-capa-report')).toBeVisible();
    await expect(page.getByText('Completed action is not an effective CAPA', { exact: true })).toBeVisible();
    await capture(page, testInfo, '16-capa-effectiveness-report');

    await page.getByRole('button', { name: 'Training', exact: true }).click();
    await expect(page.getByTestId('ui7-training-report')).toBeVisible();
    await capture(page, testInfo, '17-training-report');

    await page.getByRole('button', { name: 'OVR', exact: true }).click();
    await expect(page.getByTestId('ui7-ovr-report')).toBeVisible();
    await expect(page.getByText('Correct-compliance events', { exact: true })).toBeVisible();
    await capture(page, testInfo, '18-ovr-report');

    await page.getByRole('button', { name: 'Policy / SOP', exact: true }).click();
    await expect(page.getByTestId('ui7-governance-report')).toBeVisible();
    await expect(page.getByText('POL-001 · Clinical Governance Policy v4.2', { exact: true })).toBeVisible();
    await expect(page.getByText('SOP-014 · Medication Verification v3.1', { exact: true })).toBeVisible();
    await expect(page.getByText('Global root incidents', { exact: true }).locator('..')).toContainText('2');
    await capture(page, testInfo, '19-policy-sop-confirmed-governance');

    await page.getByRole('button', { name: 'Governance Review', exact: true }).click();
    await expect(page.getByTestId('ui7-adequacy-report')).toBeVisible();
    await expect(page.getByText('POL-031 · High Alert Medication Control v4.0', { exact: true })).toBeVisible();
    await capture(page, testInfo, '20-document-adequacy-governance-review');

    await page.getByRole('button', { name: 'Projects / Evidence', exact: true }).click();
    await expect(page.getByTestId('ui7-portfolio-evidence-report')).toBeVisible();
    await capture(page, testInfo, '21-project-evidence-report');

    await page.getByRole('button', { name: 'Risk', exact: true }).click();
    await page.locator('button.ui7-metric').filter({ hasText: 'High / critical' }).click();
    await expect(page.getByTestId('ui7-report-drilldown')).toBeVisible();
    await expect(page.getByText('RISK-0018', { exact: true })).toBeVisible();
    await capture(page, testInfo, '22-report-drilldown');

    await openPage(page, 'reportsHub');
    await page.setViewportSize({ width: 390, height: 844 });
    await expectNoHorizontalOverflow(page);
    await capture(page, testInfo, '23-reports-mobile-390');

    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.getByRole('button', { name: 'AR', exact: true }).click();
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await page.setViewportSize({ width: 390, height: 844 });
    await expectNoHorizontalOverflow(page);
    await capture(page, testInfo, '24-reports-arabic-rtl');

    expect(backend.proof.pageErrors).toEqual([]);
    expect(backend.proof.writeRequests).toEqual([]);
    expect(backend.proof.consoleProblems).toEqual([]);
  });

  test('viewer is read-only and unavailable sources are not rendered as zero', async ({ page }) => {
    const viewer = await prepare(page, { role: 'viewer' });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await openPage(page, 'approvals');
    await expect(page.getByTestId('ui7-decision-workspace')).toHaveCount(0);
    await expect(page.getByText('Risk acceptance submitted by the signed-in actor', { exact: true })).toBeVisible();
    expect(viewer.backend.proof.writeRequests).toEqual([]);

    const unavailablePage = await page.context().newPage();
    await prepare(unavailablePage, { unavailableTables: ['risks'] });
    await openPage(unavailablePage, 'reportsHub');
    await expect(unavailablePage.getByText('Not available', { exact: true }).first()).toBeVisible();
    await unavailablePage.getByRole('button', { name: 'Risk', exact: true }).click();
    await expect(unavailablePage.getByText('Metric unavailable', { exact: true }).first()).toBeVisible();
    await unavailablePage.close();
  });
});
