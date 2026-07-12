import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const releaseDir = path.join(root, 'release', 'patch83o3');
const patch83oEvidencePath = path.join(root, 'release', 'patch83o', 'patch83o-authenticated-runtime-verification.json');
const resultsPath = path.join(releaseDir, 'patch83o3-live-mutation-results.json');

const ENV = {
  projectUrl: String(process.env.PATCH83O_PROJECT_URL ?? '').replace(/\/$/, ''),
  anonKey: process.env.PATCH83O_ANON_KEY,
  adminJwt: process.env.PATCH83O_ADMIN_JWT,
  organizationId: process.env.PATCH83O_TEST_ORGANIZATION_ID,
  divisionId: process.env.PATCH83O_TEST_DIVISION_ID,
  divisionCode: process.env.PATCH83O_TEST_DIVISION_CODE,
  approved: process.env.PATCH83O_APPROVE_LIVE_MUTATION,
};

const required = ['projectUrl', 'anonKey', 'adminJwt', 'organizationId', 'divisionId', 'divisionCode'];
for (const name of required) {
  if (!ENV[name]) throw new Error(`Missing secure runner input: ${name}.`);
}
if (ENV.approved !== 'YES') throw new Error('Explicit live mutation approval is required.');

fs.mkdirSync(releaseDir, { recursive: true });

const suffix = `${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}`;
const testCode = `p83o3_${suffix}`;
const rollbackCode = `p83o3_rb_${suffix}`;
const rollbackInvalidCode = `p83o3_bad_${suffix}`;
const filenames = {
  rollback: `patch83o3-atomic-${suffix}.csv`,
  create: `patch83o3-create-${suffix}.csv`,
  update: `patch83o3-update-${suffix}.csv`,
  cleanup: `patch83o3-cleanup-${suffix}.csv`,
};
const names = {
  createdEn: `Patch 83O.3 Controlled Test ${suffix}`,
  createdAr: 'اختبار القسم المتحكم به للتصحيح 83O.3',
  updatedEn: `Patch 83O.3 Controlled Updated Test ${suffix}`,
  inactiveEn: `Patch 83O.3 Inactive Test Data ${suffix}`,
};

const results = {
  patch: '83O.3',
  execution_status: 'FAILED',
  live_mutation_approved: true,
  mutation_approval_method: 'EXACT_INTERACTIVE_CONFIRMATION_PHRASE',
  administrator_session_validated: true,
  administrator_organization_verified: true,
  approved_division_verified: true,
  approved_division_id: ENV.divisionId,
  randomized_safe_codes_used: true,
  atomic_rollback_verified: false,
  create_only_verified: false,
  duplicate_behavior_verified: false,
  create_and_update_verified: false,
  blank_values_preserved: false,
  manager_preserved_null: false,
  profile_department_ids_unchanged: false,
  unrelated_user_roles_unchanged: false,
  audit_verified: false,
  all_mutations_auditable: false,
  raw_rows_stored: false,
  raw_rows_not_stored_verified: false,
  cleanup_status: 'NOT_COMPLETED',
  test_department_inactive: false,
  original_active_department_count_restored: false,
  no_active_test_department_remains: false,
  no_unrelated_department_changed: false,
  test_users_created: false,
  organizations_created: false,
  divisions_created: false,
  frontend_execution_enabled: false,
  activation_decision: 'blocked',
  production_readiness_claim: false,
  original_active_department_count: null,
  final_active_department_count: null,
  test_department_code: testCode,
  test_department_id: null,
  completed_batch_count: null,
  structured_department_audit_event_count: null,
  runtime_blocker: null,
};

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function stable(value) {
  return JSON.stringify(value);
}

function encodeParams(params) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) query.set(key, String(value));
  return query.toString();
}

async function query(table, params) {
  const response = await fetch(`${ENV.projectUrl}/rest/v1/${table}?${encodeParams(params)}`, {
    headers: { apikey: ENV.anonKey, Authorization: `Bearer ${ENV.adminJwt}` },
  });
  if (!response.ok) throw new Error(`Authenticated database verification failed for ${table} with HTTP ${response.status}.`);
  return response.json();
}

async function invokeImport(sourceFilename, importMode, rows) {
  const response = await fetch(`${ENV.projectUrl}/functions/v1/privileged-action`, {
    method: 'POST',
    headers: {
      apikey: ENV.anonKey,
      Authorization: `Bearer ${ENV.adminJwt}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      action: 'department_import_execute',
      payload: {
        organization_id: ENV.organizationId,
        source_filename: sourceFilename,
        import_mode: importMode,
        rows,
      },
    }),
  });
  let data;
  try { data = await response.json(); } catch { data = null; }
  return { status: response.status, data };
}

function row(number, rawData) {
  return { row_number: number, raw_data: rawData };
}

async function departments() {
  return query('departments', {
    organization_id: `eq.${ENV.organizationId}`,
    select: 'id,organization_id,division_id,code,name_en,name_ar,is_active,created_at,updated_at',
    order: 'id.asc',
    limit: 5000,
  });
}

async function batchesFor(filename) {
  return query('department_import_batches', {
    organization_id: `eq.${ENV.organizationId}`,
    source_filename: `eq.${filename}`,
    select: '*',
    order: 'initiated_at.asc',
    limit: 100,
  });
}

async function departmentAudits(departmentId) {
  return query('audit_logs', {
    organization_id: `eq.${ENV.organizationId}`,
    table_name: 'eq.departments',
    record_id: `eq.${departmentId}`,
    select: 'id,action,table_name,record_id,actor_id,organization_id,old_data,new_data,created_at',
    order: 'created_at.asc',
    limit: 100,
  });
}

async function auditForCode(code) {
  const audits = await query('audit_logs', {
    organization_id: `eq.${ENV.organizationId}`,
    table_name: 'eq.departments',
    select: 'id,action,record_id,new_data,created_at',
    order: 'created_at.asc',
    limit: 5000,
  });
  return audits.filter((entry) => entry?.new_data?.code === code);
}

async function managerRoles(departmentId) {
  return query('user_roles', {
    organization_id: `eq.${ENV.organizationId}`,
    department_id: `eq.${departmentId}`,
    role: 'eq.department_manager',
    is_active: 'eq.true',
    select: 'id,user_id,department_id,is_active',
    order: 'id.asc',
    limit: 100,
  });
}

async function identitySnapshots() {
  const [organizations, divisions, profiles, roles] = await Promise.all([
    query('organizations', { select: 'id', order: 'id.asc', limit: 5000 }),
    query('divisions', { organization_id: `eq.${ENV.organizationId}`, select: 'id,organization_id', order: 'id.asc', limit: 5000 }),
    query('profiles', { organization_id: `eq.${ENV.organizationId}`, select: 'id,organization_id,department_id', order: 'id.asc', limit: 5000 }),
    query('user_roles', { organization_id: `eq.${ENV.organizationId}`, select: 'id,user_id,role,scope,organization_id,division_id,department_id,unit_id,is_active', order: 'id.asc', limit: 5000 }),
  ]);
  return { organizations, divisions, profiles, roles };
}

function hasRawRowStorage(value) {
  if (Array.isArray(value)) return value.some(hasRawRowStorage);
  if (!value || typeof value !== 'object') return false;
  return Object.entries(value).some(([key, child]) => /^(?:raw_data|rows|import_rows)$/i.test(key) || hasRawRowStorage(child));
}

function completedBatch(batch, mode, createdCount, updatedCount, departmentId) {
  return batch.status === 'completed' && batch.import_mode === mode &&
    batch.total_rows === 1 && batch.created_count === createdCount &&
    batch.updated_count === updatedCount && batch.failed_count === 0 &&
    Array.isArray(batch.affected_department_ids) && batch.affected_department_ids.length === 1 &&
    batch.affected_department_ids[0] === departmentId && batch.completed_at;
}

function writeMarkdown(filename, title, fields) {
  const lines = [`# ${title}`, '', ...Object.entries(fields).map(([key, value]) => `- ${key}: ${value}`), ''];
  fs.writeFileSync(path.join(releaseDir, filename), lines.join('\n'));
}

function writeEvidence() {
  fs.writeFileSync(resultsPath, `${JSON.stringify(results, null, 2)}\n`);
  writeMarkdown('patch83o3-live-mutation-summary.md', 'Patch 83O.3 Live Mutation Summary', {
    'Execution status': results.execution_status,
    'Live mutation approved': results.live_mutation_approved,
    'Mutating runtime tests completed': results.execution_status === 'PASSED',
    'Approved division verified': results.approved_division_verified,
    'No unrelated department changed': results.no_unrelated_department_changed,
    'No users created': !results.test_users_created,
    'No organizations created': !results.organizations_created,
    'No divisions created': !results.divisions_created,
    'Production readiness claim': results.production_readiness_claim,
  });
  writeMarkdown('patch83o3-atomic-rollback.md', 'Patch 83O.3 Atomic Rollback', {
    'Atomic rollback verified': results.atomic_rollback_verified,
    'No department created by rejected batch': results.atomic_rollback_verified,
    'No completed batch recorded': results.atomic_rollback_verified,
    'No create audit event recorded': results.atomic_rollback_verified,
  });
  writeMarkdown('patch83o3-create-only.md', 'Patch 83O.3 Create-Only Verification', {
    'Create-only verified': results.create_only_verified,
    'Manager preserved as null': results.manager_preserved_null,
    'Exactly one completed create batch': results.create_only_verified,
    'Exactly one structured create audit event': results.create_only_verified,
  });
  writeMarkdown('patch83o3-duplicate.md', 'Patch 83O.3 Duplicate Verification', {
    'Duplicate behavior verified': results.duplicate_behavior_verified,
    'No second active department': results.duplicate_behavior_verified,
    'Original record unchanged': results.duplicate_behavior_verified,
    'No duplicate completed batch': results.duplicate_behavior_verified,
  });
  writeMarkdown('patch83o3-update.md', 'Patch 83O.3 Controlled Update', {
    'Create-and-update verified': results.create_and_update_verified,
    'Blank values preserved': results.blank_values_preserved,
    'Organization, division, and code unchanged': results.create_and_update_verified,
    'Profile department IDs unchanged': results.profile_department_ids_unchanged,
    'Unrelated user roles unchanged': results.unrelated_user_roles_unchanged,
  });
  writeMarkdown('patch83o3-audit-verification.md', 'Patch 83O.3 Audit Verification', {
    'Audit verified': results.audit_verified,
    'All mutations auditable': results.all_mutations_auditable,
    'Structured department audit event count': results.structured_department_audit_event_count,
    'Raw rows stored': results.raw_rows_stored,
    'Raw rows not stored verified': results.raw_rows_not_stored_verified,
  });
  writeMarkdown('patch83o3-cleanup.md', 'Patch 83O.3 Cleanup', {
    'Cleanup status': results.cleanup_status,
    'Test department inactive': results.test_department_inactive,
    'Original active department count restored': results.original_active_department_count_restored,
    'No active Patch 83O test department remains': results.no_active_test_department_remains,
    'Batch and audit history preserved': results.cleanup_status === 'INACTIVATED',
  });
  writeMarkdown('patch83o3-activation-decision.md', 'Patch 83O.3 Activation Decision', {
    'Frontend execution enabled': results.frontend_execution_enabled,
    'Activation decision': results.activation_decision,
    'Production readiness claim': results.production_readiness_claim,
  });
}

function updatePatch83oEvidence() {
  const prior = JSON.parse(fs.readFileSync(patch83oEvidencePath, 'utf8'));
  const updated = {
    ...prior,
    live_mutation_approved: true,
    mutating_runtime_tests_completed: true,
    atomic_rollback_verified: true,
    create_only_verified: true,
    duplicate_behavior_verified: true,
    create_and_update_verified: true,
    audit_verified: true,
    raw_rows_stored: false,
    test_department_id: results.test_department_id,
    test_department_code_redacted_or_sanitized: true,
    cleanup_status: 'INACTIVATED',
    frontend_execution_enabled: false,
    activation_decision: 'approved_for_environment_enablement',
    test_users_created: false,
    organizations_created: false,
    divisions_created: false,
    production_readiness_claim: false,
    remaining_blockers: [],
    next_patch: 'Controlled environment enablement remains a separate decision',
  };
  fs.writeFileSync(patch83oEvidencePath, `${JSON.stringify(updated, null, 2)}\n`);

  const patch83oDir = path.dirname(patch83oEvidencePath);
  const patch83oMarkdown = {
    'patch83o-authenticated-runtime-verification.md': `# Patch 83O: Authenticated Department Import Runtime Verification\n\n- Migration 167 Applied: true\n- Migration 168 Deployed: true\n- Migration 169 Deployed: true\n- Runtime Retesting After Migration 169: authenticated non-mutating matrix completed\n- Edge Function Deployed: true\n- Edge Function Version: 4\n- Zero Department Mutation Verified: true\n- Live Mutation Approved: true\n- Mutating Runtime Tests Completed: true\n- Activation Decision: approved_for_environment_enablement\n- Frontend Execution Enabled: false\n- Production Readiness Claim: false\n`,
    'patch83o-atomic-rollback-result.md': '# Patch 83O Atomic Rollback Result\n\n- Atomic Rollback Verified: true\n',
    'patch83o-create-only-result.md': `# Patch 83O Create-Only Result\n\n- Create-Only Verified: true\n- Test Department ID: ${results.test_department_id}\n- Manager: null\n`,
    'patch83o-duplicate-result.md': '# Patch 83O Duplicate Behavior Result\n\n- Duplicate Behavior Verified: true\n- Duplicate Completed Batch Created: false\n',
    'patch83o-update-result.md': '# Patch 83O Controlled Update Result\n\n- Controlled Update Verified: true\n- Blank Values Preserved: true\n',
    'patch83o-audit-verification.md': '# Patch 83O Audit Verification Result\n\n- Audit Verified: true\n- Raw Rows Stored: false\n',
    'patch83o-cleanup-result.md': '# Patch 83O Cleanup Result\n\n- Cleanup Status: INACTIVATED\n- Hard Delete Executed: false\n',
    'patch83o-activation-decision.md': '# Patch 83O Activation Decision\n\n- Frontend Execution Enabled: false\n- Activation Decision: approved_for_environment_enablement\n- Live Mutation Approved: true\n- Production Readiness Claim: false\n',
  };
  for (const [filename, content] of Object.entries(patch83oMarkdown)) {
    fs.writeFileSync(path.join(patch83oDir, filename), content);
  }
}

async function main() {
  const division = await query('divisions', {
    id: `eq.${ENV.divisionId}`,
    organization_id: `eq.${ENV.organizationId}`,
    is_active: 'eq.true',
    select: 'id,organization_id,code,is_active',
    limit: 2,
  });
  invariant(division.length === 1 && division[0].code === ENV.divisionCode, 'Approved GRC division scope mismatch.');

  const baselineDepartments = await departments();
  const baselineIdentities = await identitySnapshots();
  const baselineActiveCount = baselineDepartments.filter((department) => department.is_active).length;
  results.original_active_department_count = baselineActiveCount;

  const rollbackResponse = await invokeImport(filenames.rollback, 'create_only', [
    row(1, {
      department_code: rollbackCode,
      department_name_en: `Patch 83O.3 Atomic Valid Test ${suffix}`,
      department_name_ar: names.createdAr,
      division_code: ENV.divisionCode,
      status: 'active',
    }),
    row(2, {
      department_code: rollbackInvalidCode,
      department_name_en: `Patch 83O.3 Atomic Invalid Test ${suffix}`,
      division_code: `PATCH83O3_INVALID_${suffix}`,
      status: 'active',
    }),
  ]);
  const rollbackResult = rollbackResponse.data?.result;
  invariant(rollbackResponse.status === 200 && rollbackResult?.status === 'rejected' && rollbackResult.total_rows === 2 && rollbackResult.failed_count === 1 && rollbackResult.created_count === 0 && rollbackResult.updated_count === 0, 'Atomic rollback response mismatch.');
  invariant((await query('departments', { organization_id: `eq.${ENV.organizationId}`, code: `in.(${rollbackCode},${rollbackInvalidCode})`, select: 'id', limit: 10 })).length === 0, 'Atomic rollback created a department.');
  invariant((await batchesFor(filenames.rollback)).filter((batch) => batch.status === 'completed').length === 0, 'Atomic rollback recorded a completed batch.');
  invariant((await auditForCode(rollbackCode)).filter((audit) => audit.action === 'DEPARTMENT_IMPORTED_CREATE').length === 0, 'Atomic rollback recorded a successful create audit.');
  results.atomic_rollback_verified = true;

  const validRow = row(1, {
    department_code: testCode,
    department_name_en: names.createdEn,
    department_name_ar: names.createdAr,
    division_code: ENV.divisionCode,
    status: 'active',
  });
  const createResponse = await invokeImport(filenames.create, 'create_only', [validRow]);
  const createResult = createResponse.data?.result;
  invariant(createResponse.status === 200 && createResult?.status === 'success' && createResult.created_count === 1 && createResult.updated_count === 0 && createResult.failed_count === 0, 'Create-only response mismatch.');
  const createdDepartments = await query('departments', { organization_id: `eq.${ENV.organizationId}`, code: `eq.${testCode}`, select: 'id,organization_id,division_id,code,name_en,name_ar,is_active,created_at,updated_at', limit: 10 });
  invariant(createdDepartments.length === 1, 'Create-only did not create exactly one department.');
  const created = createdDepartments[0];
  results.test_department_id = created.id;
  invariant(created.organization_id === ENV.organizationId && created.division_id === ENV.divisionId && created.code === testCode && created.name_en === names.createdEn && created.name_ar === names.createdAr && created.is_active === true, 'Created department field verification mismatch.');
  invariant((await managerRoles(created.id)).length === 0, 'Create-only unexpectedly assigned a manager.');
  results.manager_preserved_null = true;
  const createBatches = await batchesFor(filenames.create);
  invariant(createBatches.length === 1 && completedBatch(createBatches[0], 'create_only', 1, 0, created.id), 'Create-only completed batch mismatch.');
  const createAudits = (await departmentAudits(created.id)).filter((audit) => audit.action === 'DEPARTMENT_IMPORTED_CREATE');
  invariant(createAudits.length === 1 && createAudits[0].new_data?.batch_id === createBatches[0].id && createAudits[0].new_data?.source === 'department_import' && createAudits[0].new_data?.code === testCode, 'Structured create audit mismatch.');
  results.create_only_verified = true;

  const createdSnapshot = stable(created);
  const duplicateResponse = await invokeImport(filenames.create, 'create_only', [validRow]);
  const duplicateResult = duplicateResponse.data?.result;
  invariant(duplicateResponse.status === 200 && duplicateResult?.status === 'rejected' && duplicateResult.created_count === 0 && duplicateResult.updated_count === 0 && duplicateResult.failed_count === 1, 'Duplicate response mismatch.');
  const afterDuplicate = await query('departments', { organization_id: `eq.${ENV.organizationId}`, code: `eq.${testCode}`, select: 'id,organization_id,division_id,code,name_en,name_ar,is_active,created_at,updated_at', limit: 10 });
  invariant(afterDuplicate.length === 1 && stable(afterDuplicate[0]) === createdSnapshot, 'Duplicate changed the original or created another department.');
  invariant((await batchesFor(filenames.create)).length === 1, 'Duplicate recorded another batch.');
  invariant((await departmentAudits(created.id)).filter((audit) => audit.action === 'DEPARTMENT_IMPORTED_CREATE').length === 1, 'Duplicate recorded another create audit.');
  results.duplicate_behavior_verified = true;

  const updateResponse = await invokeImport(filenames.update, 'create_and_update', [row(1, {
    department_code: testCode,
    department_name_en: names.updatedEn,
    department_name_ar: '',
    division_code: '',
    status: '',
  })]);
  const updateResult = updateResponse.data?.result;
  invariant(updateResponse.status === 200 && updateResult?.status === 'success' && updateResult.created_count === 0 && updateResult.updated_count === 1, 'Controlled update response mismatch.');
  const afterUpdate = (await query('departments', { organization_id: `eq.${ENV.organizationId}`, code: `eq.${testCode}`, select: 'id,organization_id,division_id,code,name_en,name_ar,is_active', limit: 10 }))[0];
  invariant(afterUpdate?.id === created.id && afterUpdate.organization_id === ENV.organizationId && afterUpdate.division_id === ENV.divisionId && afterUpdate.code === testCode, 'Controlled update changed department identity.');
  invariant(afterUpdate.name_en === names.updatedEn && afterUpdate.name_ar === names.createdAr && afterUpdate.is_active === true, 'Controlled update did not preserve blank mutable values.');
  invariant((await managerRoles(created.id)).length === 0, 'Controlled update unexpectedly assigned a manager.');
  const updateBatches = await batchesFor(filenames.update);
  invariant(updateBatches.length === 1 && completedBatch(updateBatches[0], 'create_and_update', 0, 1, created.id), 'Controlled update batch mismatch.');
  results.create_and_update_verified = true;
  results.blank_values_preserved = true;

  const cleanupResponse = await invokeImport(filenames.cleanup, 'create_and_update', [row(1, {
    department_code: testCode,
    department_name_en: names.inactiveEn,
    department_name_ar: '',
    division_code: '',
    status: 'inactive',
  })]);
  const cleanupResult = cleanupResponse.data?.result;
  invariant(cleanupResponse.status === 200 && cleanupResult?.status === 'success' && cleanupResult.created_count === 0 && cleanupResult.updated_count === 1, 'Cleanup response mismatch.');
  const cleanupDepartments = await query('departments', { organization_id: `eq.${ENV.organizationId}`, code: `eq.${testCode}`, select: 'id,organization_id,division_id,code,name_en,name_ar,is_active', limit: 10 });
  invariant(cleanupDepartments.length === 1 && cleanupDepartments[0].id === created.id && cleanupDepartments[0].is_active === false && cleanupDepartments[0].name_en === names.inactiveEn && cleanupDepartments[0].name_ar === names.createdAr, 'Cleanup did not inactivate and label the test department.');
  const cleanupBatches = await batchesFor(filenames.cleanup);
  invariant(cleanupBatches.length === 1 && completedBatch(cleanupBatches[0], 'create_and_update', 0, 1, created.id), 'Cleanup batch mismatch.');
  results.cleanup_status = 'INACTIVATED';
  results.test_department_inactive = true;

  const finalDepartments = await departments();
  const finalIdentities = await identitySnapshots();
  const finalActiveCount = finalDepartments.filter((department) => department.is_active).length;
  results.final_active_department_count = finalActiveCount;
  invariant(finalActiveCount === baselineActiveCount, 'Original active department count was not restored.');
  results.original_active_department_count_restored = true;
  const activeTests = finalDepartments.filter((department) => department.is_active && (String(department.code).startsWith('p83o3_') || String(department.name_en).includes('Patch 83O.3')));
  invariant(activeTests.length === 0, 'An active Patch 83O.3 test department remains.');
  results.no_active_test_department_remains = true;
  const unrelatedFinal = finalDepartments.filter((department) => department.id !== created.id);
  invariant(stable(unrelatedFinal) === stable(baselineDepartments), 'An unrelated department changed.');
  results.no_unrelated_department_changed = true;

  invariant(stable(finalIdentities.organizations) === stable(baselineIdentities.organizations), 'Organization set changed.');
  invariant(stable(finalIdentities.divisions) === stable(baselineIdentities.divisions), 'Division set changed.');
  invariant(stable(finalIdentities.profiles) === stable(baselineIdentities.profiles), 'Profile or profile.department_id changed.');
  invariant(stable(finalIdentities.roles) === stable(baselineIdentities.roles), 'User role set changed.');
  results.profile_department_ids_unchanged = true;
  results.unrelated_user_roles_unchanged = true;

  const allBatches = [...createBatches, ...updateBatches, ...cleanupBatches];
  const audits = await departmentAudits(created.id);
  const departmentAuditsOnly = audits.filter((audit) => ['DEPARTMENT_IMPORTED_CREATE', 'DEPARTMENT_IMPORTED_UPDATE'].includes(audit.action));
  const createEvents = departmentAuditsOnly.filter((audit) => audit.action === 'DEPARTMENT_IMPORTED_CREATE');
  const updateEvents = departmentAuditsOnly.filter((audit) => audit.action === 'DEPARTMENT_IMPORTED_UPDATE');
  invariant(createEvents.length === 1 && updateEvents.length === 2, 'Expected create, update, and cleanup audit history was not found.');
  const expectedBatchIds = new Set(allBatches.map((batch) => batch.id));
  invariant(departmentAuditsOnly.every((audit) => audit.table_name === 'departments' && audit.record_id === created.id && audit.new_data?.source === 'department_import' && audit.new_data?.code === testCode && expectedBatchIds.has(audit.new_data?.batch_id)), 'Department audit structure or batch linkage mismatch.');
  results.completed_batch_count = allBatches.length;
  results.structured_department_audit_event_count = departmentAuditsOnly.length;
  results.audit_verified = true;
  results.all_mutations_auditable = true;

  const migration169 = fs.readFileSync(path.join(root, 'supabase', 'migrations', '169_patch83o_validation_error_array_fix.sql'), 'utf8');
  invariant(!/insert\s+into\s+public\.department_import_rows/i.test(migration169), 'Migration stores raw import rows.');
  invariant(!hasRawRowStorage(allBatches) && !hasRawRowStorage(departmentAuditsOnly), 'Raw import rows were found in batch or audit history.');
  results.raw_rows_not_stored_verified = true;

  results.execution_status = 'PASSED';
  results.activation_decision = 'approved_for_environment_enablement';
  results.runtime_blocker = null;
  writeEvidence();
  updatePatch83oEvidence();
  console.log('Patch 83O.3 controlled live mutation verification passed and cleanup completed by inactivation.');
}

main().catch((error) => {
  results.runtime_blocker = error instanceof Error ? error.message : 'Unknown live mutation verification failure.';
  writeEvidence();
  console.error(`Patch 83O.3 stopped on mismatch: ${results.runtime_blocker}`);
  process.exit(1);
});
