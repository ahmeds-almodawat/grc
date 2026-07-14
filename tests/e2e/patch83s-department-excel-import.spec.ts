import { expect, test, type Locator, type Page } from '@playwright/test';
import ExcelJS from 'exceljs';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const organizationId = '00000000-0000-4000-8000-000000000083';
const userId = '00000000-0000-4000-8000-000000000084';
const evidenceDir = path.join(process.cwd(), 'test-results', 'patch83s-browser-qa');
const departmentHeaders = [
  'organization_code',
  'division_code',
  'department_code',
  'department_name_en',
  'department_name_ar',
  'department_type',
  'manager_email',
  'status',
];

type QaTelemetry = {
  consoleProblems: string[];
  pageErrors: string[];
  previewActive: boolean;
  previewWriteRequests: string[];
  referenceRequests: string[];
};

type QaReferenceOptions = {
  delayMs?: number;
  failOrganizationAttempts?: number;
};

function workbookBuffer(
  rows: unknown[][],
  headers = departmentHeaders,
  configure?: (worksheet: ExcelJS.Worksheet) => void,
) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Departments');
  if (headers.length) worksheet.addRow(headers);
  rows.forEach((row) => worksheet.addRow(row));
  configure?.(worksheet);
  return workbook.xlsx.writeBuffer().then((buffer) => Buffer.from(buffer as ArrayBuffer));
}

function validDepartmentRow(code: string, nameEn = `Department ${code}`, nameAr = `قسم ${code}`) {
  return ['ALMODAWAT', 'MED', code, nameEn, nameAr, 'clinical', '', 'active'];
}

function expectedFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(bytes < 1024 * 100 ? 1 : 0)} KB`;
}

async function installQaSessionAndSupabaseMocks(
  page: Page,
  telemetry: QaTelemetry,
  referenceOptions: QaReferenceOptions = {},
) {
  await page.addInitScript(({ sessionUserId, sessionOrganizationId }) => {
    const expiresAt = Math.floor(Date.now() / 1000) + 60 * 60;
    localStorage.setItem('grc-control-center-auth', JSON.stringify({
      access_token: 'patch83s-browser-qa-token',
      refresh_token: 'patch83s-browser-qa-refresh',
      expires_at: expiresAt,
      expires_in: 3600,
      token_type: 'bearer',
      user: {
        id: sessionUserId,
        aud: 'authenticated',
        role: 'authenticated',
        email: 'patch83s.qa@example.test',
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
  page.on('request', (request) => {
    if (!telemetry.previewActive) return;
    const url = request.url();
    const method = request.method();
    const isRestWrite = url.includes('/rest/v1/') && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
    const isEdgeRequest = url.includes('/functions/v1/');
    if (isRestWrite || isEdgeRequest) telemetry.previewWriteRequests.push(`${method} ${url}`);
  });

  await page.route('**/auth/v1/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: userId,
        aud: 'authenticated',
        role: 'authenticated',
        email: 'patch83s.qa@example.test',
      }),
    });
  });

  await page.route('**/functions/v1/**', async (route) => {
    const body = route.request().postDataJSON() as { action?: string } | null;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, action: body?.action ?? '', result: [] }),
    });
  });

  await page.route('**/rest/v1/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const table = url.pathname.split('/').pop() ?? '';
    const select = url.searchParams.get('select') ?? '';
    const wantsObject = (request.headers().accept ?? '').includes('application/vnd.pgrst.object+json');
    let body: unknown = wantsObject ? {} : [];

    if (table === 'organizations') {
      telemetry.referenceRequests.push(`${request.method()} ${url.pathname}?${url.searchParams.toString()}`);
      if ((referenceOptions.delayMs ?? 0) > 0) {
        await new Promise((resolve) => setTimeout(resolve, referenceOptions.delayMs));
      }
      if ((referenceOptions.failOrganizationAttempts ?? 0) > 0) {
        referenceOptions.failOrganizationAttempts = (referenceOptions.failOrganizationAttempts ?? 0) - 1;
        await route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ code: 'XX000', message: 'Simulated reference lookup failure' }),
        });
        return;
      }
    }

    if (table === 'profiles' && select.includes('organizations(name_en)')) {
      body = {
        id: userId,
        email: 'patch83s.qa@example.test',
        full_name_en: 'Patch 83S Browser QA',
        full_name_ar: 'اختبار المتصفح',
        organization_id: organizationId,
        division_id: null,
        department_id: null,
        unit_id: null,
        is_active: true,
        user_status: 'active',
        organizations: { name_en: 'Patch 83S QA Organization' },
      };
    } else if (table === 'profiles') {
      body = [
        {
          id: userId,
          email: 'nursing.manager@almodawat.sa',
          user_status: 'active',
          organization_id: organizationId,
        },
      ];
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
    } else if (table === 'organizations') {
      body = wantsObject
        ? { id: organizationId, name_en: 'Patch 83S QA Organization', name_ar: 'منظمة اختبار', is_active: true }
        : [{ id: organizationId, name_en: 'Patch 83S QA Organization', name_ar: 'منظمة اختبار', is_active: true }];
    } else if (table === 'divisions') {
      body = [{ id: 'division-med', code: 'MED', organization_id: organizationId, is_active: true }];
    } else if (table === 'departments') {
      body = [
        {
          id: 'department-existing',
          code: 'EXISTING',
          name_en: 'Existing Active Department',
          name_ar: 'إدارة قائمة',
          is_active: true,
          archived_at: null,
          division_id: 'division-med',
          organization_id: organizationId,
        },
        {
          id: 'department-archived',
          code: 'ARCHIVED',
          name_en: 'Archived Department',
          name_ar: 'قسم مؤرشف',
          is_active: false,
          archived_at: '2026-01-01T00:00:00.000Z',
          division_id: 'division-med',
          organization_id: organizationId,
        },
      ];
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

async function openDepartmentImport(page: Page) {
  await page.goto('/');
  await expect(page.getByText('Patch 83S Browser QA')).toBeVisible();
  await page.locator('.nav-child-item').filter({ hasText: 'Departments' }).click();
  await expect(page.getByRole('button', { name: 'Prepare Import Batch' })).toBeVisible();
  await page.getByRole('button', { name: 'Prepare Import Batch' }).click();
  const modal = page.getByRole('dialog', { name: 'Prepare Department Import' });
  await expect(modal).toBeVisible();
  return modal;
}

function statValue(modal: Locator, label: string) {
  return modal.locator('.stat-label').getByText(label, { exact: true }).locator('..').locator('.stat-value');
}

test.describe('Patch 83S Department Excel Import browser QA', () => {
  test('downloads, inspects, uploads, resets, replaces, and preserves User Import', async ({ page }) => {
    test.setTimeout(90_000);
    mkdirSync(evidenceDir, { recursive: true });
    const telemetry: QaTelemetry = { consoleProblems: [], pageErrors: [], previewActive: true, previewWriteRequests: [], referenceRequests: [] };
    await installQaSessionAndSupabaseMocks(page, telemetry, { delayMs: 750 });
    await page.setViewportSize({ width: 1440, height: 900 });
    const modal = await openDepartmentImport(page);
    const fileInput = modal.locator('#department-workbook-input');
    const uploadControl = modal.getByRole('button', { name: /Choose \.xlsx workbook/ });

    await expect(fileInput).toBeEnabled({ timeout: 250 });
    await expect(uploadControl).toBeEnabled({ timeout: 250 });
    await uploadControl.hover();
    const uploadState = await uploadControl.evaluate((element) => ({
      cursor: getComputedStyle(element).cursor,
      pointerEvents: getComputedStyle(element).pointerEvents,
    }));
    expect(uploadState.cursor).not.toBe('not-allowed');
    expect(uploadState.pointerEvents).not.toBe('none');

    await expect(modal.locator('textarea')).toHaveCount(0);
    await expect(modal.getByText('Upload Department Excel File')).toBeVisible();
    await expect(modal.getByText('Upload the completed Excel template. Previewing does not modify data.')).toBeVisible();

    const downloadPromise = page.waitForEvent('download');
    await modal.getByRole('button', { name: 'Download template' }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('departments_template.xlsx');
    const templatePath = path.join(evidenceDir, 'departments_template.xlsx');
    await download.saveAs(templatePath);

    const downloadedWorkbook = new ExcelJS.Workbook();
    await downloadedWorkbook.xlsx.load(readFileSync(templatePath) as unknown as ArrayBuffer);
    const worksheet = downloadedWorkbook.worksheets[0];
    expect(downloadedWorkbook.worksheets.map((sheet) => sheet.name)).toContain('Instructions');
    expect(worksheet.getRow(1).values).toEqual([undefined, ...departmentHeaders]);
    expect(worksheet.getCell('E2').text).toBe('التمريض');
    expect(worksheet.views[0]).toMatchObject({ state: 'frozen', ySplit: 1 });
    expect(worksheet.autoFilter).toBeTruthy();
    expect(worksheet.columns.every((column) => Number(column.width ?? 0) >= 16)).toBeTruthy();
    expect(worksheet.getCell('F2').dataValidation.type).toBe('list');
    expect(worksheet.getCell('H2').dataValidation.type).toBe('list');

    const fileChooserPromise = page.waitForEvent('filechooser');
    await uploadControl.click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(templatePath);
    await expect(statValue(modal, 'Total rows')).toHaveText('1');
    await expect(statValue(modal, 'Valid rows')).toHaveText('1');
    await expect(statValue(modal, 'Invalid rows')).toHaveText('0');

    const rows28 = Array.from({ length: 28 }, (_, index) => validDepartmentRow(
      `QA${String(index + 1).padStart(2, '0')}`,
      `Quality Department ${index + 1}`,
      `إدارة الجودة ${index + 1}`,
    ));
    const completedWorkbook = await workbookBuffer(rows28);
    const completedPath = path.join(evidenceDir, 'departments-28-valid.xlsx');
    writeFileSync(completedPath, completedWorkbook);
    await fileInput.setInputFiles(completedPath);
    await expect(statValue(modal, 'Total rows')).toHaveText('28');
    await expect(statValue(modal, 'Valid rows')).toHaveText('28');
    await expect(statValue(modal, 'Invalid rows')).toHaveText('0');
    await expect(modal).toContainText('departments-28-valid.xlsx');
    await expect(modal).toContainText(expectedFileSize(completedWorkbook.byteLength));
    await expect(modal).toContainText('Quality Department 1');
    await expect(modal).toContainText('إدارة الجودة 1');
    await expect(modal.getByRole('button', { name: 'Continue to Confirmation' })).toBeEnabled();
    await page.screenshot({ path: path.join(evidenceDir, 'department-import-28-valid-1440.png'), fullPage: true });

    await page.setViewportSize({ width: 1024, height: 768 });
    const modalBox = await modal.boundingBox();
    expect(modalBox).not.toBeNull();
    expect(modalBox!.x).toBeGreaterThanOrEqual(0);
    expect(modalBox!.width).toBeLessThanOrEqual(1024);
    await page.screenshot({ path: path.join(evidenceDir, 'department-import-28-valid-1024.png'), fullPage: true });

    await modal.getByRole('button', { name: 'Continue to Confirmation' }).click();
    await expect(modal).toContainText('Execution is disabled by deployment configuration.');
    await expect(modal.getByRole('button', { name: /Execute Import/ })).toBeDisabled();

    await modal.getByRole('button', { name: 'Remove file' }).click();
    await expect(modal).not.toContainText('departments-28-valid.xlsx');
    await expect(modal.locator('.stat-card')).toHaveCount(0);
    await expect(modal.getByRole('button', { name: 'Continue to Confirmation' })).toBeDisabled();

    const duplicateWorkbook = await workbookBuffer([
      validDepartmentRow('DUPLICATE'),
      validDepartmentRow('DUPLICATE', 'Duplicate Two', 'قسم مكرر'),
    ]);
    await fileInput.setInputFiles({ name: 'duplicate.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: duplicateWorkbook });
    await expect(modal).toContainText('Duplicate department_code in workbook');
    await fileInput.setInputFiles({ name: 'replacement.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: completedWorkbook });
    await expect(modal).not.toContainText('Duplicate department_code in workbook');
    await expect(statValue(modal, 'Total rows')).toHaveText('28');
    await expect(statValue(modal, 'Invalid rows')).toHaveText('0');

    expect(telemetry.previewWriteRequests).toEqual([]);
    await modal.getByRole('button', { name: 'Cancel' }).click();
    telemetry.previewActive = false;

    await page.locator('.nav-child-item').filter({ hasText: 'User Management' }).click();
    await expect(page.getByRole('heading', { name: 'User Management Center' })).toBeVisible();
    await page.getByRole('button', { name: 'Import CSV' }).click();
    const userImport = page.getByRole('dialog', { name: 'Preview CSV import' });
    await expect(userImport).toBeVisible();
    const userCsv = [
      'Arabic Name,English Name,Email,Department Code,Job Title,Role,Status,Employee ID,User Type',
      'مستخدم اختبار,QA User,user.qa@example.test,,Analyst,employee,active,QA-001,employee',
    ].join('\n');
    await userImport.locator('input[type="file"]').setInputFiles({ name: 'user-import.csv', mimeType: 'text/csv', buffer: Buffer.from(userCsv, 'utf8') });
    await expect(userImport).toContainText('user.qa@example.test');
    await expect(userImport).toContainText('valid');
    await page.screenshot({ path: path.join(evidenceDir, 'user-import-unchanged.png'), fullPage: true });

    expect(telemetry.pageErrors).toEqual([]);
    expect(telemetry.consoleProblems).toEqual([]);
    expect(telemetry.consoleProblems.join('\n')).not.toMatch(/service.?role|access.?token|database.?password|postgres(?:ql)?:\/\//i);
  });

  test('rejects every invalid workbook through the real file input without crashing', async ({ page }) => {
    test.setTimeout(90_000);
    mkdirSync(evidenceDir, { recursive: true });
    const telemetry: QaTelemetry = { consoleProblems: [], pageErrors: [], previewActive: true, previewWriteRequests: [], referenceRequests: [] };
    await installQaSessionAndSupabaseMocks(page, telemetry);
    const modal = await openDepartmentImport(page);
    const fileInput = modal.locator('#department-workbook-input');

    const upload = async (name: string, buffer: Buffer, expectedMessage: string) => {
      await fileInput.setInputFiles({ name, mimeType: 'application/octet-stream', buffer });
      await expect(modal).toContainText(expectedMessage);
      await expect(modal).toBeVisible();
    };

    const csv = Buffer.from('organization_code,department_code\nALMODAWAT,CSV', 'utf8');
    await upload('departments.csv', csv, 'Unsupported file type');
    await upload('renamed.xlsx', csv, 'not a valid Excel .xlsx workbook');
    await upload('legacy.xls', csv, 'Unsupported file type');
    await upload('corrupt.xlsx', Buffer.from('corrupt workbook', 'utf8'), 'not a valid Excel .xlsx workbook');

    const emptyWorkbook = new ExcelJS.Workbook();
    emptyWorkbook.addWorksheet('Empty');
    await upload('empty.xlsx', Buffer.from(await emptyWorkbook.xlsx.writeBuffer() as ArrayBuffer), 'does not contain a header row');

    const missingHeaders = departmentHeaders.filter((header) => header !== 'department_name_ar');
    await upload('missing-header.xlsx', await workbookBuffer([
      validDepartmentRow('MISSING_AR').filter((_, index) => index !== 4),
    ], missingHeaders), 'Missing required columns: department_name_ar');

    await upload('unsupported-column.xlsx', await workbookBuffer([
      [...validDepartmentRow('EXTRA'), 'unexpected'],
    ], [...departmentHeaders, 'unexpected_column']), 'Unsupported columns: unexpected_column');

    await upload('duplicate-code.xlsx', await workbookBuffer([
      validDepartmentRow('DUP'),
      validDepartmentRow('DUP', 'Different Name', 'اسم مختلف'),
    ]), 'Duplicate department_code in workbook');

    await upload('existing-active.xlsx', await workbookBuffer([
      validDepartmentRow('EXISTING'),
    ]), 'Active department code already exists: EXISTING');

    await upload('archived-match.xlsx', await workbookBuffer([
      validDepartmentRow('ARCHIVED'),
    ]), 'archived_department_match');

    const invalidEmail = validDepartmentRow('BAD_EMAIL');
    invalidEmail[6] = 'not-an-email';
    await upload('invalid-email.xlsx', await workbookBuffer([invalidEmail]), 'Invalid manager_email: not-an-email');

    const invalidType = validDepartmentRow('BAD_TYPE');
    invalidType[5] = 'medical';
    await upload('invalid-type.xlsx', await workbookBuffer([invalidType]), 'Unsupported department_type: medical');

    await upload('formula.xlsx', await workbookBuffer([
      validDepartmentRow('FORMULA'),
    ], departmentHeaders, (worksheet) => {
      worksheet.getCell('D2').value = { formula: '1+1', result: 'Formula result' };
    }), 'Formula cells are not allowed');
    await page.screenshot({ path: path.join(evidenceDir, 'department-import-formula-rejected.png'), fullPage: true });

    await fileInput.setInputFiles({
      name: 'blank-rows.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: await workbookBuffer([
        validDepartmentRow('BLANK01'),
        ['', '', '', '', '', '', '', ''],
        validDepartmentRow('BLANK02'),
      ]),
    });
    await expect(statValue(modal, 'Total rows')).toHaveText('2');
    await expect(statValue(modal, 'Valid rows')).toHaveText('2');
    await expect(statValue(modal, 'Invalid rows')).toHaveText('0');

    expect(telemetry.previewWriteRequests).toEqual([]);
    expect(telemetry.pageErrors).toEqual([]);
    expect(telemetry.consoleProblems).toEqual([]);
  });

  test('retries failed reference data and revalidates the selected 27-row workbook', async ({ page }) => {
    test.setTimeout(90_000);
    const telemetry: QaTelemetry = { consoleProblems: [], pageErrors: [], previewActive: true, previewWriteRequests: [], referenceRequests: [] };
    const referenceOptions: QaReferenceOptions = { failOrganizationAttempts: 100 };
    await installQaSessionAndSupabaseMocks(page, telemetry, referenceOptions);
    const modal = await openDepartmentImport(page);
    const referenceError = modal.getByText('Department reference data could not be loaded. Check your connection and permissions, then retry.');
    await expect(referenceError).toBeVisible();
    const initialReferenceAttempts = telemetry.referenceRequests.length;
    expect(initialReferenceAttempts).toBeGreaterThan(0);

    const rows27 = Array.from({ length: 27 }, (_, index) => validDepartmentRow(
      `LIVE${String(index + 1).padStart(2, '0')}`,
      `Live Department ${index + 1}`,
      `إدارة مباشرة ${index + 1}`,
    ));
    const workbook = await workbookBuffer(rows27);
    const chooserPromise = page.waitForEvent('filechooser');
    await modal.getByRole('button', { name: /Choose \.xlsx workbook/ }).click();
    const chooser = await chooserPromise;
    await chooser.setFiles({
      name: 'departments-27-valid.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: workbook,
    });

    await expect.poll(() => telemetry.referenceRequests.length).toBeGreaterThan(initialReferenceAttempts);
    await expect(referenceError).toBeVisible();
    await expect(modal).toContainText('departments-27-valid.xlsx');
    await expect(modal.getByRole('button', { name: 'Continue to Confirmation' })).toBeDisabled();
    await expect(modal.locator('.stat-card')).toHaveCount(0);

    const failedReferenceAttempts = telemetry.referenceRequests.length;
    referenceOptions.failOrganizationAttempts = 0;
    await modal.getByRole('button', { name: 'Retry reference data' }).click();
    await expect(referenceError).toHaveCount(0);
    await expect.poll(() => telemetry.referenceRequests.length).toBeGreaterThan(failedReferenceAttempts);
    await expect(statValue(modal, 'Total rows')).toHaveText('27');
    await expect(statValue(modal, 'Valid rows')).toHaveText('27');
    await expect(statValue(modal, 'Invalid rows')).toHaveText('0');
    await expect(modal).toContainText('departments-27-valid.xlsx');
    await expect(modal).toContainText('Live Department 1');
    await expect(modal).toContainText('إدارة مباشرة 1');
    await expect(modal.getByRole('button', { name: 'Continue to Confirmation' })).toBeEnabled();

    const decodedRequests = telemetry.referenceRequests.map(decodeURIComponent).join('\n');
    expect(decodedRequests).toContain('select=id,name_en,name_ar,is_active');
    expect(decodedRequests).not.toContain('organization_code');
    await modal.getByRole('button', { name: 'Continue to Confirmation' }).click();
    await expect(modal.getByRole('button', { name: /Execute Import/ })).toBeDisabled();
    expect(telemetry.previewWriteRequests).toEqual([]);
    expect(telemetry.pageErrors).toEqual([]);
    const unexpectedConsoleProblems = telemetry.consoleProblems.filter(
      (message) => !/Failed to load resource: the server responded with a status of 503/i.test(message),
    );
    expect(unexpectedConsoleProblems).toEqual([]);
    expect(telemetry.consoleProblems.join('\n')).not.toMatch(/service.?role|access.?token|database.?password|postgres(?:ql)?:\/\//i);
  });
});
