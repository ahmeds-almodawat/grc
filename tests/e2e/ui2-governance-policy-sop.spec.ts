import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { PAGE_LOCATION_REGISTRY, type PageKey } from '../../src/routes/pageLocation';
import { startPatch83uTestServer, type Patch83uTestServer } from './patch83uTestServer';
import { installPatch83vBackend, waitForActivePatch83vUser } from './patch83vTestHarness';
import { installUi2FixtureData } from './ui2Fixtures';

let server: Patch83uTestServer | null = null;
let baseUrl = '';

async function openPage(page: Page, pageKey: PageKey) {
  await page.goto(`${baseUrl}/?page=${PAGE_LOCATION_REGISTRY[pageKey]}`);
  if ((page.viewportSize()?.width ?? 1440) <= 900) {
    await expect(page.locator('.auth-user-pill')).toBeAttached();
  } else {
    await waitForActivePatch83vUser(page);
  }
  await expect(page.locator('.modern-main-content')).toBeVisible();
}

async function capture(page: Page, testInfo: TestInfo, name: string) {
  await page.screenshot({ path: testInfo.outputPath(`${name}.png`), animations: 'disabled', fullPage: true });
}

async function expectNoPageOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
}

async function setTheme(page: Page, theme: 'light' | 'dark') {
  await page.evaluate((value) => localStorage.setItem('grc-theme', value), theme);
}

test.describe('UI-2 governance, policy, and SOP visual gate', () => {
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

  test('captures populated desktop Light and Dark UI-2 scope', async ({ page }, testInfo) => {
    const backend = await installPatch83vBackend(page);
    await installUi2FixtureData(page);
    await page.addInitScript(() => {
      if (!localStorage.getItem('grc-theme')) localStorage.setItem('grc-theme', 'light');
      localStorage.setItem('grc-language', 'en');
      localStorage.removeItem('grc-sidebar-collapsed');
    });
    await page.setViewportSize({ width: 1440, height: 1000 });

    await openPage(page, 'home');
    await expect(page.getByText('Governance Hub', { exact: true })).toBeVisible();
    await expectNoPageOverflow(page);
    await capture(page, testInfo, '01-home-populated-light');

    await openPage(page, 'dashboard');
    await capture(page, testInfo, '02-executive-populated-light');
    expect(backend.proof.pageErrors).toEqual([]);
    await expect(page.locator('.grc-dashboard')).toBeVisible();
    await expect(page.getByText('Medication Safety Improvement Program')).toBeVisible();
    await expectNoPageOverflow(page);

    await openPage(page, 'governance');
    await expect(page.getByRole('heading', { name: 'Governance Hub' })).toBeVisible();
    await expect(page.getByText('POL-001', { exact: true })).toBeVisible();
    await expect(page.getByText('SOP-001', { exact: true })).toBeVisible();
    await expectNoPageOverflow(page);
    await capture(page, testInfo, '04-governance-hub-populated');

    await openPage(page, 'documents');
    await expect(page.getByText('POL-001', { exact: true })).toBeVisible();
    await expect(page.locator('.platform-pagination')).toBeVisible();
    await expectNoPageOverflow(page);
    await capture(page, testInfo, '05-policy-register-populated-light');

    await page.getByText('POL-001', { exact: true }).first().click();
    await expect(page.getByTestId('policy-details')).toBeVisible();
    await expect(page.getByText('Immutable version')).toBeVisible();
    await expectNoPageOverflow(page);
    await capture(page, testInfo, '07-policy-details');

    await openPage(page, 'sops');
    await expect(page.getByText('SOP-001', { exact: true })).toBeVisible();
    await expect(page.locator('.platform-pagination')).toBeVisible();
    await expectNoPageOverflow(page);
    await capture(page, testInfo, '08-sop-register-populated');

    await page.getByText('SOP-001', { exact: true }).first().click();
    await expect(page.getByTestId('sop-details')).toBeVisible();
    await capture(page, testInfo, '09-sop-details');
    await expect(page.getByText('POL-001', { exact: false }).first()).toBeVisible();
    await expectNoPageOverflow(page);

    await openPage(page, 'sops');
    await page.getByText('SOP-002', { exact: true }).first().click();
    await expect(page.getByRole('button', { name: /Procedure Builder/i })).toBeVisible();
    await capture(page, testInfo, '10-sop-builder');

    await page.getByRole('button', { name: /Procedure Builder/i }).click();
    await expect(page.locator('input[value="Electronic medication order verification record"]')).toBeVisible();
    await expectNoPageOverflow(page);
    await capture(page, testInfo, '11-sop-procedure-builder');

    await page.getByRole('button', { name: /Risks & Controls/i }).click();
    await expect(page.getByText('RISK-CLN-014')).toBeVisible();
    await expectNoPageOverflow(page);
    await capture(page, testInfo, '12-sop-risks-controls');

    await page.getByRole('button', { name: /Forms & Records/i }).click();
    await expect(page.getByTestId('sop-forms-records')).toBeVisible();
    await expect(page.getByText('Medication administration record', { exact: true })).toBeVisible();
    await expectNoPageOverflow(page);
    await capture(page, testInfo, '13-sop-forms-records');

    await setTheme(page, 'dark');
    await openPage(page, 'dashboard');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expectNoPageOverflow(page);
    await capture(page, testInfo, '03-executive-populated-dark');

    await openPage(page, 'documents');
    await expect(page.getByText('POL-001', { exact: true })).toBeVisible();
    await expectNoPageOverflow(page);
    await capture(page, testInfo, '06-policy-register-populated-dark');

    expect(backend.proof.writeRequests).toEqual([]);
    expect(backend.proof.pageErrors).toEqual([]);
  });

  test('captures populated 390px mobile register without page overflow', async ({ page }, testInfo) => {
    const backend = await installPatch83vBackend(page);
    await installUi2FixtureData(page);
    await page.addInitScript(() => {
      localStorage.setItem('grc-theme', 'light');
      localStorage.setItem('grc-language', 'en');
    });
    await page.setViewportSize({ width: 390, height: 844 });

    await openPage(page, 'sops');
    await expect(page.locator('.platform-record-list')).toBeVisible();
    await expect(page.getByText('SOP-001', { exact: true })).toBeVisible();
    await expectNoPageOverflow(page);
    await capture(page, testInfo, '14-mobile-390-sop-register');

    expect(backend.proof.writeRequests).toEqual([]);
    expect(backend.proof.pageErrors).toEqual([]);
  });

  test('captures populated Arabic RTL governance register', async ({ page }, testInfo) => {
    const backend = await installPatch83vBackend(page);
    await installUi2FixtureData(page);
    await page.addInitScript(() => {
      localStorage.setItem('grc-theme', 'light');
      localStorage.setItem('grc-language', 'ar');
      localStorage.removeItem('grc-sidebar-collapsed');
    });
    await page.setViewportSize({ width: 1440, height: 1000 });

    await openPage(page, 'sops');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.getByText('SOP-001', { exact: true })).toBeVisible();
    await expect(page.getByText('إجراء إعطاء الدواء الآمن والتحقق المزدوج المستقل والتصعيد')).toBeVisible();
    await expectNoPageOverflow(page);
    await capture(page, testInfo, '15-arabic-rtl-sop-register');

    expect(backend.proof.writeRequests).toEqual([]);
    expect(backend.proof.pageErrors).toEqual([]);
  });
});
