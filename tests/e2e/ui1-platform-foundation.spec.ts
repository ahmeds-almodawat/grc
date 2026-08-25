import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { PAGE_LOCATION_REGISTRY, type PageKey } from '../../src/routes/pageLocation';
import { startPatch83uTestServer, type Patch83uTestServer } from './patch83uTestServer';
import { installPatch83vBackend, waitForActivePatch83vUser } from './patch83vTestHarness';

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
  await page.screenshot({ path: testInfo.outputPath(`${name}.png`), animations: 'disabled' });
}

async function shellGeometry(page: Page) {
  return page.evaluate(() => {
    const sidebar = document.querySelector('.modern-sidebar')?.getBoundingClientRect();
    const header = document.querySelector('.modern-topbar')?.getBoundingClientRect();
    const main = document.querySelector('.modern-main-content')?.getBoundingClientRect();
    return {
      sidebarWidth: sidebar?.width ?? 0,
      headerHeight: header?.height ?? 0,
      mainLeft: main?.left ?? 0,
      mainRight: main?.right ?? 0,
      overflow: document.documentElement.scrollWidth - window.innerWidth,
      sidebarBackground: getComputedStyle(document.querySelector('.modern-sidebar') as Element).backgroundColor,
      appBackground: getComputedStyle(document.body).backgroundColor,
    };
  });
}

async function expectDesktopTopbarContained(page: Page) {
  const geometry = await page.evaluate(() => {
    const search = document.querySelector('.topbar-global-search')?.getBoundingClientRect();
    const actions = document.querySelector('.topbar-actions')?.getBoundingClientRect();
    const topbar = document.querySelector('.modern-topbar')?.getBoundingClientRect();
    return {
      topbar: topbar ? { left: topbar.left, right: topbar.right, top: topbar.top, bottom: topbar.bottom } : null,
      viewportWidth: window.innerWidth,
      searchLeft: search?.left ?? -1,
      searchRight: search?.right ?? Number.POSITIVE_INFINITY,
      searchTop: search?.top ?? -1,
      searchBottom: search?.bottom ?? Number.POSITIVE_INFINITY,
      actionsLeft: actions?.left ?? -1,
      actionsRight: actions?.right ?? Number.POSITIVE_INFINITY,
      actionsTop: actions?.top ?? -1,
      actionsBottom: actions?.bottom ?? Number.POSITIVE_INFINITY,
    };
  });
  expect(geometry.searchLeft).toBeGreaterThanOrEqual(0);
  expect(geometry.searchRight).toBeLessThanOrEqual(geometry.viewportWidth);
  expect(geometry.searchTop).toBeGreaterThanOrEqual(0);
  expect(geometry.searchBottom).toBeLessThanOrEqual(70);
  expect(geometry.actionsLeft).toBeGreaterThanOrEqual(0);
  expect(geometry.actionsRight).toBeLessThanOrEqual(geometry.viewportWidth);
  expect(geometry.actionsTop).toBeGreaterThanOrEqual(0);
  expect(geometry.actionsBottom).toBeLessThanOrEqual(70);
}

test.describe('UI-1 platform foundation visual gate', () => {
  test.describe.configure({ mode: 'serial' });
  test.setTimeout(180_000);

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

  test('captures desktop Light shell, executive, register and shared-system surfaces', async ({ page }, testInfo) => {
    const backend = await installPatch83vBackend(page);
    await page.addInitScript(() => {
      localStorage.setItem('grc-theme', 'light');
      localStorage.setItem('grc-language', 'en');
      localStorage.removeItem('grc-sidebar-collapsed');
    });
    await page.setViewportSize({ width: 1440, height: 1000 });

    await openPage(page, 'home');
    const geometry = await shellGeometry(page);
    expect(geometry.sidebarWidth).toBeGreaterThanOrEqual(220);
    expect(geometry.sidebarWidth).toBeLessThanOrEqual(236);
    expect(geometry.headerHeight).toBeGreaterThanOrEqual(60);
    expect(geometry.headerHeight).toBeLessThanOrEqual(70);
    expect(geometry.overflow).toBeLessThanOrEqual(1);
    expect(geometry.sidebarBackground).toBe('rgb(255, 255, 255)');
    await expectDesktopTopbarContained(page);
    const heroSurface = await page.locator('.workspace-hero').evaluate((element) => ({
      backgroundImage: getComputedStyle(element).backgroundImage,
      borderRadius: getComputedStyle(element).borderRadius,
      decoration: getComputedStyle(element, '::after').content,
    }));
    expect(heroSurface.backgroundImage).toBe('none');
    expect(heroSurface.borderRadius).toBe('0px');
    expect(heroSurface.decoration).toBe('none');
    await capture(page, testInfo, 'desktop-light-home');

    await openPage(page, 'dashboard');
    await expect(page.locator('.topbar-global-search')).toBeVisible();
    await expect(page.locator('.topbar-actions')).toBeVisible();
    await expectDesktopTopbarContained(page);
    await capture(page, testInfo, 'desktop-light-executive');
    await openPage(page, 'documents');
    await expectDesktopTopbarContained(page);
    await capture(page, testInfo, 'desktop-light-policy-register');
    await openPage(page, 'globalSearch');
    await expectDesktopTopbarContained(page);
    await capture(page, testInfo, 'desktop-light-shared-search');

    expect(backend.proof.writeRequests).toEqual([]);
    expect(backend.proof.pageErrors).toEqual([]);
  });

  test('captures desktop Dark with intentional surfaces', async ({ page }, testInfo) => {
    const backend = await installPatch83vBackend(page);
    await page.addInitScript(() => {
      localStorage.setItem('grc-theme', 'dark');
      localStorage.setItem('grc-language', 'en');
      localStorage.removeItem('grc-sidebar-collapsed');
    });
    await page.setViewportSize({ width: 1440, height: 1000 });

    await openPage(page, 'home');
    const geometry = await shellGeometry(page);
    expect(geometry.overflow).toBeLessThanOrEqual(1);
    expect(geometry.sidebarBackground).toBe('rgb(7, 17, 29)');
    expect(geometry.appBackground).toBe('rgb(7, 15, 26)');
    const heroSurface = await page.locator('.workspace-hero').evaluate((element) => ({
      backgroundImage: getComputedStyle(element).backgroundImage,
      borderRadius: getComputedStyle(element).borderRadius,
      decoration: getComputedStyle(element, '::after').content,
    }));
    expect(heroSurface.backgroundImage).toBe('none');
    expect(heroSurface.borderRadius).toBe('0px');
    expect(heroSurface.decoration).toBe('none');
    await capture(page, testInfo, 'desktop-dark-home');
    await openPage(page, 'dashboard');
    await capture(page, testInfo, 'desktop-dark-executive');
    await openPage(page, 'documents');
    await capture(page, testInfo, 'desktop-dark-policy-register');
    await openPage(page, 'globalSearch');
    await capture(page, testInfo, 'desktop-dark-shared-search');

    expect(backend.proof.writeRequests).toEqual([]);
    expect(backend.proof.pageErrors).toEqual([]);
  });

  test('captures 390px LTR and RTL shell, cards, table transformation and drawer', async ({ page }, testInfo) => {
    const backend = await installPatch83vBackend(page);
    await page.addInitScript(() => {
      localStorage.setItem('grc-theme', 'light');
      localStorage.setItem('grc-language', 'en');
    });
    await page.setViewportSize({ width: 390, height: 844 });

    await openPage(page, 'home');
    expect((await shellGeometry(page)).overflow).toBeLessThanOrEqual(1);
    await expect(page.locator('.mobile-bottom-nav')).toBeVisible();
    await capture(page, testInfo, 'mobile-390-light-home');

    await openPage(page, 'documents');
    expect((await shellGeometry(page)).overflow).toBeLessThanOrEqual(1);
    await capture(page, testInfo, 'mobile-390-light-policy-register');

    await openPage(page, 'globalSearch');
    await page.locator('.mobile-nav-trigger').click();
    await expect(page.locator('.modern-sidebar')).toHaveClass(/mobile-nav-open/);
    await capture(page, testInfo, 'mobile-390-light-drawer');

    await page.locator('.sidebar-account .platform-icon-button').first().click();
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('.modern-sidebar')).toHaveClass(/mobile-nav-open/);
    expect((await shellGeometry(page)).overflow).toBeLessThanOrEqual(1);
    await capture(page, testInfo, 'mobile-390-rtl-drawer');

    expect(backend.proof.writeRequests).toEqual([]);
    expect(backend.proof.pageErrors).toEqual([]);
  });
});
