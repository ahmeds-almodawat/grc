import { expect, test, type Locator, type Page } from '@playwright/test';
import ExcelJS from 'exceljs';
import { USER_IMPORT_COLUMNS } from '../../src/utils/userWorkbook';
import { startPatch83uTestServer, type Patch83uTestServer } from './patch83uTestServer';
import {
  dispatchFocusAndVisibility,
  documentProof,
  installPatch83vBackend,
  refreshPatch83vSession,
  signOutPatch83vSession,
  waitForActivePatch83vUser,
} from './patch83vTestHarness';

let server: Patch83uTestServer | null = null;
let baseUrl = '';

function workbookRow(index: number, overrides: Record<string, string> = {}) {
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

async function validWorkbookBuffer(options: {
  includeExisting?: boolean;
  rowCount?: number;
  userLabel?: string;
} = {}) {
  const includeExisting = options.includeExisting ?? true;
  const rowCount = options.rowCount ?? 27;
  const userLabel = options.userLabel ?? 'User';
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Users');
  worksheet.addRow([...USER_IMPORT_COLUMNS]);
  Array.from({ length: rowCount }, (_, index) => includeExisting && index === 0
    ? workbookRow(1, {
        employee_id: '001245',
        english_name: 'Updated Existing',
        arabic_name: 'مستخدم محدث',
        contact_email: 'existing.contact@example.test',
        account_action: 'update',
      })
    : workbookRow(index + 1, {
        employee_id: `REPL-${String(index + 1).padStart(5, '0')}`,
        english_name: `${userLabel} ${index + 1}`,
        arabic_name: `مستخدم بديل ${index + 1}`,
      }))
    .forEach((row) => worksheet.addRow(row));
  return Buffer.from(await workbook.xlsx.writeBuffer() as ArrayBuffer);
}

async function openUserImport(page: Page): Promise<Locator> {
  await page.goto(`${baseUrl}/?page=admin`);
  await waitForActivePatch83vUser(page);
  await expect(page.getByRole('heading', { name: 'User Management Center' })).toBeVisible();
  await page.getByRole('button', { name: 'Import Excel' }).click();
  const modal = page.getByRole('dialog', { name: 'Preview User Excel Import' });
  await expect(modal).toBeVisible();
  return modal;
}

function kpiValue(modal: Locator, label: string) {
  return modal
    .locator('.kpi-tile__label')
    .getByText(label, { exact: true })
    .locator('..')
    .locator('.kpi-tile__value');
}

async function selectThroughChooser(
  page: Page,
  input: Locator,
  file: { name: string; mimeType: string; buffer: Buffer } | [],
) {
  const visibleTrigger = input.locator('..').getByRole('button', {
    name: /^(Choose \.xlsx workbook|Replace file)$/,
  });
  const chooserPromise = page.waitForEvent('filechooser');
  await visibleTrigger.click();
  const chooser = await chooserPromise;
  await chooser.setFiles(file);
}

test.describe('Patch 83V User Import session stability', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeAll(async () => {
    server = await startPatch83uTestServer({
      VITE_PATCH83T_USER_EXCEL_IMPORT_ENABLED: 'true',
      VITE_PATCH83U_CREDENTIAL_GOVERNANCE_ENABLED: 'true',
    });
    baseUrl = server.baseUrl;
  });

  test.afterAll(() => {
    server?.stop();
    server = null;
  });

  test('keeps the real workbook modal mounted through focus, visibility, token refresh, stale response, cancel, and replacement', async ({ page }) => {
    test.setTimeout(90_000);
    const backend = await installPatch83vBackend(page);
    const modal = await openUserImport(page);
    const input = modal.locator('#user-workbook-input');
    const firstDocument = await documentProof(page);
    const initialDocumentRequestCount = backend.proof.documentRequests.length;
    expect(backend.proof.writeRequests).toEqual([]);
    const initialCredentialCount = backend.proof.credentialRequests.length;
    const buffer = await validWorkbookBuffer();

    backend.setCredentialResult('blocked');
    backend.delayNextCredentialResponse();
    await dispatchFocusAndVisibility(page);
    await expect.poll(() => backend.proof.credentialRequests.length)
      .toBe(initialCredentialCount + 1);
    expect(backend.proof.credentialRequests.at(-1)).toEqual({
      accessToken: backend.accessTokenV1,
      result: 'blocked',
    });
    backend.setCredentialResult('active');
    await expect(page.getByText('Loading secure session...')).toHaveCount(0);
    await expect(modal).toBeVisible();

    backend.delayNextIdentityReferenceResponse();
    await selectThroughChooser(page, input, {
      name: 'users-27-session-stable.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer,
    });
    await expect(modal).toContainText('users-27-session-stable.xlsx');
    await expect(modal).toContainText('Parsing and validating workbook');
    await expect.poll(() => backend.proof.identityReferenceRequests).toBe(1);

    await dispatchFocusAndVisibility(page);
    await page.waitForTimeout(100);
    expect(backend.proof.credentialRequests.filter(
      (request) => request.accessToken === backend.accessTokenV1,
    )).toHaveLength(2);
    await expect(page.getByText('Loading secure session...')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'User Management Center' })).toBeVisible();
    await expect(modal).toBeVisible();

    await refreshPatch83vSession(page);
    await expect.poll(() => backend.proof.authRefreshRequests).toBe(1);
    await expect.poll(() => backend.proof.credentialRequests.some(
      (request) => request.accessToken === backend.accessTokenV2 && request.result === 'active',
    )).toBe(true);
    await expect.poll(() => backend.proof.credentialResponsesFulfilled).toBe(2);
    await expect(page.getByText('Loading secure session...')).toHaveCount(0);
    await expect(modal).toContainText('users-27-session-stable.xlsx');

    backend.releaseDelayedCredentialResponse();
    await expect.poll(() => backend.proof.credentialResponsesFulfilled).toBe(3);
    expect(backend.proof.credentialResponsesAborted).toBe(0);
    await expect(page.getByRole('heading', { name: 'User Management Center' })).toBeVisible();
    await expect(modal).toBeVisible();
    await expect(modal).toContainText('users-27-session-stable.xlsx');
    await expect(page.getByRole('heading', { name: 'Application access unavailable' })).toHaveCount(0);
    backend.releaseDelayedIdentityReferenceResponse();
    await expect(kpiValue(modal, 'Total rows')).toHaveText('27');
    await expect(kpiValue(modal, 'Valid rows')).toHaveText('27');
    await expect(kpiValue(modal, 'Invalid rows')).toHaveText('0');
    await expect(modal).toContainText('Updated Existing');
    await expect(modal).toContainText('001245@almodawat.sa');

    await selectThroughChooser(page, input, []);
    await expect(modal).toContainText('users-27-session-stable.xlsx');
    await expect(kpiValue(modal, 'Valid rows')).toHaveText('27');

    const replacementBuffer = await validWorkbookBuffer({
      includeExisting: false,
      rowCount: 3,
      userLabel: 'Replacement User',
    });
    await selectThroughChooser(page, input, {
      name: 'users-3-replacement.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: replacementBuffer,
    });
    await expect(modal).toContainText('users-3-replacement.xlsx');
    await expect(modal).not.toContainText('users-27-session-stable.xlsx');
    await expect(kpiValue(modal, 'Total rows')).toHaveText('3');
    await expect(kpiValue(modal, 'Valid rows')).toHaveText('3');
    await expect(kpiValue(modal, 'Invalid rows')).toHaveText('0');
    await expect(modal).toContainText('Replacement User 1');
    await expect(modal).not.toContainText('Updated Existing');

    const finalDocument = await documentProof(page);
    expect(finalDocument).toEqual(firstDocument);
    expect(backend.proof.documentRequests).toHaveLength(initialDocumentRequestCount);
    expect(new URL(page.url()).searchParams.get('page')).toBe('admin');
    expect(backend.proof.writeRequests).toEqual([]);
    expect(backend.proof.unexpectedAuthMutations).toEqual([]);
    expect(backend.proof.pageErrors).toEqual([]);
    expect(backend.proof.consoleProblems).toEqual([]);
  });

  test('fails closed when the session signs out while workbook validation is in flight', async ({ page }) => {
    test.setTimeout(60_000);
    const backend = await installPatch83vBackend(page);
    const modal = await openUserImport(page);
    backend.delayNextIdentityReferenceResponse();
    await selectThroughChooser(page, modal.locator('#user-workbook-input'), {
      name: 'users-sign-out-in-flight.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: await validWorkbookBuffer(),
    });
    await expect(modal).toContainText('Parsing and validating workbook');
    await expect.poll(() => backend.proof.identityReferenceRequests).toBe(1);

    await signOutPatch83vSession(page);
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'User Management Center' })).toHaveCount(0);
    backend.releaseDelayedIdentityReferenceResponse();
    await page.waitForTimeout(100);
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
    expect(new URL(page.url()).searchParams.get('page')).toBe('admin');
    expect(backend.proof.writeRequests).toEqual([]);
    expect(backend.proof.unexpectedAuthMutations).toEqual([]);
    expect(backend.proof.pageErrors).toEqual([]);
  });

  test('replaces the mounted import UI only after revalidation confirms access revocation', async ({ page }) => {
    test.setTimeout(60_000);
    const backend = await installPatch83vBackend(page);
    const modal = await openUserImport(page);
    backend.delayNextIdentityReferenceResponse();
    await selectThroughChooser(page, modal.locator('#user-workbook-input'), {
      name: 'users-revocation-in-flight.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: await validWorkbookBuffer(),
    });
    await expect(modal).toContainText('Parsing and validating workbook');
    await expect.poll(() => backend.proof.identityReferenceRequests).toBe(1);

    backend.setCredentialResult('blocked');
    await dispatchFocusAndVisibility(page);
    await expect(page.getByRole('heading', { name: 'Application access unavailable' }))
      .toBeVisible();
    await expect(page.getByRole('alert'))
      .toContainText('Access was revoked during credential revalidation.');
    await expect(page.getByRole('heading', { name: 'User Management Center' })).toHaveCount(0);
    await expect(page.getByText('Loading secure session...')).toHaveCount(0);
    backend.releaseDelayedIdentityReferenceResponse();
    await page.waitForTimeout(100);
    await expect(page.getByRole('heading', { name: 'Application access unavailable' }))
      .toBeVisible();
    expect(backend.proof.writeRequests).toEqual([]);
    expect(backend.proof.unexpectedAuthMutations).toEqual([]);
    expect(backend.proof.pageErrors).toEqual([]);
  });
});
