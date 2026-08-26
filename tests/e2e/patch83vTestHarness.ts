import { expect, type Page, type Route } from '@playwright/test';
import {
  buildV14jRoleAssignment,
  V14J_DEPARTMENT_ID,
  V14J_DIVISION_ID,
  V14J_ORGANIZATION_ID,
  v14jRoleDisplayName,
  type V14jRole,
} from '../helpers/v14jCrossRoleMatrix';

export const PATCH83V_ORGANIZATION_ID = V14J_ORGANIZATION_ID;
export const PATCH83V_USER_ID = '00000000-0000-4000-8000-000000000084';
export const PATCH83V_REFRESH_TOKEN = 'patch83v-refresh-token-v1';

const frontendContractVersion = 'patch83u-frontend-auth-first-v1';
const edgeContractVersion = 'patch83u-edge-auth-first-v1';

type CredentialResult = 'active' | 'blocked';

type Deferred = {
  promise: Promise<void>;
  resolve: () => void;
  released: boolean;
};

export type Patch83vProof = {
  actions: string[];
  authRequests: string[];
  authRefreshRequests: number;
  authSignOutRequests: number;
  capabilityRequests: string[];
  consoleProblems: string[];
  credentialRequests: Array<{
    accessToken: string;
    result: CredentialResult;
  }>;
  credentialResponsesAborted: number;
  credentialResponsesFulfilled: number;
  documentRequests: string[];
  identityReferenceRequests: number;
  pageErrors: string[];
  restRequests: Array<{ method: string; table: string }>;
  unexpectedAuthMutations: string[];
  writeRequests: string[];
};

export type Patch83vBackend = {
  proof: Patch83vProof;
  accessTokenV1: string;
  accessTokenV2: string;
  delayNextCredentialResponse: () => void;
  releaseDelayedCredentialResponse: () => void;
  delayNextIdentityReferenceResponse: () => void;
  releaseDelayedIdentityReferenceResponse: () => void;
  setCredentialResult: (result: CredentialResult) => void;
};

export type Patch83vRole = V14jRole;

function deferred(): Deferred {
  let release!: () => void;
  const gate: Deferred = {
    promise: new Promise<void>((resolve) => {
      release = resolve;
    }),
    resolve: () => {
      if (gate.released) return;
      gate.released = true;
      release();
    },
    released: false,
  };
  return gate;
}

function jwt(version: number): string {
  const encode = (value: unknown) => Buffer
    .from(JSON.stringify(value), 'utf8')
    .toString('base64url');
  const issuedAt = Math.floor(Date.now() / 1000);
  return [
    encode({ alg: 'HS256', typ: 'JWT' }),
    encode({
      aud: 'authenticated',
      email: 'patch83v.admin@example.test',
      exp: issuedAt + 3600,
      iat: issuedAt,
      role: 'authenticated',
      sub: PATCH83V_USER_ID,
      credential_version: version,
    }),
    `patch83v-signature-v${version}`,
  ].join('.');
}

function sessionUser(version: number) {
  return {
    id: PATCH83V_USER_ID,
    aud: 'authenticated',
    role: 'authenticated',
    email: 'patch83v.admin@example.test',
    email_confirmed_at: '2026-01-01T00:00:00.000Z',
    app_metadata: {
      provider: 'email',
      providers: ['email'],
      credential_version: version,
    },
    user_metadata: {},
    identities: [],
    created_at: '2026-01-01T00:00:00.000Z',
  };
}

function authSession(version: number, accessToken: string) {
  return {
    access_token: accessToken,
    refresh_token: version === 1 ? PATCH83V_REFRESH_TOKEN : 'patch83v-refresh-token-v2',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    token_type: 'bearer',
    user: sessionUser(version),
  };
}

function requestJson(route: Route): Record<string, unknown> {
  const raw = route.request().postData();
  if (!raw) return {};
  try {
    const value = JSON.parse(raw) as unknown;
    return value && typeof value === 'object' && !Array.isArray(value)
      ? value as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
}

function userRoster() {
  return [{
    organization_id: PATCH83V_ORGANIZATION_ID,
    user_id: 'existing-user-a',
    employee_no: '001245',
    full_name_en: 'Existing User',
    full_name_ar: 'مستخدم قائم',
    email: 'existing.user@example.test',
    contact_email: 'existing.contact@example.test',
    phone: '+966501234567',
    job_title: 'Existing Analyst',
    user_type: 'employee',
    user_status: 'active',
    is_active: true,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: null,
    last_login_at: null,
    last_reviewed_at: null,
    deactivated_at: null,
    deactivated_by: null,
    deactivation_reason: null,
    division_id: V14J_DIVISION_ID,
    division_name: 'Corporate',
    department_id: V14J_DEPARTMENT_ID,
    department_code: 'IT',
    department_name: 'Information Technology',
    department_name_ar: 'تقنية المعلومات',
    unit_id: null,
    unit_name: null,
    active_role_count: 1,
    roles: [{
      user_role_id: '00000000-0000-4000-8000-000000000087',
      role: 'employee',
      scope: 'assigned_only',
      organization_id: PATCH83V_ORGANIZATION_ID,
      division_id: null,
      department_id: null,
      unit_id: null,
      is_active: true,
      assigned_at: '2026-01-01T00:00:00.000Z',
    }],
    linked_project_count: 0,
    linked_task_count: 0,
    linked_approval_count: 0,
    linked_evidence_count: 0,
    open_project_count: 0,
    open_task_count: 0,
    pending_approval_count: 0,
    managed_identity: true,
    identity_mode: 'employee_id_managed',
    auth_email: '001245@almodawat.sa',
    synthetic_auth_email: '001245@almodawat.sa',
    credential_state: 'active',
    credential_version: 1,
    must_change_password: false,
    last_password_reset_at: null,
    last_password_changed_at: null,
    provisioning_state: null,
    credential_proof_available: true,
  }];
}

function credentialBody(result: CredentialResult) {
  return result === 'blocked'
    ? {
        managed: true,
        credential_state: 'blocked',
        credential_version: 2,
        auth_email: 'patch83v.admin@example.test',
        access_allowed: false,
        message: 'Access was revoked during credential revalidation.',
      }
    : {
        managed: true,
        credential_state: 'active',
        credential_version: 1,
        auth_email: 'patch83v.admin@example.test',
        access_allowed: true,
        message: null,
      };
}

function isReadOnlyAction(action: string): boolean {
  return action === 'patch83u_get_capabilities'
    || action === 'patch83u_get_credential_state'
    || action === 'list_user_management_roster'
    || action === 'patch83t_get_user_import_capabilities'
    || action === 'patch83t_user_import_identity_references'
    || action === 'ovr_executive_dashboard_analytics'
    || action === 'dashboard_recent_governed_activity'
    || action === 'f1r2_list_my_work'
    || /^(?:get|list|search|preview|evaluate)_/i.test(action);
}

async function safeFulfill(
  route: Route,
  response: Parameters<Route['fulfill']>[0],
): Promise<boolean> {
  try {
    await route.fulfill(response);
    return true;
  } catch (error) {
    // An intentionally delayed old-token request can be aborted when a newer
    // TOKEN_REFRESHED generation wins. That cancellation is the behavior under
    // test; all non-abort route failures must still surface.
    const message = error instanceof Error ? error.message : String(error);
    if (!/aborted|cancelled|canceled|already handled|route is not found|target.*closed/i.test(message)) {
      throw error;
    }
    return false;
  }
}

export async function installPatch83vBackend(
  page: Page,
  role: Patch83vRole = 'super_admin',
): Promise<Patch83vBackend> {
  const assignment = buildV14jRoleAssignment(role);
  const accessTokenV1 = jwt(1);
  const accessTokenV2 = jwt(2);
  const proof: Patch83vProof = {
    actions: [],
    authRequests: [],
    authRefreshRequests: 0,
    authSignOutRequests: 0,
    capabilityRequests: [],
    consoleProblems: [],
    credentialRequests: [],
    credentialResponsesAborted: 0,
    credentialResponsesFulfilled: 0,
    documentRequests: [],
    identityReferenceRequests: 0,
    pageErrors: [],
    restRequests: [],
    unexpectedAuthMutations: [],
    writeRequests: [],
  };

  let credentialResult: CredentialResult = 'active';
  let armCredentialDelay = false;
  let credentialGate: Deferred | null = null;
  let armIdentityDelay = false;
  let identityGate: Deferred | null = null;

  const backend: Patch83vBackend = {
    proof,
    accessTokenV1,
    accessTokenV2,
    delayNextCredentialResponse: () => {
      if (armCredentialDelay || (credentialGate && !credentialGate.released)) {
        throw new Error('A credential response is already delayed.');
      }
      armCredentialDelay = true;
      credentialGate = deferred();
    },
    releaseDelayedCredentialResponse: () => credentialGate?.resolve(),
    delayNextIdentityReferenceResponse: () => {
      if (armIdentityDelay || (identityGate && !identityGate.released)) {
        throw new Error('An identity-reference response is already delayed.');
      }
      armIdentityDelay = true;
      identityGate = deferred();
    },
    releaseDelayedIdentityReferenceResponse: () => identityGate?.resolve(),
    setCredentialResult: (result) => {
      credentialResult = result;
    },
  };

  await page.addInitScript(({ storedSession }) => {
    localStorage.setItem('grc-control-center-auth', JSON.stringify(storedSession));

    const bootKey = '__patch83v_document_boot_count';
    const previous = Number(sessionStorage.getItem(bootKey) ?? '0');
    sessionStorage.setItem(bootKey, String(previous + 1));

    const proof = { push: [] as string[], replace: [] as string[] };
    Object.defineProperty(window, '__patch83vHistoryProof__', {
      configurable: true,
      value: proof,
    });
    const originalPush = history.pushState.bind(history);
    const originalReplace = history.replaceState.bind(history);
    history.pushState = ((data: unknown, unused: string, url?: string | URL | null) => {
      proof.push.push(String(url ?? ''));
      return originalPush(data, unused, url);
    }) as History['pushState'];
    history.replaceState = ((data: unknown, unused: string, url?: string | URL | null) => {
      proof.replace.push(String(url ?? ''));
      return originalReplace(data, unused, url);
    }) as History['replaceState'];
  }, { storedSession: authSession(1, accessTokenV1) });

  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') {
      proof.consoleProblems.push(`${message.type()}: ${message.text()}`);
    }
  });
  page.on('pageerror', (error) => proof.pageErrors.push(error.message));
  page.on('request', (request) => {
    if (request.isNavigationRequest() && request.frame() === page.mainFrame()) {
      proof.documentRequests.push(request.url());
    }
  });

  await page.route('**/auth/v1/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    const requestLabel = `${method} ${url.pathname}${url.search}`;
    proof.authRequests.push(requestLabel);
    if (
      method === 'POST'
      && url.pathname.endsWith('/token')
      && url.searchParams.get('grant_type') === 'refresh_token'
    ) {
      proof.authRefreshRequests += 1;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(authSession(2, accessTokenV2)),
      });
      return;
    }
    if (method === 'POST' && url.pathname.endsWith('/logout')) {
      proof.authSignOutRequests += 1;
      await route.fulfill({ status: 204, body: '' });
      return;
    }
    if (method === 'OPTIONS') {
      await route.fulfill({ status: 204, body: '' });
      return;
    }
    if (method !== 'GET' || !url.pathname.endsWith('/user')) {
      if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
        proof.unexpectedAuthMutations.push(requestLabel);
        proof.writeRequests.push(`AUTH ${requestLabel}`);
      }
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 'PATCH83V_UNEXPECTED_AUTH_REQUEST',
          message: 'Unexpected Auth request in Patch 83V browser proof.',
        }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(sessionUser(
        (request.headers().authorization ?? '').includes(accessTokenV2) ? 2 : 1,
      )),
    });
  });

  await page.route('**/functions/v1/**', async (route) => {
    const request = route.request();
    const body = requestJson(route);
    const action = typeof body.action === 'string' ? body.action : '';
    const authorization = request.headers().authorization ?? '';
    proof.actions.push(action);
    if (!isReadOnlyAction(action)) {
      proof.writeRequests.push(`EDGE ${request.method()} ${action || '(missing action)'}`);
    }

    if (action === 'patch83u_get_capabilities') {
      proof.capabilityRequests.push(
        authorization.includes(accessTokenV2) ? accessTokenV2 : accessTokenV1,
      );
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          action,
          result: {
            edge_contract_version: edgeContractVersion,
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
      const result = credentialResult;
      const accessToken = authorization.includes(accessTokenV2)
        ? accessTokenV2
        : accessTokenV1;
      proof.credentialRequests.push({ accessToken, result });
      let gate: Deferred | null = null;
      if (armCredentialDelay) {
        armCredentialDelay = false;
        gate = credentialGate;
      }
      if (gate) await gate.promise;
      const fulfilled = await safeFulfill(route, {
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, action, result: credentialBody(result) }),
      });
      if (fulfilled) proof.credentialResponsesFulfilled += 1;
      else proof.credentialResponsesAborted += 1;
      return;
    }

    if (action === 'list_user_management_roster') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, action, result: userRoster() }),
      });
      return;
    }

    if (action === 'patch83t_get_user_import_capabilities') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          action,
          result: {
            edge_contract_version: 'patch83t-edge-user-import-v1',
            migration_173_available: true,
            identity_reference_action_available: true,
            import_execution_action_available: true,
            maximum_rows: 5000,
            runtime_status: 'compatible',
            compatible: true,
            server_time: '2026-07-16T00:00:00.000Z',
          },
        }),
      });
      return;
    }

    if (action === 'patch83t_user_import_identity_references') {
      proof.identityReferenceRequests += 1;
      let gate: Deferred | null = null;
      if (armIdentityDelay) {
        armIdentityDelay = false;
        gate = identityGate;
      }
      if (gate) await gate.promise;
      await safeFulfill(route, {
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          action,
          result: {
            auth_identities: [{
              employee_id: '001245',
              auth_email: '001245@almodawat.sa',
              auth_user_id: 'existing-user-a',
              organization_match: true,
            }],
            profile_identities: [{
              employee_id: '001245',
              auth_email: '001245@almodawat.sa',
              profile_id: 'existing-user-a',
              organization_match: true,
              employee_id_match: true,
              employee_id_case_insensitive_match: true,
              auth_email_match: true,
              has_cross_org_active_role: false,
            }],
            provisioning_identities: [],
          },
        }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, action, result: [] }),
    });
  });

  await page.route('**/rest/v1/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const table = url.pathname.split('/').pop() ?? '';
    const method = request.method();
    proof.restRequests.push({ method, table });
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      proof.writeRequests.push(`REST ${method} ${table}`);
    }

    const wantsObject = (request.headers().accept ?? '')
      .includes('application/vnd.pgrst.object+json');
    const select = url.searchParams.get('select') ?? '';
    let response: unknown = wantsObject ? {} : [];

    if (table === 'profiles' && select.includes('organizations(name_en)')) {
      response = {
        id: PATCH83V_USER_ID,
        email: 'patch83v.admin@example.test',
        full_name_en: v14jRoleDisplayName(role),
        full_name_ar: null,
        organization_id: PATCH83V_ORGANIZATION_ID,
        division_id: assignment.divisionId ?? null,
        department_id: assignment.departmentId ?? null,
        unit_id: null,
        is_active: true,
        user_status: 'active',
        organizations: { name_en: 'Patch 83V Organization' },
      };
    } else if (table === 'user_roles') {
      response = [{
        role,
        scope: assignment.scope,
        organization_id: PATCH83V_ORGANIZATION_ID,
        division_id: assignment.divisionId ?? null,
        department_id: assignment.departmentId ?? null,
        unit_id: null,
        is_active: true,
      }];
    } else if (table === 'departments') {
      const archived = url.searchParams.get('is_active') === 'eq.false'
        || (url.searchParams.get('or') ?? '').includes('is_active.eq.false');
      response = archived
        ? [{
            id: '00000000-0000-4000-8000-000000000088',
            code: 'OLD',
            name_en: 'Archived Department',
            name_ar: 'قسم مؤرشف',
            division_id: V14J_DIVISION_ID,
            organization_id: PATCH83V_ORGANIZATION_ID,
            is_active: false,
            archived_at: '2026-01-01T00:00:00.000Z',
          }]
        : [{
            id: V14J_DEPARTMENT_ID,
            code: 'IT',
            name_en: 'Information Technology',
            name_ar: 'تقنية المعلومات',
            division_id: V14J_DIVISION_ID,
            organization_id: PATCH83V_ORGANIZATION_ID,
            is_active: true,
            archived_at: null,
          }];
    } else if (table === 'organizations') {
      response = wantsObject
        ? {
            id: PATCH83V_ORGANIZATION_ID,
            code: 'PATCH83V',
            name_en: 'Patch 83V Organization',
            name_ar: 'منظمة باتش',
            is_active: true,
          }
        : [{
            id: PATCH83V_ORGANIZATION_ID,
            code: 'PATCH83V',
            name_en: 'Patch 83V Organization',
            name_ar: 'منظمة باتش',
            is_active: true,
          }];
    } else if (table === 'divisions') {
      response = [{
        id: V14J_DIVISION_ID,
        code: 'CORP',
        organization_id: PATCH83V_ORGANIZATION_ID,
        is_active: true,
      }];
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: {
        'access-control-allow-origin': '*',
        'access-control-expose-headers': 'Content-Range',
        'content-range': Array.isArray(response) && response.length
          ? `0-${response.length - 1}/${response.length}`
          : '*/0',
      },
      body: JSON.stringify(response),
    });
  });

  return backend;
}

export async function dispatchFocusAndVisibility(page: Page): Promise<void> {
  await page.evaluate(() => {
    if (document.visibilityState !== 'visible') {
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        value: 'visible',
      });
    }
    window.dispatchEvent(new Event('focus'));
    document.dispatchEvent(new Event('visibilitychange'));
  });
}

export async function refreshPatch83vSession(page: Page): Promise<void> {
  await page.evaluate(async ({ refreshToken }) => {
    const client = (globalThis as typeof globalThis & {
      __grcSupabaseClient__?: {
        auth: {
          refreshSession: (session: { refresh_token: string }) => Promise<{
            error: { message?: string } | null;
          }>;
        };
      };
    }).__grcSupabaseClient__;
    if (!client) throw new Error('Patch 83V could not access the configured browser Auth client.');
    const { error } = await client.auth.refreshSession({ refresh_token: refreshToken });
    if (error) throw new Error(error.message ?? 'Patch 83V token refresh failed.');
  }, { refreshToken: PATCH83V_REFRESH_TOKEN });
}

export async function signOutPatch83vSession(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const client = (globalThis as typeof globalThis & {
      __grcSupabaseClient__?: {
        auth: {
          signOut: (options: { scope: 'local' }) => Promise<{
            error: { message?: string } | null;
          }>;
        };
      };
    }).__grcSupabaseClient__;
    if (!client) throw new Error('Patch 83V could not access the configured browser Auth client.');
    const { error } = await client.auth.signOut({ scope: 'local' });
    if (error) throw new Error(error.message ?? 'Patch 83V sign-out failed.');
  });
}

export async function documentProof(page: Page) {
  return page.evaluate(() => ({
    bootCount: Number(sessionStorage.getItem('__patch83v_document_boot_count') ?? '0'),
    timeOrigin: performance.timeOrigin,
  }));
}

export async function historyProof(page: Page) {
  return page.evaluate(() => {
    const proof = (window as typeof window & {
      __patch83vHistoryProof__?: { push: string[]; replace: string[] };
    }).__patch83vHistoryProof__;
    return proof ?? { push: [], replace: [] };
  });
}

export async function waitForActivePatch83vUser(page: Page, role: Patch83vRole = 'super_admin') {
  const activeUser = page.getByText(v14jRoleDisplayName(role)).first();
  if ((page.viewportSize()?.width ?? 1440) <= 900) {
    await expect(activeUser).toBeAttached();
  } else {
    await expect(activeUser).toBeVisible();
  }
}
