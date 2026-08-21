import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const patch83uMigration = 'supabase/migrations/174_patch83u_employee_id_auth_and_credential_governance.sql';

function source(relativePath: string) {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

function sqlFunction(sql: string, functionName: string) {
  const start = sql.indexOf(`create or replace function public.${functionName}(`);
  if (start < 0) throw new Error(`Missing SQL function: ${functionName}`);
  const end = sql.indexOf('\n$$;', start);
  if (end < 0) throw new Error(`Unterminated SQL function: ${functionName}`);
  return sql.slice(start, end + 4);
}

describe('Patch 83U credential governance contract', () => {
  it('fails closed when the central service-role guard sees a null role', () => {
    const migration = source(patch83uMigration);
    const guard = sqlFunction(migration, 'patch83u_require_service_role');

    expect(guard).toContain("auth.role() is distinct from 'service_role'");
    expect(guard).not.toContain("auth.role() <> 'service_role'");
    expect(guard).toContain('PATCH83U_SERVICE_ROLE_REQUIRED');
  });

  it('uses strict, absence-only legacy credential-version parsing at Edge and SQL boundaries', () => {
    const edge = source('supabase/functions/privileged-action/index.ts');
    const migration = source('supabase/migrations/174_patch83u_employee_id_auth_and_credential_governance.sql');

    expect(edge).toContain("Object.prototype.hasOwnProperty.call(metadata, 'credential_version')");
    expect(edge).toContain("typeof value === 'number'");
    expect(edge).toContain("typeof value === 'string' && /^[0-9]+$/.test(value)");
    expect(edge).toContain('patch83uCredentialVersionFromMetadata(claimAppMetadata)');
    expect(edge).not.toMatch(/Number\([^\n]*credential_version/);
    expect(migration).toContain('public.patch83u_auth_credential_version');
    expect(migration).toMatch(/patch83u_credential_access_allowed\(\)[\s\S]*patch83u_auth_credential_version\(\s*auth\.jwt\(\)\s*->\s*'app_metadata'\s*\)/);
  });

  it('keeps Employee ID login deterministic and derives only the controlled Auth alias', () => {
    const login = source('src/pages/LoginPage.tsx');
    expect(login).toContain("const EMPLOYEE_ID_LOGIN_DOMAIN = 'almodawat.sa'");
    expect(login).toMatch(/trimmed\.includes\('@'\)[\s\S]*`\$\{trimmed\}@\$\{EMPLOYEE_ID_LOGIN_DOMAIN\}`/);
    expect(login).toContain('.toLowerCase()');
  });

  it('exposes every credential action only through the authenticated privileged bridge', () => {
    const edge = source('supabase/functions/privileged-action/index.ts');
    const registry = source('src/lib/runtimeActionRegistry.ts');
    const migration = source(patch83uMigration);
    const frontend = [
      source('src/lib/userCredentialApi.ts'),
      source('src/lib/userManagementApi.ts'),
      source('src/pages/UserManagementCenter.tsx'),
    ].join('\n');
    const actions = [
      'patch83u_get_credential_state',
      'patch83u_list_provisioning',
      'patch83u_provision_account',
      'patch83u_reconcile_provisioning',
      'patch83u_reconcile_credential_state',
      'patch83u_change_required_password',
      'patch83u_admin_reset_password',
    ];

    for (const action of actions) {
      expect(edge).toContain(`'${action}'`);
      expect(registry).toContain(`'${action}'`);
    }
    for (const claimArgument of [
      'p_token_credential_version', 'p_token_email', 'p_session_id',
    ]) {
      expect(edge).toContain(claimArgument);
      expect(migration).toContain(claimArgument);
    }
    expect(migration).toContain('from auth.sessions');
    expect(frontend).not.toMatch(/service[_-]?role[_-]?(key|secret)|SUPABASE_SERVICE_ROLE/i);
    expect(frontend).not.toMatch(/\.auth\.admin\.|admin\.createUser|admin\.updateUserById|admin\.deleteUser/);
  });

  it('creates Auth users only in the Edge function with the exact Employee ID credentials', () => {
    const edge = source('supabase/functions/privileged-action/index.ts');
    const provisionBlock = edge.split("action === 'patch83u_provision_account'")[1]
      ?.split("action === 'patch83u_reconcile_provisioning'")[0] ?? '';

    expect(provisionBlock).toMatch(/@almodawat\.sa/);
    expect(provisionBlock).toMatch(/auth\.admin\.createUser/);
    expect(provisionBlock).toMatch(/password\s*:\s*employee(?:Id|No)/);
    expect(provisionBlock).toMatch(/email_confirm\s*:\s*true/);
    expect(provisionBlock).not.toMatch(/Math\.random|randomUUID\(\).*password|temporary_password\s*:/i);
    expect(provisionBlock).not.toMatch(/employee(?:Id|No)\.length\s*[<]=?\s*6|min(?:imum)?[^\n]{0,40}6/i);
  });

  it('maps hosted initial-password policy rejection without inventing or returning another password', () => {
    const edge = source('supabase/functions/privileged-action/index.ts');
    const migration = source(patch83uMigration);
    const message = 'The current Supabase Auth password policy does not accept this Employee ID as the initial password.';

    expect(edge).toContain(message);
    expect(edge).toContain('PATCH83U_INITIAL_PASSWORD_POLICY_BLOCKED');
    expect(edge).toMatch(/initialPasswordPolicyBlocked[\s\S]*p_reconciliation_required:\s*reconciliationRequired/);
    expect(migration).toContain("'policy_blocked'");
    expect(edge).not.toMatch(/generate[^\n]{0,80}password|fallback[^\n]{0,80}password/i);
  });

  it('never deletes a newly created Auth identity after finalization is attempted and routes ambiguous proof to reconciliation', () => {
    const edge = source('supabase/functions/privileged-action/index.ts');
    const provisionBlock = edge.split("action === 'patch83u_provision_account'")[1]
      ?.split("action === 'patch83u_reconcile_provisioning'")[0] ?? '';
    const finalizeAttempt = provisionBlock.indexOf('finalizeAttempted = true');
    const reconciliationBeforeFinalize = provisionBlock.indexOf('reconciliationRequired = true', finalizeAttempt);
    const finalizeRpc = provisionBlock.indexOf("serviceClient.rpc('patch83u_finalize_provisioning'", finalizeAttempt);
    const proofCheck = provisionBlock.indexOf("String(finalized.provisioning_id ?? '') !== provisioningId", finalizeRpc);
    const reconciliationCleared = provisionBlock.indexOf('reconciliationRequired = false', proofCheck);
    const rollbackGuard = provisionBlock.indexOf('if (!finalizeAttempted && createdAuthUserId');
    const deleteAuthUser = provisionBlock.indexOf('auth.admin.deleteUser(createdAuthUserId)', rollbackGuard);

    expect(provisionBlock).toContain('let finalizeAttempted = false');
    expect(finalizeAttempt).toBeGreaterThan(-1);
    expect(reconciliationBeforeFinalize).toBeGreaterThan(finalizeAttempt);
    expect(finalizeRpc).toBeGreaterThan(reconciliationBeforeFinalize);
    expect(proofCheck).toBeGreaterThan(finalizeRpc);
    expect(reconciliationCleared).toBeGreaterThan(proofCheck);
    expect(rollbackGuard).toBeGreaterThan(finalizeRpc);
    expect(deleteAuthUser).toBeGreaterThan(rollbackGuard);
    expect(provisionBlock.match(/auth\.admin\.deleteUser\(createdAuthUserId\)/g)).toHaveLength(1);
    expect(provisionBlock).toMatch(/if \(!finalizeAttempted && createdAuthUserId[\s\S]*auth\.admin\.deleteUser\(createdAuthUserId\)/);
    expect(provisionBlock).toMatch(/String\(finalized\.profile_id \?\? ''\) !== authUserId/);
    expect(provisionBlock).toMatch(/String\(finalized\.provisioning_status \?\? ''\) !== 'initial_change_required'/);
    expect(provisionBlock).toMatch(/String\(finalized\.credential_state \?\? ''\) !== 'initial_change_required'/);
    expect(provisionBlock).toContain('patch83uStrictResponseInteger(finalized.credential_version) !== 1');
    expect(provisionBlock).toContain('finalized.must_change_password !== true');
    expect(provisionBlock).toContain("throw new Error('PATCH83U_PROVISIONING_FINALIZE_PROOF_FAILED')");
    expect(provisionBlock).toMatch(/patch83u_fail_provisioning[\s\S]*p_reconciliation_required:\s*reconciliationRequired/);
  });

  it('keeps managed Employee ID and Auth alias identities immutable and consistent', () => {
    const migration = source(patch83uMigration);
    const finalizeProvisioning = sqlFunction(migration, 'patch83u_finalize_provisioning');
    const legacyBackfillStart = migration.indexOf('-- Legacy compatibility and lifecycle synchronization');
    const legacyBackfillEnd = migration.indexOf(
      'insert into public.user_credential_events (',
      legacyBackfillStart,
    );
    const legacyBackfill = migration.slice(legacyBackfillStart, legacyBackfillEnd);

    expect(migration).toMatch(/identity_mode text not null[\s\S]*'legacy_verified'[\s\S]*'employee_id_managed'[\s\S]*'unverified'/);
    expect(legacyBackfill).toContain('u.email_confirmed_at is not null');
    expect(legacyBackfill).toContain('u.deleted_at is null');
    expect(legacyBackfill).toContain('(u.banned_until is null or u.banned_until <= now())');
    expect(legacyBackfill).toContain('public.patch83u_auth_credential_version(u.raw_app_meta_data) = 0');
    expect(legacyBackfill.match(/select count\(\*\)[\s\S]*?from auth\.identities ai/g)).toHaveLength(4);
    expect(legacyBackfill).toMatch(/ai\.provider = 'email'[\s\S]*lower\(btrim\(coalesce\(ai\.identity_data ->> 'email', ''\)\)\)[\s\S]*= lower\(btrim\(u\.email\)\)[\s\S]*then 'legacy_verified'/);
    expect(legacyBackfill).toContain("then 'existing_password_rotation_pending'");
    expect(legacyBackfill).toContain("then 'reconciliation_required'");
    expect(finalizeProvisioning).toContain("'employee_id_managed'");
    expect(migration).toContain('patch83u_guard_managed_profile_employee_id');
    expect(migration).toContain('PATCH83U_MANAGED_EMPLOYEE_ID_IMMUTABLE');
    expect(migration).toContain('patch83u_guard_credential_identity');
    expect(migration).toContain('PATCH83U_MANAGED_AUTH_IDENTITY_MISMATCH');
    expect(migration).toMatch(/new\.auth_email <> public\.patch83u_expected_auth_email\(v_employee_id\)/);
  });

  it('keeps global roles nullable-or-exact organization bound and all non-global roles exact-org bound', () => {
    const migration = source(patch83uMigration);
    const roleScope = sqlFunction(migration, 'patch83u_role_scope_allowed');
    const validator = sqlFunction(migration, 'patch83u_role_assignment_valid');
    const roleScopeDefinition = migration.indexOf('create or replace function public.patch83u_role_scope_allowed(');
    const roleAssignmentDefinition = migration.indexOf('create or replace function public.patch83u_role_assignment_valid(');
    const firstEligibilityCaller = migration.indexOf('create or replace function public.patch83u_bootstrap_super_admin_eligible(');

    expect(roleScopeDefinition).toBeGreaterThan(-1);
    expect(roleAssignmentDefinition).toBeGreaterThan(roleScopeDefinition);
    expect(firstEligibilityCaller).toBeGreaterThan(roleAssignmentDefinition);
    expect(migration.match(/create or replace function public\.patch83u_role_scope_allowed\(/g)).toHaveLength(1);
    expect(migration.match(/create or replace function public\.patch83u_role_assignment_valid\(/g)).toHaveLength(1);
    expect(roleScope).toMatch(/division_head'[\s\S]*p_scope = 'division'/);
    expect(roleScope).toMatch(/department_manager'[\s\S]*p_scope = 'department'/);
    expect(roleScope).toMatch(/project_owner'[\s\S]*p_scope = 'assigned_only'/);
    expect(roleScope).toContain('select coalesce(case');
    expect(validator).toContain('p_organization_id is null or p_scope is null');
    expect(validator).toMatch(/p_scope = 'global'[\s\S]*p_role_organization_id is null or p_role_organization_id = p_organization_id/);
    expect(validator).toMatch(/p_scope = 'global'[\s\S]*p_division_id is null[\s\S]*p_department_id is null[\s\S]*p_unit_id is null/);
    expect(validator).toMatch(/p_role_organization_id is distinct from p_organization_id[\s\S]*return false/);
  });

  it('routes generic role assignment and deactivation through Patch 83U tenant-safe database boundaries', () => {
    const edge = source('supabase/functions/privileged-action/index.ts');
    const migration = source(patch83uMigration);
    const assignBlock = edge.split("if (action === 'assign_user_role' || action === 'patch19_assign_user_role')")[1]
      ?.split("if (action === 'deactivate_user_role')")[0] ?? '';
    const deactivateBlock = edge.split("if (action === 'deactivate_user_role')")[1]
      ?.split("if (action.startsWith('v99_'))")[0] ?? '';
    const assignSql = sqlFunction(migration, 'patch83u_assign_user_role');
    const deactivateSql = sqlFunction(migration, 'patch83u_deactivate_user_role');

    expect(assignBlock).toContain("serviceClient.rpc('patch83u_assign_user_role'");
    expect(assignBlock).toContain('patch83uRoleScopeAllowed(role, scope)');
    expect(assignBlock).toContain('PATCH83U_ROLE_ASSIGNMENT_PROOF_FAILED');
    expect(assignBlock).not.toContain('v72_execute_privileged_action');
    expect(deactivateBlock).toContain("serviceClient.rpc('patch83u_deactivate_user_role'");
    expect(deactivateBlock).toContain('PATCH83U_ROLE_DEACTIVATION_PROOF_FAILED');
    expect(deactivateBlock).not.toContain('v72_execute_privileged_action');
    expect(assignSql).toContain('public.patch83u_role_assignment_valid');
    expect(assignSql).toContain('public.patch83u_role_scope_allowed');
    expect(assignSql).toMatch(/p_target_user_id[\s\S]*organization_id[\s\S]*for update/i);
    expect(deactivateSql).toContain('PATCH83U_SELF_ROLE_DEACTIVATION_DENIED');
    expect(deactivateSql).toMatch(/super_admin[\s\S]*last|last[\s\S]*super_admin/i);
  });

  it('routes canonical user lifecycle changes through the service-only Patch 83U proof boundary', () => {
    const edge = source('supabase/functions/privileged-action/index.ts');
    const migration = source(patch83uMigration);
    const ui = source('src/pages/UserManagementCenter.tsx');
    const lifecycleSql = sqlFunction(migration, 'patch83u_apply_user_lifecycle');
    const roleActivationGuard = sqlFunction(migration, 'patch83u_guard_role_activation');
    const lifecycleEdgeStart = edge.indexOf('if (patch19LifecycleActions.has(action)) {');
    const genericPatch19Start = edge.indexOf("if (action.startsWith('patch19_')) {", lifecycleEdgeStart);
    const lifecycleEdge = edge.slice(lifecycleEdgeStart, genericPatch19Start);
    const provisioningGuard = lifecycleSql.indexOf('from public.user_account_provisioning q');
    const profileUpdate = lifecycleSql.indexOf('update public.profiles');
    const actionMenu = ui.split("<Building2 size={14} /> {t('userManagement.assignDepartmentSingle')}")[1]
      ?.split("<Download size={14} /> {t('userManagement.exportUser')}")[0] ?? '';
    const reactivateLabel = actionMenu.indexOf("t('userManagement.reactivateUser')");
    const archivedGuard = actionMenu.indexOf('actionMenuUser.user_status === "archived"');

    expect(lifecycleSql).toMatch(/begin\s+perform public\.patch83u_require_service_role\(\);/);
    expect(lifecycleSql.indexOf('patch83u_require_service_role()'))
      .toBeLessThan(lifecycleSql.indexOf('p_action not in'));
    expect(lifecycleSql).toMatch(/p_action is null or p_action not in \(\s*'patch19_deactivate_user',\s*'patch19_reactivate_user',\s*'patch19_archive_user',\s*'patch19_unarchive_user'/);
    expect(lifecycleSql).toContain('public.patch83u_require_role_admin(p_actor_id)');
    expect(lifecycleSql).toContain("'patch83u-super-admin-eligibility:' || v_org_id::text");
    expect(lifecycleSql).toContain('PATCH83U_LIFECYCLE_ADMIN_ORGANIZATION_CHANGED');
    expect(lifecycleSql).toContain('PATCH83U_SELF_LIFECYCLE_DEACTIVATION_DENIED');
    expect(lifecycleSql).toContain('PATCH83U_PRIVILEGED_LIFECYCLE_REQUIRES_SUPER_ADMIN');
    expect(lifecycleSql).toContain('PATCH83U_PROFILE_LIFECYCLE_INCONSISTENT');
    expect(lifecycleSql).toMatch(/v_target\.user_status in \('active', 'invited'\)[\s\S]*v_target\.deactivated_at is not null[\s\S]*v_target\.user_status in \('inactive', 'archived', 'locked'\)[\s\S]*v_target\.deactivated_at is null/);
    expect(lifecycleSql).toMatch(/patch19_reactivate_user'[\s\S]*v_target\.user_status not in \('inactive', 'locked'\)/);
    expect(lifecycleSql).toMatch(/patch19_unarchive_user'[\s\S]*v_target\.user_status <> 'archived'/);
    expect(lifecycleSql).toMatch(/if v_expected_active and exists \([\s\S]*ur\.is_active = true[\s\S]*PATCH83U_LIFECYCLE_ACTIVE_ROLE_DRIFT/);
    expect(provisioningGuard).toBeGreaterThan(-1);
    expect(provisioningGuard).toBeLessThan(profileUpdate);
    expect(lifecycleSql).toMatch(/q\.profile_id = p_target_user_id[\s\S]*q\.organization_id = v_org_id[\s\S]*q\.provisioning_status not in \('completed', 'cancelled'\)[\s\S]*PATCH83U_LIFECYCLE_OPEN_PROVISIONING_DENIED/);
    expect(lifecycleSql).not.toMatch(/(?:update|insert into|delete from) public\.user_account_provisioning/i);
    expect(lifecycleSql).toContain("set_config('request.jwt.claim.sub', p_actor_id::text, true)");
    expect(lifecycleSql).not.toContain("set_config('request.jwt.claim.role'");
    expect(lifecycleSql).toMatch(/update public\.profiles[\s\S]*user_status = v_next_status[\s\S]*is_active = v_expected_active[\s\S]*deactivated_by = case[\s\S]*deactivation_reason = case/);
    expect(lifecycleSql).toContain('PATCH83U_LIFECYCLE_CREDENTIAL_EVENT_PROOF_FAILED');
    expect(lifecycleSql).toContain('insert into public.role_change_audit');
    expect(lifecycleSql).toContain('PATCH83U_LIFECYCLE_ACTIVE_ROLE_PROOF_FAILED');
    expect(lifecycleSql).toContain('insert into public.user_management_audit_history');
    for (const field of [
      'user_id', 'organization_id', 'action', 'audit_action', 'user_status',
      'is_active', 'credential_state', 'requested_lifecycle',
      'deactivated_role_count', 'role_audit_record_count',
      'remaining_active_role_count', 'reactivated_role_count', 'audit_id',
      'audit_record_count', 'credential_event_records', 'linked_record_count',
    ]) {
      expect(lifecycleSql).toContain(`'${field}'`);
    }
    expect(roleActivationGuard).toMatch(/from public\.profiles p[\s\S]*for share;/);

    expect(lifecycleEdgeStart).toBeGreaterThan(-1);
    expect(genericPatch19Start).toBeGreaterThan(lifecycleEdgeStart);
    expect(lifecycleEdge).toContain("serviceClient.rpc('patch83u_apply_user_lifecycle'");
    expect(lifecycleEdge).toContain('PATCH83U_USER_LIFECYCLE_PROOF_FAILED');
    expect(lifecycleEdge).not.toContain('patch19_user_management_bridge');
    expect(lifecycleEdge).toMatch(/expected\.active[\s\S]*remainingActiveRoleCount !== 0/);
    for (const count of [
      'deactivatedRoleCount', 'roleAuditRecordCount', 'remainingActiveRoleCount',
      'reactivatedRoleCount', 'auditRecordCount', 'credentialEventRecords',
      'linkedRecordCount',
    ]) {
      expect(lifecycleEdge).toContain(`${count} < 0`);
    }

    expect(reactivateLabel).toBeGreaterThan(-1);
    expect(actionMenu.lastIndexOf('actionMenuUser.user_status === "inactive"', reactivateLabel))
      .toBeGreaterThan(-1);
    expect(actionMenu.lastIndexOf('actionMenuUser.user_status === "locked"', reactivateLabel))
      .toBeGreaterThan(-1);
    expect(archivedGuard).toBeGreaterThan(reactivateLabel);
    expect(actionMenu.slice(reactivateLabel, archivedGuard)).toContain(') : null}');
    expect(actionMenu.slice(archivedGuard)).toContain("t('userManagement.unarchiveUser')");
  });

  it('limits the controlled lifecycle marker to exact service-only terminal activation', () => {
    const migration = source(patch83uMigration);
    const sync = sqlFunction(migration, 'patch83u_sync_profile_credential_lifecycle');
    const lifecycleSql = sqlFunction(migration, 'patch83u_apply_user_lifecycle');
    const markerStart = sync.indexOf("current_setting('patch83u.controlled_lifecycle_transition'");
    const genericLifecycleStart = sync.indexOf('if (new.user_status is distinct from old.user_status', markerStart);
    const markerBranch = sync.slice(markerStart, genericLifecycleStart);

    expect(markerStart).toBeGreaterThan(-1);
    expect(genericLifecycleStart).toBeGreaterThan(markerStart);
    expect(markerBranch).toContain("auth.role() is distinct from 'service_role'");
    expect(markerBranch).toContain("new.user_status <> 'active'");
    expect(markerBranch).toContain('new.is_active is distinct from true');
    expect(markerBranch).toMatch(/update public\.user_credential_states[\s\S]*requested_lifecycle = 'active'[\s\S]*user_id = new\.id[\s\S]*organization_id = new\.organization_id/);
    expect(markerBranch).toContain('get diagnostics v_controlled_update_count = row_count');
    expect(markerBranch).toContain('PATCH83U_CONTROLLED_LIFECYCLE_STATE_PROOF_FAILED');
    expect(markerBranch).toContain('return new;');
    expect(markerBranch).not.toContain('credential_state =');
    expect(markerBranch).not.toContain('session_valid_after =');
    expect(markerBranch).not.toContain('insert into public.user_credential_events');
    expect(lifecycleSql).not.toContain('patch83u.controlled_lifecycle_transition');
    expect(migration.match(/set_config\('patch83u\.controlled_lifecycle_transition', 'on', true\)/g))
      .toHaveLength(2);
    expect(migration.match(/set_config\('patch83u\.controlled_lifecycle_transition', 'off', true\)/g))
      .toHaveLength(2);
  });

  it('restricts direct authenticated user-role mutations to canonical same-tenant administrators', () => {
    const migration = source(patch83uMigration);
    const decision = sqlFunction(migration, 'patch83u_user_role_mutation_allowed');

    expect(decision).toContain('actor.id <> p_target_user_id');
    expect(decision).toMatch(/target\.organization_id = actor\.organization_id/);
    expect(decision).toContain('public.patch83u_credential_access_allowed()');
    expect(decision).toMatch(/actor_role\.role in \('super_admin', 'governance_admin'\)[\s\S]*actor_role\.scope = 'global'/);
    expect(decision).toMatch(/actor_role\.organization_id is null or actor_role\.organization_id = actor\.organization_id/);
    expect(decision).toMatch(/actor_role\.division_id is null[\s\S]*actor_role\.department_id is null[\s\S]*actor_role\.unit_id is null/);
    expect(decision).toMatch(/p_role not in \('super_admin', 'executive', 'governance_admin'\)[\s\S]*actor_role\.role = 'super_admin'/);
    expect(decision).toContain('public.patch83u_role_assignment_valid');
    expect(decision).toContain('public.patch83u_role_scope_allowed(p_role, p_scope)');
    for (const policy of [
      'patch83u_user_roles_insert_gate',
      'patch83u_user_roles_update_gate',
      'patch83u_user_roles_delete_gate',
    ]) {
      expect(migration).toContain(policy);
    }
    expect(migration).toMatch(/patch83u_user_roles_insert_gate[\s\S]*as restrictive for insert to authenticated[\s\S]*patch83u_user_role_mutation_allowed/);
    expect(migration).toMatch(/patch83u_user_roles_update_gate[\s\S]*as restrictive for update to authenticated[\s\S]*patch83u_user_role_mutation_allowed/);
    expect(migration).toMatch(/patch83u_user_roles_delete_gate[\s\S]*as restrictive for delete to authenticated[\s\S]*patch83u_user_role_mutation_allowed/);
    expect(migration).toMatch(/grant execute on function public\.patch83u_user_role_mutation_allowed\([\s\S]*to authenticated;/);
  });

  it('fails closed on active role/scope drift at the trigger and authenticated session boundary', () => {
    const migration = source(patch83uMigration);
    const guard = sqlFunction(migration, 'patch83u_guard_role_activation');
    const activationBlockers = sqlFunction(migration, 'patch83u_runtime_activation_blockers');
    const authProvider = source('src/auth/AuthProvider.tsx');

    expect(guard).toContain('public.patch83u_role_scope_allowed(new.role, new.scope)');
    expect(guard).toContain('PATCH83U_ACTIVE_ROLE_SCOPE_NOT_ALLOWED');
    expect(activationBlockers).toContain('v_invalid_active_role_assignments');
    expect(activationBlockers).toContain('public.patch83u_role_scope_allowed(ur.role, ur.scope)');
    expect(activationBlockers).toContain('public.patch83u_role_assignment_valid');
    expect(activationBlockers).toContain("'invalid_active_role_assignments', v_invalid_active_role_assignments");
    expect(activationBlockers).toContain("'invalid_profile_lifecycle_rows', v_invalid_profile_lifecycle_rows");
    expect(authProvider).toContain('isRoleScopeAllowed(source.role, source.scope)');
    expect(authProvider).toMatch(/division_head'[\s\S]*scope === 'division'/);
  });

  it('protects the last runtime-eligible Super Admin from profile lifecycle removal', () => {
    const migration = source(patch83uMigration);
    const guard = sqlFunction(migration, 'patch83u_guard_profile_security_boundary');
    const eligibilityCheck = guard.indexOf('patch83u_runtime_super_admin_eligible(old.id, old.organization_id)');
    const serviceRoleReturn = guard.indexOf("if auth.role() = 'service_role' then");

    expect(eligibilityCheck).toBeGreaterThan(-1);
    expect(serviceRoleReturn).toBeGreaterThan(eligibilityCheck);
    expect(guard).toContain("'patch83u-super-admin-eligibility:' || old.organization_id::text");
    expect(guard).toContain("current_setting('patch83u.super_admin_batch_guard_verified', true)");
    expect(guard).toContain("v_marker <> old.organization_id::text || ':' || coalesce(auth.uid()::text, '')");
    expect(guard).toContain('ur.user_id <> old.id');
    expect(guard).toContain("ur.role = 'super_admin'");
    expect(guard).toContain("ur.scope = 'global'");
    expect(guard).toContain('public.patch83u_runtime_super_admin_eligible');
    expect(guard).toContain('PATCH83U_LAST_SUPER_ADMIN_PROFILE_DEACTIVATION_DENIED');
    expect(guard).toMatch(/new\.organization_id is distinct from old\.organization_id[\s\S]*PATCH83U_PROFILE_ORGANIZATION_IMMUTABLE/);
    expect(guard).not.toContain('patch83u.controlled_organization_change');
  });

  it('normalizes and protects profile lifecycle audit metadata at the database boundary', () => {
    const migration = source(patch83uMigration);
    const guard = sqlFunction(migration, 'patch83u_guard_profile_security_boundary');
    const api = source('src/lib/userManagementApi.ts');
    const compatibilityFallback = api.split('async function updateLifecycleViaCompatibility')[1]
      ?.split('type LifecycleCompatibilityAction')[0] ?? '';

    expect(guard).toContain('PATCH83U_DIRECT_DEACTIVATION_METADATA_CHANGE_DENIED');
    expect(guard).toContain('PATCH83U_PROFILE_DEACTIVATION_METADATA_INCONSISTENT');
    expect(guard).toContain("if tg_op = 'INSERT' then");
    expect(guard).toMatch(/if tg_op = 'INSERT' then[\s\S]*auth\.role\(\) is distinct from 'service_role'[\s\S]*PATCH83U_PROFILE_INSERT_SERVICE_ROLE_REQUIRED[\s\S]*new\.user_status not in/);
    expect(guard).toMatch(/new\.user_status in \('active', 'invited'\)[\s\S]*new\.deactivated_at := null;[\s\S]*new\.deactivated_by := null;[\s\S]*new\.deactivation_reason := null;/);
    expect(guard).toMatch(/auth\.role\(\) is distinct from 'service_role'[\s\S]*new\.deactivated_at := pg_catalog\.statement_timestamp\(\);[\s\S]*new\.deactivated_by := auth\.uid\(\);/);
    expect(guard).toMatch(/deactivation_actor\.id = new\.deactivated_by[\s\S]*deactivation_actor\.organization_id = new\.organization_id/);
    expect(migration).toMatch(/before insert or update of organization_id, user_status, is_active,\s*deactivated_at, deactivated_by, deactivation_reason\s*on public\.profiles/);
    expect(migration).toMatch(/create policy patch83u_profile_credential_insert_gate\s+on public\.profiles as restrictive for insert to authenticated[\s\S]*?with check \(false\);/);
    expect(compatibilityFallback).toContain('supabase.auth.getUser()');
    expect(compatibilityFallback).toContain('deactivated_by: deactivatedBy');
    expect(compatibilityFallback).toContain('deactivated_at: null');
    expect(compatibilityFallback).not.toContain('new Date().toISOString()');
  });

  it('counts only emergency-access-compatible legacy Super Admins for break glass', () => {
    const migration = source(patch83uMigration);
    const breakGlass = sqlFunction(migration, 'patch83u_break_glass_super_admin_eligible');

    expect(breakGlass).toContain('join public.user_credential_states cs on cs.user_id = p.id');
    expect(breakGlass).toContain("cs.identity_mode = 'legacy_verified'");
    expect(breakGlass).toContain("cs.credential_state <> 'disabled'");
    expect(breakGlass).toContain('lower(btrim(u.email)) = cs.auth_email');
    expect(breakGlass).toContain('public.patch83u_auth_credential_version(u.raw_app_meta_data) = cs.credential_version');
    expect(breakGlass).toContain("ai.provider = 'email'");
  });

  it('replays the historical runtime state version instead of the current singleton version', () => {
    const migration = source(patch83uMigration);
    const transition = sqlFunction(migration, 'patch83u_transition_runtime');

    expect(transition).toContain("'resulting_state_version', v_runtime.state_version + 1");
    expect(transition).toContain("'state_version', (v_existing.details ->> 'resulting_state_version')::integer");
    expect(transition).toContain('v_existing.event_type = p_target_state');
    expect(transition).toContain('v_existing.confirmation_code = v_expected_confirmation');
    expect(transition).toContain('v_existing.reason = btrim(p_reason)');
    expect(transition).toMatch(/p_target_state is null\s+or p_target_state not in/);
    expect(transition).toContain("jsonb_typeof(v_existing.details -> 'resulting_state_version') = 'number'");
    expect(transition).not.toMatch(/'state_version',\s*v_runtime\.state_version,\s*'idempotent_replay',\s*true/);
  });

  it('makes runtime, credential, and deployment compatibility decisions total and fail closed', () => {
    const migration = source(patch83uMigration);
    const requireEnforced = sqlFunction(migration, 'patch83u_require_enforced_runtime');
    const runtimeCredential = sqlFunction(migration, 'patch83u_runtime_credential_state_allowed');
    const capabilities = sqlFunction(migration, 'patch83u_get_capabilities');

    expect(requireEnforced).toContain(
      "public.patch83u_runtime_enforcement_state() is distinct from 'enforced'",
    );
    expect(runtimeCredential).toContain('select coalesce(case');
    expect(capabilities).toContain(
      'p_edge_contract_version is not distinct from v_runtime.expected_edge_contract_version',
    );
    expect(capabilities).toContain(
      'p_frontend_contract_version is not distinct from v_runtime.expected_frontend_contract_version',
    );
    expect(capabilities).toContain(
      'p_edge_contract_version is distinct from v_runtime.expected_edge_contract_version',
    );
    expect(capabilities).toContain(
      'p_frontend_contract_version is distinct from v_runtime.expected_frontend_contract_version',
    );
    expect(capabilities).not.toMatch(/p_(?:edge|frontend)_contract_version <>/);
  });

  it('requires exact reconciliation response proof before Edge reports success', () => {
    const edge = source('supabase/functions/privileged-action/index.ts');
    const provisioningBlock = edge.split("if (action === 'patch83u_reconcile_provisioning')")[1]
      ?.split("if (action === 'patch83u_change_required_password')")[0] ?? '';
    const credentialBlock = edge.split("if (action === 'patch83u_reconcile_credential_state')")[1]
      ?.split("if (action === 'list_user_management_roster')")[0] ?? '';

    expect(provisioningBlock).toContain("String(reconciled.provisioning_id ?? '') !== provisioningId");
    expect(provisioningBlock).toContain("typeof reconciled.reconciliation_required !== 'boolean'");
    expect(provisioningBlock).toContain('PATCH83U_PROVISIONING_RECONCILIATION_PROOF_FAILED');
    expect(credentialBlock).toContain("String(reconciled.user_id ?? '') !== targetUserId");
    expect(credentialBlock).toContain("typeof reconciliationRequired !== 'boolean'");
    expect(credentialBlock).toContain('PATCH83U_CREDENTIAL_RECONCILIATION_PROOF_FAILED');
    expect(`${provisioningBlock}\n${credentialBlock}`).toContain('mutation may already have committed');
  });

  it('does not manufacture a canonical Auth email when protected credential proof is unavailable', () => {
    const edge = source('supabase/functions/privileged-action/index.ts');
    const api = source('src/lib/userManagementApi.ts');
    const ui = source('src/pages/UserManagementCenter.tsx');
    const i18n = source('src/i18n/I18nContext.tsx');
    const workbook = source('src/utils/userWorkbook.ts');

    expect(edge).toContain('credential_proof_available: Boolean(credential)');
    expect(edge).toContain("['employee_id_managed', 'legacy_verified'].includes(String(credential?.identity_mode ?? ''))");
    expect(edge).not.toContain('auth_email: safeString(credential?.auth_email, safeString(profile.email))');
    expect(api).toContain('credential_proof_available: false');
    expect(api).toContain("credential_proof_available: row.credential_proof_available === true");
    expect(api).not.toContain('auth_email: safeString(row.auth_email, safeString(row.email))');
    expect(ui).toContain('!actionMenuUser.credential_proof_available');
    expect(ui).toContain("t('userManagement.identityUnavailable')");
    expect(i18n).toContain("en: 'Identity mode: Unavailable (credential proof required)'");
    expect(workbook).toContain("row.auth_email ?? ''");
  });

  it('enforces forced password change before application authorization', () => {
    const credentialApi = source('src/lib/userCredentialApi.ts');
    const authProvider = source('src/auth/AuthProvider.tsx');
    const app = source('src/App.tsx');

    for (const state of [
      'initial_change_required',
      'admin_reset_change_required',
      'reactivation_change_required',
      'existing_password_change_required',
    ]) expect(credentialApi).toContain(`'${state}'`);
    expect(credentialApi).toMatch(/PASSWORD_CHANGE_STATES[\s\S]*existing_password_change_required/);
    expect(credentialApi).toMatch(/PASSWORD_CHANGE_STATES\.has\(state\.credential_state\)[\s\S]*gate: 'password_change_required'/);
    expect(credentialApi).toContain("gate: 'password_change_required'");
    expect(credentialApi).toContain("gate: 'blocked'");
    expect(authProvider).toContain("'authenticated_password_change_required'");
    expect(authProvider).toContain("credentialState: 'password_change_required'");
    expect(authProvider).toMatch(/decision\.gate === 'blocked'/);
    expect(app).toMatch(/auth\.status === ["']authenticated_password_change_required["'][\s\S]*<ForcedPasswordChange \/>/);
  });

  it('fails closed for both a missing migration and all other credential-state verification errors', () => {
    const edge = source('supabase/functions/privileged-action/index.ts');
    const errorGate = edge.split('if (credentialStateResult.error) {')[1]
      ?.split('credentialState = (credentialStateResult.data ?? {})')[0] ?? '';

    expect(edge).toContain('isMissingPatch83uCredentialContract');
    expect(edge).toMatch(/\['PGRST202', '42883'\]\.includes\(code\)/);
    expect(edge).toMatch(/!isMissingPatch83uCredentialContract\(credentialStateResult\.error\)[\s\S]*PATCH83U_CREDENTIAL_STATE_UNAVAILABLE/);
    expect(edge).toMatch(/PATCH83U_CREDENTIAL_STATE_UNAVAILABLE[\s\S]*Access remains denied/);
    expect(errorGate).toContain('PATCH83U_CREDENTIAL_MIGRATION_REQUIRED');
    expect(errorGate.match(/503/g)?.length).toBe(2);
    expect(errorGate).not.toContain('jsonResponse({ ok: true');
  });

  it('requires exact Super Admin reset proof, checks session absence without target sign-in, and never persists a password', () => {
    const edge = source('supabase/functions/privileged-action/index.ts');
    const ui = source('src/pages/UserManagementCenter.tsx');
    const i18n = source('src/i18n/I18nContext.tsx');
    const credentialApi = source('src/lib/userCredentialApi.ts');
    const migration = source(patch83uMigration);
    const resetBlock = edge.split("if (action === 'patch83u_admin_reset_password')")[1]
      ?.split("if (action === 'patch83u_reconcile_credential_state')")[0] ?? '';
    const sessionProof = sqlFunction(migration, 'patch83u_admin_reset_session_revocation_proof');

    expect(ui).toMatch(/temporary password/i);
    expect(ui).toMatch(/confirm temporary password/i);
    expect(ui).toContain('Type {ADMIN_RESET_CONFIRMATION_TEXT} exactly');
    expect(credentialApi).toContain("ADMIN_RESET_CONFIRMATION_TEXT = 'RESET USER PASSWORD'");
    expect(credentialApi).toContain("ADMIN_RESET_CONFIRMATION = 'PATCH83U_RESET_USER_PASSWORD'");
    expect(credentialApi).toContain('confirmation: ADMIN_RESET_CONFIRMATION');
    expect(credentialApi).toContain("'patch83u_admin_reset_password'");
    expect(edge).toContain("resetConfirmation !== 'PATCH83U_RESET_USER_PASSWORD'");
    expect(edge).toContain('p_confirmation: resetConfirmation');
    expect(migration).toContain("p_confirmation text");
    expect(migration).toContain("p_confirmation is distinct from 'PATCH83U_RESET_USER_PASSWORD'");
    expect(resetBlock).toContain('auth.admin.updateUserById');
    expect(resetBlock).not.toContain('signInWithPassword');
    expect(resetBlock).toMatch(/updateResult\.error \|\| !updateResult\.data\.user[\s\S]*followUpAuthLookup[\s\S]*auth\.admin\.getUserById\(targetUserId\)/);
    expect(resetBlock).toContain("'patch83u_admin_reset_session_revocation_proof'");
    expect(sessionProof).toMatch(/language plpgsql\s+stable\s+security definer/);
    expect(sessionProof).toContain('perform public.patch83u_require_enforced_runtime()');
    expect(sessionProof).toContain('v_org_id := public.patch83u_require_super_admin(p_actor_id)');
    expect(sessionProof).toMatch(/v_sessions_revoked := not exists \([\s\S]*from auth\.sessions s where s\.user_id = p_target_user_id/);
    expect(sessionProof).not.toMatch(/\b(?:insert|update|delete|truncate)\s+(?:into|from|public\.|auth\.)/i);
    expect(edge).toMatch(/patch83u_change_required_password[\s\S]*auth\.admin\.signOut\([\s\S]*['"]global['"]/i);
    expect(migration).toMatch(/admin_reset[\s\S]*(credential_version|session_valid_after)/i);
    expect(migration).toContain('invalidated_session_id');
    expect(migration).toContain('PATCH83U_ACTIVE_SUPER_ADMIN_REQUIRED');
    expect(migration).toContain('PATCH83U_SELF_RESET_DENIED');
    expect(migration).toContain('PATCH83U_LAST_SUPER_ADMIN_RESET_DENIED');
    expect(migration).toContain('PATCH83U_AUTH_SESSIONS_STILL_ACTIVE');
    expect(migration).not.toContain('planned_auth_user_id');
    const resetSignature = migration.slice(
      migration.indexOf('public.patch83u_begin_admin_reset('),
      migration.indexOf('returns jsonb', migration.indexOf('public.patch83u_begin_admin_reset(')),
    );
    expect(resetSignature).not.toMatch(/password|secret|token/i);
    expect(migration).not.toMatch(/\b(password|temporary_password|encrypted_password|access_token|refresh_token)\s+(text|varchar|jsonb)\b/i);
    expect(migration).not.toMatch(/->>\s*['"](?:password|temporary_password|access_token|refresh_token)['"]/i);
  });

  it('rejects a reset reason containing the exact temporary password before persistence', () => {
    const edge = source('supabase/functions/privileged-action/index.ts');
    const ui = source('src/pages/UserManagementCenter.tsx');
    const credentialApi = source('src/lib/userCredentialApi.ts');
    const resetBlock = edge.split("if (action === 'patch83u_admin_reset_password')")[1]
      ?.split("if (action === 'patch83u_reconcile_credential_state')")[0] ?? '';

    expect(resetBlock).toContain('reason.includes(temporaryPassword)');
    expect(resetBlock.indexOf('reason.includes(temporaryPassword)'))
      .toBeLessThan(resetBlock.indexOf("serviceClient.rpc('patch83u_begin_admin_reset'"));
    expect(resetBlock).toContain("'PATCH83U_ADMIN_RESET_REASON_INVALID'");
    expect(resetBlock).not.toMatch(/console\.(?:log|info|warn|error)/);
    expect(credentialApi).toContain('reason.includes(input.temporaryPassword)');
    expect(ui).toContain('resetReasonContainsTemporaryPassword');
    expect(ui).toContain('The reset reason must not contain the temporary password.');
  });

  it('resets temporary-password and confirmation fields across the complete dialog lifecycle', () => {
    const ui = source('src/pages/UserManagementCenter.tsx');
    const openReset = ui.split('const openPasswordReset')[1]?.split('const closePasswordReset')[0] ?? '';
    const closeReset = ui.split('const closePasswordReset')[1]?.split('const submitPasswordReset')[0] ?? '';
    const submitReset = ui.split('const submitPasswordReset')[1]?.split('const openCredentialReconciliation')[0] ?? '';

    expect(openReset).toMatch(/temporaryPassword:\s*user\.employee_no\s*\?\?\s*["']{2}/);
    expect(openReset).toMatch(/confirmPassword:\s*user\.employee_no\s*\?\?\s*["']{2}/);
    expect(openReset).toMatch(/employeeIdConfirmation:\s*["']{2}[\s\S]*resetConfirmation:\s*["']{2}/);
    expect(closeReset).toMatch(/temporaryPassword:\s*["']{2}[\s\S]*confirmPassword:\s*["']{2}[\s\S]*employeeIdConfirmation:\s*["']{2}[\s\S]*resetConfirmation:\s*["']{2}/);
    expect(submitReset).toMatch(/catch \(error\)[\s\S]*temporaryPassword:\s*resetUser\.employee_no\s*\?\?\s*["']{2}[\s\S]*confirmPassword:\s*resetUser\.employee_no\s*\?\?\s*["']{2}[\s\S]*employeeIdConfirmation:\s*["']{2}[\s\S]*resetConfirmation:\s*["']{2}/);
  });

  it('validates permanent-password confirmation and managed identity reuse at the trusted server boundary', () => {
    const edge = source('supabase/functions/privileged-action/index.ts');
    const credentialApi = source('src/lib/userCredentialApi.ts');
    const migration = source(patch83uMigration);
    const changeBlock = edge.split("if (action === 'patch83u_change_required_password')")[1]
      ?.split("if (action === 'patch83u_admin_reset_password')")[0] ?? '';
    const beginChange = sqlFunction(migration, 'patch83u_begin_required_password_change');

    expect(credentialApi).toContain('confirm_new_password: input.confirmNewPassword');
    expect(changeBlock).toContain('payload.current_password');
    expect(changeBlock).toContain('payload.new_password');
    expect(changeBlock).toContain('payload.confirm_new_password');
    expect(changeBlock).toContain('newPassword !== confirmNewPassword');
    expect(beginChange).toMatch(/select p\.\* into v_profile[\s\S]*from public\.profiles p/);
    expect(beginChange).toContain("v_employee_id := nullif(btrim(v_profile.employee_no), '')");
    expect(beginChange).toContain("'employee_id', v_employee_id");
    expect(changeBlock).toContain('normalizedNewPassword === employeeId.toLowerCase()');
    expect(changeBlock).toContain('normalizedNewPassword === authEmailLocalPart');
    expect(changeBlock).toContain('newPassword === currentPassword');
    expect(changeBlock).not.toMatch(/payload\.employee_(?:id|no)/i);
  });

  it('moves partial password operations into recovery_required without credential material', () => {
    const edge = source('supabase/functions/privileged-action/index.ts');
    const migration = source(patch83uMigration);
    const abortChange = sqlFunction(migration, 'patch83u_abort_required_password_change');
    const abortReset = sqlFunction(migration, 'patch83u_abort_admin_reset');

    expect(abortChange).toMatch(/p_auth_changed[\s\S]*'recovery_required'/);
    expect(abortReset).toMatch(/p_auth_changed[\s\S]*'recovery_required'/);
    expect(edge).toContain('p_auth_changed: authChanged');
    for (const block of [abortChange, abortReset]) {
      expect(block).not.toMatch(/jsonb_build_object\([\s\S]{0,700}['"](?:password|temporary_password)['"]/i);
    }
  });

  it('never persists caller-supplied credential failure text', () => {
    const migration = source(patch83uMigration);
    const safeFailureMessage = sqlFunction(migration, 'patch83u_safe_failure_message');

    expect(safeFailureMessage).toContain(
      'The server-side identity operation failed. No credential detail was retained.',
    );
    expect(safeFailureMessage).not.toMatch(/btrim\s*\(\s*p_message|regexp_replace\s*\(\s*p_message|left\s*\(\s*p_message/i);
    expect(safeFailureMessage).not.toMatch(/then\s+p_message|select\s+p_message|coalesce\s*\(\s*p_message/i);
  });

  it('replays terminal operations from version-consistent protected safe results', () => {
    const migration = source(patch83uMigration);
    const prepareChange = sqlFunction(migration, 'patch83u_prepare_required_password_change');
    const finishChange = sqlFunction(migration, 'patch83u_finalize_required_password_change');
    const abortChange = sqlFunction(migration, 'patch83u_abort_required_password_change');
    const beginReset = sqlFunction(migration, 'patch83u_begin_admin_reset');
    const finishReset = sqlFunction(migration, 'patch83u_finalize_admin_reset');
    const abortReset = sqlFunction(migration, 'patch83u_abort_admin_reset');

    expect(prepareChange).toMatch(/'current_credential_version', case when v_terminal\s+then v_state\.credential_version/);
    expect(prepareChange).toMatch(/v_operation\.safe_result ->> 'credential_state'/);
    expect(beginReset).toMatch(/'credential_version', coalesce\([\s\S]*v_existing_operation\.safe_result -> 'credential_version'/);
    expect(beginReset).toMatch(/'result_status', case when v_existing_operation\.safe_result is not null[\s\S]*v_existing_operation\.safe_result ->> 'credential_state'/);
    expect(beginReset).toMatch(/'completed', v_existing_operation\.operation_status in \([\s\S]*'completed'[\s\S]*'recovery_required'[\s\S]*'session_revocation_review_required'/);

    for (const terminal of [finishChange, abortChange, finishReset, abortReset]) {
      expect(terminal).toMatch(/v_operation\.safe_result \|\| jsonb_build_object\('idempotent_replay', true\)/);
      expect(terminal).toContain('safe_result = v_result');
    }
    for (const abort of [abortChange, abortReset]) {
      expect(abort).toContain('v_effective_credential_version');
      expect(abort).toContain('credential_version = v_effective_credential_version');
      expect(abort).toContain("'credential_version', v_effective_credential_version");
    }
    expect(abortReset).toMatch(/v_revocation_proven :=[\s\S]*not exists \([\s\S]*from auth\.sessions s where s\.user_id = p_target_user_id/);
    expect(abortReset).toContain('session_revocation_confirmed = v_revocation_proven');
  });

  it('requires exact Auth session rows, the created-at cutoff, and zero sessions before either finalizer', () => {
    const migration = source(patch83uMigration);
    const stateRead = sqlFunction(migration, 'patch83u_get_credential_state');
    const beginChange = sqlFunction(migration, 'patch83u_begin_required_password_change');
    const finishChange = sqlFunction(migration, 'patch83u_finalize_required_password_change');
    const finishReset = sqlFunction(migration, 'patch83u_finalize_admin_reset');

    for (const block of [stateRead, beginChange]) {
      expect(block).toMatch(/from auth\.sessions s[\s\S]*s\.created_at >= (?:cs|v_state)\.session_valid_after/);
    }
    for (const block of [finishChange, finishReset]) {
      expect(block).toMatch(/exists \(select 1 from auth\.sessions s where s\.user_id = [^)]+\)[\s\S]*PATCH83U_AUTH_SESSIONS_STILL_ACTIVE/);
    }
  });

  it('shows Last Password Reset only from a successfully finalized reset timestamp', () => {
    const edge = source('supabase/functions/privileged-action/index.ts');
    const api = source('src/lib/userManagementApi.ts');
    const ui = source('src/pages/UserManagementCenter.tsx');
    const i18n = source('src/i18n/I18nContext.tsx');
    const migration = source(patch83uMigration);
    const beginReset = sqlFunction(migration, 'patch83u_begin_admin_reset');
    const finishReset = sqlFunction(migration, 'patch83u_finalize_admin_reset');
    const abortReset = sqlFunction(migration, 'patch83u_abort_admin_reset');
    const databaseProof = finishReset.indexOf('PATCH83U_ADMIN_RESET_DATABASE_PROOF_FAILED');
    const sessionProof = finishReset.indexOf('PATCH83U_AUTH_SESSIONS_STILL_ACTIVE');
    const completionTimestamp = finishReset.indexOf('password_reset_at = v_now');

    expect(edge).toContain('password_changed_at,password_reset_at,provisioning_id');
    expect(edge).toContain('last_password_reset_at: credential?.password_reset_at ?? null');
    expect(api).toContain('last_password_reset_at: row.last_password_reset_at ?? null');
    expect(ui).toContain("{t('userManagement.lastPasswordReset')}: {detailUser.last_password_reset_at ?? t('userManagement.neverAvailable')}");
    expect(i18n).toContain("'userManagement.lastPasswordReset': { en: 'Last Password Reset'");
    expect(beginReset).not.toContain('password_reset_at =');
    expect(abortReset).not.toContain('password_reset_at =');
    expect(finishReset).toContain('password_reset_at = v_now');
    expect(databaseProof).toBeGreaterThan(-1);
    expect(sessionProof).toBeGreaterThan(databaseProof);
    expect(completionTimestamp).toBeGreaterThan(sessionProof);
  });

  it('protects provisioning and credential state with service-role-only mutation RPCs', () => {
    const migration = [
      source('supabase/migrations/173_patch83t_controlled_user_excel_import.sql'),
      source(patch83uMigration),
    ].join('\n');

    for (const table of [
      'user_account_provisioning',
      'user_credential_states',
      'user_credential_events',
      'user_credential_suspended_roles',
    ]) {
      expect(migration).toMatch(new RegExp(`alter table public\\.${table} enable row level security;`, 'i'));
      expect(migration).toMatch(new RegExp(`revoke all on table public\\.${table} from public, anon, authenticated;`, 'i'));
    }
    expect(migration).toContain('auth_user_id');
    expect(migration).not.toContain('planned_auth_user_id');

    for (const fn of [
      'patch83u_get_credential_state',
      'patch83u_list_provisioning',
      'patch83u_confirm_session_revocation',
      'patch83u_admin_reset_session_revocation_proof',
      'patch83u_claim_provisioning',
      'patch83u_finalize_provisioning',
      'patch83u_fail_provisioning',
      'patch83u_begin_required_password_change',
      'patch83u_finalize_required_password_change',
      'patch83u_abort_required_password_change',
      'patch83u_begin_admin_reset',
      'patch83u_finalize_admin_reset',
      'patch83u_abort_admin_reset',
      'patch83u_reconcile_provisioning',
      'patch83u_reconcile_credential_state',
    ]) {
      expect(migration).toContain(`public.${fn}`);
    }
    expect(migration).toMatch(/proname like 'patch83u\\_%'[\s\S]*revoke all on function %s from public, anon, authenticated/i);
    expect(migration).toMatch(/proname like 'patch83u\\_%'[\s\S]*grant execute on function %s to service_role/i);
  });

  it('applies the credential gate to both public data and protected storage objects', () => {
    const migration = source(patch83uMigration);

    expect(migration).toMatch(/create policy patch83u_credential_gate[\s\S]*as restrictive for all to authenticated/i);
    expect(migration).toMatch(/create policy patch83u_storage_credential_read_gate\s+on storage\.objects as restrictive for select to authenticated\s+using \(public\.patch83u_credential_access_allowed\(\)\)/i);
    expect(migration).toMatch(/create policy patch83u_storage_credential_insert_gate\s+on storage\.objects as restrictive for insert to authenticated\s+with check \(public\.patch83u_credential_access_allowed\(\)\)/i);
    expect(migration).toMatch(/create policy patch83u_storage_credential_update_gate\s+on storage\.objects as restrictive for update to authenticated\s+using \(public\.patch83u_credential_access_allowed\(\)\)\s+with check \(public\.patch83u_credential_access_allowed\(\)\)/i);
    expect(migration).toMatch(/create policy patch83u_storage_credential_delete_gate\s+on storage\.objects as restrictive for delete to authenticated\s+using \(public\.patch83u_credential_access_allowed\(\)\)/i);
  });

  it('records credential transitions and exposes reconciliation without credential material', () => {
    const edge = source('supabase/functions/privileged-action/index.ts');
    const migration = source(patch83uMigration);
    const beginReset = sqlFunction(migration, 'patch83u_begin_admin_reset');
    const abortReset = sqlFunction(migration, 'patch83u_abort_admin_reset');
    const finishChange = sqlFunction(migration, 'patch83u_finalize_required_password_change');
    const reconcile = sqlFunction(migration, 'patch83u_reconcile_credential_state');

    expect(edge).toContain("'patch83u_reconcile_provisioning'");
    expect(migration).toContain('PATCH83U_RECONCILIATION_REQUIRED');
    expect(migration).toContain('user_credential_events');
    expect(migration).toContain('credential_version');
    expect(migration).toMatch(/operation_source[\s\S]*admin_reset/);
    expect(migration).toMatch(/operation_source[\s\S]*password_change/);
    expect(migration).toContain('reconciliation_auth_changed');
    expect(beginReset).toContain('role_suspension_id = null');
    expect(beginReset).not.toMatch(/(?:insert into|update|delete from) public\.user_roles/i);
    expect(beginReset).not.toMatch(/update public\.profiles/i);
    expect(abortReset).toMatch(/when coalesce\(p_auth_changed, false\) and not v_revocation_proven[\s\S]*then 'session_revocation_review_required'[\s\S]*when coalesce\(p_auth_changed, false\) then 'recovery_required'[\s\S]*else v_state\.operation_previous_state/);
    expect(abortReset).toContain("'role_rows_preserved', true");
    expect(abortReset).not.toMatch(/(?:insert into|update|delete from) public\.user_roles/i);
    expect(abortReset).not.toMatch(/update public\.profiles/i);
    expect(finishChange).toMatch(/v_state\.operation_previous_state = 'initial_change_required'/);
    expect(finishChange).toContain('v_matching_role_count <> 1');
    expect(finishChange).toContain("'existing_role_rows_preserved', not v_role_activation_required");
    expect(reconcile).toMatch(/patch83u_abort_admin_reset\([\s\S]*pending_operation_id,[\s\S]*v_operation_request_id, true, false,[\s\S]*admin_reset_auth_change_recovery_required/);
    expect(reconcile).toMatch(/patch83u_abort_required_password_change\([\s\S]*pending_operation_id,[\s\S]*v_operation_request_id, true, false,[\s\S]*password_change_auth_change_recovery_required/);
    expect(reconcile).toContain('admin_reset_abort_restored_from_database_proof');
    expect(reconcile).not.toContain('patch83u_restore_suspended_roles');
    expect(migration).toMatch(/initial_change_required|admin_reset_change_required/);
    expect(migration).toMatch(/session[s_].*revok|revok.*session/i);
    expect(migration).not.toMatch(/jsonb_build_object\([\s\S]{0,500}['"](?:password|temporary_password|access_token|refresh_token)['"]/i);
  });
});
