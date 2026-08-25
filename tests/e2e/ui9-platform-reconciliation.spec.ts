import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { PAGE_LOCATION_REGISTRY, type PageKey } from '../../src/routes/pageLocation';
import { startPatch83uTestServer, type Patch83uTestServer } from './patch83uTestServer';
import { installPatch83vBackend, waitForActivePatch83vUser } from './patch83vTestHarness';
import { installUi2FixtureData } from './ui2Fixtures';
import { installUi3FixtureData } from './ui3Fixtures';
import { installUi4FixtureData } from './ui4Fixtures';
import { installUi5FixtureData } from './ui5Fixtures';
import { installUi6FixtureData } from './ui6Fixtures';
import { installUi7FixtureData } from './ui7Fixtures';
import { installUi8FixtureData } from './ui8Fixtures';

let server: Patch83uTestServer | null = null;
let baseUrl = '';

async function prepare(page: Page) {
  const backend = await installPatch83vBackend(page);
  await installUi2FixtureData(page);
  await installUi3FixtureData(page);
  await installUi4FixtureData(page);
  await installUi5FixtureData(page);
  await installUi6FixtureData(page);
  const ui7 = await installUi7FixtureData(page);
  const ui8 = await installUi8FixtureData(page);
  await page.addInitScript(() => {
    if (!localStorage.getItem('grc-language')) localStorage.setItem('grc-language', 'en');
    if (!localStorage.getItem('grc-theme')) localStorage.setItem('grc-theme', 'light');
    localStorage.removeItem('grc-sidebar-collapsed');
  });
  return { backend, ui7, ui8 };
}

async function openPage(page: Page, key: PageKey) {
  await page.goto(`${baseUrl}/?page=${PAGE_LOCATION_REGISTRY[key]}`);
  if ((page.viewportSize()?.width ?? 1440) > 900) await waitForActivePatch83vUser(page);
  else await expect(page.locator('.auth-user-pill')).toBeAttached();
  await expect(page.locator('.modern-main-content')).toBeVisible();
  await expect.poll(() => new URL(page.url()).searchParams.get('page')).toBe(PAGE_LOCATION_REGISTRY[key]);
}

async function capture(page: Page, testInfo: TestInfo, name: string) {
  await page.screenshot({ path: testInfo.outputPath(`${name}.png`), animations: 'disabled', fullPage: true });
}

async function expectContained(page: Page) {
  const result = await page.evaluate(() => ({
    duplicateIds: [...document.querySelectorAll('[id]')]
      .map((element) => element.id)
      .filter((id, index, values) => values.indexOf(id) !== index),
    overflow: document.documentElement.scrollWidth - window.innerWidth,
    unnamedButtons: [...document.querySelectorAll<HTMLElement>('button, [role="button"]')]
      .filter((element) => {
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.visibility !== 'hidden' && style.display !== 'none' && rect.width > 0 && rect.height > 0;
      })
      .filter((element) => ![element.getAttribute('aria-label'), element.getAttribute('title'), element.textContent].some((value) => value?.trim()))
      .length,
  }));
  expect(result.overflow).toBeLessThanOrEqual(1);
  expect(result.duplicateIds).toEqual([]);
  expect(result.unnamedButtons).toBe(0);
}

async function setPreferences(page: Page, language: 'en' | 'ar', theme: 'light' | 'dark') {
  await page.evaluate(({ languageValue, themeValue }) => {
    localStorage.setItem('grc-language', languageValue);
    localStorage.setItem('grc-theme', themeValue);
  }, { languageValue: language, themeValue: theme });
}

test.describe('UI-9 responsive, dark, RTL and accessibility reconciliation', () => {
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

  test('covers every accepted module family and captures representative visual evidence', async ({ page }, testInfo) => {
    const proof = await prepare(page);

    await page.setViewportSize({ width: 1440, height: 1000 });
    await openPage(page, 'home');
    await expectContained(page);
    await capture(page, testInfo, '01-desktop-light-shell-home');

    await setPreferences(page, 'en', 'dark');
    await openPage(page, 'dashboard');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expectContained(page);
    await capture(page, testInfo, '02-desktop-dark-executive');

    await setPreferences(page, 'en', 'light');
    await page.setViewportSize({ width: 1024, height: 900 });
    await openPage(page, 'governance');
    await expectContained(page);
    await capture(page, testInfo, '03-governance-1024');

    await page.setViewportSize({ width: 768, height: 900 });
    await openPage(page, 'documents');
    await expectContained(page);
    await capture(page, testInfo, '04-policy-register-768');

    await page.setViewportSize({ width: 390, height: 844 });
    await openPage(page, 'home');
    await expectContained(page);
    await capture(page, testInfo, '05-home-mobile-390');

    await openPage(page, 'risks');
    await expect(page.getByTestId('ui3-risk-register')).toBeVisible();
    await expectContained(page);
    await capture(page, testInfo, '06-risk-register-mobile-390');

    await openPage(page, 'sops');
    await page.getByText('SOP-002', { exact: true }).first().click();
    await page.getByRole('button', { name: /Procedure Builder/i }).click();
    await expect(page.locator('input[value="Electronic medication order verification record"]')).toBeVisible();
    await expectContained(page);
    await capture(page, testInfo, '07-sop-builder-mobile-390');

    await page.setViewportSize({ width: 1440, height: 1000 });
    await setPreferences(page, 'en', 'dark');
    await openPage(page, 'governance');
    await expectContained(page);
    await capture(page, testInfo, '08-governance-dark');

    await setPreferences(page, 'en', 'light');
    await openPage(page, 'compliance');
    await expect(page.getByTestId('ui3-compliance-register')).toBeVisible();
    await capture(page, testInfo, '09-risk-compliance-representative');

    await openPage(page, 'audit');
    await expect(page.getByTestId('ui4-audit-dashboard')).toBeVisible();
    await capture(page, testInfo, '10-audit-representative');

    await openPage(page, 'capa');
    await expect(page.getByTestId('ui4-capa-dashboard')).toBeVisible();
    await capture(page, testInfo, '11-capa-representative');

    await openPage(page, 'trainingGovernance');
    await expect(page.getByTestId('ui5-training-dashboard')).toBeVisible();
    await capture(page, testInfo, '12-training-representative');

    await openPage(page, 'ovr');
    await expect(page.locator('.ui5-workspace-tabs')).toBeVisible();
    await capture(page, testInfo, '13-ovr-representative');

    await openPage(page, 'projects');
    await expect(page.getByTestId('ui6-project-overview')).toBeVisible();
    await capture(page, testInfo, '14-projects-representative');

    await openPage(page, 'evidence');
    await expect(page.getByTestId('ui6-evidence-overview')).toBeVisible();
    await capture(page, testInfo, '15-evidence-representative');

    await openPage(page, 'approvals');
    await expect(page.getByTestId('ui7-approval-inbox')).toBeVisible();
    await capture(page, testInfo, '16-approvals-representative');

    await openPage(page, 'reportsHub');
    await expect(page.getByTestId('ui7-reports-overview')).toBeVisible();
    await capture(page, testInfo, '17-reports-representative');

    await openPage(page, 'adminHub');
    await expect(page.getByTestId('ui8-admin-overview')).toBeVisible();
    await capture(page, testInfo, '18-administration-representative');

    await setPreferences(page, 'ar', 'light');
    await openPage(page, 'risks');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expectContained(page);
    await capture(page, testInfo, '19-arabic-rtl-desktop');

    await page.setViewportSize({ width: 390, height: 844 });
    await openPage(page, 'adminHub');
    await expect(page.getByTestId('ui8-admin-overview')).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    const rtlUsersTab = page.locator('.ui8-tabs button').nth(1);
    await rtlUsersTab.focus();
    await page.keyboard.press('Tab');
    await expect.poll(() => page.evaluate(() => document.activeElement !== document.body)).toBe(true);
    await expectContained(page);
    await capture(page, testInfo, '20-arabic-rtl-mobile-390');

    await setPreferences(page, 'en', 'light');
    await page.setViewportSize({ width: 1440, height: 1000 });
    await openPage(page, 'risks');
    const newRisk = page.getByRole('button', { name: 'New risk', exact: true });
    await newRisk.focus();
    await newRisk.click();
    const dialog = page.getByRole('dialog', { name: 'Create risk' });
    await expect(dialog).toBeVisible();
    const closeDialog = dialog.getByRole('button', { name: 'Close' });
    await expect(closeDialog).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect.poll(() => dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
    const lastDialogButton = dialog.getByRole('button').last();
    await lastDialogButton.focus();
    await page.keyboard.press('Tab');
    await expect(closeDialog).toBeFocused();
    await capture(page, testInfo, '21-modal-keyboard-focus');
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(newRisk).toBeFocused();

    await page.setViewportSize({ width: 768, height: 900 });
    await openPage(page, 'adminHub');
    await page.getByRole('button', { name: 'Users & Access', exact: true }).click();
    await expect(page.getByTestId('ui8-admin-users')).toBeVisible();
    await expectContained(page);
    await capture(page, testInfo, '22-dense-table-responsive');

    expect(proof.backend.proof.pageErrors).toEqual([]);
    expect(proof.backend.proof.consoleProblems).toEqual([]);
    expect(proof.backend.proof.writeRequests).toEqual([]);
    expect(proof.ui7.decisionRequests).toEqual([]);
    expect(proof.ui8.protectedReadHeaders.length).toBeGreaterThan(0);
    expect(proof.ui8.protectedReadHeaders.every((value) => value === 'patch83u-frontend-auth-first-v1')).toBe(true);
  });

  test('proves keyboard shell navigation, current-location semantics and mobile drawer focus', async ({ page }) => {
    const proof = await prepare(page);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await openPage(page, 'home');

    await page.keyboard.press('Tab');
    const skipLink = page.getByRole('link', { name: 'Skip to main content' });
    await expect(skipLink).toBeFocused();
    await expect(skipLink).toBeVisible();
    await page.keyboard.press('Enter');
    await expect(page.locator('#platform-main-content')).toBeFocused();
    await expect(page.locator('.modern-sidebar [aria-current="page"]')).toHaveCount(1);

    await page.setViewportSize({ width: 390, height: 844 });
    const trigger = page.getByRole('button', { name: 'Open navigation' });
    await trigger.click();
    await expect(page.locator('#primary-navigation-drawer')).toHaveAttribute('data-mobile-open', 'true');
    await expect(page.getByRole('button', { name: 'Close navigation' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.locator('#primary-navigation-drawer')).toHaveAttribute('data-mobile-open', 'false');
    await expect(trigger).toBeFocused();

    expect(proof.backend.proof.pageErrors).toEqual([]);
    expect(proof.backend.proof.writeRequests).toEqual([]);
  });

});
