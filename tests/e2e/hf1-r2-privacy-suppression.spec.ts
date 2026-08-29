import { expect, test } from '@playwright/test';
import { startPatch83uTestServer, type Patch83uTestServer } from './patch83uTestServer';
import { installPatch83vBackend, waitForActivePatch83vUser } from './patch83vTestHarness';
import { installUi2FixtureData } from './ui2Fixtures';

let server: Patch83uTestServer | null = null;
let baseUrl = '';

test.describe('HF-1-R2 privacy suppression dashboard UX', () => {
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

  for (const role of ['super_admin', 'executive'] as const) {
    test(`${role} sees privacy suppression without a false zero or oversized lock`, async ({ page }, testInfo) => {
      const backend = await installPatch83vBackend(page, role);
      await installUi2FixtureData(page, { analyticsMode: 'privacy-suppressed' });
      await page.addInitScript(() => {
        if (!localStorage.getItem('grc-theme')) {
          localStorage.setItem('grc-theme', 'light');
        }
        localStorage.setItem('grc-language', 'en');
        localStorage.removeItem('grc-sidebar-collapsed');
      });
      await page.setViewportSize({ width: 1440, height: 1000 });
      await page.goto(`${baseUrl}/?page=dashboard`);
      await waitForActivePatch83vUser(page, role);

      const dashboard = page.locator('.grc-dashboard');
      const trend = page.locator('.grc-dashboard-trend-panel');
      const openOvr = page.locator('.grc-metric-card').filter({ hasText: 'Open OVR' });
      await expect(dashboard).toBeVisible();
      await expect(openOvr.locator('.grc-metric-card__value')).toHaveText('<5');
      const privacyNotice = trend.locator('.grc-safe-trend__privacy-note');
      await expect(privacyNotice).toHaveText('<5Privacy protected');
      await expect(privacyNotice).toHaveAttribute('title', 'Exact values remain hidden to protect confidentiality.');
      await expect(privacyNotice).not.toContainText('Exact values');
      await expect(trend.locator('.grc-safe-trend__range[aria-label="New reports, 2025-09: 0"]')).toHaveCount(1);
      await expect(trend.locator('.grc-safe-trend__range[aria-label*="2025-10:"]')).toHaveCount(0);
      await expect(trend.getByText('3', { exact: true })).toHaveCount(0);
      await expect(openOvr.getByText('3', { exact: true })).toHaveCount(0);

      const lockSize = await trend.locator('.grc-safe-trend__privacy-icon svg').evaluate(element => {
        const rect = element.getBoundingClientRect();
        return { width: rect.width, height: rect.height };
      });
      expect(lockSize.width).toBeLessThanOrEqual(16);
      expect(lockSize.height).toBeLessThanOrEqual(16);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);

      if (role === 'super_admin') {
        await page.screenshot({ path: testInfo.outputPath('hf1-r2-privacy-suppression-light.png'), animations: 'disabled', fullPage: true });
        await page.evaluate(() => localStorage.setItem('grc-theme', 'dark'));
        await page.reload();
        await waitForActivePatch83vUser(page, role);
        await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
        await expect(page.locator('.grc-safe-trend__privacy-note')).toBeVisible();

        await page.setViewportSize({ width: 390, height: 844 });
        await page.reload();
        await expect(page.locator('.auth-user-pill')).toBeAttached();
        await expect(page.locator('.grc-safe-trend__privacy-note')).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
      }

      expect(backend.proof.writeRequests).toEqual([]);
      expect(backend.proof.pageErrors).toEqual([]);
    });
  }
});
