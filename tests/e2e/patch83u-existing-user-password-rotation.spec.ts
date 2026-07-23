import { expect, test, type Page, type Route } from '@playwright/test';
import { startPatch83uTestServer, type Patch83uTestServer } from './patch83uTestServer';

const organizationId = '00000000-0000-4000-8000-000000000083';
const existingUserId = '00000000-0000-4000-8000-000000000084';
const existingAuthEmail = 'existing.admin@example.test';
const existingPassword = 'Existing.Password#2025';
const replacementPassword = 'Permanent.Password#2026';
const frontendContractVersion = 'patch83u-frontend-auth-first-v1';

let testServer: Patch83uTestServer | null = null;
let baseUrl = '';

type RecordedAction = {
  action: string;
  payload: Record<string, unknown>;
  contractVersion: string | undefined;
};

type ExistingUserProof = {
  acceptedPassword: string;
  credentialState: 'existing_password_rotation_pending' | 'existing_password_change_required' | 'active';
  credentialVersion: number;
  lazyTransitionCount: number;
  credentialVersionIncrements: number;
  authRequests: Record<string, unknown>[];
  actions: RecordedAction[];
  restRequests: Array<{ method: string; table: string; contractVersion: string | undefined }>;
  sequence: string[];
  completedRequestId: string | null;
  loseFirstCompletionResponse: boolean;
  rejectNextPasswordByPolicy: boolean;
};

function createProof(): ExistingUserProof {
  return {
    acceptedPassword: existingPassword,
    credentialState: 'existing_password_rotation_pending',
    credentialVersion: 1,
    lazyTransitionCount: 0,
    credentialVersionIncrements: 0,
    authRequests: [],
    actions: [],
    restRequests: [],
    sequence: [],
    completedRequestId: null,
    loseFirstCompletionResponse: false,
    rejectNextPasswordByPolicy: false,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requestJson(route: Route): Record<string, unknown> {
  const raw = route.request().postData();
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function authUser(credentialVersion: number) {
  return {
    id: existingUserId,
    aud: 'authenticated',
    role: 'authenticated',
    email: existingAuthEmail,
    email_confirmed_at: '2025-01-01T00:00:00.000Z',
    app_metadata: {
      provider: 'email',
      providers: ['email'],
      credential_version: credentialVersion,
    },
    user_metadata: {},
    identities: [],
    created_at: '2025-01-01T00:00:00.000Z',
  };
}

function tokenResponse(proof: ExistingUserProof) {
  return {
    access_token: `patch83u-existing-user-access-v${proof.credentialVersion}`,
    refresh_token: `patch83u-existing-user-refresh-v${proof.credentialVersion}`,
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    token_type: 'bearer',
    user: authUser(proof.credentialVersion),
  };
}

async function installExistingUserBackend(page: Page, proof: ExistingUserProof) {
  await page.route('**/auth/v1/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === 'POST' && url.pathname.endsWith('/token') && url.searchParams.get('grant_type') === 'password') {
      const body = requestJson(route);
      proof.authRequests.push(body);
      proof.sequence.push('auth:password');
      if (body.email !== existingAuthEmail || body.password !== proof.acceptedPassword) {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({ code: 'invalid_credentials', msg: 'Invalid login credentials' }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(tokenResponse(proof)),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(authUser(proof.credentialVersion)),
    });
  });

  await page.route('**/functions/v1/**', async (route) => {
    const body = requestJson(route);
    const action = typeof body.action === 'string' ? body.action : '';
    const payload = isRecord(body.payload) ? body.payload : {};
    proof.actions.push({
      action,
      payload,
      contractVersion: route.request().headers()['x-patch83u-frontend-contract-version'],
    });
    proof.sequence.push(`edge:${action}`);

    if (action === 'patch83u_get_capabilities') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
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
        }),
      });
      return;
    }

    if (action === 'patch83u_get_credential_state') {
      if (proof.credentialState === 'existing_password_rotation_pending') {
        proof.credentialState = 'existing_password_change_required';
        proof.lazyTransitionCount += 1;
      }
      const active = proof.credentialState === 'active';
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          action,
          result: {
            managed: true,
            credential_state: proof.credentialState,
            credential_version: proof.credentialVersion,
            auth_email: existingAuthEmail,
            access_allowed: active,
            message: active ? null : 'Change your existing password before application access.',
          },
        }),
      });
      return;
    }

    if (action === 'patch83u_change_required_password') {
      const requestId = typeof payload.request_id === 'string' ? payload.request_id : '';
      if (proof.completedRequestId === requestId) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ok: true,
            action,
            result: {
              userId: existingUserId,
              status: 'active',
              credentialVersion: proof.credentialVersion,
              mustReauthenticate: true,
              reconciliationRequired: false,
              sessionRevocationReviewRequired: false,
              idempotentReplay: true,
              requestId,
            },
          }),
        });
        return;
      }
      if (
        proof.credentialState !== 'existing_password_change_required'
        || payload.current_password !== proof.acceptedPassword
      ) {
        await route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'Current password verification failed.',
            code: 'PATCH83U_CURRENT_PASSWORD_INVALID',
          }),
        });
        return;
      }

      if (proof.rejectNextPasswordByPolicy) {
        proof.rejectNextPasswordByPolicy = false;
        await route.fulfill({
          status: 409,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'The new password was rejected by the hosted Auth policy.',
            code: 'PATCH83U_PERMANENT_PASSWORD_POLICY_REJECTED',
          }),
        });
        return;
      }

      proof.acceptedPassword = String(payload.new_password ?? '');
      proof.credentialState = 'active';
      proof.credentialVersion += 1;
      proof.credentialVersionIncrements += 1;
      proof.completedRequestId = requestId;
      if (proof.loseFirstCompletionResponse) {
        proof.loseFirstCompletionResponse = false;
        await route.abort('failed');
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          action,
          result: {
            userId: existingUserId,
            status: 'active',
            credentialVersion: proof.credentialVersion,
            mustReauthenticate: true,
            reconciliationRequired: false,
            sessionRevocationReviewRequired: false,
            idempotentReplay: false,
            requestId,
          },
        }),
      });
      return;
    }

    await route.fulfill({
      status: 400,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Unexpected test action.', code: 'UNEXPECTED_TEST_ACTION' }),
    });
  });

  await page.route('**/rest/v1/**', async (route) => {
    const request = route.request();
    const table = new URL(request.url()).pathname.split('/').pop() ?? '';
    proof.sequence.push(`rest:${table}`);
    proof.restRequests.push({
      method: request.method(),
      table,
      contractVersion: request.headers()['x-patch83u-frontend-contract-version'],
    });
    const wantsObject = (request.headers().accept ?? '').includes('application/vnd.pgrst.object+json');
    let response: unknown = wantsObject ? {} : [];
    if (table === 'profiles') {
      response = {
        id: existingUserId,
        email: existingAuthEmail,
        full_name_en: 'Existing Last Super Admin',
        full_name_ar: null,
        organization_id: organizationId,
        division_id: null,
        department_id: null,
        unit_id: null,
        is_active: true,
        user_status: 'active',
        organizations: { name_en: 'Patch 83U Existing Organization' },
      };
    } else if (table === 'user_roles') {
      response = [{
        role: 'super_admin',
        scope: 'global',
        organization_id: organizationId,
        division_id: null,
        department_id: null,
        unit_id: null,
        is_active: true,
      }];
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: {
        'access-control-allow-origin': '*',
        'access-control-expose-headers': 'Content-Range',
        'content-range': Array.isArray(response) && response.length ? `0-${response.length - 1}/${response.length}` : '*/0',
      },
      body: JSON.stringify(response),
    });
  });
}

async function submitLogin(page: Page, password: string, identifier = existingAuthEmail) {
  await page.getByLabel(/Email or Employee ID/).fill(identifier);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
}

function actionsFor(proof: ExistingUserProof, action: string): RecordedAction[] {
  return proof.actions.filter((call) => call.action === action);
}

test.describe('Patch 83U existing-user authenticate-first password rotation', () => {
  test.describe.configure({ mode: 'serial', timeout: 90_000 });

  test.beforeAll(async () => {
    testServer = await startPatch83uTestServer({
      VITE_PATCH83U_CREDENTIAL_GOVERNANCE_ENABLED: 'true',
    });
    baseUrl = testServer.baseUrl;
  });

  test.afterAll(() => {
    testServer?.stop();
    testServer = null;
  });

  test('invalid existing credentials produce only the generic Auth failure and no Patch 83U call', async ({ page }) => {
    const proof = createProof();
    await installExistingUserBackend(page, proof);
    await page.goto(baseUrl);

    await submitLogin(page, 'wrong-password', 'Existing.Admin@Example.Test');

    await expect(page.getByText('Sign-in failed. Check your credentials, then try again.')).toBeVisible();
    expect(proof.authRequests).toHaveLength(1);
    expect(proof.authRequests[0]).toMatchObject({
      email: existingAuthEmail,
      password: 'wrong-password',
    });
    expect(proof.actions).toEqual([]);
    expect(proof.restRequests).toEqual([]);
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  });

  test('authenticates the preserved full email before capability and lazy credential-state resolution', async ({ page }) => {
    const proof = createProof();
    await installExistingUserBackend(page, proof);
    await page.goto(baseUrl);

    await submitLogin(page, existingPassword, ' Existing.Admin@Example.Test ');

    await expect(page.getByRole('heading', { name: 'Password change required' })).toBeVisible();
    expect(proof.authRequests[0]).toMatchObject({
      email: existingAuthEmail,
      password: existingPassword,
    });
    expect(proof.sequence).toEqual([
      'auth:password',
      'edge:patch83u_get_capabilities',
      'edge:patch83u_get_credential_state',
    ]);
    expect(proof.lazyTransitionCount).toBe(1);
    expect(proof.credentialState).toBe('existing_password_change_required');
    expect(proof.restRequests).toEqual([]);
    expect(proof.actions.every((call) => call.contractVersion === frontendContractVersion)).toBe(true);
    await expect(page.locator('.modern-sidebar')).toHaveCount(0);
    await expect(page.getByText('Existing Last Super Admin')).toHaveCount(0);

    const persistedSession = await page.evaluate(() => localStorage.getItem('grc-control-center-auth'));
    expect(persistedSession).toContain('patch83u-existing-user-access-v1');
    expect(persistedSession ?? '').not.toContain(existingPassword);
  });

  test('lets the last Super Admin change the password, closes the session, and requires the new password', async ({ page }) => {
    const proof = createProof();
    await installExistingUserBackend(page, proof);
    await page.goto(baseUrl);
    await submitLogin(page, existingPassword);
    await expect(page.getByRole('heading', { name: 'Password change required' })).toBeVisible();

    await page.getByLabel('Current password').fill(existingPassword);
    await page.getByLabel('New password', { exact: true }).fill(replacementPassword);
    await page.getByLabel('Confirm new password').fill(replacementPassword);
    await page.getByRole('button', { name: 'Change password' }).click();

    await expect(page.getByRole('status')).toContainText('Password changed. Sign in again using your new password.');
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
    const changeCalls = actionsFor(proof, 'patch83u_change_required_password');
    expect(changeCalls).toHaveLength(1);
    expect(changeCalls[0].payload).toEqual({
      current_password: existingPassword,
      new_password: replacementPassword,
      confirm_new_password: replacementPassword,
      request_id: expect.stringMatching(/^[0-9a-f-]{36}$/),
    });
    expect(proof.credentialVersionIncrements).toBe(1);
    expect(proof.credentialVersion).toBe(2);
    expect(await page.evaluate(() => localStorage.getItem('grc-control-center-auth'))).toBeNull();

    const actionCountAfterChange = proof.actions.length;
    await submitLogin(page, existingPassword);
    await expect(page.getByText('Sign-in failed. Check your credentials, then try again.')).toBeVisible();
    expect(proof.actions).toHaveLength(actionCountAfterChange);

    await submitLogin(page, replacementPassword);
    await expect(page.getByText('Existing Last Super Admin').first()).toBeVisible();
    expect(actionsFor(proof, 'patch83u_get_capabilities')).toHaveLength(2);
    expect(actionsFor(proof, 'patch83u_get_credential_state')).toHaveLength(2);
    expect(proof.restRequests.slice(0, 2).map((request) => `${request.method} ${request.table}`)).toEqual([
      'GET profiles',
      'GET user_roles',
    ]);
    expect(proof.restRequests.every((request) => request.contractVersion === frontendContractVersion)).toBe(true);
    expect(proof.restRequests.filter((request) => request.table === 'user_roles')).toHaveLength(1);
    expect(proof.restRequests.some((request) => /POST|PUT|PATCH|DELETE/.test(request.method))).toBe(false);
  });

  test('closes the browser session after an unconfirmed response without retrying or creating a replacement session', async ({ page }) => {
    const proof = createProof();
    proof.loseFirstCompletionResponse = true;
    await installExistingUserBackend(page, proof);
    await page.goto(baseUrl);
    await submitLogin(page, existingPassword);
    await expect(page.getByRole('heading', { name: 'Password change required' })).toBeVisible();

    await page.getByLabel('Current password').fill(existingPassword);
    await page.getByLabel('New password', { exact: true }).fill(replacementPassword);
    await page.getByLabel('Confirm new password').fill(replacementPassword);
    await page.getByRole('button', { name: 'Change password' }).click();
    await expect(page.getByRole('status')).toContainText('The password-change result could not be confirmed.');
    await expect(page.getByRole('status')).toContainText('Do not retry or sign in until a protected administrator reconciles');
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
    const changeCalls = actionsFor(proof, 'patch83u_change_required_password');
    expect(changeCalls).toHaveLength(1);
    expect(proof.credentialVersionIncrements).toBe(1);
    expect(proof.credentialVersion).toBe(2);
    expect(proof.authRequests).toHaveLength(1);
    expect(await page.evaluate(() => localStorage.getItem('grc-control-center-auth'))).toBeNull();
  });

  test('closes the stale browser session when Auth rejects the new password after revocation begins', async ({ page }) => {
    const proof = createProof();
    proof.rejectNextPasswordByPolicy = true;
    await installExistingUserBackend(page, proof);
    await page.goto(baseUrl);
    await submitLogin(page, existingPassword);
    await expect(page.getByRole('heading', { name: 'Password change required' })).toBeVisible();

    await page.getByLabel('Current password').fill(existingPassword);
    await page.getByLabel('New password', { exact: true }).fill(replacementPassword);
    await page.getByLabel('Confirm new password').fill(replacementPassword);
    await page.getByRole('button', { name: 'Change password' }).click();

    await expect(page.getByRole('status')).toContainText('The new password was rejected by the Auth policy');
    await expect(page.getByRole('status')).toContainText('This browser session was closed.');
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
    expect(actionsFor(proof, 'patch83u_change_required_password')).toHaveLength(1);
    expect(proof.authRequests).toHaveLength(1);
    expect(proof.acceptedPassword).toBe(existingPassword);
    expect(proof.credentialVersionIncrements).toBe(0);
    expect(await page.evaluate(() => localStorage.getItem('grc-control-center-auth'))).toBeNull();
  });
});
