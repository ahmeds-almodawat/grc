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

    expect(migration).toMatch(/identity_mode text not null[\s\S]*'legacy_verified'[\s\S]*'employee_id_managed'[\s\S]*'unverified'/);
    expect(migration).toMatch(/u\.email_confirmed_at is not null\s+then 'legacy_verified'/);
    expect(finalizeProvisioning).toContain("'employee_id_managed'");
    expect(migration).toContain('patch83u_guard_managed_profile_employee_id');
    expect(migration).toContain('PATCH83U_MANAGED_EMPLOYEE_ID_IMMUTABLE');
    expect(migration).toContain('patch83u_guard_credential_identity');
    expect(migration).toContain('PATCH83U_MANAGED_AUTH_IDENTITY_MISMATCH');
    expect(migration).toMatch(/new\.auth_email <> public\.patch83u_expected_auth_email\(v_employee_id\)/);
  });

  it('keeps global roles nullable-or-exact organization bound and all non-global roles exact-org bound', () => {
    const migration = source(patch83uMigration);
    const validator = sqlFunction(migration, 'patch83u_role_assignment_valid');

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
    expect(assignBlock).toContain('PATCH83U_ROLE_ASSIGNMENT_PROOF_FAILED');
    expect(assignBlock).not.toContain('v72_execute_privileged_action');
    expect(deactivateBlock).toContain("serviceClient.rpc('patch83u_deactivate_user_role'");
    expect(deactivateBlock).toContain('PATCH83U_ROLE_DEACTIVATION_PROOF_FAILED');
    expect(deactivateBlock).not.toContain('v72_execute_privileged_action');
    expect(assignSql).toContain('public.patch83u_role_assignment_valid');
    expect(assignSql).toMatch(/p_target_user_id[\s\S]*organization_id[\s\S]*for update/i);
    expect(deactivateSql).toContain('PATCH83U_SELF_ROLE_DEACTIVATION_DENIED');
    expect(deactivateSql).toMatch(/super_admin[\s\S]*last|last[\s\S]*super_admin/i);
  });

  it('restricts direct authenticated user-role mutations to canonical same-tenant administrators', () => {
    const migration = source(patch83uMigration);
    const decision = sqlFunction(migration, 'patch83u_user_role_mutation_allowed');

    expect(decision).toContain('actor.id <> p_target_user_id');
    expect(decision).toMatch(/target\.organization_id = actor\.organization_id/);
    expect(decision).toMatch(/actor_state\.identity_mode in \('employee_id_managed', 'legacy_verified'\)/);
    expect(decision).toContain("actor_state.credential_state = 'active'");
    expect(decision).toMatch(/actor_role\.role in \('super_admin', 'governance_admin'\)[\s\S]*actor_role\.scope = 'global'/);
    expect(decision).toMatch(/p_role not in \('super_admin', 'executive', 'governance_admin'\)[\s\S]*actor_role\.role = 'super_admin'/);
    expect(decision).toContain('public.patch83u_role_assignment_valid');
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
    const workbook = source('src/utils/userWorkbook.ts');

    expect(edge).toContain('credential_proof_available: Boolean(credential)');
    expect(edge).toContain("['employee_id_managed', 'legacy_verified'].includes(String(credential?.identity_mode ?? ''))");
    expect(edge).not.toContain('auth_email: safeString(credential?.auth_email, safeString(profile.email))');
    expect(api).toContain('credential_proof_available: false');
    expect(api).toContain("credential_proof_available: row.credential_proof_available === true");
    expect(api).not.toContain('auth_email: safeString(row.auth_email, safeString(row.email))');
    expect(ui).toContain('!actionMenuUser.credential_proof_available');
    expect(ui).toContain('Unavailable (credential proof required)');
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
    ]) expect(credentialApi).toContain(`'${state}'`);
    expect(credentialApi).toContain("gate: 'password_change_required'");
    expect(credentialApi).toContain("gate: 'blocked'");
    expect(authProvider).toContain("status: 'password_change_required'");
    expect(authProvider).toMatch(/credentialDecision\.gate === 'blocked'/);
    expect(app).toMatch(/password_change_required[\s\S]*(Password|Credential)/i);
  });

  it('fails closed for both a missing migration and all other credential-state verification errors', () => {
    const edge = source('supabase/functions/privileged-action/index.ts');
    const errorGate = edge.split('if (credentialStateResult.error) {')[1]
      ?.split("const credentialState =", 1)[0] ?? '';

    expect(edge).toContain('isMissingPatch83uCredentialContract');
    expect(edge).toMatch(/\['PGRST202', '42883'\]\.includes\(code\)/);
    expect(edge).toMatch(/!isMissingPatch83uCredentialContract\(credentialStateResult\.error\)[\s\S]*PATCH83U_CREDENTIAL_STATE_UNAVAILABLE/);
    expect(edge).toMatch(/PATCH83U_CREDENTIAL_STATE_UNAVAILABLE[\s\S]*Access remains denied/);
    expect(errorGate).toContain('PATCH83U_CREDENTIAL_MIGRATION_REQUIRED');
    expect(errorGate.match(/503/g)?.length).toBe(2);
    expect(errorGate).not.toContain('jsonResponse({ ok: true');
  });

  it('requires the exact Super Admin reset confirmations, performs global session revocation, and never persists a password', () => {
    const edge = source('supabase/functions/privileged-action/index.ts');
    const ui = source('src/pages/UserManagementCenter.tsx');
    const credentialApi = source('src/lib/userCredentialApi.ts');
    const migration = source(patch83uMigration);

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
    expect(edge).toMatch(/patch83u_admin_reset_password[\s\S]*auth\.admin\.updateUserById/i);
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
    const changeBlock = edge.split("action === 'patch83u_change_required_password'")[1]
      ?.split("action === 'patch83u_admin_reset_password'")[0] ?? '';
    const beginChange = sqlFunction(migration, 'patch83u_begin_required_password_change');

    expect(credentialApi).toContain('confirm_new_password: input.confirmNewPassword');
    expect(changeBlock).toContain('payload.current_password');
    expect(changeBlock).toContain('payload.new_password');
    expect(changeBlock).toContain('payload.confirm_new_password');
    expect(changeBlock).toContain('newPassword !== confirmNewPassword');
    expect(beginChange).toMatch(/select p\.employee_no[\s\S]*into v_employee_id[\s\S]*from public\.profiles p/);
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
    expect(ui).toContain('Last Password Reset: {detailUser.last_password_reset_at ?? "Never / unavailable"}');
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
    expect(beginReset).toMatch(/coalesce\(v_state\.role_suspension_id, gen_random_uuid\(\)\)/);
    expect(abortReset).toMatch(/not coalesce\(p_auth_changed, false\)[\s\S]*operation_previous_state = 'active'[\s\S]*patch83u_restore_suspended_roles/);
    expect(finishChange).toMatch(/credential_state = 'active'[\s\S]*role_suspension_id = null[\s\S]*operation_source = null[\s\S]*reconciliation_auth_changed = false/);
    expect(reconcile).toMatch(/patch83u_abort_admin_reset\([\s\S]*pending_operation_id, true,[\s\S]*admin_reset_auth_change_recovery_required/);
    expect(reconcile).toMatch(/patch83u_abort_required_password_change\([\s\S]*pending_operation_id, true,[\s\S]*password_change_auth_change_recovery_required/);
    expect(reconcile).toContain('admin_reset_abort_restored_from_database_proof');
    expect(migration).toMatch(/initial_change_required|admin_reset_change_required/);
    expect(migration).toMatch(/session[s_].*revok|revok.*session/i);
    expect(migration).not.toMatch(/jsonb_build_object\([\s\S]{0,500}['"](?:password|temporary_password|access_token|refresh_token)['"]/i);
  });
});
