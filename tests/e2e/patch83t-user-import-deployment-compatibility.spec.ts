import { expect, test, type Locator, type Page, type Route } from '@playwright/test';
import ExcelJS from 'exceljs';
import { USER_IMPORT_COLUMNS } from '../../src/utils/userWorkbook';
import { startPatch83uTestServer, type Patch83uTestServer } from './patch83uTestServer';
import {
  installPatch83vBackend,
  waitForActivePatch83vUser,
  type Patch83vBackend,
} from './patch83vTestHarness';

const capabilityAction = 'patch83t_get_user_import_capabilities';
const identityReferenceAction = 'patch83t_user_import_identity_references';
const executionAction = 'patch83t_apply_user_excel_import';
const frontendContractVersion = 'patch83t-frontend-user-import-v1';
const edgeContractVersion = 'patch83t-edge-user-import-v1';
const deploymentMessage = 'User Excel Import backend is not fully deployed. No user data was changed.';
const featureDisabledMessage = 'User Excel Import is not enabled in this deployment.';
const checkingMessage = 'Checking User Excel Import backend compatibility...';

type CapabilityMode = 'compatible' | 'old_edge';

type Deferred = {
  promise: Promise<void>;
  resolve: () => void;
};

type CapabilityRequest = {
  action: string;
  frontendContractVersion: unknown;
  headerContractVersion: string | undefined;
};

type CompatibilityProof = {
  capabilityRequests: CapabilityRequest[];
  delayNextResponse: () => void;
  releaseDelayedResponse: () => void;
  setMode: (mode: CapabilityMode) => void;
};

let disabledServer: Patch83uTestServer | null = null;
let enabledServer: Patch83uTestServer | null = null;
let disabledBaseUrl = '';
let enabledBaseUrl = '';

function requestJson(route: Route): Record<string, unknown> {
  const raw = route.request().postData();
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

function deferred(): Deferred {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

async function installCapabilityResponse(
  page: Page,
  initialMode: CapabilityMode,
): Promise<CompatibilityProof> {
  let mode = initialMode;
  let delayedResponse: Deferred | null = null;
  const proof: CompatibilityProof = {
    capabilityRequests: [],
    delayNextResponse: () => {
      if (delayedResponse) throw new Error('A capability response is already delayed.');
      delayedResponse = deferred();
    },
    releaseDelayedResponse: () => delayedResponse?.resolve(),
    setMode: (nextMode) => {
      mode = nextMode;
    },
  };
  await page.route('**/functions/v1/**', async (route) => {
    const body = requestJson(route);
    const action = typeof body.action === 'string' ? body.action : '';
    if (action !== capabilityAction) {
      await route.fallback();
      return;
    }

    const payload = body.payload && typeof body.payload === 'object' && !Array.isArray(body.payload)
      ? body.payload as Record<string, unknown>
      : {};
    proof.capabilityRequests.push({
      action,
      frontendContractVersion: payload.frontend_contract_version,
      headerContractVersion: route.request().headers()['x-patch83t-frontend-contract-version'],
    });

    const gate = delayedResponse;
    if (gate) {
      await gate.promise;
      if (delayedResponse === gate) delayedResponse = null;
    }

    if (mode === 'old_edge') {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 'UNSUPPORTED_PRIVILEGED_ACTION',
          error: `Unsupported privileged action: ${capabilityAction}`,
          details: `The legacy dispatcher does not register ${identityReferenceAction}.`,
        }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        action,
        result: {
          edge_contract_version: edgeContractVersion,
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
  });
  return proof;
}

async function failFirstIdentityReferenceRequest(page: Page): Promise<{ attempts: number }> {
  const proof = { attempts: 0 };
  await page.route('**/functions/v1/**', async (route) => {
    const body = requestJson(route);
    if (body.action !== identityReferenceAction) {
      await route.fallback();
      return;
    }

    proof.attempts += 1;
    if (proof.attempts > 1) {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 400,
      contentType: 'application/json',
      body: JSON.stringify({
        code: 'UNSUPPORTED_PRIVILEGED_ACTION',
        error: `Unsupported privileged action: ${identityReferenceAction}`,
        details: 'Legacy Edge dispatcher response that must remain browser-private.',
      }),
    });
  });
  return proof;
}

async function openUserManagement(page: Page, baseUrl: string): Promise<void> {
  await page.goto(`${baseUrl}/?page=admin`);
  await waitForActivePatch83vUser(page);
  await expect(page.getByRole('heading', { name: 'User Management Center' })).toBeVisible();
  await expect(page).toHaveURL(/\?page=admin(?:&|$)/);
}

async function openUserImport(page: Page): Promise<Locator> {
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

function uploadSection(modal: Locator): Locator {
  return modal.locator('.user-workbook-upload');
}

function workbookInput(modal: Locator): Locator {
  return modal.locator('#user-workbook-input');
}

function chooseWorkbookControl(modal: Locator): Locator {
  return modal.getByRole('button', { name: /Choose \.xlsx workbook/i });
}

async function expectDisabledUpload(
  modal: Locator,
  describedReason: string,
): Promise<void> {
  const section = uploadSection(modal);
  const choose = chooseWorkbookControl(modal);
  const input = workbookInput(modal);
  await expect(section).toBeVisible();
  await expect(section.getByText('Upload User Excel File', { exact: true })).toBeVisible();
  await expect(choose).toBeVisible();
  await expect(choose).toBeDisabled();
  await expect(choose).toHaveAttribute('aria-disabled', 'true');
  await expect(choose).toHaveAttribute('aria-describedby', /\S+/);
  await expect(input).toBeAttached();
  await expect(input).toBeDisabled();
  await expect(modal.getByText(describedReason, { exact: true })).toBeVisible();
  const accessibleDescription = await choose.evaluate((element) => (
    (element.getAttribute('aria-describedby') ?? '')
      .split(/\s+/)
      .filter(Boolean)
      .map((id) => document.getElementById(id)?.textContent ?? '')
      .join(' ')
  ));
  expect(accessibleDescription).toContain(describedReason);
}

async function validWorkbookBuffer(): Promise<Buffer> {
  const values: Record<string, string> = {
    employee_id: 'COMPAT-0001',
    english_name: 'Compatibility User',
    arabic_name: 'مستخدم التوافق',
    contact_email: 'compatibility.user@example.test',
    phone: '0501234567',
    department_code: 'IT',
    job_title: 'Compatibility Analyst',
    role: 'employee',
    role_scope: 'assigned_only',
    status: 'active',
    user_type: 'employee',
    account_action: 'create',
  };
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Users');
  worksheet.addRow([...USER_IMPORT_COLUMNS]);
  worksheet.addRow(USER_IMPORT_COLUMNS.map((column) => values[column]));
  return Buffer.from(await workbook.xlsx.writeBuffer() as ArrayBuffer);
}

function patch83tActions(backend: Patch83vBackend): string[] {
  return backend.proof.actions.filter((action) => action.startsWith('patch83t_'));
}

test.describe('Patch 83T User Excel Import deployment compatibility', () => {
  test.describe.configure({ mode: 'serial', timeout: 90_000 });

  test.beforeAll(async () => {
    disabledServer = await startPatch83uTestServer({
      VITE_PATCH83T_USER_EXCEL_IMPORT_ENABLED: 'false',
      VITE_PATCH83U_CREDENTIAL_GOVERNANCE_ENABLED: 'true',
    });
    enabledServer = await startPatch83uTestServer({
      VITE_PATCH83T_USER_EXCEL_IMPORT_ENABLED: 'true',
      VITE_PATCH83U_CREDENTIAL_GOVERNANCE_ENABLED: 'true',
    });
    disabledBaseUrl = disabledServer.baseUrl;
    enabledBaseUrl = enabledServer.baseUrl;
  });

  test.afterAll(() => {
    disabledServer?.stop();
    enabledServer?.stop();
    disabledServer = null;
    enabledServer = null;
  });

  test('keeps the modal and authenticated User Management page mounted when an old Edge rejects the capability action', async ({ page }) => {
    const backend = await installPatch83vBackend(page);
    const compatibility = await installCapabilityResponse(page, 'old_edge');
    await openUserManagement(page, enabledBaseUrl);
    const modal = await openUserImport(page);

    await expectDisabledUpload(modal, deploymentMessage);
    await expect(modal.getByRole('button', { name: 'Retry compatibility check' })).toBeVisible();
    await expect(modal.getByRole('button', { name: 'Close' })).toHaveCount(1);
    await expect(modal.getByRole('button', { name: 'Close' })).toBeVisible();
    expect(await modal.evaluate(() => {
      const upload = document.querySelector('.user-workbook-upload');
      const warning = document.querySelector('[role="alert"]');
      return Boolean(
        upload
        && warning
        && (upload.compareDocumentPosition(warning) & Node.DOCUMENT_POSITION_FOLLOWING),
      );
    })).toBe(true);
    await expect(page.getByRole('heading', { name: 'User Management Center' })).toBeVisible();
    await expect(page.getByText('Loading secure session...')).toHaveCount(0);
    await expect(page).toHaveURL(/\?page=admin(?:&|$)/);

    await expect(page.locator('body')).not.toContainText('UNSUPPORTED_PRIVILEGED_ACTION');
    await expect(page.locator('body')).not.toContainText(capabilityAction);
    await expect(page.locator('body')).not.toContainText(identityReferenceAction);
    expect(compatibility.capabilityRequests).toEqual([{
      action: capabilityAction,
      frontendContractVersion,
      headerContractVersion: frontendContractVersion,
    }]);
    expect(backend.proof.identityReferenceRequests).toBe(0);
    expect(patch83tActions(backend)).not.toContain(identityReferenceAction);
    expect(patch83tActions(backend)).not.toContain(executionAction);
    expect(backend.proof.writeRequests).toEqual([]);

    await page.waitForTimeout(250);
    expect(compatibility.capabilityRequests).toHaveLength(1);
    await expect(modal).toBeVisible();
    await modal.getByRole('button', { name: 'Close' }).click();
    await expect(modal).toBeHidden();
    await expect(page.getByRole('heading', { name: 'User Management Center' })).toBeVisible();
    expect(backend.proof.pageErrors).toEqual([]);
    expect(backend.proof.consoleProblems.join('\n')).not.toContain('UNSUPPORTED_PRIVILEGED_ACTION');
    expect(backend.proof.consoleProblems.join('\n')).not.toContain(capabilityAction);
    expect(backend.proof.consoleProblems.join('\n')).not.toContain(identityReferenceAction);
  });

  test('keeps a disabled, described uploader visible while the compatibility check is pending', async ({ page }) => {
    const backend = await installPatch83vBackend(page);
    const compatibility = await installCapabilityResponse(page, 'compatible');
    compatibility.delayNextResponse();
    await openUserManagement(page, enabledBaseUrl);

    let modal: Locator | null = null;
    try {
      modal = await openUserImport(page);
      await expect.poll(() => compatibility.capabilityRequests.length).toBe(1);
      await expectDisabledUpload(modal, checkingMessage);
      expect(backend.proof.identityReferenceRequests).toBe(0);
      expect(patch83tActions(backend)).not.toContain(identityReferenceAction);
      expect(patch83tActions(backend)).not.toContain(executionAction);
      expect(backend.proof.writeRequests).toEqual([]);
    } finally {
      compatibility.releaseDelayedResponse();
    }

    await expect(chooseWorkbookControl(modal!)).toBeEnabled();
    await expect(workbookInput(modal!)).toBeEnabled();
    await expect(modal!.getByText(checkingMessage, { exact: true })).toHaveCount(0);
    expect(backend.proof.writeRequests).toEqual([]);
    expect(backend.proof.pageErrors).toEqual([]);
    expect(backend.proof.consoleProblems).toEqual([]);
  });

  test('shows a disabled uploader and makes zero Patch 83T requests when the exact feature flag is false', async ({ page }) => {
    const backend = await installPatch83vBackend(page);
    await openUserManagement(page, disabledBaseUrl);

    const importButton = page.getByRole('button', { name: 'Import Excel' });
    await expect(importButton).toBeEnabled();
    await expect(page.getByText(featureDisabledMessage, { exact: true })).toBeVisible();
    const modal = await openUserImport(page);
    await expectDisabledUpload(modal, featureDisabledMessage);
    await expect(modal.getByRole('button', { name: 'Retry compatibility check' })).toHaveCount(0);
    const templateButton = modal.getByRole('button', { name: 'Download Excel template' });
    await expect(templateButton).toBeEnabled();
    const downloadPromise = page.waitForEvent('download');
    await templateButton.click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('user-management-import-template.xlsx');
    await modal.getByRole('button', { name: 'Close' }).click();
    await expect(modal).toBeHidden();

    const rosterReadsBeforeRefresh = backend.proof.actions
      .filter((action) => action === 'list_user_management_roster').length;
    await page.getByRole('button', { name: 'Refresh' }).click();
    await expect.poll(() => backend.proof.actions
      .filter((action) => action === 'list_user_management_roster').length)
      .toBeGreaterThan(rosterReadsBeforeRefresh);
    await expect(page.getByText('Existing User').first()).toBeVisible();

    expect(patch83tActions(backend)).toEqual([]);
    expect(backend.proof.identityReferenceRequests).toBe(0);
    expect(backend.proof.writeRequests).toEqual([]);
    expect(backend.proof.pageErrors).toEqual([]);
    expect(backend.proof.consoleProblems).toEqual([]);
  });

  test('retains a selected workbook and validates it automatically after compatibility recovers', async ({ page }) => {
    const backend = await installPatch83vBackend(page);
    const compatibility = await installCapabilityResponse(page, 'compatible');
    const identityFailure = await failFirstIdentityReferenceRequest(page);
    await openUserManagement(page, enabledBaseUrl);
    const modal = await openUserImport(page);
    const upload = workbookInput(modal);
    const workbook = await validWorkbookBuffer();
    const filename = 'patch83t-retained-user.xlsx';
    const sizeLabel = workbook.length < 1024
      ? `${workbook.length} B`
      : `${(workbook.length / 1024).toFixed(workbook.length < 1024 * 100 ? 1 : 0)} KB`;

    await expect(upload).toBeEnabled();
    await upload.setInputFiles({
      name: filename,
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: workbook,
    });

    await expect(uploadSection(modal)).toBeVisible();
    await expect(uploadSection(modal).getByText('Upload User Excel File', { exact: true })).toBeVisible();
    await expect(modal.getByText(deploymentMessage, { exact: true })).toBeVisible();
    await expect(workbookInput(modal)).toBeDisabled();
    await expect(modal.getByText(filename, { exact: true })).toBeVisible();
    await expect(modal.getByText(sizeLabel, { exact: true })).toBeVisible();
    await expect(modal.getByRole('button', { name: 'Replace file' })).toBeVisible();
    await expect(modal.getByRole('button', { name: 'Replace file' })).toBeDisabled();
    await expect(modal.getByRole('button', { name: 'Replace file' })).toHaveAttribute('aria-disabled', 'true');
    await expect(modal.getByRole('button', { name: 'Replace file' })).toHaveAttribute('aria-describedby', /\S+/);
    await expect(modal.getByRole('button', { name: 'Execute User Import' })).toHaveCount(0);
    expect(identityFailure.attempts).toBe(1);
    expect(backend.proof.identityReferenceRequests).toBe(0);
    expect(backend.proof.writeRequests).toEqual([]);

    compatibility.setMode('compatible');
    await modal.getByRole('button', { name: 'Retry compatibility check' }).click();

    await expect(kpiValue(modal, 'Total rows')).toHaveText('1');
    await expect(kpiValue(modal, 'Valid rows')).toHaveText('1');
    await expect(kpiValue(modal, 'Invalid rows')).toHaveText('0');
    await expect(modal.getByLabel('User Excel import preview')).toContainText('Compatibility User');
    await expect(modal.getByText(filename, { exact: true })).toBeVisible();
    await expect(modal.getByText(sizeLabel, { exact: true })).toBeVisible();
    await expect(workbookInput(modal)).toBeEnabled();
    expect(compatibility.capabilityRequests).toHaveLength(2);
    expect(identityFailure.attempts).toBe(2);
    expect(backend.proof.identityReferenceRequests).toBe(1);
    expect(patch83tActions(backend)).not.toContain(executionAction);
    expect(backend.proof.writeRequests).toEqual([]);
    await expect(page.locator('body')).not.toContainText('UNSUPPORTED_PRIVILEGED_ACTION');
    await expect(page.locator('body')).not.toContainText(identityReferenceAction);
    await expect(page.getByRole('heading', { name: 'User Management Center' })).toBeVisible();
    await expect(page).toHaveURL(/\?page=admin(?:&|$)/);
    expect(backend.proof.pageErrors).toEqual([]);
    expect(backend.proof.consoleProblems.join('\n')).not.toContain('UNSUPPORTED_PRIVILEGED_ACTION');
    expect(backend.proof.consoleProblems.join('\n')).not.toContain(identityReferenceAction);
  });

  test('enables the existing preview and exact-confirmation workflow only after a compatible capability response', async ({ page }) => {
    const backend = await installPatch83vBackend(page);
    const compatibility = await installCapabilityResponse(page, 'compatible');
    await openUserManagement(page, enabledBaseUrl);
    const modal = await openUserImport(page);
    const upload = workbookInput(modal);

    await expect(upload).toBeAttached();
    await expect(upload).toBeEnabled();
    await expect(chooseWorkbookControl(modal)).toBeVisible();
    await expect(chooseWorkbookControl(modal)).toBeEnabled();
    await expect(chooseWorkbookControl(modal)).toHaveAttribute('aria-disabled', 'false');
    expect(compatibility.capabilityRequests).toEqual([{
      action: capabilityAction,
      frontendContractVersion,
      headerContractVersion: frontendContractVersion,
    }]);
    expect(backend.proof.identityReferenceRequests).toBe(0);

    await upload.setInputFiles({
      name: 'patch83t-compatible-user.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: await validWorkbookBuffer(),
    });

    await expect(kpiValue(modal, 'Total rows')).toHaveText('1');
    await expect(kpiValue(modal, 'Valid rows')).toHaveText('1');
    await expect(kpiValue(modal, 'Invalid rows')).toHaveText('0');
    await expect(modal.getByLabel('User Excel import preview')).toContainText('Compatibility User');
    expect(backend.proof.identityReferenceRequests).toBe(1);

    const execute = modal.getByRole('button', { name: 'Execute User Import' });
    await expect(execute).toBeDisabled();
    await modal.getByLabel('Exact execution confirmation').fill('EXECUTE USER IMPOR');
    await expect(execute).toBeDisabled();
    await modal.getByLabel('Exact execution confirmation').fill('EXECUTE USER IMPORT');
    await expect(execute).toBeEnabled();
    expect(patch83tActions(backend)).toEqual([identityReferenceAction]);
    expect(backend.proof.writeRequests).toEqual([]);
    await expect(page.getByRole('heading', { name: 'User Management Center' })).toBeVisible();
    await expect(page).toHaveURL(/\?page=admin(?:&|$)/);
    expect(backend.proof.pageErrors).toEqual([]);
    expect(backend.proof.consoleProblems).toEqual([]);
  });
});
