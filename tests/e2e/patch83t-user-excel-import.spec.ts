import { expect, test, type Locator, type Page } from '@playwright/test';
import ExcelJS from 'exceljs';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { USER_IMPORT_COLUMNS } from '../../src/utils/userWorkbook';

const organizationId = '00000000-0000-4000-8000-000000000083';
const userId = '00000000-0000-4000-8000-000000000084';

type Telemetry = {
  mutationRequests: string[];
  readActions: string[];
  authCreationRequests: string[];
  consoleProblems: string[];
  pageErrors: string[];
  actionPayloads: Array<{ action: string; payload: Record<string, unknown> }>;
};

function row(index: number, overrides: Record<string, string> = {}) {
  const values: Record<string, string> = {
    employee_id: `EMP-${String(index).padStart(5, '0')}`,
    english_name: `User ${index}`,
    arabic_name: `مستخدم ${index}`,
    contact_email: index % 3 ? `user.${index}@example.test` : '',
    phone: index % 2 ? '0501234567' : '+966501234567',
    department_code: 'IT',
    job_title: 'Analyst',
    role: 'employee',
    role_scope: 'assigned_only',
    status: 'active',
    user_type: 'employee',
    account_action: 'create',
    ...overrides,
  };
  return USER_IMPORT_COLUMNS.map((column) => values[column]);
}

async function workbookBuffer(
  rows: unknown[][],
  options: {
    headers?: string[];
    configure?: (workbook: ExcelJS.Workbook, worksheet: ExcelJS.Worksheet) => void;
  } = {},
) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Users');
  worksheet.addRow(options.headers ?? [...USER_IMPORT_COLUMNS]);
  rows.forEach((values) => worksheet.addRow(values));
  options.configure?.(workbook, worksheet);
  return Buffer.from(await workbook.xlsx.writeBuffer() as ArrayBuffer);
}

function rosterRows() {
  return [{
    organization_id: organizationId,
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
    created_at: new Date(0).toISOString(),
    updated_at: null,
    last_login_at: null,
    last_reviewed_at: null,
    deactivated_at: null,
    deactivated_by: null,
    deactivation_reason: null,
    division_id: 'division-1',
    division_name: 'Corporate',
    department_id: 'department-it',
    department_code: 'IT',
    department_name: 'Information Technology',
    department_name_ar: 'تقنية المعلومات',
    unit_id: null,
    unit_name: null,
    active_role_count: 1,
    roles: [{
      user_role_id: 'role-existing',
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

async function installMocks(page: Page, telemetry: Telemetry, role = 'super_admin') {
  await page.addInitScript(({ sessionUserId, sessionOrganizationId }) => {
    localStorage.setItem('grc-control-center-auth', JSON.stringify({
      access_token: 'patch83t-browser-qa-token',
      refresh_token: 'patch83t-browser-qa-refresh',
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      expires_in: 3600,
      token_type: 'bearer',
      user: {
        id: sessionUserId,
        aud: 'authenticated',
        role: 'authenticated',
        email: 'patch83t.qa@example.test',
        app_metadata: { provider: 'email', providers: ['email'] },
        user_metadata: {},
        identities: [],
        created_at: new Date(0).toISOString(),
      },
      organization_id: sessionOrganizationId,
    }));
  }, { sessionUserId: userId, sessionOrganizationId: organizationId });

  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') {
      telemetry.consoleProblems.push(`${message.type()}: ${message.text()}`);
    }
  });
  page.on('pageerror', (error) => telemetry.pageErrors.push(error.message));

  await page.route('**/auth/v1/**', async (route) => {
    const request = route.request();
    if (/signup|invite|admin\/users/i.test(request.url()) || ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method())) {
      if (!/auth\/v1\/user$/i.test(new URL(request.url()).pathname)) {
        telemetry.authCreationRequests.push(`${request.method()} ${request.url()}`);
      }
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ id: userId, aud: 'authenticated', role: 'authenticated', email: 'patch83t.qa@example.test' }),
    });
  });

  await page.route('**/functions/v1/**', async (route) => {
    const request = route.request();
    const body = request.postDataJSON() as { action?: string; payload?: Record<string, unknown> } | null;
    const action = body?.action ?? '';
    if (
      action === 'list_user_management_roster'
      || action === 'patch83u_get_credential_state'
      || action === 'patch83t_user_import_identity_references'
    ) telemetry.readActions.push(action);
    else telemetry.mutationRequests.push(`${request.method()} ${action}`);
    telemetry.actionPayloads.push({ action, payload: body?.payload ?? {} });
    const result = action === 'list_user_management_roster'
      ? rosterRows()
      : action === 'patch83u_get_credential_state'
        ? { managed: true, credential_state: 'active', credential_version: 0, auth_email: 'patch83t.qa@example.test', access_allowed: true }
        : action === 'patch83t_user_import_identity_references'
          ? {
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
            }
        : {
            batch_id: '83000000-0000-4000-8000-000000000000',
            updated_count: 1,
            pending_account_creation_count: 26,
            provisioning_ids: Array.from(
              { length: 26 },
              (_, index) => `83000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
            ),
            database_proof: {
              import_row_count: 27,
              provisioning_record_count: 26,
              audit_record_count: 1,
              payload_sha256: '83'.repeat(32),
            },
          };
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
    const method = request.method();
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) telemetry.mutationRequests.push(`${method} ${table}`);
    const wantsObject = (request.headers().accept ?? '').includes('application/vnd.pgrst.object+json');
    const select = url.searchParams.get('select') ?? '';
    let body: unknown = wantsObject ? {} : [];

    if (table === 'profiles' && select.includes('organizations(name_en)')) {
      body = {
        id: userId,
        email: 'patch83t.qa@example.test',
        full_name_en: 'Patch 83T Browser QA',
        full_name_ar: 'اختبار المتصفح',
        organization_id: organizationId,
        division_id: null,
        department_id: null,
        unit_id: null,
        is_active: true,
        user_status: 'active',
        organizations: { name_en: 'Patch 83T QA Organization' },
      };
    } else if (table === 'profiles') {
      body = rosterRows().map((item) => ({
        id: item.user_id,
        organization_id: item.organization_id,
        employee_no: item.employee_no,
        full_name_en: item.full_name_en,
        full_name_ar: item.full_name_ar,
        email: item.email,
        contact_email: item.contact_email,
        phone: item.phone,
        job_title: item.job_title,
        department_id: item.department_id,
        is_active: true,
        user_status: 'active',
        user_type: 'employee',
        created_at: item.created_at,
      }));
    } else if (table === 'user_roles') {
      body = [{ role, scope: role === 'viewer' ? 'assigned_only' : 'global', organization_id: organizationId, is_active: true }];
    } else if (table === 'departments') {
      const archived = url.searchParams.get('is_active') === 'eq.false'
        || (url.searchParams.get('or') ?? '').includes('is_active.eq.false');
      body = archived
        ? [{ id: 'department-old', code: 'OLD', name_en: 'Archived', name_ar: 'مؤرشفة', division_id: 'division-1', is_active: false, archived_at: '2026-01-01T00:00:00Z' }]
        : [{ id: 'department-it', code: 'IT', name_en: 'Information Technology', name_ar: 'تقنية المعلومات', division_id: 'division-1', is_active: true, archived_at: null }];
    } else if (table === 'organizations') {
      body = wantsObject
        ? { id: organizationId, name_en: 'Patch 83T QA Organization', name_ar: 'منظمة اختبار', is_active: true }
        : [{ id: organizationId, name_en: 'Patch 83T QA Organization', name_ar: 'منظمة اختبار', is_active: true }];
    } else if (table === 'divisions') {
      body = [{ id: 'division-1', code: 'CORP', organization_id: organizationId, is_active: true }];
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

async function openUserImport(page: Page) {
  await page.goto('/');
  await expect(page.getByText('Patch 83T Browser QA')).toBeVisible();
  await page.locator('.nav-child-item').filter({ hasText: 'User Management' }).click();
  await expect(page.getByRole('heading', { name: 'User Management Center' })).toBeVisible();
  await page.getByRole('button', { name: 'Import Excel' }).click();
  const modal = page.getByRole('dialog', { name: 'Preview User Excel Import' });
  await expect(modal).toBeVisible();
  return modal;
}

function kpiValue(modal: Locator, label: string) {
  return modal.locator('.kpi-tile__label').getByText(label, { exact: true }).locator('..').locator('.kpi-tile__value');
}

test.describe('Patch 83T controlled User Excel Import', () => {
  test('downloads the template and previews a real 27-row workbook without writes', async ({ page }) => {
    test.setTimeout(90_000);
    const telemetry: Telemetry = { mutationRequests: [], readActions: [], authCreationRequests: [], consoleProblems: [], pageErrors: [], actionPayloads: [] };
    await installMocks(page, telemetry);
    await page.setViewportSize({ width: 1440, height: 900 });
    const modal = await openUserImport(page);

    const downloadPromise = page.waitForEvent('download');
    await modal.getByRole('button', { name: 'Download Excel template' }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('user-management-import-template.xlsx');
    const templatePath = path.join(test.info().outputDir, 'user-management-import-template.xlsx');
    await download.saveAs(templatePath);
    const template = new ExcelJS.Workbook();
    await template.xlsx.load(readFileSync(templatePath) as unknown as ArrayBuffer);
    expect(template.getWorksheet('Users')?.getRow(1).values).toEqual([undefined, ...USER_IMPORT_COLUMNS]);
    expect(template.getWorksheet('Users')?.getColumn(1).numFmt).toBe('@');
    expect(template.getWorksheet('Users')?.getCell('I5001').dataValidation.type).toBe('list');
    expect(template.getWorksheet('Users')?.getCell('L5001').dataValidation.type).toBe('list');
    expect(template.getWorksheet('Instructions')?.getColumn(1).values.join('\n')).toContain('Never enter passwords');

    const rows = Array.from({ length: 27 }, (_, index) => index === 0
      ? row(1, {
          employee_id: '001245',
          contact_email: 'existing.contact@example.test',
          account_action: 'update',
          english_name: 'Updated Existing',
          arabic_name: 'مستخدم محدث',
        })
      : row(index + 1));
    const buffer = await workbookBuffer(rows);
    await modal.locator('#user-workbook-input').setInputFiles({
      name: 'users-27-valid.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer,
    });

    await expect(kpiValue(modal, 'Total rows')).toHaveText('27');
    await expect(kpiValue(modal, 'Valid rows')).toHaveText('27');
    await expect(kpiValue(modal, 'Invalid rows')).toHaveText('0');
    await expect(kpiValue(modal, 'Existing users to update')).toHaveText('1');
    await expect(kpiValue(modal, 'Accounts pending controlled creation')).toHaveText('26');
    await expect(modal).toContainText('Updated Existing');
    await expect(modal).toContainText('مستخدم محدث');
    await expect(modal).toContainText('0501234567');
    await expect(modal).toContainText('+966501234567');
    await expect(modal).toContainText('001245@almodawat.sa');
    await expect(modal).toContainText('existing.contact@example.test');
    await expect(modal).toContainText('update');
    await expect(modal).toContainText('update_existing_profile');
    await expect(modal).toContainText('pending_account_creation');
    await expect(modal.getByRole('button', { name: 'Execute User Import' })).toBeDisabled();
    await modal.getByLabel('Exact execution confirmation').fill('EXECUTE USER IMPORT');
    await expect(modal.getByRole('button', { name: 'Execute User Import' })).toBeEnabled();
    await modal.locator('#user-workbook-input').setInputFiles({
      name: 'users-27-replaced.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer,
    });
    await expect(kpiValue(modal, 'Valid rows')).toHaveText('27');
    await expect(modal.getByLabel('Exact execution confirmation')).toHaveValue('');
    await expect(modal.getByRole('button', { name: 'Execute User Import' })).toBeDisabled();

    await page.setViewportSize({ width: 1024, height: 768 });
    const modalBox = await modal.boundingBox();
    expect(modalBox).not.toBeNull();
    expect(modalBox!.x).toBeGreaterThanOrEqual(0);
    expect(modalBox!.width).toBeLessThanOrEqual(1024);

    await modal.getByRole('button', { name: 'Remove file' }).first().click();
    await expect(modal).not.toContainText('users-27-valid.xlsx');
    await expect(modal.locator('.kpi-tile')).toHaveCount(0);
    await modal.locator('#user-workbook-input').setInputFiles({
      name: 'replacement.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer,
    });
    await expect(kpiValue(modal, 'Total rows')).toHaveText('27');

    expect(telemetry.readActions.length).toBeGreaterThan(0);
    expect(telemetry.mutationRequests).toEqual([]);
    expect(telemetry.authCreationRequests).toEqual([]);
    expect(telemetry.pageErrors).toEqual([]);
    expect(telemetry.consoleProblems).toEqual([]);
  });

  test('sends the exact confirmed 27-row execution payload and displays database proof', async ({ page }) => {
    test.setTimeout(90_000);
    const telemetry: Telemetry = { mutationRequests: [], readActions: [], authCreationRequests: [], consoleProblems: [], pageErrors: [], actionPayloads: [] };
    await installMocks(page, telemetry);
    const modal = await openUserImport(page);
    const rows = Array.from({ length: 27 }, (_, index) => index === 0
      ? row(1, {
          employee_id: '001245',
          contact_email: 'existing.contact@example.test',
          account_action: 'update',
          phone: '0501234567',
        })
      : row(index + 1));
    await modal.locator('#user-workbook-input').setInputFiles({
      name: 'users-27-execute.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: await workbookBuffer(rows),
    });
    await expect(kpiValue(modal, 'Valid rows')).toHaveText('27');
    await modal.getByLabel('Exact execution confirmation').fill('EXECUTE USER IMPORT');
    await modal.getByRole('button', { name: 'Execute User Import' }).click();

    await expect(page.getByText(/Import batch 83000000-0000-4000-8000-000000000000 applied with database proof: 27 import rows, 26 protected provisioning records, and 1 profile audit records/)).toBeVisible();
    const execution = telemetry.actionPayloads.find((entry) => entry.action === 'patch83t_apply_user_excel_import');
    expect(execution).toBeDefined();
    expect(execution!.payload.execution_confirmation).toBe('EXECUTE USER IMPORT');
    expect(execution!.payload.source_format).toBe('xlsx');
    const payloadRows = execution!.payload.rows as Array<Record<string, unknown>>;
    expect(payloadRows).toHaveLength(27);
    expect(payloadRows[0]).toMatchObject({
      row_number: 2,
      employee_id: '001245',
      contact_email: 'existing.contact@example.test',
      account_action: 'update',
      phone: '+966501234567',
      expected_matched_user_id: 'existing-user-a',
      expected_planned_action: 'update_existing_profile',
      expected_active_role_ids: ['role-existing'],
    });
    expect(payloadRows[26]).toMatchObject({
      employee_id: 'EMP-00027',
      contact_email: null,
      account_action: 'create',
      expected_planned_action: 'pending_account_creation',
    });
    expect(telemetry.mutationRequests).toEqual(['POST patch83t_apply_user_excel_import']);
    expect(telemetry.authCreationRequests).toEqual([]);
    expect(telemetry.pageErrors).toEqual([]);
    expect(telemetry.consoleProblems).toEqual([]);
  });

  test('rejects invalid files and exports validation errors as xlsx', async ({ page }) => {
    test.setTimeout(90_000);
    const telemetry: Telemetry = { mutationRequests: [], readActions: [], authCreationRequests: [], consoleProblems: [], pageErrors: [], actionPayloads: [] };
    await installMocks(page, telemetry);
    const modal = await openUserImport(page);
    const input = modal.locator('#user-workbook-input');

    await input.setInputFiles({ name: 'users.csv', mimeType: 'text/csv', buffer: Buffer.from('employee_id,contact_email,account_action\n001,a@example.test,create') });
    await expect(modal).toContainText('CSV and legacy .xls files are not accepted');
    await input.setInputFiles({ name: 'renamed.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: Buffer.from('not a workbook') });
    await expect(modal).toContainText('corrupt or is not a valid Excel .xlsx workbook');

    const invalid = await workbookBuffer([
      row(1, {
        employee_id: '001245',
        contact_email: 'not-an-email',
        account_action: 'update',
        department_code: 'OLD',
        phone: '123',
        user_type: 'unknown',
      }),
      row(2, { employee_id: '001245', contact_email: '', account_action: 'unsupported' }),
    ], {
      configure: (_workbook, worksheet) => {
        worksheet.getCell('A2').value = 1245;
        worksheet.getCell('B3').value = { formula: 'CONCAT("Bad"," User")', result: 'Bad User' };
      },
    });
    await input.setInputFiles({ name: 'invalid-users.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: invalid });
    await expect(kpiValue(modal, 'Invalid rows')).toHaveText('2');
    await expect(modal).toContainText('This value must be entered as text using the provided Excel template');
    await expect(modal).toContainText('Formula cells are not allowed');
    await expect(modal).toContainText('Archived department cannot be assigned');
    await expect(modal).toContainText('Contact email must be a valid email address when populated');
    await expect(modal).toContainText('Invalid account action');
    await expect(modal.getByRole('button', { name: 'Execute User Import' })).toBeDisabled();

    const downloadPromise = page.waitForEvent('download');
    await modal.getByRole('button', { name: 'Export validation errors' }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^user-import-validation-.*\.xlsx$/);
    const errorPath = path.join(test.info().outputDir, 'user-validation-errors.xlsx');
    await download.saveAs(errorPath);
    const errorsWorkbook = new ExcelJS.Workbook();
    await errorsWorkbook.xlsx.load(readFileSync(errorPath) as unknown as ArrayBuffer);
    expect(errorsWorkbook.getWorksheet('Validation Errors')?.getRow(1).values).toEqual([
      undefined, 'Row Number', 'Employee ID', 'Synthetic Auth Email', 'Contact Email', 'Original Phone', 'Normalized Phone',
      'Account Action', 'Matched Profile', 'Matched Auth Identity', 'Planned Operation', 'Errors', 'Warnings',
    ]);
    expect(errorsWorkbook.getWorksheet('Validation Errors')?.getColumn(11).values.join(' ')).toContain('Formula cells are not allowed');
    expect(telemetry.mutationRequests).toEqual([]);
    expect(telemetry.authCreationRequests).toEqual([]);
  });

  test('keeps User Excel Import unavailable to unauthorized roles', async ({ page }) => {
    const telemetry: Telemetry = { mutationRequests: [], readActions: [], authCreationRequests: [], consoleProblems: [], pageErrors: [], actionPayloads: [] };
    await installMocks(page, telemetry, 'viewer');
    await page.goto('/');
    await expect(page.getByText('Patch 83T Browser QA')).toBeVisible();
    await expect(page.locator('.nav-child-item').filter({ hasText: 'User Management' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Import Excel' })).toHaveCount(0);
    expect(telemetry.mutationRequests).toEqual([]);
    expect(telemetry.authCreationRequests).toEqual([]);
  });

  test('leaves Department Excel Import controls unchanged', async ({ page }) => {
    const telemetry: Telemetry = { mutationRequests: [], readActions: [], authCreationRequests: [], consoleProblems: [], pageErrors: [], actionPayloads: [] };
    await installMocks(page, telemetry);
    await page.goto('/');
    await expect(page.getByText('Patch 83T Browser QA')).toBeVisible();
    await page.locator('.nav-child-item').filter({ hasText: 'Departments' }).click();
    await page.getByRole('button', { name: 'Prepare Import Batch' }).click();
    const departmentModal = page.getByRole('dialog', { name: 'Prepare Department Import' });
    await expect(departmentModal).toContainText('Upload Department Excel File');
    await expect(departmentModal.locator('#department-workbook-input')).toHaveAttribute('accept', /\.xlsx/);
    await expect(departmentModal.getByRole('button', { name: 'Download template' })).toBeVisible();
    expect(telemetry.mutationRequests).toEqual([]);
    expect(telemetry.authCreationRequests).toEqual([]);
  });
});
