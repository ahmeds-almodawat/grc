import { expect, test, type Page } from '@playwright/test';
import { canAccessPageForUser, firstAllowedPage } from '../../src/auth/authAccess';
import { PAGE_LOCATION_REGISTRY } from '../../src/routes/pageLocation';
import {
  buildV14jRoleAssignment,
  V14J_GOVERNED_ROUTES,
  V14J_ROLES,
  type V14jRole,
} from '../helpers/v14jCrossRoleMatrix';
import { startPatch83uTestServer, type Patch83uTestServer } from './patch83uTestServer';
import { installPatch83vBackend, waitForActivePatch83vUser } from './patch83vTestHarness';

let server: Patch83uTestServer | null = null;
let baseUrl = '';

async function expectCurrentPage(page: Page, locationValue: string) {
  await expect.poll(() => new URL(page.url()).searchParams.get('page')).toBe(locationValue);
}

async function expectNativeAccessibilityAndMobileContainment(page: Page) {
  const result = await page.evaluate(() => {
    const visible = (element: Element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
    };
    const ids = [...document.querySelectorAll('[id]')].map((element) => element.id);
    const unnamedButtons = [...document.querySelectorAll('button, [role="button"]')]
      .filter(visible)
      .filter((element) => ![
        element.getAttribute('aria-label'),
        element.getAttribute('title'),
        element.textContent,
      ].some((value) => value?.trim()))
      .map((element) => element.outerHTML.slice(0, 180));
    const imagesWithoutAlt = [...document.querySelectorAll('img')]
      .filter(visible)
      .filter((image) => !image.hasAttribute('alt'))
      .map((image) => image.outerHTML.slice(0, 180));
    return {
      duplicateIds: ids.filter((id, index) => ids.indexOf(id) !== index),
      imagesWithoutAlt,
      overflow: document.documentElement.scrollWidth - window.innerWidth,
      unnamedButtons,
    };
  });

  expect(result.duplicateIds).toEqual([]);
  expect(result.imagesWithoutAlt).toEqual([]);
  expect(result.overflow).toBeLessThanOrEqual(1);
  expect(result.unnamedButtons).toEqual([]);
  await page.keyboard.press('Tab');
  await expect.poll(() => page.evaluate(() => document.activeElement?.tagName ?? 'BODY'))
    .not.toBe('BODY');
}

test.describe('GRC v1.4-J cross-role UAT readiness', () => {
  test.describe.configure({ mode: 'serial' });
  test.setTimeout(600_000);

  test.beforeAll(async () => {
    server = await startPatch83uTestServer({
      VITE_PATCH83U_CREDENTIAL_GOVERNANCE_ENABLED: 'true',
    });
    baseUrl = server.baseUrl;
  });

  test.afterAll(() => {
    server?.stop();
    server = null;
  });

  test('enforces the governed route matrix for all twelve personas without writes', async ({ browser }) => {
    for (const role of V14J_ROLES) {
      const page = await browser.newPage();
      const backend = await installPatch83vBackend(page, role);
      const assignment = buildV14jRoleAssignment(role);
      const fallbackPage = firstAllowedPage([assignment]);

      for (const route of V14J_GOVERNED_ROUTES) {
        await page.goto(`${baseUrl}/?page=${PAGE_LOCATION_REGISTRY[route.page]}`);
        await waitForActivePatch83vUser(page, role);
        const expectedPage = canAccessPageForUser(route.page, [assignment])
          ? route.page
          : fallbackPage;
        await expectCurrentPage(page, PAGE_LOCATION_REGISTRY[expectedPage]);
        await expect(page.locator('.modern-main-content')).toBeVisible();
      }

      expect(backend.proof.writeRequests, role).toEqual([]);
      expect(backend.proof.pageErrors, role).toEqual([]);
      await page.close();
    }
  });

  test('keeps every persona accessible in Arabic RTL at 390px with empty data', async ({ browser }) => {
    for (const role of V14J_ROLES) {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
      await page.addInitScript(() => localStorage.setItem('grc-language', 'ar'));
      const backend = await installPatch83vBackend(page, role);

      await page.goto(`${baseUrl}/?page=${PAGE_LOCATION_REGISTRY.ovr}`);
      await waitForActivePatch83vUser(page, role);
      await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
      await expect(page.locator('.modern-main-content')).toBeVisible();
      await expectNativeAccessibilityAndMobileContainment(page);

      expect(backend.proof.writeRequests, role).toEqual([]);
      expect(backend.proof.pageErrors, role).toEqual([]);
      await page.close();
    }
  });

  test('renders empty and fail-closed authorization error states without data writes', async ({ browser }) => {
    const emptyPage = await browser.newPage();
    const emptyBackend = await installPatch83vBackend(emptyPage, 'viewer');
    await emptyPage.goto(`${baseUrl}/?page=${PAGE_LOCATION_REGISTRY.approvals}`);
    await waitForActivePatch83vUser(emptyPage, 'viewer');
    await expect(emptyPage.getByText('No approvals match the selected filter')).toBeVisible();
    expect(emptyBackend.proof.writeRequests).toEqual([]);
    await emptyPage.close();

    const errorPage = await browser.newPage();
    const errorBackend = await installPatch83vBackend(errorPage, 'employee');
    await errorPage.route('**/rest/v1/profiles*', (route) => route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ code: 'J_SYNTHETIC_AUTHORIZATION_READ_FAILURE' }),
    }));
    await errorPage.goto(`${baseUrl}/?page=${PAGE_LOCATION_REGISTRY.ovr}`);
    await expect(errorPage.getByRole('heading', { name: 'Application access unavailable' })).toBeVisible();
    await expect(errorPage.getByRole('alert')).toContainText(
      'Authorization data could not be verified. No application data has been opened.',
    );
    expect(errorBackend.proof.writeRequests).toEqual([]);
    expect(errorBackend.proof.pageErrors).toEqual([]);
    await errorPage.close();
  });
});
