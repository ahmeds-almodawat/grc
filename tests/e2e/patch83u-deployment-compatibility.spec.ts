import { readFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test, type Page, type Route } from '@playwright/test';
import { startPatch83uTestServer, type Patch83uTestServer } from './patch83uTestServer';

const organizationId = '00000000-0000-4000-8000-000000000083';
const userId = '00000000-0000-4000-8000-000000000084';
const authEmail = 'deployment.admin@example.test';
const password = 'Deployment.Password#2026';
const frontendContractVersion = 'patch83u-frontend-auth-first-v1';
const edgeContractVersion = 'patch83u-edge-auth-first-v1';
const deploymentMessage = 'Your login was successful, but credential governance is not fully deployed. No application data has been opened. Contact the system administrator.';

let stableServer: Patch83uTestServer | null = null;
let compatibleServer: Patch83uTestServer | null = null;
let stableBaseUrl = '';
let compatibleBaseUrl = '';

type RuntimeState = 'disabled' | 'prepared' | 'enforced' | 'emergency_suspended';

type CompatibilityOptions = {
  runtimeState?: RuntimeState;
  edgeVersion?: string;
  compatibilityStatus?: string;
  unsupportedCapability?: boolean;
  credentialGate?: Promise<void>;
};

type CompatibilityProof = {
  authRequests: Record<string, unknown>[];
  actions: Array<{
    action: string;
    contractVersion: string | undefined;
  }>;
  restRequests: Array<{
    method: string;
    table: string;
    contractVersion: string | undefined;
  }>;
  sequence: string[];
};

function createProof(): CompatibilityProof {
  return { authRequests: [], actions: [], restRequests: [], sequence: [] };
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

function sessionUser() {
  return {
    id: userId,
    aud: 'authenticated',
    role: 'authenticated',
    email: authEmail,
    email_confirmed_at: '2025-01-01T00:00:00.000Z',
    app_metadata: {
      provider: 'email',
      providers: ['email'],
      credential_version: 1,
    },
    user_metadata: {},
    identities: [],
    created_at: '2025-01-01T00:00:00.000Z',
  };
}

function authTokenResponse() {
  return {
    access_token: 'patch83u-deployment-proof-access-token',
    refresh_token: 'patch83u-deployment-proof-refresh-token',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    token_type: 'bearer',
    user: sessionUser(),
  };
}

async function seedSession(page: Page) {
  await page.addInitScript(({ user }) => {
    localStorage.setItem('grc-control-center-auth', JSON.stringify({
      access_token: 'patch83u-deployment-proof-access-token',
      refresh_token: 'patch83u-deployment-proof-refresh-token',
      expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      token_type: 'bearer',
      user,
    }));
  }, { user: sessionUser() });
}

async function installCompatibilityBackend(
  page: Page,
  proof: CompatibilityProof,
  options: CompatibilityOptions = {},
) {
  const runtimeState = options.runtimeState ?? 'disabled';
  await page.route('**/auth/v1/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === 'POST' && url.pathname.endsWith('/token') && url.searchParams.get('grant_type') === 'password') {
      const body = requestJson(route);
      proof.authRequests.push(body);
      proof.sequence.push('auth:password');
      if (body.email !== authEmail || body.password !== password) {
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
        body: JSON.stringify(authTokenResponse()),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(sessionUser()),
    });
  });

  await page.route('**/functions/v1/**', async (route) => {
    const body = requestJson(route);
    const action = typeof body.action === 'string' ? body.action : '';
    proof.actions.push({
      action,
      contractVersion: route.request().headers()['x-patch83u-frontend-contract-version'],
    });
    proof.sequence.push(`edge:${action}`);

    if (action === 'patch83u_get_capabilities') {
      if (options.unsupportedCapability) {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'Unsupported privileged action.',
            code: 'UNSUPPORTED_PRIVILEGED_ACTION',
          }),
        });
        return;
      }
      const mutationsAvailable = runtimeState === 'enforced';
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          action,
          result: {
            edge_contract_version: options.edgeVersion ?? edgeContractVersion,
            installed_schema_version: 174,
            runtime_enforcement_state: runtimeState,
            credential_state_action_available: true,
            password_change_action_available: mutationsAvailable,
            provisioning_action_available: mutationsAvailable,
            reset_action_available: mutationsAvailable,
            server_time: '2026-07-16T00:00:00.000Z',
            compatibility_status: options.compatibilityStatus ?? 'compatible',
          },
        }),
      });
      return;
    }

    if (action === 'patch83u_get_credential_state') {
      if (options.credentialGate) await options.credentialGate;
      const legacyAccess = runtimeState !== 'enforced';
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          action,
          result: {
            managed: true,
            credential_state: legacyAccess ? 'existing_password_rotation_pending' : 'active',
            credential_version: 1,
            auth_email: authEmail,
            access_allowed: true,
            message: null,
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
        id: userId,
        email: authEmail,
        full_name_en: 'Deployment Compatibility Admin',
        full_name_ar: null,
        organization_id: organizationId,
        division_id: null,
        department_id: null,
        unit_id: null,
        is_active: true,
        user_status: 'active',
        organizations: { name_en: 'Patch 83U Compatibility Organization' },
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

async function signIn(page: Page, url: string) {
  await page.goto(url);
  await page.getByLabel(/Email or Employee ID/).fill(authEmail);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
}

test.describe('Patch 83U deployment compatibility and lockout prevention', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeAll(async () => {
    stableServer = await startPatch83uTestServer({
      VITE_PATCH83U_CREDENTIAL_GOVERNANCE_ENABLED: 'false',
    });
    compatibleServer = await startPatch83uTestServer({
      VITE_PATCH83U_CREDENTIAL_GOVERNANCE_ENABLED: 'true',
    });
    stableBaseUrl = stableServer.baseUrl;
    compatibleBaseUrl = compatibleServer.baseUrl;
  });

  test.afterAll(() => {
    stableServer?.stop();
    compatibleServer?.stop();
    stableServer = null;
    compatibleServer = null;
  });

  test('keeps the stable frontend usable and makes zero Patch 83U calls while the exact feature flag is false', async ({ page }) => {
    const proof = createProof();
    await installCompatibilityBackend(page, proof, { runtimeState: 'disabled' });
    await signIn(page, stableBaseUrl);

    await expect(page.getByText('Deployment Compatibility Admin').first()).toBeVisible();
    expect(proof.authRequests).toHaveLength(1);
    expect(proof.authRequests[0].contractVersion).toBeUndefined();
    expect(proof.actions).toEqual([]);
    expect(proof.sequence.slice(0, 3)).toEqual(['auth:password', 'rest:profiles', 'rest:user_roles']);
    expect(proof.restRequests.every((request) => request.contractVersion === undefined)).toBe(true);
  });

  for (const runtimeState of ['disabled', 'prepared'] as const) {
    test(`authenticates and safely loads the compatible frontend while runtime is ${runtimeState}`, async ({ page }) => {
      const proof = createProof();
      await installCompatibilityBackend(page, proof, { runtimeState });
      await signIn(page, compatibleBaseUrl);

      await expect(page.getByText('Deployment Compatibility Admin').first()).toBeVisible();
      expect(proof.authRequests).toHaveLength(1);
      expect(proof.authRequests[0].contractVersion).toBeUndefined();
      expect(proof.sequence.slice(0, 5)).toEqual([
        'auth:password',
        'edge:patch83u_get_capabilities',
        'edge:patch83u_get_credential_state',
        'rest:profiles',
        'rest:user_roles',
      ]);
      expect(proof.actions.map((call) => call.action)).toEqual([
        'patch83u_get_capabilities',
        'patch83u_get_credential_state',
      ]);
      expect(proof.actions.every((call) => call.contractVersion === frontendContractVersion)).toBe(true);
      expect(proof.restRequests.every((request) => request.contractVersion === frontendContractVersion)).toBe(true);
    });
  }

  test('shows the authenticated deployment screen for an old Edge and keeps retries single-flight', async ({ page }) => {
    const proof = createProof();
    await installCompatibilityBackend(page, proof, { unsupportedCapability: true });
    await signIn(page, compatibleBaseUrl);

    await expect(page.getByRole('heading', { name: 'Deployment compatibility required' })).toBeVisible();
    await expect(page.getByRole('alert')).toContainText(deploymentMessage);
    await expect(page.getByRole('heading', { name: 'Sign in' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Retry compatibility check' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Hard refresh' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible();
    expect(proof.restRequests).toEqual([]);
    expect(proof.actions.map((call) => call.action)).toEqual(['patch83u_get_capabilities']);

    await page.getByRole('button', { name: 'Retry compatibility check' }).evaluate((button: HTMLButtonElement) => {
      button.click();
      button.click();
    });
    await expect.poll(() => proof.actions.length).toBe(2);
    expect(proof.actions.map((call) => call.action)).toEqual([
      'patch83u_get_capabilities',
      'patch83u_get_capabilities',
    ]);
    await expect(page.getByRole('button', { name: 'Retry compatibility check' })).toBeDisabled();
    expect(proof.restRequests).toEqual([]);

    const persistedSession = await page.evaluate(() => localStorage.getItem('grc-control-center-auth'));
    expect(persistedSession).toContain('patch83u-deployment-proof-access-token');
    expect(persistedSession ?? '').not.toContain(password);
    await page.getByRole('button', { name: 'Sign out' }).click();
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  });

  test('fails closed before credential or data access when an enforced backend reports a contract mismatch', async ({ page }) => {
    const proof = createProof();
    await installCompatibilityBackend(page, proof, {
      runtimeState: 'enforced',
      edgeVersion: 'patch83u-edge-legacy-v0',
      compatibilityStatus: 'edge_contract_mismatch',
    });
    await signIn(page, compatibleBaseUrl);

    await expect(page.getByRole('alert')).toContainText(deploymentMessage);
    expect(proof.actions.map((call) => call.action)).toEqual(['patch83u_get_capabilities']);
    expect(proof.actions[0].contractVersion).toBe(frontendContractVersion);
    expect(proof.restRequests).toEqual([]);
    await expect(page.getByText('Deployment Compatibility Admin')).toHaveCount(0);
  });

  test('ignores a stale credential response after cross-tab invalidation and opens no authorization data', async ({ page }) => {
    let releaseCredential!: () => void;
    const credentialGate = new Promise<void>((resolve) => {
      releaseCredential = resolve;
    });
    const proof = createProof();
    await seedSession(page);
    await installCompatibilityBackend(page, proof, {
      runtimeState: 'enforced',
      credentialGate,
    });
    await page.goto(compatibleBaseUrl);
    await expect.poll(() => proof.actions.map((call) => call.action)).toContain('patch83u_get_credential_state');

    await page.evaluate(async ({ activeUserId }) => {
      const channel = new BroadcastChannel('grc-patch83u-auth-state-v1');
      channel.postMessage({ type: 'credential-invalidated', userId: activeUserId });
      await new Promise((resolve) => setTimeout(resolve, 50));
      channel.close();
    }, { activeUserId: userId });
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
    releaseCredential();
    await page.waitForTimeout(100);

    expect(proof.restRequests).toEqual([]);
    await expect(page.getByText('Deployment Compatibility Admin')).toHaveCount(0);
    await expect(page.getByText('Your credentials changed in another browser tab. Sign in again.')).toBeVisible();
  });

  test('requires disabled-by-default, prepared attestation, exact versions, and audited idempotent enforcement in migration 174', () => {
    const migrationPath = path.resolve(
      process.cwd(),
      'supabase/migrations/174_patch83u_employee_id_auth_and_credential_governance.sql',
    );
    const sql = readFileSync(migrationPath, 'utf8');
    const transitionStart = sql.indexOf('create or replace function public.patch83u_transition_runtime(');
    const transitionEnd = sql.indexOf('create or replace function public.patch83u_get_capabilities(', transitionStart);
    expect(transitionStart).toBeGreaterThan(-1);
    expect(transitionEnd).toBeGreaterThan(transitionStart);
    const transition = sql.slice(transitionStart, transitionEnd);

    expect(sql).toContain("enforcement_state text not null default 'disabled'");
    expect(sql).toContain("values (true, 'disabled')");
    expect(sql).toContain('request_id text not null unique');
    expect(sql).toContain('compatible_edge_contract_version = expected_edge_contract_version');
    expect(sql).toContain('compatible_frontend_contract_version = expected_frontend_contract_version');
    expect(transition).toContain("when 'enforced' then 'PATCH83U_ENFORCE_CREDENTIAL_GOVERNANCE'");
    expect(transition).toContain("if v_runtime.enforcement_state <> 'prepared'");
    expect(transition).toContain('v_runtime.compatibility_attested_by is distinct from p_designated_super_admin_id');
    expect(transition).toContain('v_runtime.compatible_edge_contract_version is distinct from v_runtime.expected_edge_contract_version');
    expect(transition).toContain('v_runtime.compatible_frontend_contract_version is distinct from v_runtime.expected_frontend_contract_version');
    expect(transition).toContain("raise exception 'PATCH83U_EDGE_CONTRACT_MISMATCH'");
    expect(transition).toContain("raise exception 'PATCH83U_FRONTEND_CONTRACT_MISMATCH'");
    expect(transition).toContain('insert into public.patch83u_runtime_events');
    expect(transition).toContain("'idempotent_replay', true");
  });
});
