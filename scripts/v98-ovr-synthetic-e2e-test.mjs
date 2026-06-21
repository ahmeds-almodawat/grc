import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';

const root = process.cwd();
const outDir = path.join(root, 'release', 'v98');
const outPath = path.join(outDir, 'ovr-synthetic-e2e-test.md');
fs.mkdirSync(outDir, { recursive: true });

const password = 'V98-Ovr-Synthetic!4826';
const suffix = Date.now().toString(36);
const results = [];
const createdUserIds = [];
const createdDepartmentIds = [];
const createdOvrIds = [];
let cleanupStatus = 'not_run';

function localStatus() {
  const result = spawnSync('cmd.exe', ['/d', '/s', '/c', 'npx supabase status -o json'], {
    cwd: root,
    encoding: 'utf8',
    windowsHide: true,
    maxBuffer: 4 * 1024 * 1024,
  });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || 'Local Supabase status failed. Run: npx supabase start');
  }
  return JSON.parse(result.stdout.slice(result.stdout.indexOf('{'), result.stdout.lastIndexOf('}') + 1));
}

function client(url, key) {
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

async function must(promise, label) {
  const result = await promise;
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  return result.data;
}

async function invokeBridge(personaClient, action, payload) {
  const { data, error } = await personaClient.functions.invoke('privileged-action', {
    body: { action, payload },
  });
  if (!error) return { ok: Boolean(data?.ok), data, error: null };
  let message = error.message;
  if ('context' in error && error.context instanceof Response) {
    try {
      const body = await error.context.clone().json();
      message = body.error || message;
    } catch {
      // Preserve SDK error when the body is not JSON.
    }
  }
  return { ok: false, data: null, error: message };
}

function record(name, passed, expected, actual) {
  results.push({ name, passed: Boolean(passed), expected, actual });
}

const generatedAt = new Date().toISOString();
let admin = null;

try {
  const status = localStatus();
  admin = client(status.API_URL, status.SERVICE_ROLE_KEY);
  const organization = await must(
    admin.from('organizations').select('id,name_en').eq('is_active', true).order('created_at').limit(1).single(),
    'select active organization',
  );

  const departments = await must(
    admin.from('departments').insert([
      { organization_id: organization.id, name_en: `V98 OVR Origin ${suffix}`, code: `V98OA${suffix}`.toUpperCase().slice(0, 24), is_active: true },
      { organization_id: organization.id, name_en: `V98 OVR Referred ${suffix}`, code: `V98OB${suffix}`.toUpperCase().slice(0, 24), is_active: true },
      { organization_id: organization.id, name_en: `V98 OVR Unrelated ${suffix}`, code: `V98OC${suffix}`.toUpperCase().slice(0, 24), is_active: true },
    ]).select('id,name_en'),
    'create synthetic departments',
  );
  createdDepartmentIds.push(...departments.map(row => row.id));
  const [originDepartment, referredDepartment, unrelatedDepartment] = departments;

  const definitions = [
    ['reporter', 'Synthetic Reporter', 'employee', 'assigned_only', originDepartment],
    ['origin_manager', 'Synthetic Origin Manager', 'department_manager', 'department', originDepartment],
    ['quality', 'Synthetic Quality Reviewer', 'governance_admin', 'global', originDepartment],
    ['referred_user', 'Synthetic Referred User', 'employee', 'assigned_only', referredDepartment],
    ['referred_manager', 'Synthetic Referred Manager', 'department_manager', 'department', referredDepartment],
    ['auditor', 'Synthetic Auditor', 'auditor', 'global', originDepartment],
    ['admin', 'Synthetic Super Admin', 'super_admin', 'global', originDepartment],
    ['unrelated', 'Synthetic Unrelated User', 'employee', 'assigned_only', unrelatedDepartment],
  ];
  const personas = {};

  for (const [code, name, role, scope, department] of definitions) {
    const email = `v98.ovr.${code}.${suffix}@local.test`;
    const created = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { synthetic_ovr_pilot_test: true },
    });
    if (created.error || !created.data.user) {
      throw new Error(`create ${code} auth user: ${created.error?.message || 'user missing'}`);
    }
    const user = created.data.user;
    createdUserIds.push(user.id);
    await must(admin.from('profiles').insert({
      id: user.id,
      organization_id: organization.id,
      department_id: department.id,
      full_name_en: name,
      email,
      job_title: name,
      is_active: true,
    }), `create ${code} profile`);
    await must(admin.from('user_roles').insert({
      user_id: user.id,
      role,
      scope,
      organization_id: organization.id,
      department_id: scope === 'department' ? department.id : null,
      is_active: true,
    }), `create ${code} role`);

    const personaClient = client(status.API_URL, status.ANON_KEY);
    const signedIn = await personaClient.auth.signInWithPassword({ email, password });
    if (signedIn.error) throw new Error(`sign in ${code}: ${signedIn.error.message}`);
    personas[code] = { user, email, client: personaClient, department, role };
  }

  const inserted = await must(
    personas.reporter.client.from('ovr_reports').insert({
      organization_id: organization.id,
      department_id: originDepartment.id,
      occurrence_date: new Date().toISOString().slice(0, 10),
      occurrence_location: 'Synthetic controlled pilot test location',
      involved_person_type: 'other',
      brief_description: `Synthetic non-confidential OVR workflow proof ${suffix}. No patient or real-person data.`,
      occurrence_category: 'other',
      severity_level: 'level_2',
      status: 'submitted',
      evidence_required: false,
      reported_by: personas.reporter.user.id,
      owner_id: personas.reporter.user.id,
      created_by: personas.reporter.user.id,
      updated_by: personas.reporter.user.id,
      occurrence_details: {
        synthetic_only: true,
        no_real_patient_identifiers: true,
        no_confidential_ovr_details: true,
      },
    }).select('id,ovr_number,status,supervisor_due_date,person_involved_name,mrn_or_id_no,evidence_required').single(),
    'reporter submits synthetic OVR',
  );
  createdOvrIds.push(inserted.id);

  const expectedDue = new Date();
  expectedDue.setUTCDate(expectedDue.getUTCDate() + 1);
  record(
    'Reporter submits synthetic OVR',
    inserted.status === 'submitted' && !inserted.person_involved_name && !inserted.mrn_or_id_no && inserted.evidence_required === true,
    'submitted status with no patient identifiers and server-enforced evidence requirement',
    inserted,
  );
  record(
    'Manager review due within 24 hours',
    inserted.supervisor_due_date === expectedDue.toISOString().slice(0, 10),
    expectedDue.toISOString().slice(0, 10),
    inserted.supervisor_due_date,
  );

  const visibilityBefore = {};
  for (const code of ['reporter', 'origin_manager', 'quality', 'referred_user', 'referred_manager', 'auditor', 'admin', 'unrelated']) {
    const response = await personas[code].client.from('ovr_reports').select('id').eq('id', inserted.id);
    visibilityBefore[code] = response.error ? `error:${response.error.message}` : response.data.length;
  }
  record(
    'Role visibility before referral',
    visibilityBefore.reporter === 1
      && visibilityBefore.origin_manager === 1
      && visibilityBefore.quality === 1
      && visibilityBefore.auditor === 1
      && visibilityBefore.admin === 1
      && visibilityBefore.referred_user === 0
      && visibilityBefore.referred_manager === 0
      && visibilityBefore.unrelated === 0,
    'reporter/relevant manager/Quality/Admin/Audit see one; unrelated and future referral parties see zero',
    visibilityBefore,
  );

  const referredNotificationsBefore = await must(
    admin.from('notifications')
      .select('id')
      .eq('user_id', personas.referred_user.user.id)
      .eq('title', 'OVR referral requires response'),
    'read pre-validation referral notifications',
  );
  record(
    'No cross-department notification before Quality validation',
    referredNotificationsBefore.length === 0,
    'zero referral notifications',
    `${referredNotificationsBefore.length} notifications`,
  );

  const auditorTableUpdate = await personas.auditor.client
    .from('ovr_reports')
    .update({ brief_description: 'AUDITOR MUST NOT CHANGE THIS' })
    .eq('id', inserted.id)
    .select('id');
  const auditorBridgeUpdate = await invokeBridge(personas.auditor.client, 'update_ovr_workflow', {
    ovr_report_id: inserted.id,
    next_status: 'manager_review',
    supervisor_investigation: 'Auditor mutation attempt.',
  });
  record(
    'Audit sees all read-only',
    !auditorTableUpdate.error && auditorTableUpdate.data.length === 0 && !auditorBridgeUpdate.ok,
    'direct update affects zero rows and bridge mutation is denied',
    {
      direct: auditorTableUpdate.error?.message || `${auditorTableUpdate.data.length} rows`,
      bridge: auditorBridgeUpdate.error || auditorBridgeUpdate.data,
    },
  );

  const managerReview = await invokeBridge(personas.origin_manager.client, 'update_ovr_workflow', {
    ovr_report_id: inserted.id,
    next_status: 'manager_review',
    supervisor_investigation: 'Synthetic manager review completed; no confidential details.',
    note: 'Synthetic manager review.',
  });
  record('Manager completes review', managerReview.ok && managerReview.data?.result?.status === 'manager_review', 'manager_review', managerReview.error || managerReview.data);

  const qualityValidation = await invokeBridge(personas.quality.client, 'update_ovr_workflow', {
    ovr_report_id: inserted.id,
    next_status: 'quality_validation',
    quality_manager_comments: 'Synthetic Quality validation completed.',
    confirmed_severity_level: 'level_2',
  });
  record('Quality validates OVR', qualityValidation.ok && qualityValidation.data?.result?.status === 'quality_validation', 'quality_validation', qualityValidation.error || qualityValidation.data);

  const referredNotificationsAfterValidation = await must(
    admin.from('notifications')
      .select('id')
      .eq('user_id', personas.referred_user.user.id)
      .eq('title', 'OVR referral requires response'),
    'read post-validation/pre-referral notifications',
  );
  record(
    'Quality validation alone does not notify another department',
    referredNotificationsAfterValidation.length === 0,
    'zero referral notifications until explicit referral',
    `${referredNotificationsAfterValidation.length} notifications`,
  );

  const referral = await invokeBridge(personas.quality.client, 'update_ovr_workflow', {
    ovr_report_id: inserted.id,
    next_status: 'referred_party_response',
    referred_department_id: referredDepartment.id,
    referred_user_id: personas.referred_user.user.id,
    note: 'Synthetic referral after Quality validation.',
  });
  const referredVisibility = await personas.referred_user.client.from('ovr_reports').select('id,status').eq('id', inserted.id);
  const referredNotification = await must(
    admin.from('notifications')
      .select('id')
      .eq('user_id', personas.referred_user.user.id)
      .eq('title', 'OVR referral requires response'),
    'read referral notification',
  );
  record(
    'Quality referral unlocks referred-party visibility and notification',
    referral.ok
      && referral.data?.result?.status === 'referred_party_response'
      && Boolean(referral.data?.result?.cross_department_notified_at)
      && !referredVisibility.error
      && referredVisibility.data.length === 1
      && referredNotification.length >= 1,
    'referred_party_response with timestamp, one visible OVR, and notification',
    {
      transition: referral.error || referral.data,
      visible_rows: referredVisibility.error?.message || referredVisibility.data.length,
      notifications: referredNotification.length,
    },
  );

  const referredResponse = await invokeBridge(personas.referred_user.client, 'update_ovr_workflow', {
    ovr_report_id: inserted.id,
    next_status: 'quality_final_review',
    referred_response: 'Synthetic referred-party response completed.',
    corrective_action: 'Synthetic corrective action documented.',
    corrective_action_due_date: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
  });
  record('Referred party responds', referredResponse.ok && referredResponse.data?.result?.status === 'quality_final_review', 'quality_final_review pending verdict', referredResponse.error || referredResponse.data);

  const finalVerdict = await invokeBridge(personas.quality.client, 'update_ovr_workflow', {
    ovr_report_id: inserted.id,
    next_status: 'quality_final_review',
    final_verdict: 'Synthetic pilot verdict: corrective action is acceptable after evidence review.',
    quality_manager_comments: 'Synthetic final Quality review.',
    confirmed_severity_level: 'level_2',
  });
  record(
    'Quality issues final verdict',
    finalVerdict.ok && Boolean(finalVerdict.data?.result?.final_verdict),
    'quality_final_review with final verdict',
    finalVerdict.error || finalVerdict.data,
  );

  await must(admin.from('evidence_files').insert({
    organization_id: organization.id,
    ovr_report_id: inserted.id,
    file_name: `v98-synthetic-ovr-evidence-${suffix}.txt`,
    file_path: `v98-ovr-synthetic/${suffix}/evidence.txt`,
    file_type: 'text/plain',
    description: 'Synthetic non-confidential evidence marker; no patient identifiers.',
    status: 'accepted',
    uploaded_by: personas.quality.user.id,
    reviewed_by: personas.quality.user.id,
    reviewed_at: new Date().toISOString(),
  }), 'attach accepted synthetic evidence');

  const dispute = await invokeBridge(personas.reporter.client, 'update_ovr_workflow', {
    ovr_report_id: inserted.id,
    next_status: 'disputed',
    note: 'Synthetic dispute to prove reopen handling.',
  });
  const reopen = await invokeBridge(personas.quality.client, 'update_ovr_workflow', {
    ovr_report_id: inserted.id,
    next_status: 'reopened',
    note: 'Synthetic Quality reopen.',
  });
  const escalate = await invokeBridge(personas.quality.client, 'update_ovr_workflow', {
    ovr_report_id: inserted.id,
    next_status: 'escalated',
    note: 'Synthetic escalation proof.',
  });
  const revisedVerdict = await invokeBridge(personas.quality.client, 'update_ovr_workflow', {
    ovr_report_id: inserted.id,
    next_status: 'quality_final_review',
    final_verdict: 'Synthetic revised final verdict after dispute review.',
    quality_manager_comments: 'Synthetic revised Quality conclusion.',
  });
  record(
    'Dispute reopens and can be escalated/re-reviewed',
    dispute.ok
      && reopen.ok
      && escalate.ok
      && revisedVerdict.ok
      && revisedVerdict.data?.result?.status === 'quality_final_review',
    'disputed -> reopened -> escalated -> quality_final_review',
    {
      dispute: dispute.error || dispute.data,
      reopen: reopen.error || reopen.data,
      escalate: escalate.error || escalate.data,
      revised_verdict: revisedVerdict.error || revisedVerdict.data,
    },
  );

  const close = await invokeBridge(personas.reporter.client, 'update_ovr_workflow', {
    ovr_report_id: inserted.id,
    next_status: 'closed',
    note: 'Synthetic reporter acceptance after accepted evidence.',
  });
  record(
    'Reporter accepts verdict and closes with required evidence',
    close.ok
      && close.data?.result?.status === 'closed'
      && close.data?.result?.reporter_response === 'accepted'
      && Boolean(close.data?.result?.closed_at),
    'closed with accepted reporter response and closure timestamp',
    close.error || close.data,
  );

  const rejectFixture = await must(
    personas.reporter.client.from('ovr_reports').insert({
      organization_id: organization.id,
      department_id: originDepartment.id,
      occurrence_date: new Date().toISOString().slice(0, 10),
      involved_person_type: 'other',
      brief_description: `Synthetic rejection-path OVR ${suffix}; no real identifiers.`,
      occurrence_category: 'other',
      severity_level: 'level_1',
      status: 'submitted',
      reported_by: personas.reporter.user.id,
      owner_id: personas.reporter.user.id,
      created_by: personas.reporter.user.id,
      updated_by: personas.reporter.user.id,
    }).select('id').single(),
    'create rejection-path OVR',
  );
  createdOvrIds.push(rejectFixture.id);
  const rejectManager = await invokeBridge(personas.origin_manager.client, 'update_ovr_workflow', {
    ovr_report_id: rejectFixture.id,
    next_status: 'manager_review',
    supervisor_investigation: 'Synthetic rejection-path manager review.',
  });
  const reject = await invokeBridge(personas.quality.client, 'update_ovr_workflow', {
    ovr_report_id: rejectFixture.id,
    next_status: 'rejected',
    note: 'Synthetic controlled rejection reason.',
  });
  record(
    'Quality rejection path',
    rejectManager.ok && reject.ok && reject.data?.result?.status === 'rejected',
    'manager_review -> rejected with reason',
    { manager: rejectManager.error || rejectManager.data, rejection: reject.error || reject.data },
  );

  const auditComments = await must(
    admin.from('comments').select('id').in('ovr_report_id', createdOvrIds),
    'read OVR workflow audit comments',
  );
  record(
    'Workflow transitions leave an audit/comment trail',
    auditComments.length >= 10,
    'at least ten transition comments for the exercised lifecycle',
    `${auditComments.length} comments`,
  );
} catch (error) {
  record('Synthetic E2E runner infrastructure', false, 'setup and lifecycle complete', error instanceof Error ? error.message : String(error));
} finally {
  if (admin) {
    try {
      if (createdOvrIds.length) {
        await admin.from('ovr_reports').delete().in('id', createdOvrIds);
      }
      for (const userId of [...createdUserIds].reverse()) {
        const deleted = await admin.auth.admin.deleteUser(userId);
        if (deleted.error) throw deleted.error;
      }
      if (createdDepartmentIds.length) {
        await admin.from('departments').delete().in('id', createdDepartmentIds);
      }
      cleanupStatus = 'passed';
    } catch (error) {
      cleanupStatus = `failed: ${error instanceof Error ? error.message : String(error)}`;
    }
  }
}

const failed = results.filter(result => !result.passed);
const passed = failed.length === 0 && cleanupStatus === 'passed';
const lines = [
  '# v9.8 OVR Synthetic E2E Test',
  '',
  `- Generated: ${generatedAt}`,
  '- Environment: Local Supabase Docker staging',
  '- Data classification: synthetic, non-confidential, no real patient identifiers',
  `- Status: **${passed ? 'PASSED' : 'FAILED'}**`,
  `- Scenarios passed: ${results.length - failed.length}/${results.length}`,
  `- Cleanup: ${cleanupStatus}`,
  '- Production readiness: **Not asserted**',
  '',
  '| Scenario | Result | Expected | Actual |',
  '|---|---|---|---|',
  ...results.map(result => `| ${result.name} | ${result.passed ? 'PASS' : 'FAIL'} | ${String(result.expected).replaceAll('|', '\\|')} | ${JSON.stringify(result.actual).replaceAll('|', '\\|')} |`),
  '',
  '## Lifecycle exercised',
  '',
  '`submitted -> manager_review -> quality_validation -> referred_party_response -> quality_final_review -> disputed -> reopened -> escalated -> quality_final_review -> closed`',
  '',
  'A separate synthetic OVR exercised the `rejected` path. No real patient identifiers, real-person names, medical-record numbers, or confidential OVR narratives were used.',
  '',
];
fs.writeFileSync(outPath, `${lines.join('\n')}\n`, 'utf8');
console.log(`v9.8 OVR synthetic E2E: ${passed ? 'PASSED' : 'FAILED'}`);
console.log(`Scenarios: ${results.length - failed.length}/${results.length}`);
console.log(`Cleanup: ${cleanupStatus}`);
console.log(`Report: ${path.relative(root, outPath)}`);
if (!passed) process.exitCode = 1;
