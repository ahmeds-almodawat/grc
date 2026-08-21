import { expect, test, type Page } from '@playwright/test';
import { PAGE_LOCATION_REGISTRY, type PageKey } from '../../src/routes/pageLocation';
import { startPatch83uTestServer, type Patch83uTestServer } from './patch83uTestServer';
import { installPatch83vBackend, waitForActivePatch83vUser } from './patch83vTestHarness';

const viewports = [
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1366, height: 768 },
];

const governedPages: PageKey[] = [
  'ovr',
  'documents',
  'trainingGovernance',
  'evidence',
  'risks',
  'audit',
  'approvals',
];

let server: Patch83uTestServer | null = null;
let baseUrl = '';

async function expectResponsiveSurface(page: Page, viewportWidth: number) {
  const proof = await page.evaluate(() => {
    const visible = (element: Element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
    };
    const documentOverflow = document.documentElement.scrollWidth - window.innerWidth;
    const main = document.querySelector('.modern-main-content');
    const mainRect = main?.getBoundingClientRect() ?? null;
    const overflowingFields = [...document.querySelectorAll('input, select, textarea')]
      .filter(visible)
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        return rect.left < -1 || rect.right > window.innerWidth + 1;
      })
      .map((element) => element.outerHTML.slice(0, 140));
    const uncontainedTables = [...document.querySelectorAll('table')]
      .filter(visible)
      .filter((table) => {
        const rect = table.getBoundingClientRect();
        if (rect.width <= window.innerWidth + 1) return false;
        let parent = table.parentElement;
        while (parent && parent !== document.body) {
          const overflowX = getComputedStyle(parent).overflowX;
          if (overflowX === 'auto' || overflowX === 'scroll') return false;
          parent = parent.parentElement;
        }
        return true;
      })
      .map((table) => table.className || table.tagName);
    const undersizedButtons = [...document.querySelectorAll('.modern-main-content button, .modal-card button')]
      .filter(visible)
      .filter((button) => {
        const rect = button.getBoundingClientRect();
        return rect.width < 40 || rect.height < 40;
      })
      .map((button) => ({
        text: (button.textContent ?? '').trim().slice(0, 60),
        className: button.className,
        width: Math.round(button.getBoundingClientRect().width),
        height: Math.round(button.getBoundingClientRect().height),
      }));
    return { documentOverflow, mainRect, overflowingFields, uncontainedTables, undersizedButtons };
  });

  expect(proof.documentOverflow).toBeLessThanOrEqual(1);
  expect(proof.mainRect?.left ?? 0).toBeGreaterThanOrEqual(-1);
  expect(proof.mainRect?.right ?? viewportWidth).toBeLessThanOrEqual(viewportWidth + 1);
  expect(proof.overflowingFields).toEqual([]);
  expect(proof.uncontainedTables).toEqual([]);
  if (viewportWidth === 390) expect(proof.undersizedButtons).toEqual([]);
}

test.describe('GRC v1.4-H responsive and mobile completion', () => {
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

  test('contains governed pages at every required viewport without writes', async ({ page }) => {
    const backend = await installPatch83vBackend(page);

    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      for (const pageKey of governedPages) {
        await page.goto(`${baseUrl}/?page=${PAGE_LOCATION_REGISTRY[pageKey]}`);
        await waitForActivePatch83vUser(page);
        await expect(page.locator('.modern-main-content')).toBeVisible();
        await expectResponsiveSurface(page, viewport.width);
      }
    }

    expect(backend.proof.writeRequests).toEqual([]);
    expect(backend.proof.pageErrors).toEqual([]);
  });

  test('keeps Arabic RTL mobile pages and navigation inside the viewport', async ({ page }) => {
    const backend = await installPatch83vBackend(page);
    await page.addInitScript(() => localStorage.setItem('grc-language', 'ar'));
    await page.setViewportSize({ width: 390, height: 844 });

    for (const pageKey of governedPages) {
      await page.goto(`${baseUrl}/?page=${PAGE_LOCATION_REGISTRY[pageKey]}`);
      await waitForActivePatch83vUser(page);
      await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
      await expectResponsiveSurface(page, 390);
    }

    const menuButton = page.locator('.mobile-nav-trigger');
    await menuButton.click();
    await expect(page.locator('.modern-sidebar')).toHaveClass(/mobile-nav-open/);
    await expectResponsiveSurface(page, 390);
    await page.locator('.mobile-nav-backdrop').click({ position: { x: 2, y: 2 } });
    await expect(page.locator('.modern-sidebar')).not.toHaveClass(/mobile-nav-open/);

    expect(backend.proof.writeRequests).toEqual([]);
    expect(backend.proof.pageErrors).toEqual([]);
  });

  test('keeps governed forms and modal actions reachable at 390px', async ({ page }) => {
    const backend = await installPatch83vBackend(page);
    await page.setViewportSize({ width: 390, height: 844 });

    for (const target of [
      { pageKey: 'risks' as const, button: 'New Risk' },
      { pageKey: 'audit' as const, button: 'New Finding' },
    ]) {
      await page.goto(`${baseUrl}/?page=${PAGE_LOCATION_REGISTRY[target.pageKey]}`);
      await waitForActivePatch83vUser(page);
      await page.getByRole('button', { name: target.button, exact: true }).click();
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();
      const box = await dialog.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.x).toBeGreaterThanOrEqual(-1);
      expect(box!.x + box!.width).toBeLessThanOrEqual(391);
      expect(box!.y).toBeGreaterThanOrEqual(-1);
      expect(box!.y + box!.height).toBeLessThanOrEqual(845);
      await expectResponsiveSurface(page, 390);
      const actions = dialog.locator('.form-actions');
      await actions.scrollIntoViewIfNeeded();
      await expect(actions).toBeVisible();
      await expect(dialog.getByRole('button', { name: 'Close', exact: true })).toBeVisible();
      await dialog.getByRole('button', { name: 'Close', exact: true }).click();
    }

    await page.goto(`${baseUrl}/?page=${PAGE_LOCATION_REGISTRY.ovr}`);
    await waitForActivePatch83vUser(page);
    await page.getByRole('button', { name: 'New OVR Report', exact: true }).click();
    await expect(page.locator('.form-grid').first()).toBeVisible();
    await expectResponsiveSurface(page, 390);

    await page.goto(`${baseUrl}/?page=${PAGE_LOCATION_REGISTRY.documents}`);
    await waitForActivePatch83vUser(page);
    await page.getByRole('button', { name: 'New Policy', exact: true }).first().click();
    await expect(page.getByRole('heading', { name: 'New Governed Policy', exact: true })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'e.g. Clinical Data Privacy & Security Policy' })).toBeVisible();
    await expectResponsiveSurface(page, 390);

    expect(backend.proof.writeRequests).toEqual([]);
    expect(backend.proof.pageErrors).toEqual([]);
  });
});
