import { expect, test } from '@playwright/test';
import {
  startPatch83uTestServer,
  type Patch83uTestServer,
} from './patch83uTestServer';

let server: Patch83uTestServer | null = null;

test.describe('HF-1-R3 password-only login', () => {
  test.beforeAll(async () => {
    server = await startPatch83uTestServer({
      VITE_PATCH83U_CREDENTIAL_GOVERNANCE_ENABLED: 'true',
    });
  });

  test.afterAll(() => {
    server?.stop();
    server = null;
  });

  test('submits identifier and password without any retired challenge dependency', async ({ page }) => {
    if (!server) throw new Error('HF-1-R3 test server is unavailable.');
    const requests: string[] = [];
    let loginPayload: Record<string, unknown> | null = null;
    page.on('request', (request) => requests.push(request.url()));
    await page.route('**/auth/v1/token?grant_type=password', async (route) => {
      loginPayload = JSON.parse(route.request().postData() ?? '{}') as Record<string, unknown>;
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ code: 'invalid_credentials', msg: 'Invalid login credentials' }),
      });
    });

    await page.goto(server.baseUrl);
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
    await expect(page.getByText(/captcha|turnstile/i)).toHaveCount(0);
    await expect(page.locator('iframe[src*="challenges.cloudflare.com"]')).toHaveCount(0);

    await page.getByLabel(/Email or Employee ID/).fill('  ReviewUser8  ');
    await page.getByLabel('Password', { exact: true }).fill('not-a-real-password8');
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page.getByText('Sign-in failed. Check your credentials, then try again.')).toBeVisible();
    expect(loginPayload).toMatchObject({
      email: 'reviewuser8@almodawat.sa',
      password: 'not-a-real-password8',
    });
    expect(loginPayload?.gotrue_meta_security ?? {}).not.toHaveProperty('captcha_token');
    expect(requests.some((url) => url.includes('challenges.cloudflare.com'))).toBe(false);
  });
});
