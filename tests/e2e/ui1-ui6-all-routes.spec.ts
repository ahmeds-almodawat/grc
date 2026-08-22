import { expect, test } from '@playwright/test';
import { PAGE_LOCATION_REGISTRY } from '../../src/routes/pageLocation';
import { startPatch83uTestServer, type Patch83uTestServer } from './patch83uTestServer';
import { installPatch83vBackend, waitForActivePatch83vUser } from './patch83vTestHarness';

let server: Patch83uTestServer | null = null;
let baseUrl = '';

test.describe('UI-1 through UI-6 canonical route stabilization', () => {
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

  test('renders every registered page through its unique canonical query route without writes', async ({ page }) => {
    const backend = await installPatch83vBackend(page);

    for (const [pageKey, locationValue] of Object.entries(PAGE_LOCATION_REGISTRY)) {
      await test.step(`${pageKey} -> ${locationValue}`, async () => {
        await page.goto(`${baseUrl}/?page=${locationValue}`);
        await waitForActivePatch83vUser(page);
        await expect.poll(() => new URL(page.url()).searchParams.get('page')).toBe(locationValue);
        await expect(page.locator('.modern-main-content')).toBeVisible();
        await expect(page.getByRole('heading', { name: 'Application access unavailable' })).toHaveCount(0);
        await expect(page.getByRole('heading', { name: 'Deployment compatibility required' })).toHaveCount(0);
      });
    }

    expect(backend.proof.writeRequests).toEqual([]);
    expect(backend.proof.pageErrors).toEqual([]);
  });
});
