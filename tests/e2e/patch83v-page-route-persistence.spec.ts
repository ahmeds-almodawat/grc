import { expect, test } from '@playwright/test';
import { startPatch83uTestServer, type Patch83uTestServer } from './patch83uTestServer';
import {
  dispatchFocusAndVisibility,
  documentProof,
  historyProof,
  installPatch83vBackend,
  waitForActivePatch83vUser,
} from './patch83vTestHarness';

let server: Patch83uTestServer | null = null;
let baseUrl = '';

test.describe('Patch 83V page route persistence', () => {
  test.describe.configure({ mode: 'serial' });

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

  test('preserves User Management and safe query state across a browser refresh', async ({ page }) => {
    const backend = await installPatch83vBackend(page);
    await page.goto(
      `${baseUrl}/?campaign=patch83v&page=admin&password=secret#user/4dcfd619-8fc3-40e1-88cb-58f7af7158e6`,
    );
    await waitForActivePatch83vUser(page);
    await expect(page.getByRole('heading', { name: 'User Management Center' })).toBeVisible();
    expect(new URL(page.url()).searchParams.get('page')).toBe('admin');
    expect(new URL(page.url()).searchParams.get('campaign')).toBe('patch83v');
    expect(new URL(page.url()).searchParams.has('password')).toBe(false);
    expect(new URL(page.url()).hash).toBe('');
    const beforeReload = await documentProof(page);

    await page.reload();
    await waitForActivePatch83vUser(page);
    await expect(page.getByRole('heading', { name: 'User Management Center' })).toBeVisible();
    await expect(page.locator('.workspace-home')).toHaveCount(0);
    expect(new URL(page.url()).searchParams.get('page')).toBe('admin');
    expect(new URL(page.url()).searchParams.get('campaign')).toBe('patch83v');
    const afterReload = await documentProof(page);
    expect(afterReload.bootCount).toBe(beforeReload.bootCount + 1);
    expect(afterReload.timeOrigin).not.toBe(beforeReload.timeOrigin);
    expect(backend.proof.writeRequests).toEqual([]);
  });

  test('uses pushState navigation and restores Home, Departments, and User Management with Back and Forward', async ({ page }) => {
    const backend = await installPatch83vBackend(page);
    await page.goto(`${baseUrl}/?page=home`);
    await waitForActivePatch83vUser(page);
    await expect(page.locator('.workspace-home')).toBeVisible();

    await page.locator('.nav-child-item').filter({ hasText: 'Departments' }).click();
    await expect(page.getByText('Master tracking across departments', { exact: true })).toBeVisible();
    expect(new URL(page.url()).searchParams.get('page')).toBe('departments');

    await page.locator('.nav-child-item').filter({ hasText: 'User Management' }).click();
    await expect(page.getByRole('heading', { name: 'User Management Center' })).toBeVisible();
    expect(new URL(page.url()).searchParams.get('page')).toBe('admin');

    const pushed = await historyProof(page);
    expect(pushed.push.some((url) => url.includes('page=departments'))).toBe(true);
    expect(pushed.push.some((url) => url.includes('page=admin'))).toBe(true);

    await page.goBack();
    await expect(page.getByText('Master tracking across departments', { exact: true })).toBeVisible();
    expect(new URL(page.url()).searchParams.get('page')).toBe('departments');
    await page.goBack();
    await expect(page.locator('.workspace-home')).toBeVisible();
    expect(new URL(page.url()).searchParams.get('page')).toBe('home');
    await page.goForward();
    await expect(page.getByText('Master tracking across departments', { exact: true })).toBeVisible();
    expect(new URL(page.url()).searchParams.get('page')).toBe('departments');
    expect(backend.proof.writeRequests).toEqual([]);
  });

  test('replaces an unauthorized deep link with the viewer first-allowed page', async ({ page }) => {
    const backend = await installPatch83vBackend(page, 'viewer');
    await page.goto(`${baseUrl}/?campaign=patch83v&page=admin`);
    await waitForActivePatch83vUser(page, 'viewer');
    await expect(page.locator('.workspace-home')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'User Management Center' })).toHaveCount(0);
    const url = new URL(page.url());
    expect(url.searchParams.get('page')).toBe('home');
    expect(url.searchParams.get('campaign')).toBe('patch83v');
    const writes = await historyProof(page);
    expect(writes.replace.some((value) => value.includes('page=home'))).toBe(true);
    expect(writes.push).toEqual([]);
    expect(backend.proof.writeRequests).toEqual([]);
  });

  test('keeps the active page and canonical URL unchanged during a delayed same-user revalidation', async ({ page }) => {
    const backend = await installPatch83vBackend(page);
    await page.goto(`${baseUrl}/?campaign=patch83v&page=admin`);
    await waitForActivePatch83vUser(page);
    await expect(page.getByRole('heading', { name: 'User Management Center' })).toBeVisible();
    const expectedUrl = page.url();
    const credentialCount = backend.proof.credentialRequests.length;

    backend.delayNextCredentialResponse();
    await dispatchFocusAndVisibility(page);
    await expect.poll(() => backend.proof.credentialRequests.length)
      .toBe(credentialCount + 1);
    await expect(page.getByText('Loading secure session...')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'User Management Center' })).toBeVisible();
    expect(page.url()).toBe(expectedUrl);

    backend.releaseDelayedCredentialResponse();
    await expect.poll(() => backend.proof.credentialResponsesFulfilled)
      .toBe(credentialCount + 1);
    expect(backend.proof.credentialResponsesAborted).toBe(0);
    await expect(page.getByRole('heading', { name: 'User Management Center' })).toBeVisible();
    expect(page.url()).toBe(expectedUrl);
    expect(backend.proof.writeRequests).toEqual([]);
  });

  for (const [pathname, heading, canonicalPage] of [
    ['/production-operator-console', 'Production Operator Console', 'production-operator-console'],
    ['/production-evidence-closure', 'Production Evidence Closure', 'production-evidence-closure'],
  ] as const) {
    test(`keeps the historical ${pathname} alias and adds its canonical page value`, async ({ page }) => {
      const backend = await installPatch83vBackend(page);
      await page.goto(`${baseUrl}${pathname}?campaign=patch83v`);
      await waitForActivePatch83vUser(page);
      await expect(page.getByRole('heading', { name: heading })).toBeVisible();
      const url = new URL(page.url());
      expect(url.pathname).toBe(pathname);
      expect(url.searchParams.get('page')).toBe(canonicalPage);
      expect(url.searchParams.get('campaign')).toBe('patch83v');
      expect(backend.proof.writeRequests).toEqual([]);
    });
  }
});
