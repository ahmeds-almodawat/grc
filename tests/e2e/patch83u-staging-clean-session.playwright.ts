import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test';

const STAGING_REF = 'zghsgzrdwbqdrpuxanac';
const PRODUCTION_REF = 'zbrjjecpsrzposhuarcn';
const PROFILE_RECONCILIATION_MESSAGE =
  'Signed-in user has no profile record. Ask an administrator to reconcile the account.';

async function createNetworkIsolatedContext(
  browser: Browser,
  options: { interceptMissingProfile?: boolean } = {},
) {
  const context = await browser.newContext({
    serviceWorkers: 'block',
  });
  const blockedExternalHosts = new Set<string>();
  const interceptedStagingPaths = new Set<string>();
  await context.route('https://**/*', async route => {
    const url = new URL(route.request().url());
    if (
      options.interceptMissingProfile
      && url.hostname === `${STAGING_REF}.supabase.co`
      && url.pathname.startsWith('/rest/v1/profiles')
    ) {
      interceptedStagingPaths.add(url.pathname);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: '[]',
        headers: { 'content-range': '*/0' },
      });
      return;
    }
    blockedExternalHosts.add(url.hostname);
    await route.abort('blockedbyclient');
  });
  return { context, blockedExternalHosts, interceptedStagingPaths };
}

async function expectSignedOutLogin(page: Page) {
  await expect(page.getByRole('heading', { name: /^(Sign in|تسجيل الدخول)$/ })).toBeVisible();
  expect(await page.getByText(PROFILE_RECONCILIATION_MESSAGE, { exact: true }).count()).toBe(0);
  expect(await page.getByText(/Access denied|تعذر الوصول/i).count()).toBe(0);
}

async function loadedProjectRef(page: Page): Promise<string | null> {
  return page.evaluate(async () => {
    const config = await import('/src/lib/supabase.ts');
    return config.supabaseProjectRef;
  });
}

async function authStorageKeyNames(page: Page): Promise<string[]> {
  return page.evaluate(() => [
    ...Object.keys(localStorage),
    ...Object.keys(sessionStorage),
  ].filter(key => key.includes('auth')).sort());
}

async function closeContext(context: BrowserContext) {
  await context.close();
}

function syntheticSession(projectRef: string) {
  const future = Math.floor(Date.now() / 1_000) + 3_600;
  const userId = '00000000-0000-4000-8000-000000000222';
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const accessToken = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({
    iss: `https://${projectRef}.supabase.co/auth/v1`,
    sub: userId,
    aud: 'authenticated',
    exp: future,
  })}.synthetic-signature`;
  return {
    access_token: accessToken,
    refresh_token: 'synthetic-refresh',
    expires_at: future,
    user: { id: userId, aud: 'authenticated' },
  };
}

test.describe('Patch 83U staging clean-session startup', () => {
  test('a brand-new nonpersistent context stays signed out before and after reload', async ({ browser }) => {
    const { context, blockedExternalHosts } = await createNetworkIsolatedContext(browser);
    try {
      const page = await context.newPage();
      const response = await page.goto('/', { waitUntil: 'domcontentloaded' });
      expect(response?.status()).toBe(200);
      expect(new URL(page.url()).pathname).toBe('/');
      await expectSignedOutLogin(page);
      expect(await loadedProjectRef(page)).toBe(STAGING_REF);
      expect((await authStorageKeyNames(page)).filter(key => (
        key.startsWith('grc-control-center-auth') || key.startsWith('sb-')
      ))).toEqual([]);

      const reloadResponse = await page.reload({ waitUntil: 'domcontentloaded' });
      expect(reloadResponse?.status()).toBe(200);
      await expectSignedOutLogin(page);
      expect(await loadedProjectRef(page)).toBe(STAGING_REF);
      expect(blockedExternalHosts).toEqual(new Set());
      expect([...blockedExternalHosts].some(host => host.includes(PRODUCTION_REF))).toBe(false);
    } finally {
      await closeContext(context);
    }
  });

  test('a production-project legacy blob is never imported into staging', async ({ browser }) => {
    const { context, blockedExternalHosts } = await createNetworkIsolatedContext(browser);
    await context.addInitScript(({ session }) => {
      localStorage.setItem('grc-control-center-auth', JSON.stringify(session));
    }, {
      session: syntheticSession(PRODUCTION_REF),
    });

    try {
      const page = await context.newPage();
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await expectSignedOutLogin(page);
      expect(await loadedProjectRef(page)).toBe(STAGING_REF);
      expect(await authStorageKeyNames(page)).toContain('grc-control-center-auth');
      expect(await authStorageKeyNames(page))
        .not.toContain(`grc-control-center-auth:${STAGING_REF}`);
      expect(blockedExternalHosts).toEqual(new Set());
    } finally {
      await closeContext(context);
    }
  });

  test('removing the accepted current-project session clears stale profile denial', async ({ browser }) => {
    const {
      context,
      blockedExternalHosts,
      interceptedStagingPaths,
    } = await createNetworkIsolatedContext(browser, { interceptMissingProfile: true });
    await context.addInitScript(({ session }) => {
      localStorage.setItem('grc-control-center-auth', JSON.stringify(session));
    }, {
      session: syntheticSession(STAGING_REF),
    });

    try {
      const page = await context.newPage();
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await expect(page.getByText(PROFILE_RECONCILIATION_MESSAGE, { exact: true })).toBeVisible();
      expect(await authStorageKeyNames(page))
        .toContain(`grc-control-center-auth:${STAGING_REF}`);

      await page.evaluate(projectRef => {
        localStorage.removeItem(`grc-control-center-auth:${projectRef}`);
        localStorage.removeItem(`grc-control-center-auth:${projectRef}-code-verifier`);
        window.dispatchEvent(new Event('focus'));
      }, STAGING_REF);

      await expectSignedOutLogin(page);
      expect(await authStorageKeyNames(page))
        .not.toContain(`grc-control-center-auth:${STAGING_REF}`);
      expect(interceptedStagingPaths).toEqual(new Set(['/rest/v1/profiles']));
      expect(blockedExternalHosts).toEqual(new Set());
    } finally {
      await closeContext(context);
    }
  });
});
