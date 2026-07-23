import { spawn, type ChildProcess } from 'node:child_process';
import { createServer } from 'node:net';
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';

let captchaServer: ChildProcess | null = null;
let captchaBaseUrl = '';
let serverLog = '';

const existingUserId = '00000000-0000-4000-8000-000000000084';
const existingAuthEmail = 'existing.admin@example.test';

async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      server.close((error) => error ? reject(error) : resolve(port));
    });
  });
}

async function waitForServer(url: string) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // The isolated Vite process is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`CAPTCHA test server did not start.\n${serverLog}`);
}

async function installTurnstileMock(page: Page) {
  await page.route('https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: `
        window.__patch83uTurnstile = { options: null, resetCount: 0 };
        window.turnstile = {
          render(element, options) {
            window.__patch83uTurnstile.options = options;
            element.setAttribute('data-testid', 'turnstile-mock');
            element.textContent = 'Turnstile test challenge';
            return 'patch83u-widget';
          },
          reset() { window.__patch83uTurnstile.resetCount += 1; },
          remove() {},
        };
        window.__patch83uTurnstile.verify = (token) => window.__patch83uTurnstile.options.callback(token);
        window.__patch83uTurnstile.expire = () => window.__patch83uTurnstile.options['expired-callback']();
      `,
    });
  });
}

async function completeCaptcha(page: Page, token: string) {
  await expect(page.getByTestId('turnstile-mock')).toBeVisible();
  await page.evaluate((value) => (window as any).__patch83uTurnstile.verify(value), token);
}

function existingSessionUser() {
  return {
    id: existingUserId,
    aud: 'authenticated',
    role: 'authenticated',
    email: existingAuthEmail,
    app_metadata: {
      provider: 'email',
      providers: ['email'],
      credential_version: 1,
    },
    user_metadata: {},
    identities: [],
    created_at: new Date(0).toISOString(),
  };
}

async function seedExistingAuthenticatedSession(page: Page) {
  await page.addInitScript(({ user }) => {
    localStorage.setItem('grc-control-center-auth', JSON.stringify({
      access_token: 'patch83u-captcha-existing-user-token',
      refresh_token: 'patch83u-captcha-existing-user-refresh',
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      expires_in: 3600,
      token_type: 'bearer',
      user,
    }));
  }, { user: existingSessionUser() });
}

function requestJson(raw: string | null): Record<string, unknown> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
}

test.describe('Patch 83U required login CAPTCHA browser gate', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeAll(async () => {
    const port = await freePort();
    captchaBaseUrl = `http://127.0.0.1:${port}`;
    const viteBin = path.resolve(process.cwd(), 'node_modules/vite/bin/vite.js');
    captchaServer = spawn(process.execPath, [viteBin, '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        VITE_SUPABASE_URL: 'http://127.0.0.1:54321',
        VITE_SUPABASE_ANON_KEY: 'patch83u-captcha-browser-public-anon-key',
        VITE_AUTH_BYPASS_LOCAL: 'false',
        VITE_AUTH_CAPTCHA_REQUIRED: 'true',
        VITE_AUTH_CAPTCHA_SITE_KEY: '1x00000000000000000000AA',
        VITE_PATCH83U_CREDENTIAL_GOVERNANCE_ENABLED: 'true',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    const collect = (chunk: Buffer) => {
      serverLog = `${serverLog}${chunk.toString()}`.slice(-20_000);
    };
    captchaServer.stdout?.on('data', collect);
    captchaServer.stderr?.on('data', collect);
    await waitForServer(captchaBaseUrl);
  });

  test.afterAll(() => {
    captchaServer?.kill();
    captchaServer = null;
  });

  test('renders the required challenge and keeps sign-in disabled until a token exists', async ({ page }) => {
    await installTurnstileMock(page);
    await page.goto(captchaBaseUrl);

    await expect(page.getByLabel('Login CAPTCHA challenge')).toBeVisible();
    await expect(page.getByTestId('turnstile-mock')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeDisabled();

    await completeCaptcha(page, 'accepted-ui-token');
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeEnabled();
  });

  test('clears an expired token and resets the challenge for a safe retry', async ({ page }) => {
    await installTurnstileMock(page);
    await page.goto(captchaBaseUrl);

    await completeCaptcha(page, 'soon-to-expire-token');
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeEnabled();

    await page.evaluate(() => (window as any).__patch83uTurnstile.expire());
    await expect(page.getByTestId('login-captcha-error')).toContainText('challenge expired');
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeDisabled();
    await expect.poll(() => page.evaluate(() => (window as any).__patch83uTurnstile.resetCount)).toBe(1);

    await completeCaptcha(page, 'replacement-token');
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeEnabled();
    await expect(page.getByTestId('login-captcha-error')).toHaveCount(0);
  });

  test('blocks missing tokens for both Employee ID and full-email identifiers without an Auth request', async ({ page }) => {
    let authRequests = 0;
    await installTurnstileMock(page);
    await page.route('**/auth/v1/**', async (route) => {
      authRequests += 1;
      await route.abort();
    });
    await page.goto(captchaBaseUrl);

    await page.getByLabel(/Email or Employee ID/).fill('11111');
    await page.getByLabel('Password', { exact: true }).fill('11111');
    await page.locator('form').evaluate((form: HTMLFormElement) => form.requestSubmit());
    await expect(page.getByTestId('login-captcha-error')).toContainText('Complete the CAPTCHA challenge');
    expect(authRequests).toBe(0);

    await page.getByLabel(/Email or Employee ID/).fill('admin@almodawat.sa');
    await page.locator('form').evaluate((form: HTMLFormElement) => form.requestSubmit());
    await expect(page.getByTestId('login-captcha-error')).toContainText('Complete the CAPTCHA challenge');
    expect(authRequests).toBe(0);
  });

  test('fails closed when the CAPTCHA provider script is unavailable', async ({ page }) => {
    await page.route('https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit', async (route) => {
      await route.abort('failed');
    });
    await page.goto(captchaBaseUrl);

    await expect(page.getByTestId('login-captcha-error')).toContainText('could not be loaded');
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeDisabled();
  });

  test('submits an invalid token to Supabase, reports rejection, and resets the challenge', async ({ page }) => {
    let loginRequest: Record<string, unknown> | null = null;
    await installTurnstileMock(page);
    await page.route('**/auth/v1/**', async (route) => {
      const request = route.request();
      if (request.method() === 'POST') loginRequest = request.postDataJSON();
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ code: 'captcha_failed', msg: 'CAPTCHA verification failed' }),
      });
    });
    await page.goto(captchaBaseUrl);
    await page.getByLabel(/Email or Employee ID/).fill('11111');
    await page.getByLabel('Password', { exact: true }).fill('11111');
    await completeCaptcha(page, 'invalid-captcha-token');
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page.getByText(/CAPTCHA verification failed/i)).toBeVisible();
    expect(loginRequest).toMatchObject({
      email: '11111@almodawat.sa',
      gotrue_meta_security: { captcha_token: 'invalid-captcha-token' },
    });
    await expect.poll(() => page.evaluate(() => (window as any).__patch83uTurnstile.resetCount)).toBe(1);
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeDisabled();
  });

  test('passes an accepted token through the supported Supabase password-sign-in payload', async ({ page }) => {
    let loginRequest: Record<string, unknown> | null = null;
    await installTurnstileMock(page);
    await page.route('**/auth/v1/**', async (route) => {
      const request = route.request();
      if (request.method() === 'POST') loginRequest = request.postDataJSON();
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ code: 'invalid_credentials', msg: 'Invalid login credentials' }),
      });
    });
    await page.goto(captchaBaseUrl);
    await page.getByLabel(/Email or Employee ID/).fill('  000042Ab  ');
    await page.getByLabel('Password', { exact: true }).fill('EmployeePass!2026');
    await completeCaptcha(page, 'accepted-captcha-token');
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect.poll(() => loginRequest).not.toBeNull();
    expect(loginRequest).toMatchObject({
      email: '000042ab@almodawat.sa',
      password: 'EmployeePass!2026',
      gotrue_meta_security: { captcha_token: 'accepted-captcha-token' },
    });
  });

  test('requires a fresh CAPTCHA token for every forced current-password reauthentication attempt', async ({ page }) => {
    const passwordChangePayloads: Record<string, unknown>[] = [];
    await seedExistingAuthenticatedSession(page);
    await installTurnstileMock(page);
    await page.route('**/functions/v1/**', async (route) => {
      const body = requestJson(route.request().postData());
      const action = typeof body.action === 'string' ? body.action : '';
      const payload = body.payload && typeof body.payload === 'object' && !Array.isArray(body.payload)
        ? body.payload as Record<string, unknown>
        : {};

      let status = 200;
      let response: Record<string, unknown>;
      if (action === 'patch83u_get_capabilities') {
        response = {
          ok: true,
          action,
          result: {
            edge_contract_version: 'patch83u-edge-auth-first-v1',
            installed_schema_version: 174,
            runtime_enforcement_state: 'enforced',
            credential_state_action_available: true,
            password_change_action_available: true,
            provisioning_action_available: true,
            reset_action_available: true,
            server_time: '2026-07-16T00:00:00.000Z',
            compatibility_status: 'compatible',
          },
        };
      } else if (action === 'patch83u_get_credential_state') {
        response = {
          ok: true,
          action,
          result: {
            managed: true,
            credential_state: 'existing_password_change_required',
            credential_version: 1,
            auth_email: existingAuthEmail,
            access_allowed: false,
            message: 'Change your existing password before application access.',
          },
        };
      } else if (action === 'patch83u_change_required_password') {
        passwordChangePayloads.push(payload);
        if (payload.current_password === 'wrong-existing-password') {
          status = 401;
          response = {
            error: 'Current password verification failed.',
            code: 'PATCH83U_CURRENT_PASSWORD_INVALID',
          };
        } else {
          response = {
            ok: true,
            action,
            result: {
              userId: existingUserId,
              status: 'active',
              credentialVersion: 2,
              mustReauthenticate: true,
              reconciliationRequired: false,
              sessionRevocationReviewRequired: false,
              idempotentReplay: false,
              requestId: payload.request_id,
            },
          };
        }
      } else {
        response = { ok: true, action, result: {} };
      }

      await route.fulfill({
        status,
        contentType: 'application/json',
        body: JSON.stringify(response),
      });
    });

    await page.goto(captchaBaseUrl);
    await expect(page.getByRole('heading', { name: 'Password change required' })).toBeVisible();
    await expect(page.getByLabel('Password change CAPTCHA challenge')).toBeVisible();
    const submit = page.getByRole('button', { name: 'Change password' });
    await expect(submit).toBeDisabled();

    await page.getByLabel('Current password').fill('wrong-existing-password');
    await page.getByLabel('New password', { exact: true }).fill('Permanent.Password#2026');
    await page.getByLabel('Confirm new password').fill('Permanent.Password#2026');
    await page.locator('form').evaluate((form: HTMLFormElement) => form.requestSubmit());
    await expect(page.getByRole('alert')).toContainText('Complete the CAPTCHA challenge');
    expect(passwordChangePayloads).toEqual([]);
    await expect.poll(
      () => page.evaluate(() => (window as any).__patch83uTurnstile.resetCount),
    ).toBe(1);

    await completeCaptcha(page, 'forced-reauth-token-one');
    await submit.click();
    await expect(page.getByRole('alert')).toContainText('Current password verification failed');
    expect(passwordChangePayloads[0]).toMatchObject({
      current_password: 'wrong-existing-password',
      new_password: 'Permanent.Password#2026',
      confirm_new_password: 'Permanent.Password#2026',
      captcha_token: 'forced-reauth-token-one',
      request_id: expect.stringMatching(/^[0-9a-f-]{36}$/),
    });
    await expect.poll(
      () => page.evaluate(() => (window as any).__patch83uTurnstile.resetCount),
    ).toBe(2);
    await expect(submit).toBeDisabled();

    await page.getByLabel('Current password').fill('Existing.Password#2025');
    await completeCaptcha(page, 'forced-reauth-token-two');
    await submit.click();
    await expect.poll(() => passwordChangePayloads.length).toBe(2);
    expect(passwordChangePayloads[1]).toMatchObject({
      current_password: 'Existing.Password#2025',
      captcha_token: 'forced-reauth-token-two',
      request_id: expect.stringMatching(/^[0-9a-f-]{36}$/),
    });
    expect(passwordChangePayloads[1].request_id).not.toBe(passwordChangePayloads[0].request_id);
    await expect(page.getByRole('status')).toContainText('Password changed. Sign in again using your new password.');
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();

    const persistedAuth = await page.evaluate(() => localStorage.getItem('grc-control-center-auth'));
    expect(persistedAuth ?? '').not.toContain('Existing.Password#2025');
    expect(persistedAuth ?? '').not.toContain('Permanent.Password#2026');
    expect(persistedAuth).toBeNull();
  });
});
