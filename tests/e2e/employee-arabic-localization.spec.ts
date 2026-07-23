import { expect, test, type Page, type Request } from '@playwright/test';
import { canAccessPageForUser, pageGroups } from '../../src/auth/authAccess';
import type { AuthRoleAssignment } from '../../src/auth/authTypes';
import type { PageKey } from '../../src/components/Layout';
import { PAGE_LOCATION_REGISTRY } from '../../src/routes/pageLocation';
import { startPatch83uTestServer, type Patch83uTestServer } from './patch83uTestServer';

const organizationId = '00000000-0000-4000-8000-000000000191';
const employeeUserId = '00000000-0000-4000-8000-000000000192';
const employeeRoles: AuthRoleAssignment[] = [{ role: 'employee', scope: 'assigned_only' }];
const employeePages = (Object.keys(PAGE_LOCATION_REGISTRY) as PageKey[])
  .filter((page) => canAccessPageForUser(page, employeeRoles));

type EmployeePage = 'home' | 'myWork' | 'ovr' | 'approvals' | 'evidence' | 'userGuide' | 'globalSearch';

const expectedArabicHeadings: Record<EmployeePage, string> = {
  home: 'مدخل موحد ونظيف للحوكمة والمخاطر والجودة والتنفيذ.',
  myWork: 'المراحل والمهام وتواريخ الاستحقاق ومتطلبات الأدلة المسندة إليّ',
  ovr: 'إدارة بلاغات OVR والحوادث',
  approvals: 'الموافقات المعلقة للإغلاق والأدلة والمشاريع وإجراءات الحوكمة',
  evidence: 'مكتبة الأدلة',
  userGuide: 'دليل المستخدم',
  globalSearch: 'مركز البحث الشامل',
};

const viewports = [
  { width: 1920, height: 1080 },
  { width: 1440, height: 900 },
  { width: 1366, height: 768 },
  { width: 1024, height: 768 },
  { width: 390, height: 844 },
];

const approvedLatinTerms: Record<string, string> = {
  GRC: 'Established product acronym and brand mark.',
  OVR: 'Established occurrence variance reporting acronym.',
  RLS: 'Technical row-level security acronym.',
  KPI: 'Technical key performance indicator acronym.',
  KRI: 'Technical key risk indicator acronym.',
  ISO: 'Standards organization proper name.',
  CBAHI: 'Accreditation body proper name.',
  API: 'Technical application programming interface acronym.',
  UAT: 'Technical user acceptance testing acronym.',
  URL: 'Technical resource locator acronym.',
  PDF: 'Technical file-format acronym.',
  CSV: 'Technical file-format acronym.',
  JSON: 'Technical data-format acronym.',
  ERP: 'Technical enterprise system acronym.',
  HIS: 'Technical hospital information system acronym.',
  SLA: 'Technical service-level acronym.',
  Supabase: 'Technical platform proper name.',
  English: 'Language name shown by the language switch control.',
  EN: 'Compact language-switch abbreviation.',
  AR: 'Compact language-switch abbreviation.',
  'grc-evidence': 'Fixed private storage bucket identifier.',
};

type BrowserProof = {
  actions: string[];
  mutationRequests: string[];
  consoleProblems: string[];
  pageErrors: string[];
  responseErrors: string[];
};

let server: Patch83uTestServer | null = null;
let baseUrl = '';

function sessionUser() {
  return {
    id: employeeUserId,
    aud: 'authenticated',
    role: 'authenticated',
    email: '12345@almodawat.sa',
    app_metadata: { provider: 'email', providers: ['email'], credential_version: 0 },
    user_metadata: {},
    identities: [],
    created_at: new Date(0).toISOString(),
  };
}

function parseRequestBody(request: Request): Record<string, unknown> {
  try {
    return JSON.parse(request.postData() || '{}') as Record<string, unknown>;
  } catch {
    return {};
  }
}

async function installEmployeeMocks(
  page: Page,
  proof: BrowserProof,
  language: 'ar' | 'en' = 'ar',
  includeFixtures = false,
) {
  await page.addInitScript(({ user, selectedLanguage }) => {
    localStorage.setItem('grc-language', selectedLanguage);
    localStorage.setItem('grc-control-center-auth', JSON.stringify({
      access_token: 'patch83u-employee-arabic-readonly-token',
      refresh_token: 'patch83u-employee-arabic-readonly-refresh',
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      expires_in: 3600,
      token_type: 'bearer',
      user,
    }));
  }, { user: sessionUser(), selectedLanguage: language });

  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') {
      proof.consoleProblems.push(`${message.type()}: ${message.text()}`);
    }
  });
  page.on('pageerror', (error) => proof.pageErrors.push(error.message));
  page.on('response', (response) => {
    if (response.status() >= 400) proof.responseErrors.push(`${response.status()} ${response.url()}`);
  });

  await page.route('**/auth/v1/**', async (route) => {
    if (!['GET', 'HEAD'].includes(route.request().method())) {
      proof.mutationRequests.push(`${route.request().method()} ${new URL(route.request().url()).pathname}`);
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(sessionUser()),
    });
  });

  await page.route('**/functions/v1/**', async (route) => {
    const body = parseRequestBody(route.request());
    const action = typeof body.action === 'string' ? body.action : '';
    proof.actions.push(action);

    let result: unknown = {};
    if (action === 'patch83u_get_capabilities') {
      result = {
        edge_contract_version: 'patch83u-edge-auth-first-v1',
        installed_schema_version: 174,
        runtime_enforcement_state: 'enforced',
        credential_state_action_available: true,
        password_change_action_available: true,
        provisioning_action_available: true,
        reset_action_available: true,
        compatibility_status: 'compatible',
        server_time: '2026-07-18T00:00:00.000Z',
      };
    } else if (action === 'patch83u_get_credential_state') {
      result = {
        managed: true,
        credential_state: 'active',
        credential_version: 0,
        auth_email: '12345@almodawat.sa',
        access_allowed: true,
        message: null,
      };
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
    if (!['GET', 'HEAD'].includes(request.method())) {
      proof.mutationRequests.push(`${request.method()} ${url.pathname}`);
    }

    const resource = url.pathname.split('/').pop() || '';
    const wantsObject = (request.headers().accept || '').includes('application/vnd.pgrst.object+json');
    let result: unknown = wantsObject ? {} : [];
    if (resource === 'profiles' && (wantsObject || url.searchParams.has('id'))) {
      result = {
        id: employeeUserId,
        email: '12345@almodawat.sa',
        full_name_en: 'Employee Arabic Test User',
        full_name_ar: 'موظف اختبار العربية',
        organization_id: organizationId,
        division_id: null,
        department_id: '00000000-0000-4000-8000-000000000193',
        unit_id: null,
        is_active: true,
        user_status: 'active',
        organizations: { name_en: 'منشأة اختبار العربية' },
      };
    } else if (resource === 'user_roles') {
      result = [{
        role: 'employee',
        scope: 'assigned_only',
        organization_id: organizationId,
        division_id: null,
        department_id: null,
        unit_id: null,
        is_active: true,
      }];
    } else if (includeFixtures && resource === 'profiles') {
      result = [{
        id: '00000000-0000-4000-8000-000000000194',
        full_name_en: 'Arabic Approver',
        full_name_ar: 'صاحب موافقة عربي',
        email: 'approver@almodawat.sa',
        department_id: null,
      }];
    } else if (includeFixtures && resource === 'v_my_open_work_expanded') {
      result = [{
        id: '00000000-0000-4000-8000-000000000195',
        organization_id: organizationId,
        item_type: 'task',
        title: 'مهمة مراجعة عربية',
        project_title: 'مشروع الحوكمة',
        department_name: 'إدارة الجودة',
        due_date: '2026-07-30',
        status: 'in_progress',
        progress_percent: 25,
      }];
    } else if (includeFixtures && resource === 'v_pending_approvals_expanded') {
      result = [{
        id: '00000000-0000-4000-8000-000000000196',
        item_type: 'task',
        item_title: 'اعتماد مهمة عربية',
        requested_by_name: 'موظف اختبار العربية',
        approver_name: 'صاحب موافقة عربي',
        requested_at: '2026-07-18T00:00:00.000Z',
        status: 'pending',
      }];
    } else if (includeFixtures && resource === 'ovr_reports') {
      result = [{
        id: '00000000-0000-4000-8000-000000000197',
        organization_id: organizationId,
        ovr_number: 'OVR-AR-001',
        logging_number: 'OVR-AR-001',
        occurrence_date: '2026-07-18',
        occurrence_category: 'medications',
        severity_level: 'level_1',
        status: 'submitted',
        brief_description: 'وصف واقعة للاختبار',
        reported_by: employeeUserId,
        department_id: null,
        owner_id: employeeUserId,
        departments: { name_en: 'Quality', name_ar: 'إدارة الجودة' },
        owner: { full_name_en: 'Employee Arabic Test User', full_name_ar: 'موظف اختبار العربية' },
      }];
    } else if (includeFixtures && resource === 'v_ovr_summary') {
      result = [{
        total_reports: 1,
        open_reports: 1,
        under_quality_review: 0,
        corrective_actions_required: 0,
        sentinel_events: 0,
        near_miss_level_1: 1,
      }];
    } else if (includeFixtures && resource === 'v_ovr_workflow_control_summary') {
      result = [{
        pending_supervisor_review: 0,
        pending_quality_review: 0,
        returned_for_clarification: 0,
        pending_evidence_review: 0,
        major_open_ovrs: 0,
        overdue_ovr_workflow_items: 0,
      }];
    } else if (includeFixtures && resource === 'v_patch23_evidence_review_queue') {
      result = [{
        evidence_file_id: '00000000-0000-4000-8000-000000000198',
        evidence_code: 'EV-AR-001',
        evidence_title: 'دليل اختبار عربي',
        file_name: 'arabic-proof.pdf',
        evidence_type: 'document',
        sensitivity_level: 'confidential',
        review_status: 'submitted',
        review_due_date: '2026-07-30',
        expiry_date: '2027-07-30',
        queue_reason: 'pending_review',
        owner_name: 'موظف اختبار العربية',
        reviewer_name: 'مراجع عربي',
        revision_required: false,
        renewal_required: false,
        locked_at: null,
        created_at: '2026-07-18T00:00:00.000Z',
      }];
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: {
        'access-control-allow-origin': '*',
        'access-control-expose-headers': 'Content-Range',
        'content-range': Array.isArray(result) && result.length ? `0-${result.length - 1}/${result.length}` : '*/0',
      },
      body: JSON.stringify(result),
    });
  });
}

async function visibleUnapprovedEnglish(page: Page): Promise<string[]> {
  const visibleText = await page.locator('body').innerText();
  const withoutTechnicalValues = visibleText
    .replace(/\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b/g, '')
    .replace(/\b[\w.-]+\.(?:pdf|csv|json|xlsx?|docx?|png|jpe?g|txt)\b/gi, '')
    .replace(/\b[A-Z]{2,}(?:-[A-Z0-9]+)+\b/g, '')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/\b[0-9a-f]{8}-[0-9a-f-]{27,}\b/gi, '');
  const words = withoutTechnicalValues.match(/[A-Za-z][A-Za-z-]{1,}/g) || [];
  return [...new Set(words.filter((word) => !(word in approvedLatinTerms)))].sort();
}

test.describe('Patch 83U Phase 1 Employee Arabic localization', () => {
  test.describe.configure({ mode: 'serial' });
  test.setTimeout(120_000);

  test.beforeAll(async () => {
    server = await startPatch83uTestServer({
      VITE_PATCH83U_CREDENTIAL_GOVERNANCE_ENABLED: 'true',
    });
    baseUrl = server.baseUrl;
  });

  test.afterAll(() => {
    server?.stop();
    server = null;
  });

  test('crawls every registry-authorized Employee page in Arabic at all required viewports without writes', async ({ page }) => {
    const proof: BrowserProof = { actions: [], mutationRequests: [], consoleProblems: [], pageErrors: [], responseErrors: [] };
    await installEmployeeMocks(page, proof, 'ar');

    expect(employeePages).toEqual(['home', 'myWork', 'ovr', 'approvals', 'evidence', 'userGuide', 'globalSearch']);
    expect(employeePages.every((pageKey) => ['home', 'personal'].includes(pageGroups[pageKey]))).toBe(true);

    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      for (const pageKey of employeePages) {
        await page.goto(`${baseUrl}/?page=${PAGE_LOCATION_REGISTRY[pageKey]}`);
        await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
        await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
        await expect(page.getByText(expectedArabicHeadings[pageKey as EmployeePage], { exact: true }).first()).toBeVisible();
        await page.waitForLoadState('networkidle');
        await expect.poll(() => new URL(page.url()).searchParams.get('page')).toBe(PAGE_LOCATION_REGISTRY[pageKey]);
        expect(await visibleUnapprovedEnglish(page), `${pageKey} at ${viewport.width}×${viewport.height}`).toEqual([]);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
      }
    }

    expect(proof.actions.filter(Boolean).every((action) => [
      'patch83u_get_capabilities',
      'patch83u_get_credential_state',
    ].includes(action))).toBe(true);
    expect(proof.mutationRequests).toEqual([]);
    expect(proof.consoleProblems).toEqual([]);
    expect(proof.pageErrors).toEqual([]);
    expect(proof.responseErrors).toEqual([]);
  });

  test('supports English mode and live Arabic switching without route loss', async ({ page }) => {
    const proof: BrowserProof = { actions: [], mutationRequests: [], consoleProblems: [], pageErrors: [], responseErrors: [] };
    await installEmployeeMocks(page, proof, 'en');
    await page.goto(`${baseUrl}/?page=${PAGE_LOCATION_REGISTRY.myWork}`);

    await expect(page.getByText('My assigned milestones, tasks, due dates and evidence requirements', { exact: true })).toBeVisible();
    await page.locator('.language-toggle').click();
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.getByText(expectedArabicHeadings.myWork, { exact: true })).toBeVisible();
    expect(new URL(page.url()).searchParams.get('page')).toBe(PAGE_LOCATION_REGISTRY.myWork);

    await page.locator('.language-toggle').click();
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
    await expect(page.getByText('My assigned milestones, tasks, due dates and evidence requirements', { exact: true })).toBeVisible();
    expect(new URL(page.url()).searchParams.get('page')).toBe(PAGE_LOCATION_REGISTRY.myWork);
    expect(proof.mutationRequests).toEqual([]);
  });

  test('keeps every Employee-openable work, OVR, approval, and evidence detail surface Arabic', async ({ page }) => {
    const proof: BrowserProof = { actions: [], mutationRequests: [], consoleProblems: [], pageErrors: [], responseErrors: [] };
    await installEmployeeMocks(page, proof, 'ar', true);
    await page.setViewportSize({ width: 1366, height: 768 });

    await page.goto(`${baseUrl}/?page=${PAGE_LOCATION_REGISTRY.myWork}`);
    await page.getByRole('button', { name: 'الحالة', exact: true }).click();
    expect(await visibleUnapprovedEnglish(page)).toEqual([]);
    await page.getByRole('button', { name: 'إغلاق', exact: true }).click();
    await page.getByRole('button', { name: 'الدليل', exact: true }).click();
    expect(await visibleUnapprovedEnglish(page)).toEqual([]);
    await page.getByRole('button', { name: 'إغلاق', exact: true }).click();
    await page.getByRole('button', { name: 'الموافقة', exact: true }).click();
    expect(await visibleUnapprovedEnglish(page)).toEqual([]);
    await page.getByRole('button', { name: 'إغلاق', exact: true }).click();

    await page.goto(`${baseUrl}/?page=${PAGE_LOCATION_REGISTRY.ovr}`);
    await page.getByRole('button', { name: /بلاغ OVR جديد/ }).click();
    expect(await visibleUnapprovedEnglish(page)).toEqual([]);

    await page.goto(`${baseUrl}/?page=${PAGE_LOCATION_REGISTRY.approvals}`);
    await page.getByRole('button', { name: 'اعتماد مهمة عربية', exact: true }).click();
    expect(await visibleUnapprovedEnglish(page)).toEqual([]);

    await page.goto(`${baseUrl}/?page=${PAGE_LOCATION_REGISTRY.evidence}`);
    await page.getByRole('button', { name: 'دليل اختبار عربي', exact: true }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    expect(await visibleUnapprovedEnglish(page)).toEqual([]);
    await page.getByRole('button', { name: 'إغلاق', exact: true }).click();

    expect(proof.mutationRequests).toEqual([]);
    expect(proof.consoleProblems).toEqual([]);
    expect(proof.pageErrors).toEqual([]);
    expect(proof.responseErrors).toEqual([]);
  });

  test('denies a direct administrative route to the Employee persona', async ({ page }) => {
    const proof: BrowserProof = { actions: [], mutationRequests: [], consoleProblems: [], pageErrors: [], responseErrors: [] };
    await installEmployeeMocks(page, proof, 'ar');
    await page.goto(`${baseUrl}/?page=admin`);

    await expect.poll(() => new URL(page.url()).searchParams.get('page')).toBe('home');
    await expect(page.getByText(expectedArabicHeadings.home, { exact: true })).toBeVisible();
    await expect(page.locator('.user-management-center')).toHaveCount(0);
    expect(proof.mutationRequests).toEqual([]);
  });
});
