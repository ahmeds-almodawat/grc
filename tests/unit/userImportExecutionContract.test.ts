import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { validateUserImportRows } from '../../src/utils/userImportValidation';
import type { ParsedUserImportRow } from '../../src/utils/userWorkbook';

const root = process.cwd();

function source(relativePath: string) {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

describe('Patch 83T execution security contract', () => {
  it('uses one literal privileged action and has no direct-browser import fallback', () => {
    const api = source('src/lib/userManagementApi.ts');
    const functionBody = api.split('export async function applyImportBatch')[1]
      ?.split('export async function updateUserProfile')[0] ?? '';
    expect(functionBody).toContain("invokePrivilegedAction<ApplyImportResult>('patch83t_apply_user_excel_import'");
    expect(functionBody).not.toContain("supabase.from('profiles')");
    expect(functionBody).not.toContain('updateProfileViaCompatibility');
    expect(functionBody).not.toContain('assignRoleViaCompatibility');
    expect(functionBody).not.toContain('auth.admin');
    expect(functionBody).not.toContain('signUp');
    expect(functionBody).toContain('employee_id: row.employee_no');
    expect(functionBody).toContain('contact_email: row.contact_email || null');
    expect(functionBody).toContain('account_action: row.account_action');
    expect(functionBody).toContain('expected_matched_user_id: row.matched_user_id ?? null');
    expect(functionBody).toContain('expected_planned_action: row.planned_action');
    expect(functionBody).toContain('expected_active_role_ids: row.matched_active_role_ids ?? []');
    expect(functionBody).toContain('execution_confirmation: executionConfirmation');
  });

  it('retires the legacy Patch 19 import execution surface instead of bypassing Patch 83T authorization', () => {
    const edge = source('supabase/functions/privileged-action/index.ts');
    const allowedActionsBlock = edge.split('const allowedActions = new Set([')[1]
      ?.split(']);')[0] ?? '';

    expect(allowedActionsBlock).not.toContain("'patch19_apply_import_batch'");
    expect(allowedActionsBlock).toContain("'patch83t_apply_user_excel_import'");
  });

  it('loads protected Auth and open-provisioning identity references through the service bridge', () => {
    const api = source('src/lib/userManagementApi.ts');
    const edge = source('supabase/functions/privileged-action/index.ts');
    const migration = source('supabase/migrations/173_patch83t_controlled_user_excel_import.sql');

    expect(api).toContain("'patch83t_user_import_identity_references'");
    expect(edge).toContain("'patch83t_user_import_identity_references'");
    expect(edge).toContain("serviceClient.rpc('patch83t_user_import_identity_references'");
    expect(migration).toContain('public.patch83t_user_import_identity_references');
    expect(migration).toMatch(/revoke all on function public\.patch83t_user_import_identity_references\(uuid, text\[\]\)[\s\S]*from public, anon, authenticated/i);
    expect(migration).toMatch(/grant execute on function public\.patch83t_user_import_identity_references\(uuid, text\[\]\)[\s\S]*to service_role/i);
  });

  it('requires profile identity proof and exposes no protected profile contact or name fields', () => {
    const api = source('src/lib/userManagementApi.ts');
    const migration = source('supabase/migrations/173_patch83t_controlled_user_excel_import.sql');
    const functionStart = migration.indexOf('create or replace function public.patch83t_user_import_identity_references(');
    const functionEnd = migration.indexOf('\n$$;', functionStart);
    const referenceFunction = migration.slice(functionStart, functionEnd + 4);

    expect(api).toContain('profile_identities: Array<{');
    expect(api).toContain('!Array.isArray(identityReferences.profile_identities)');
    expect(api).toContain('Protected User Import identity-reference proof is incomplete.');
    expect(migration).toContain("'profile_identities', v_profile_identities");
    expect(referenceFunction).toContain("'profile_id'");
    expect(referenceFunction).toContain("'organization_match'");
    expect(referenceFunction).toContain("'employee_id_match'");
    expect(referenceFunction).toContain("'employee_id_case_insensitive_match'");
    expect(referenceFunction).toContain("'auth_email_match'");
    expect(referenceFunction).toContain("'has_cross_org_active_role'");
    expect(referenceFunction).not.toMatch(/full_name|contact_email|phone|job_title/i);
  });

  it.each(['create', 'update', 'create_or_update'] as const)(
    'blocks %s for cross-organization and unresolved protected profile collisions without leaking PII',
    (accountAction) => {
      const importRow: ParsedUserImportRow = {
        row_number: 2,
        employee_no: 'COLLISION-001',
        full_name_en: 'Workbook User',
        full_name_ar: 'مستخدم ملف',
        contact_email: '',
        synthetic_auth_email: 'collision-001@almodawat.sa',
        phone_original: '0501234567',
        phone_normalized: null,
        department: 'IT',
        job_title: 'Analyst',
        role: 'employee',
        role_scope: 'assigned_only',
        status: 'active',
        user_type: 'employee',
        account_action: accountAction,
      };
      const protectedProfile = {
        profile_id: 'protected-profile-id',
        employee_no: 'COLLISION-001',
        auth_email: 'collision-001@almodawat.sa',
        employee_id_match: true,
        employee_id_case_insensitive_match: true,
        auth_email_match: true,
        has_cross_org_active_role: false,
        full_name_en: 'Confidential Protected Person',
        contact_email: 'private.person@example.test',
        phone: '+966500000000',
      };
      const references = {
        users: [],
        authIdentities: [],
        openProvisioningIdentities: [],
        actorIsSuperAdmin: true,
        activeDepartments: [{ id: 'department-it', code: 'IT', name_en: 'IT', name_ar: null }],
        archivedDepartments: [],
      };

      const crossOrganization = validateUserImportRows([importRow], {
        ...references,
        profileIdentities: [{ ...protectedProfile, organization_match: false }],
      });
      const unresolvedAuthorizedProfile = validateUserImportRows([importRow], {
        ...references,
        profileIdentities: [{ ...protectedProfile, organization_match: true }],
      });

      expect(crossOrganization.rows[0]).toMatchObject({
        validation_status: 'error',
        planned_action: 'rejected',
        matched_user_id: null,
      });
      expect(crossOrganization.rows[0].validation_errors).toContain(
        'The Employee ID or synthetic Auth email belongs to a profile outside the authorized organization. Organization-crossing import is forbidden.',
      );
      expect(unresolvedAuthorizedProfile.rows[0]).toMatchObject({
        validation_status: 'error',
        planned_action: 'rejected',
        matched_user_id: null,
      });
      expect(unresolvedAuthorizedProfile.rows[0].validation_errors).toContain(
        'The protected profile identity could not be resolved in the authorized organization roster. Import is blocked pending reconciliation.',
      );
      const browserSafeResult = JSON.stringify([crossOrganization, unresolvedAuthorizedProfile]);
      expect(browserSafeResult).not.toContain('Confidential Protected Person');
      expect(browserSafeResult).not.toContain('private.person@example.test');
      expect(browserSafeResult).not.toContain('+966500000000');
    },
  );

  it('rejects a preview when protected proof finds an active cross-organization role', () => {
    const row: ParsedUserImportRow = {
      row_number: 2,
      employee_no: 'ROLE-COLLISION-001',
      full_name_en: 'Workbook User',
      full_name_ar: 'مستخدم ملف',
      contact_email: '',
      synthetic_auth_email: 'role-collision-001@almodawat.sa',
      phone_original: '',
      phone_normalized: null,
      department: 'IT',
      job_title: 'Analyst',
      role: 'employee',
      role_scope: 'assigned_only',
      status: 'active',
      user_type: 'employee',
      account_action: 'update',
    };
    const result = validateUserImportRows([row], {
      users: [{
        user_id: 'profile-role-collision',
        organization_id: 'organization-current',
        employee_no: row.employee_no,
        full_name_en: 'Existing User',
        email: row.synthetic_auth_email,
      }],
      profileIdentities: [{
        profile_id: 'profile-role-collision',
        employee_no: row.employee_no,
        auth_email: row.synthetic_auth_email,
        organization_match: true,
        employee_id_match: true,
        employee_id_case_insensitive_match: true,
        auth_email_match: true,
        has_cross_org_active_role: true,
      }],
      authIdentities: [],
      openProvisioningIdentities: [],
      actorIsSuperAdmin: true,
      activeDepartments: [{ id: 'department-it', code: 'IT', name_en: 'IT', name_ar: null }],
      archivedDepartments: [],
    });

    expect(result.rows[0]).toMatchObject({ validation_status: 'error', planned_action: 'rejected' });
    expect(result.rows[0].validation_errors).toContain(
      'The matched profile has an active role assignment outside its organization. Resolve the cross-organization role anomaly before importing.',
    );
  });

  it.each(['create', 'update', 'create_or_update'] as const)(
    'rejects %s when a protected profile Employee ID differs only by letter casing',
    (accountAction) => {
      const employeeId = 'emp-case-001';
      const row: ParsedUserImportRow = {
        row_number: 2,
        employee_no: employeeId,
        full_name_en: 'Workbook User',
        full_name_ar: 'مستخدم ملف',
        contact_email: '',
        synthetic_auth_email: `${employeeId}@almodawat.sa`,
        phone_original: '',
        phone_normalized: null,
        department: 'IT',
        job_title: 'Analyst',
        role: 'employee',
        role_scope: 'assigned_only',
        status: 'active',
        user_type: 'employee',
        account_action: accountAction,
      };
      const result = validateUserImportRows([row], {
        users: [],
        profileIdentities: [{
          profile_id: 'protected-case-collision',
          employee_no: employeeId,
          auth_email: `${employeeId}@almodawat.sa`,
          organization_match: true,
          employee_id_match: false,
          employee_id_case_insensitive_match: true,
          auth_email_match: false,
          has_cross_org_active_role: false,
        }],
        authIdentities: [],
        openProvisioningIdentities: [],
        actorIsSuperAdmin: true,
        activeDepartments: [{ id: 'department-it', code: 'IT', name_en: 'IT', name_ar: null }],
        archivedDepartments: [],
      });

      expect(result.rows[0]).toMatchObject({ validation_status: 'error', planned_action: 'rejected' });
      expect(result.rows[0].validation_errors).toContain(
        'An existing profile has this Employee ID with different letter casing. Employee ID text and case cannot be changed implicitly.',
      );
    },
  );

  it('requires the exact typed execution confirmation in the UI and at the database boundary', () => {
    const api = source('src/lib/userManagementApi.ts');
    const ui = source('src/pages/UserManagementCenter.tsx');
    const migration = source('supabase/migrations/173_patch83t_controlled_user_excel_import.sql');

    expect(api).toContain("USER_IMPORT_EXECUTION_CONFIRMATION = 'EXECUTE USER IMPORT'");
    expect(ui).toContain('USER_IMPORT_EXECUTION_CONFIRMATION');
    expect(ui).toMatch(/aria-label=\{t\('userManagement\.exactConfirmation'\)\}[\s\S]*value=\{importConfirmation\}[\s\S]*setImportConfirmation/);
    expect(ui).toMatch(/importConfirmation\s*!==\s*USER_IMPORT_EXECUTION_CONFIRMATION/);
    expect(api).toContain('execution_confirmation: executionConfirmation');
    expect(migration).toMatch(/p_payload\s*->>\s*'execution_confirmation'/);
    expect(migration).toContain('EXECUTE USER IMPORT');
    expect(migration).toContain('PATCH83T_EXECUTION_CONFIRMATION_REQUIRED');

    const confirmationCheck = migration.indexOf('PATCH83T_EXECUTION_CONFIRMATION_REQUIRED');
    const firstBusinessWrite = migration.search(/insert into public\.(user_management_import_batches|user_management_import_rows|user_account_provisioning)|update public\.profiles/i);
    expect(confirmationCheck).toBeGreaterThan(-1);
    expect(firstBusinessWrite).toBeGreaterThan(confirmationCheck);
  });

  it('dispatches through the verified Edge bridge to the service-role-only migration RPC', () => {
    const edge = source('supabase/functions/privileged-action/index.ts');
    const migration = source('supabase/migrations/173_patch83t_controlled_user_excel_import.sql');
    expect(edge).toContain("'patch83t_apply_user_excel_import'");
    expect(edge).toContain("serviceClient.rpc('patch83t_apply_user_excel_import'");
    expect(migration.match(/if auth\.role\(\) is distinct from 'service_role'/g)).toHaveLength(2);
    expect(migration).not.toContain("if auth.role() <> 'service_role'");
    expect(migration).toContain("ur.role in ('super_admin', 'governance_admin')");
    expect(migration).toContain('set search_path = pg_catalog, public, pg_temp');
    expect(migration).toMatch(/revoke all on function public\.patch83t_apply_user_excel_import\(uuid, jsonb\)[\s\S]*from public, anon, authenticated;/i);
    expect(migration).toMatch(/grant execute on function public\.patch83t_apply_user_excel_import\(uuid, jsonb\)[\s\S]*to service_role;/i);
    expect(migration).not.toMatch(/(?:insert\s+into|update|delete\s+from)\s+auth\.users|admin\.create|invite_user/i);
    expect(migration).not.toMatch(/\b(password|temporary_password|encrypted_password)\s+(text|varchar|jsonb)\b/i);
    expect(migration).not.toMatch(/->>\s*['"](?:password|temporary_password)['"]/i);
  });

  it('keeps the Patch 83T capability handshake read-only, service-only, and fixed-shape', () => {
    const edge = source('supabase/functions/privileged-action/index.ts');
    const migration = source('supabase/migrations/173_patch83t_controlled_user_excel_import.sql');
    const capabilityStart = migration.indexOf(
      'create or replace function public.patch83t_get_user_import_capabilities(',
    );
    const capabilityEnd = migration.indexOf('\n$$;', capabilityStart);
    const capabilitySql = migration.slice(capabilityStart, capabilityEnd + 4);

    expect(edge).toContain("'patch83t_get_user_import_capabilities'");
    expect(edge).toContain("serviceClient.rpc('patch83t_get_user_import_capabilities'");
    expect(edge).toContain('x-patch83t-frontend-contract-version');
    expect(capabilitySql).toMatch(/language plpgsql[\s\S]*stable[\s\S]*security definer/i);
    expect(capabilitySql).toContain('set search_path = pg_catalog, public, pg_temp');
    expect(capabilitySql).toContain("coalesce(auth.jwt()->>'role', '') is distinct from 'service_role'");
    expect(capabilitySql).toContain("ur.role in ('super_admin', 'governance_admin')");
    expect(capabilitySql).toContain("ur.scope = 'global'");
    expect(capabilitySql).toContain('(ur.organization_id is null or ur.organization_id = v_actor_org)');
    expect(capabilitySql).not.toMatch(/\b(?:insert\s+into|update|delete\s+from)\b/i);
    for (const field of [
      'edge_contract_version',
      'migration_173_available',
      'identity_reference_action_available',
      'import_execution_action_available',
      'maximum_rows',
      'runtime_status',
      'compatible',
      'server_time',
    ]) expect(capabilitySql).toContain(`'${field}'`);
    expect(migration).toMatch(/revoke all on function public\.patch83t_get_user_import_capabilities\(uuid, text, text\)[\s\S]*from public, anon, authenticated;/i);
    expect(migration).toMatch(/grant execute on function public\.patch83t_get_user_import_capabilities\(uuid, text, text\)[\s\S]*to service_role;/i);
  });

  it('limits the optional migration-174 exception to exact missing-contract diagnostics and Patch 83T actions', () => {
    const edge = source('supabase/functions/privileged-action/index.ts');
    const actionSet = edge.split('const patch83tUserImportActions = new Set([')[1]
      ?.split(']);')[0] ?? '';
    const actionNames = [...actionSet.matchAll(/'([^']+)'/g)].map((match) => match[1]);
    const missingCheck = edge.split('function isMissingPatch83uRuntimeContract')[1]
      ?.split('type Patch83uCapabilities')[0] ?? '';

    expect(actionNames).toEqual([
      'patch83t_get_user_import_capabilities',
      'patch83t_user_import_identity_references',
      'patch83t_apply_user_excel_import',
    ]);
    expect(missingCheck).toContain("['PGRST202', '42883'].includes(code)");
    expect(missingCheck).toMatch(/patch83u_get_capabilities/i);
    expect(missingCheck).toMatch(/does not exist\|could not find\|not find the function\|schema cache/i);
    expect(edge).toContain(
      'patch83tUserImportActions.has(action) && isMissingPatch83uRuntimeContract(capabilityResult.error)',
    );
    expect(edge).toContain('capabilities = patch83uCapabilitiesFromResponse(capabilityResult.data)');
    expect(edge).toMatch(/capabilities[\s\S]*runtimeState === 'enforced'[\s\S]*credentialState\.access_allowed !== true/);
  });

  it('keeps identity, hierarchy, role replacement, and administrator safety checks server-side', () => {
    const migration = source('supabase/migrations/173_patch83t_controlled_user_excel_import.sql');
    expect(migration).toContain('PATCH83T_MULTIPLE_ROWS_TARGET_SAME_USER');
    expect(migration).toContain('PATCH83T_IDENTITY_CHANGED_DURING_EXECUTION');
    expect(migration).toContain('PATCH83T_PREVIEW_IDENTITY_CHANGED');
    expect(migration).toContain('PATCH83T_PREVIEW_ROLE_STATE_CHANGED');
    expect(migration).toContain('PATCH83T_EMPLOYEE_AUTH_EMAIL_CROSS_USER_CONFLICT');
    expect(migration).toContain('PATCH83T_SELF_DEACTIVATION_DENIED');
    expect(migration).toContain('PATCH83T_SELF_ROLE_CHANGE_DENIED');
    expect(migration).toContain('PATCH83T_LAST_SUPER_ADMIN_DEACTIVATION_DENIED');
    expect(migration).toContain('PATCH83T_CROSS_ORG_ROLE_ASSIGNMENT_REQUIRES_REVIEW');
    expect(migration).toContain("division_id = v_division_id");
    expect(migration).toContain("unit_id = null");
    expect(migration).toContain('PATCH83T_ROLE_DEACTIVATION_PROOF_FAILED');
    expect(migration).toMatch(/'active_roles',[\s\S]*public\.user_management_audit_history/i);
  });

  it('uses an actor-bound service-only role mutation path instead of legacy auth.uid helpers', () => {
    const migration = source('supabase/migrations/173_patch83t_controlled_user_excel_import.sql');
    const applyStart = migration.indexOf(
      'create or replace function public.patch83t_apply_user_excel_import(',
    );
    const applyEnd = migration.indexOf('\n$$;', applyStart);
    const applySql = migration.slice(applyStart, applyEnd + 4);

    expect(applySql).toContain("if auth.role() is distinct from 'service_role'");
    expect(applySql).not.toContain('public.assign_user_role(');
    expect(applySql).not.toContain('public.deactivate_user_role(');
    expect(applySql).not.toContain('auth.uid()');
    expect(applySql).not.toContain("set_config('request.jwt.claim.role'");
    expect(applySql).toMatch(/update public\.user_roles[\s\S]*set is_active = false[\s\S]*PATCH83T_ROLE_DEACTIVATION_PROOF_FAILED/);
    expect(applySql).toMatch(/insert into public\.user_roles[\s\S]*null, true, p_actor_id, now\(\)/);
    expect(applySql).toMatch(/update public\.user_roles[\s\S]*set is_active = true,[\s\S]*assigned_by = p_actor_id/);
    expect(applySql).toMatch(/public\.role_change_audit[\s\S]*'deactivated'[\s\S]*v_old_role[\s\S]*p_actor_id/);
    expect(applySql).toMatch(/values \(\s*v_actor_org, v_target_user, v_user_role_id, 'deactivated'/);
    expect(applySql).toMatch(/public\.role_change_audit[\s\S]*'assigned'[\s\S]*v_new_role[\s\S]*p_actor_id/);
    expect(applySql).toMatch(/public\.role_change_audit[\s\S]*'reactivated'[\s\S]*v_new_role[\s\S]*p_actor_id/);
    expect(applySql).toContain('PATCH83T_ROLE_ASSIGNMENT_PROOF_FAILED');
    expect(applySql).toContain('PATCH83T_ROLE_REACTIVATION_PROOF_FAILED');
    expect(applySql).toMatch(/set_config\('patch83u\.controlled_role_restore', 'on', true\)[\s\S]*set_config\('patch83u\.controlled_role_restore', 'off', true\)/);
  });

  it('keeps Patch 83T runtime-compatible without a parse-time Patch 83U dependency', () => {
    const migration = source('supabase/migrations/173_patch83t_controlled_user_excel_import.sql');
    const applyStart = migration.indexOf(
      'create or replace function public.patch83t_apply_user_excel_import(',
    );
    const applyEnd = migration.indexOf('\n$$;', applyStart);
    const applySql = migration.slice(applyStart, applyEnd + 4);

    expect(applySql).toContain(
      "to_regprocedure('public.patch83u_runtime_super_admin_eligible(uuid,uuid)')",
    );
    expect(applySql).toContain(
      "to_regprocedure('public.patch83u_runtime_enforcement_state()')",
    );
    expect(applySql).toMatch(/execute \$patch83t_lock_runtime\$[\s\S]*for share/);
    expect(applySql).toMatch(/execute \$patch83t_lock_target_credential\$[\s\S]*for update/);
    expect(applySql).toMatch(/execute \$patch83t_target_super\$[\s\S]*patch83u_runtime_super_admin_eligible/);
    expect(applySql).toMatch(/execute \$patch83t_super_count\$[\s\S]*patch83u_runtime_super_admin_eligible/);
    expect(applySql).toMatch(/disabled', 'prepared'[\s\S]*existing_password_rotation_pending/);
    expect(applySql).toMatch(/= 'enforced'[\s\S]*cs\.credential_state = 'active'/);
    expect(applySql).toMatch(/= 'emergency_suspended'[\s\S]*cs\.identity_mode = 'legacy_verified'[\s\S]*cs\.credential_state <> 'disabled'/);
    expect(applySql).toMatch(/v_active_super_admin_count[\s\S]*- v_super_admin_removal_count[\s\S]*\+ v_super_admin_addition_count < 1/);

    // Every Patch 83U object is resolved or executed dynamically. Migration 173
    // still parses and installs before those migration-174 objects exist.
    expect(applySql).not.toMatch(/perform\s+public\.patch83u_runtime_/i);
    expect(applySql).not.toMatch(/select\s+public\.patch83u_runtime_super_admin_eligible\([^$]*;/i);
  });

  it('preserves an existing active canonical role while credential/RLS enforcement stays authoritative', () => {
    const migration = source('supabase/migrations/173_patch83t_controlled_user_excel_import.sql');
    const applyStart = migration.indexOf(
      'create or replace function public.patch83t_apply_user_excel_import(',
    );
    const applyEnd = migration.indexOf('\n$$;', applyStart);
    const applySql = migration.slice(applyStart, applyEnd + 4);
    const executionRoleBlock = applySql.slice(
      applySql.indexOf("v_role_should_activate := v_status = 'active';"),
      applySql.indexOf("select jsonb_build_object(\n      'batch_id'", applySql.indexOf("v_role_should_activate := v_status = 'active';")),
    );

    expect(executionRoleBlock).toContain("v_role_should_activate := v_status = 'active';");
    expect(executionRoleBlock).not.toMatch(/v_role_should_activate\s*:=\s*[^;]*v_credential_state/);
    expect(executionRoleBlock).not.toContain('PATCH83T_TARGET_CREDENTIAL_RECONCILIATION_REQUIRED');
    expect(executionRoleBlock).toContain("set_config('patch83u.controlled_role_restore', 'on', true)");
    expect(executionRoleBlock).not.toContain("set_config('request.jwt.claim.role'");
    expect(executionRoleBlock).toMatch(/elsif not v_role_should_activate[\s\S]*null, false, p_actor_id/);
  });

  it('independently enforces strict account_action semantics in preview and SQL', () => {
    const validation = source('src/utils/userImportValidation.ts');
    const migration = source('supabase/migrations/173_patch83t_controlled_user_excel_import.sql');

    for (const action of ['create', 'update', 'create_or_update']) {
      expect(validation).toContain(action);
      expect(migration).toContain(`'${action}'`);
    }
    for (const code of [
      'PATCH83T_ACCOUNT_ACTION_INVALID',
      'PATCH83T_CREATE_PROFILE_ALREADY_EXISTS',
      'PATCH83T_CREATE_AUTH_IDENTITY_ALREADY_EXISTS',
      'PATCH83T_CREATE_OPEN_PROVISIONING_EXISTS',
      'PATCH83T_UPDATE_PROFILE_NOT_FOUND',
      'PATCH83T_UPDATE_OPEN_PROVISIONING_CONFLICT',
      'PATCH83T_CREATE_OR_UPDATE_AUTH_IDENTITY_WITHOUT_PROFILE',
      'PATCH83T_CREATE_OR_UPDATE_OPEN_PROVISIONING_CONFLICT',
    ]) expect(migration).toContain(code);
    expect(validation).toMatch(/account_action update requires exactly one existing profile match[\s\S]*never creates an account or provisioning record/i);
  });

  it('derives the synthetic Auth email from exact Employee ID and keeps contact email optional', () => {
    const api = source('src/lib/userManagementApi.ts');
    const validation = source('src/utils/userImportValidation.ts');
    const migration = source('supabase/migrations/173_patch83t_controlled_user_excel_import.sql');

    expect(migration).toMatch(/v_auth_email\s*:=\s*lower\(v_employee_id\)\s*\|\|\s*'@almodawat\.sa'/);
    expect(migration).toMatch(/v_contact_email <> ''[\s\S]*PATCH83T_CONTACT_EMAIL_INVALID/);
    expect(migration).toContain("v_employee_id !~ '^[A-Za-z0-9._-]+$'");
    expect(migration).not.toMatch(/length\(v_employee_id\)\s*<\s*6/);
  });

  it('enforces the narrow canonical role/scope import matrix in both TypeScript and SQL', () => {
    const validation = source('src/utils/userImportValidation.ts');
    const migration = source('supabase/migrations/173_patch83t_controlled_user_excel_import.sql');

    for (const token of [
      'super_admin', 'executive', 'governance_admin', 'auditor', 'compliance_officer',
      'department_manager', 'project_owner', 'milestone_owner', 'task_owner', 'viewer', 'employee',
      'global', 'department', 'assigned_only',
    ]) {
      expect(validation).toContain(token);
      expect(migration).toContain(token);
    }
    expect(validation).toMatch(/role[\s\S]*scope[\s\S]*(invalid|supported|allowed)/i);
    expect(migration).toContain('PATCH83T_ROLE_SCOPE_COMBINATION_INVALID');
    expect(migration).toMatch(/division_head[\s\S]*(unsupported|invalid|false)|(?:unsupported|invalid|false)[\s\S]*division_head/i);
  });

  it('creates protected, complete provisioning snapshots without storing credentials', () => {
    const migration = source('supabase/migrations/173_patch83t_controlled_user_excel_import.sql');
    const tableStart = migration.search(/create table(?: if not exists)? public\.user_account_provisioning/i);
    const tableEnd = tableStart < 0 ? -1 : migration.indexOf(';', tableStart);
    const tableDefinition = tableStart < 0 || tableEnd < 0 ? '' : migration.slice(tableStart, tableEnd);

    expect(tableStart).toBeGreaterThan(-1);
    for (const column of [
      'organization_id', 'import_batch_id', 'import_row_id', 'auth_user_id', 'employee_id',
      'auth_email', 'contact_email', 'full_name_en', 'full_name_ar', 'phone', 'department_id',
      'department_code', 'job_title', 'requested_role', 'requested_scope',
      'requested_lifecycle', 'requested_user_type', 'account_action', 'provisioning_status',
    ]) {
      expect(tableDefinition).toContain(column);
    }
    expect(tableDefinition).not.toMatch(/\b(password|temporary_password|encrypted_password)\b/i);
    expect(tableDefinition).not.toContain('planned_auth_user_id');
    expect(migration).toMatch(/alter table public\.user_account_provisioning enable row level security;/i);
    expect(migration).toMatch(/revoke all on table public\.user_account_provisioning from public, anon, authenticated;/i);
    expect(migration).toMatch(/grant (?:select|all)(?:[\s\S]*?) on table public\.user_account_provisioning to service_role;/i);
    expect(migration).toContain('PATCH83T_PROVISIONING_RECORD_DELETE_DENIED');
    expect(migration).toMatch(/before update or delete on public\.user_account_provisioning/i);
    expect(migration).toMatch(/insert into public\.user_account_provisioning[\s\S]*pending_account_creation/i);
  });

  it('returns database-derived execution proof and does not rely on browser summary counts', () => {
    const api = source('src/lib/userManagementApi.ts');
    const ui = source('src/pages/UserManagementCenter.tsx');
    const migration = source('supabase/migrations/173_patch83t_controlled_user_excel_import.sql');

    expect(migration).toContain("'database_proof'");
    expect(migration).toContain("'import_row_count'");
    expect(migration).toContain("'provisioning_record_count'");
    expect(migration).toContain("'audit_record_count'");
    expect(migration).toContain("'payload_sha256'");
    expect(api).toContain('database_proof');
    expect(api).toContain('payload_sha256');
    expect(api).toContain('provisioning_ids');
    expect(ui).toMatch(/batch[_ ]id|batchId/i);
    expect(ui).toMatch(/import_row_count|provisioning_record_count|audit_record_count/);
  });

  it('keeps Department Import and migration 172 out of the Patch 83T execution path', () => {
    const api = source('src/lib/userManagementApi.ts');
    const migration = source('supabase/migrations/173_patch83t_controlled_user_excel_import.sql');
    expect(api).not.toContain('department_import_execute');
    expect(migration).not.toContain('apply_department_import_batch');
    expect(migration).not.toContain('172_patch83s1');
  });
});
