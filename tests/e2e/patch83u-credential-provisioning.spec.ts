import { expect, test, type Page } from '@playwright/test';

const organizationId = '00000000-0000-4000-8000-000000000083';
const adminUserId = '00000000-0000-4000-8000-000000000084';
const targetUserId = '00000000-0000-4000-8000-000000000085';
const provisioningId = '00000000-0000-4000-8000-000000000086';
const employeeId = '11111';
const adminAuthEmail = 'sa-0001@almodawat.sa';

type ActionCall = {
  action: string;
  payload: Record<string, unknown>;
};

type Telemetry = {
  actions: ActionCall[];
  restRequests: string[];
  unexpectedAuthWrites: string[];
  consoleProblems: string[];
  pageErrors: string[];
};

function telemetry(): Telemetry {
  return {
    actions: [],
    restRequests: [],
    unexpectedAuthWrites: [],
    consoleProblems: [],
    pageErrors: [],
  };
}

function sessionUser() {
  return {
    id: adminUserId,
    aud: 'authenticated',
    role: 'authenticated',
    email: adminAuthEmail,
    app_metadata: {
      provider: 'email',
      providers: ['email'],
      credential_version: 0,
    },
    user_metadata: {},
    identities: [],
    created_at: new Date(0).toISOString(),
  };
}

function rosterRows() {
  return [{
    organization_id: organizationId,
    user_id: targetUserId,
    employee_no: employeeId,
    full_name_en: 'Patch 83U Managed User',
    full_name_ar: 'مستخدم مُدار',
    email: `${employeeId.toLowerCase()}@almodawat.sa`,
    contact_email: 'managed.user@example.test',
    phone: '+966501234567',
    job_title: 'Risk Analyst',
    user_type: 'employee',
    user_status: 'active',
    is_active: true,
    created_at: new Date(0).toISOString(),
    updated_at: null,
    last_login_at: null,
    last_reviewed_at: null,
    deactivated_at: null,
    deactivated_by: null,
    deactivation_reason: null,
    division_id: null,
    division_name: null,
    department_id: '00000000-0000-4000-8000-000000000087',
    department_code: 'GRC',
    department_name: 'Governance, Risk and Compliance',
    department_name_ar: 'الحوكمة والمخاطر والامتثال',
    unit_id: null,
    unit_name: null,
    active_role_count: 1,
    roles: [{
      user_role_id: '00000000-0000-4000-8000-000000000088',
      role: 'employee',
      scope: 'assigned_only',
      organization_id: organizationId,
      department_id: null,
      is_active: true,
      assigned_at: new Date(0).toISOString(),
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
    auth_email: `${employeeId.toLowerCase()}@almodawat.sa`,
    synthetic_auth_email: `${employeeId.toLowerCase()}@almodawat.sa`,
    credential_state: 'active',
    credential_version: 2,
    must_change_password: false,
    last_password_reset_at: null,
    last_password_changed_at: null,
    provisioning_state: 'completed',
    credential_proof_available: true,
  }];
}

function provisioningResult() {
  return {
    organization_id: organizationId,
    count: 1,
    rows: [{
      id: provisioningId,
      import_batch_id: '00000000-0000-4000-8000-000000000089',
      import_row_id: '00000000-0000-4000-8000-000000000090',
      employee_id: employeeId,
      auth_email: `${employeeId.toLowerCase()}@almodawat.sa`,
      contact_email: null,
      account_action: 'create',
      full_name_en: 'Patch 83U Provision User',
      full_name_ar: 'مستخدم تهيئة',
      phone: '+966501234567',
      department_id: '00000000-0000-4000-8000-000000000087',
      department_code: 'GRC',
      job_title: 'Risk Analyst',
      requested_role: 'employee',
      requested_scope: 'assigned_only',
      requested_user_type: 'employee',
      requested_lifecycle: 'active',
      provisioning_status: 'queued',
      attempt_count: 0,
      last_error_code: null,
      last_error_message: null,
      profile_id: null,
      created_at: new Date(0).toISOString(),
      updated_at: new Date(0).toISOString(),
    }],
  };
}

async function seedAuthenticatedSession(page: Page) {
  await page.addInitScript(({ user }) => {
    localStorage.setItem('grc-control-center-auth', JSON.stringify({
      access_token: 'patch83u-browser-proof-token',
      refresh_token: 'patch83u-browser-proof-refresh',
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      expires_in: 3600,
      token_type: 'bearer',
      user,
    }));
  }, { user: sessionUser() });
}

async function installAuthenticatedMocks(
  page: Page,
  proof: Telemetry,
  credentialState: 'active' | 'initial_change_required' = 'active',
) {
  await seedAuthenticatedSession(page);

  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') {
      proof.consoleProblems.push(`${message.type()}: ${message.text()}`);
    }
  });
  page.on('pageerror', (error) => proof.pageErrors.push(error.message));

  await page.route('**/auth/v1/**', async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    if (/signup|invite|admin\/users/i.test(pathname)) {
      proof.unexpectedAuthWrites.push(`${request.method()} ${pathname}`);
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(sessionUser()),
    });
  });

  await page.route('**/functions/v1/**', async (route) => {
    const requestBody = requestJson(route.request().postData());
    const action = typeof requestBody.action === 'string' ? requestBody.action : '';
    const payload = isRecord(requestBody.payload) ? requestBody.payload : {};
    proof.actions.push({ action, payload });

    let result: unknown;
    if (action === 'patch83u_get_credential_state') {
      result = {
        managed: true,
        credential_state: credentialState,
        credential_version: credentialState === 'active' ? 0 : 1,
        auth_email: adminAuthEmail,
        access_allowed: credentialState === 'active',
        message: credentialState === 'active'
          ? null
          : 'Change the initial Employee ID password before application access.',
      };
    } else if (action === 'list_user_management_roster') {
      result = rosterRows();
    } else if (action === 'patch83u_list_provisioning') {
      result = provisioningResult();
    } else if (action === 'patch83u_provision_account') {
      result = {
        provisioningId,
        profileId: targetUserId,
        status: 'initial_change_required',
        mustChangePassword: true,
      };
    } else if (action === 'patch83u_reconcile_provisioning') {
      result = {
        provisioningId,
        status: 'completed',
        outcome: 'reconciled',
      };
    } else if (action === 'patch83u_admin_reset_password') {
      result = {
        userId: targetUserId,
        status: 'admin_reset_change_required',
        mustChangePassword: true,
        mustReauthenticate: true,
      };
    } else {
      result = {};
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, action, result }),
    });
  });

  await page.route('**/rest/v1/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const table = url.pathname.split('/').pop() ?? '';
    proof.restRequests.push(`${request.method()} ${table}`);
    const wantsObject = (request.headers().accept ?? '').includes('application/vnd.pgrst.object+json');
    let body: unknown = wantsObject ? {} : [];

    if (table === 'profiles') {
      body = {
        id: adminUserId,
        email: adminAuthEmail,
        full_name_en: 'Patch 83U Browser Admin',
        full_name_ar: 'مسؤول اختبار',
        organization_id: organizationId,
        division_id: null,
        department_id: null,
        unit_id: null,
        is_active: true,
        user_status: 'active',
        organizations: { name_en: 'Patch 83U QA Organization' },
      };
    } else if (table === 'user_roles') {
      body = [{
        role: 'super_admin',
        scope: 'global',
        organization_id: organizationId,
        division_id: null,
        department_id: null,
        unit_id: null,
        is_active: true,
      }];
    } else if (table === 'departments') {
      body = [{
        id: '00000000-0000-4000-8000-000000000087',
        code: 'GRC',
        name_en: 'Governance, Risk and Compliance',
        name_ar: 'الحوكمة والمخاطر والامتثال',
        division_id: null,
        is_active: true,
        archived_at: null,
      }];
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: {
        'access-control-allow-origin': '*',
        'access-control-expose-headers': 'Content-Range',
        'content-range': Array.isArray(body) && body.length ? `0-${body.length - 1}/${body.length}` : '*/0',
      },
      body: JSON.stringify(body),
    });
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requestJson(raw: string | null): Record<string, unknown> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

async function openUserManagement(page: Page) {
  await page.goto('/');
  await expect(page.getByText('Patch 83U Browser Admin')).toBeVisible();
  await page.locator('.nav-child-item').filter({ hasText: 'User Management' }).click();
  await expect(page.getByRole('heading', { name: 'User Management Center' })).toBeVisible();
  await expect(page.getByText('Patch 83U Managed User')).toBeVisible();
}

function callsFor(proof: Telemetry, action: string) {
  return proof.actions.filter((call) => call.action === action);
}

test.describe('Patch 83U Employee ID credentials and protected provisioning', () => {
  test('normalizes an Employee ID to the controlled Auth email for login', async ({ page }) => {
    let loginRequest: Record<string, unknown> | null = null;
    await page.route('**/auth/v1/**', async (route) => {
      const request = route.request();
      if (request.method() === 'POST' && new URL(request.url()).searchParams.get('grant_type') === 'password') {
        loginRequest = requestJson(request.postData());
      }
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'invalid_grant', error_description: 'Invalid login credentials' }),
      });
    });

    await page.goto('/');
    await page.getByLabel(/Email or Employee ID/).fill('  000042Ab  ');
    await page.getByLabel('Password', { exact: true }).fill('EmployeePass!2026');
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect.poll(() => loginRequest).not.toBeNull();
    expect(loginRequest).toMatchObject({
      email: '000042ab@almodawat.sa',
      password: 'EmployeePass!2026',
    });
  });

  test('blocks the application shell and shows only forced password change for required state', async ({ page }) => {
    const proof = telemetry();
    await installAuthenticatedMocks(page, proof, 'initial_change_required');

    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Password change required' })).toBeVisible();
    await expect(page.getByLabel('Current password')).toBeVisible();
    await expect(page.getByLabel('New password', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Confirm new password')).toBeVisible();
    await expect(page.locator('.modern-sidebar')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'User Management Center' })).toHaveCount(0);

    expect(callsFor(proof, 'patch83u_get_credential_state').length).toBeGreaterThan(0);
    expect(proof.restRequests).toEqual([]);
    expect(proof.pageErrors).toEqual([]);
    expect(proof.consoleProblems).toEqual([]);
  });

  test('requires permanent-password confirmation and sends the three-field protected payload', async ({ page }) => {
    const proof = telemetry();
    await installAuthenticatedMocks(page, proof, 'initial_change_required');
    await page.goto('/');

    await page.getByLabel('Current password').fill(employeeId);
    await page.getByLabel('New password', { exact: true }).fill(employeeId);
    await page.getByLabel('Confirm new password').fill(employeeId);
    await page.getByRole('button', { name: 'Change password' }).click();
    await expect(page.getByRole('alert')).toContainText('must differ from the current password');
    expect(callsFor(proof, 'patch83u_change_required_password')).toEqual([]);

    const permanentPassword = 'Permanent.Password#2026';
    await page.getByLabel('New password', { exact: true }).fill(permanentPassword);
    await page.getByLabel('Confirm new password').fill('mismatch');
    await page.getByRole('button', { name: 'Change password' }).click();
    await expect(page.getByRole('alert')).toContainText('confirmation does not match');
    expect(callsFor(proof, 'patch83u_change_required_password')).toEqual([]);

    await page.getByLabel('Confirm new password').fill(permanentPassword);
    await page.getByRole('button', { name: 'Change password' }).click();
    await expect.poll(() => callsFor(proof, 'patch83u_change_required_password').length).toBe(1);
    expect(callsFor(proof, 'patch83u_change_required_password')[0].payload).toEqual({
      current_password: employeeId,
      new_password: permanentPassword,
      confirm_new_password: permanentPassword,
    });
    expect(proof.pageErrors).toEqual([]);
    expect(proof.consoleProblems).toEqual([]);
  });

  test('opens the provisioning queue without writes and provisions only after exact confirmation and click', async ({ page }) => {
    const proof = telemetry();
    await installAuthenticatedMocks(page, proof);
    await openUserManagement(page);

    expect(callsFor(proof, 'patch83u_provision_account')).toEqual([]);
    await page.getByRole('button', { name: 'Provisioning queue' }).click();
    const dialog = page.getByRole('dialog', { name: 'Protected account provisioning' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('Patch 83U Provision User')).toBeVisible();
    await expect(dialog.getByText('11111@almodawat.sa')).toBeVisible();
    await expect(dialog.getByText('No contact email')).toBeVisible();
    await expect(dialog.getByText('create', { exact: true })).toBeVisible();
    expect(callsFor(proof, 'patch83u_list_provisioning').length).toBeGreaterThan(0);
    expect(callsFor(proof, 'patch83u_provision_account')).toEqual([]);
    expect(proof.restRequests.filter((request) => /^(POST|PUT|PATCH|DELETE) /.test(request))).toEqual([]);

    await dialog.getByRole('button', { name: 'Provision', exact: true }).click();
    const execute = dialog.getByRole('button', { name: 'Provision account' });
    await expect(execute).toBeDisabled();
    await dialog.getByLabel('Provisioning Employee ID confirmation').fill('000042ab');
    await expect(execute).toBeDisabled();
    expect(callsFor(proof, 'patch83u_provision_account')).toEqual([]);

    await dialog.getByLabel('Provisioning Employee ID confirmation').fill(employeeId);
    await expect(execute).toBeEnabled();
    expect(callsFor(proof, 'patch83u_provision_account')).toEqual([]);
    await execute.click();

    await expect.poll(() => callsFor(proof, 'patch83u_provision_account').length).toBe(1);
    expect(callsFor(proof, 'patch83u_provision_account')[0].payload).toEqual({
      provisioning_id: provisioningId,
      employee_id_confirmation: employeeId,
      request_id: expect.stringMatching(/^patch83u:provision:[0-9a-f-]{36}$/),
    });
    expect(proof.unexpectedAuthWrites).toEqual([]);
    expect(proof.pageErrors).toEqual([]);
    expect(proof.consoleProblems).toEqual([]);
  });

  test('defaults reset to Employee ID and requires both exact confirmations and a reason', async ({ page }) => {
    const proof = telemetry();
    await installAuthenticatedMocks(page, proof);
    await openUserManagement(page);

    await page.getByLabel('More actions for Patch 83U Managed User').click();
    const actionsDialog = page.getByRole('dialog', { name: 'Actions for Patch 83U Managed User' });
    await actionsDialog.getByRole('button', { name: 'Reset temporary password' }).click();
    const resetDialog = page.getByRole('dialog', { name: 'Super Admin temporary password reset' });
    const reset = resetDialog.getByRole('button', { name: 'Reset password and revoke sessions' });
    await expect(resetDialog).toBeVisible();
    await expect(reset).toBeDisabled();
    expect(callsFor(proof, 'patch83u_admin_reset_password')).toEqual([]);

    await expect(resetDialog.getByLabel('Temporary password', { exact: true })).toHaveValue(employeeId);
    await expect(resetDialog.getByLabel('Confirm temporary password', { exact: true })).toHaveValue(employeeId);
    await resetDialog.getByLabel('Reset Employee ID confirmation').fill(employeeId);
    await expect(reset).toBeDisabled();

    await resetDialog.getByLabel('Reset password action confirmation').fill('RESET PASSWORD');
    await expect(reset).toBeDisabled();
    expect(callsFor(proof, 'patch83u_admin_reset_password')).toEqual([]);

    await resetDialog.getByLabel('Reset password action confirmation').fill('RESET USER PASSWORD');
    await expect(reset).toBeDisabled();
    await resetDialog.getByLabel('Reset reason').fill('Employee requested a controlled temporary password reset.');
    await expect(reset).toBeEnabled();
    expect(callsFor(proof, 'patch83u_admin_reset_password')).toEqual([]);
    await reset.click();

    await expect.poll(() => callsFor(proof, 'patch83u_admin_reset_password').length).toBe(1);
    expect(callsFor(proof, 'patch83u_admin_reset_password')[0].payload).toEqual({
      user_id: targetUserId,
      temporary_password: employeeId,
      confirmation: 'PATCH83U_RESET_USER_PASSWORD',
      employee_id_confirmation: employeeId,
      reason: 'Employee requested a controlled temporary password reset.',
      request_id: expect.stringMatching(/^patch83u:admin-reset:[0-9a-f-]{36}$/),
    });
    expect(proof.unexpectedAuthWrites).toEqual([]);
    expect(proof.pageErrors).toEqual([]);
    expect(proof.consoleProblems).toEqual([]);
  });
});
