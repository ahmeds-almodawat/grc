import { expect, test, type Page, type Request } from '@playwright/test';
import { startPatch83uTestServer, type Patch83uTestServer } from './patch83uTestServer';

const organizationId = '00000000-0000-4000-8000-000000000401';
const departmentId = '00000000-0000-4000-8000-000000000402';
const managerId = '00000000-0000-4000-8000-000000000403';
const reportId = '00000000-0000-4000-8000-000000000404';

let server: Patch83uTestServer | null = null;
let baseUrl = '';

function sessionUser() {
  return {
    id: managerId,
    aud: 'authenticated',
    role: 'authenticated',
    email: 'f4-h1-manager@example.invalid',
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

function ovrRow(status: 'submitted' | 'manager_review') {
  return {
    id: reportId,
    organization_id: organizationId,
    ovr_number: 'OVR-H1-STATE-SYNC',
    logging_number: 'F4-H1',
    occurrence_date: '2026-08-15',
    occurrence_time: '15:00:00',
    occurrence_location: null,
    involved_person_type: 'other',
    person_involved_name: null,
    mrn_or_id_no: null,
    department_id: departmentId,
    brief_description: 'Synthetic F4 H1 state synchronization proof',
    occurrence_category: 'other',
    severity_level: 'level_1',
    injury_type: null,
    supervisor_investigation: status === 'manager_review' ? 'Governed manager review complete' : null,
    corrective_action: null,
    quality_manager_comments: null,
    referred_department_id: null,
    referred_user_id: null,
    referred_response: null,
    reported_by: managerId,
    supervisor_id: status === 'manager_review' ? managerId : null,
    quality_reviewer_id: null,
    quality_validated_at: null,
    cross_department_notified_at: null,
    final_verdict: null,
    reporter_response: null,
    evidence_required: true,
    status,
    corrective_action_required: true,
    linked_project_id: null,
    created_at: '2026-08-15T12:00:00.000Z',
    departments: { name_en: 'Quality', name_ar: 'إدارة الجودة' },
    owner: null,
  };
}

async function installMocks(page: Page) {
  let mutationCalls = 0;
  let staleReadsRemaining = 0;
  let postMutationReads = 0;

  await page.addInitScript(({ user }) => {
    localStorage.setItem('grc-language', 'en');
    localStorage.setItem('grc-control-center-auth', JSON.stringify({
      access_token: 'f4-h1-local-access',
      refresh_token: 'f4-h1-local-refresh',
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      expires_in: 3600,
      token_type: 'bearer',
      user,
    }));
  }, { user: sessionUser() });

  await page.route('**/auth/v1/**', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(sessionUser()),
  }));

  await page.route('**/functions/v1/**', async route => {
    const body = parseRequestBody(route.request());
    const action = typeof body.action === 'string' ? body.action : '';
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
        server_time: '2026-08-15T12:00:00.000Z',
      };
    } else if (action === 'patch83u_get_credential_state') {
      result = {
        managed: true,
        credential_state: 'active',
        credential_version: 0,
        auth_email: 'f4-h1-manager@example.invalid',
        access_allowed: true,
        message: null,
      };
    } else if (action === 'update_ovr_workflow') {
      mutationCalls += 1;
      staleReadsRemaining = 2;
      result = {
        id: reportId,
        status: 'manager_review',
        supervisor_due_date: null,
        quality_validated_at: null,
        cross_department_notified_at: null,
        final_verdict: null,
        reporter_response: null,
        closed_at: null,
      };
    } else if (action === 'f1r2_search_eligible_participants') {
      result = [];
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, action, result }),
    });
  });

  await page.route('**/rest/v1/**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    const resource = url.pathname.split('/').pop() || '';
    const wantsObject = (request.headers().accept || '').includes('application/vnd.pgrst.object+json');
    let result: unknown = wantsObject ? {} : [];

    if (resource === 'profiles' && (wantsObject || url.searchParams.has('id'))) {
      result = {
        id: managerId,
        email: 'f4-h1-manager@example.invalid',
        full_name_en: 'F4 H1 Manager',
        full_name_ar: 'مدير اختبار F4',
        organization_id: organizationId,
        division_id: null,
        department_id: departmentId,
        unit_id: null,
        is_active: true,
        user_status: 'active',
        organizations: { name_en: 'F4 H1 Local Organization' },
      };
    } else if (resource === 'profiles') {
      result = [];
    } else if (resource === 'user_roles') {
      result = [{
        role: 'department_manager',
        scope: 'department',
        organization_id: organizationId,
        division_id: null,
        department_id: departmentId,
        unit_id: null,
        is_active: true,
      }];
    } else if (resource === 'organizations') {
      result = [{ id: organizationId, name_en: 'F4 H1 Local Organization', name_ar: 'منشأة اختبار F4' }];
    } else if (resource === 'departments') {
      result = [{ id: departmentId, organization_id: organizationId, name_en: 'Quality', name_ar: 'إدارة الجودة' }];
    } else if (resource === 'ovr_reports') {
      if (mutationCalls > 0) postMutationReads += 1;
      const status = staleReadsRemaining > 0 ? 'submitted' : mutationCalls > 0 ? 'manager_review' : 'submitted';
      if (staleReadsRemaining > 0) staleReadsRemaining -= 1;
      result = [ovrRow(status)];
    } else if (resource === 'v_ovr_summary') {
      result = [{ total_reports: 1, open_reports: 1, under_quality_review: 0, corrective_actions_required: 1, sentinel_events: 0, near_miss_level_1: 1 }];
    } else if (resource === 'v_ovr_workflow_control_summary') {
      result = [{ pending_supervisor_review: 1, pending_quality_review: 0, returned_for_clarification: 0, pending_evidence_review: 0, major_open_ovrs: 0, overdue_ovr_workflow_items: 0 }];
    } else if (resource === 'v_ovr_workflow_queue' || resource === 'evidence_files') {
      result = [];
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

  return {
    getMutationCalls: () => mutationCalls,
    getPostMutationReads: () => postMutationReads,
  };
}

test.describe('F4 H1 OVR modal state synchronization', () => {
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

  test('keeps manager review visible at 390x844 despite stale post-mutation reads', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const proof = await installMocks(page);
    let navigationCount = 0;
    page.on('framenavigated', frame => {
      if (frame === page.mainFrame()) navigationCount += 1;
    });

    await page.goto(`${baseUrl}/?page=ovr`);
    await page.getByRole('button', { name: 'Open workflow' }).click();
    const dialog = page.getByRole('dialog', { name: 'OVR-H1-STATE-SYNC' });
    await expect(dialog).toBeVisible();
    const investigation = dialog.getByLabel('Investigation report / action taken');
    await investigation.fill('Governed manager review complete');
    await dialog.getByRole('button', { name: 'Complete manager review' }).click();

    await expect(dialog.getByText('Manager review', { exact: true }).first()).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Complete manager review' })).toHaveCount(0);
    await expect(dialog.getByText('OVR workflow updated.')).toBeVisible();
    await expect(investigation).toHaveValue('Governed manager review complete');
    await expect(dialog).toHaveAttribute('dir', 'ltr');
    expect(proof.getMutationCalls()).toBe(1);
    expect(navigationCount).toBe(1);

    expect(proof.getPostMutationReads()).toBe(2);
    await dialog.getByRole('button', { name: 'Close' }).click();
    await expect(dialog).toHaveCount(0);

    const reportRow = page.getByRole('row').filter({ hasText: 'OVR-H1-STATE-SYNC' });
    await expect(reportRow.getByText('Manager review', { exact: true })).toBeVisible();
    expect(proof.getPostMutationReads()).toBe(2);

    await reportRow.getByRole('button', { name: 'Open workflow' }).click();
    await expect(dialog.getByText('Manager review', { exact: true }).first()).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Complete manager review' })).toHaveCount(0);
    expect(proof.getMutationCalls()).toBe(1);
    expect(navigationCount).toBe(1);

    await expect.poll(() => proof.getPostMutationReads(), { timeout: 5000 }).toBeGreaterThanOrEqual(3);
    await expect(reportRow.getByText('Manager review', { exact: true })).toBeVisible();
    await expect(dialog.getByText('Manager review', { exact: true }).first()).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Complete manager review' })).toHaveCount(0);
    expect(proof.getMutationCalls()).toBe(1);
  });
});
