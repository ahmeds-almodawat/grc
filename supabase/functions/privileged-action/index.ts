import { createClient } from 'npm:@supabase/supabase-js@2.108.2';
import { normalizeRosterPageRequest } from '../_shared/accV13RosterPaging.ts';
import {
  v14e1rGovernedDocumentActions,
  MAX_E1R2_PAYLOAD_BYTES,
  validateStageConfigInput,
  validateProcedureSections,
  validateProcedureSteps,
  validateDepartmentScopes,
  validateRoleScopes,
  validateDefinitions,
  validateRoleResponsibilities,
  validateMonitoringKpis,
  validateRiskLinks,
  validateAccreditationLinks,
  validateVersionLinks,
  validateConfigureStagesProof,
  validateCreateSopDraftProof,
  validateSaveSopDraftProof,
  validateStartRevisionProof,
  validateSubmitReviewProof,
  validateApprovalDecisionProof,
  validateFinalizeApprovalProof,
  mapV14e1rDatabaseError,
  requireCanonicalUuid,
  optionalCanonicalUuid,
  boundedString,
  validateStrictBoolean,
  optionalStrictBoolean,
  validateStrictInteger,
  optionalStrictInteger,
  assertNoIdentityOverrides,
  assertOnlyAllowedKeys,
  asPlainObject,
  validCriticalityLevels,
  validConfidentialityLevels,
  validContentModes,
  validTranscriptionStatuses,
  validGovernanceLinkStates,
  resolveCreateGovernanceLinkState,
  validRevisionTypes,
  validApprovalDecisions,
} from '../_shared/v14e1rGovernedDocumentBridge.ts';
import {
  v14e2b2TrainingActions,
  MAX_E2B2_PAYLOAD_BYTES,
  validCompetencyResults,
  globalGovernanceRoles,
  optionalStrictFiniteNumber,
  validateLegacyActorId,
  mapV14e2b2DatabaseError,
  hasActiveGlobalGovernanceRole,
  hasActiveDepartmentManagerRole,
  hasActiveDivisionHeadRole,
  hasActiveRoleForAcknowledgmentRequirement,
  verifyProgramTenancy,
  resolveGovernedVersionTrainingRequirements,
} from '../_shared/v14e2b2TrainingBridge.ts';
import {
  hasExactE2B3GlobalGovernanceRole,
  hasExactE2B3TrainingReconciliationCapability,
  isE2B3Migration209CapabilityUnavailable,
} from '../_shared/v14e2b3TrainingReconciliationBridge.ts';
import {
  hasExactF1GlobalGovernanceRole,
  hasExactF1OvrGovernedVersionCapability,
  isF1Migration210CapabilityUnavailable,
  mapF1OvrGovernedVersionError,
} from '../_shared/v14f1OvrGovernedVersionBridge.ts';
import {
  F2_REVIEW_OUTCOMES,
  hasExactF2GlobalGovernanceRole,
  hasExactF2OvrGovernanceFeedbackCapability,
  isF2Migration211CapabilityUnavailable,
  mapF2OvrGovernanceFeedbackError,
} from '../_shared/v14f2OvrGovernanceFeedbackBridge.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, x-patch83t-frontend-contract-version, x-patch83u-frontend-contract-version, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const PATCH83T_EDGE_CONTRACT_VERSION = 'patch83t-edge-user-import-v1';
const PATCH83T_FRONTEND_CONTRACT_VERSION = 'patch83t-frontend-user-import-v1';
const PATCH83T_MAXIMUM_ROWS = 5000;
const PATCH83U_EDGE_CONTRACT_VERSION = 'patch83u-edge-auth-first-v1';
const PATCH83U_FRONTEND_CONTRACT_VERSION = 'patch83u-frontend-auth-first-v1';
const PATCH83U_INSTALLED_SCHEMA_VERSION = 174;
const patch83uRuntimeStates = new Set([
  'disabled',
  'prepared',
  'enforced',
  'emergency_suspended',
]);

const patch22RiskActions = new Set([
  'update_risk_assessment',
  'request_risk_acceptance',
  'approve_risk_acceptance',
  'reject_risk_acceptance',
  'update_risk_treatment',
  'complete_risk_treatment',
  'request_risk_closure',
  'approve_risk_closure',
  'reopen_risk_with_reason',
  'link_risk_source',
  'mark_duplicate_risk',
]);

const patch23EvidenceActions = new Set([
  'create_evidence_requirement',
  'link_evidence_to_item',
  'submit_evidence_for_review',
  'accept_evidence',
  'reject_evidence',
  'request_evidence_revision',
  'supersede_evidence',
  'lock_evidence',
  'request_evidence_gate_waiver',
  'approve_evidence_gate_waiver',
  'reject_evidence_gate_waiver',
  'check_evidence_gate_status',
  'generate_evidence_pack_index',
]);

const patch24AuditActions = new Set([
  'issue_audit_finding',
  'submit_management_response',
  'accept_management_response',
  'reject_management_response',
  'submit_corrective_action_plan',
  'accept_corrective_action_plan',
  'reject_corrective_action_plan',
  'request_audit_finding_extension',
  'approve_audit_finding_extension',
  'reject_audit_finding_extension',
  'request_audit_finding_closure',
  'validate_audit_finding_closure',
  'reject_audit_finding_closure',
  'reopen_audit_finding_with_reason',
  'escalate_audit_finding',
  'mark_repeat_audit_finding',
  'link_audit_finding_to_risk',
  'link_audit_finding_to_compliance',
  'generate_audit_closure_pack_index',
]);

const patch68EvidenceClosureActions = new Set([
  'record_production_evidence_closure_action',
  'get_production_evidence_closure_action_history',
]);

const patch76CutoverDecisionActions = new Set([
  'create_controlled_production_cutover_decision',
  'record_controlled_production_cutover_decision_event',
]);

const patch77LivePilotActions = new Set([
  'create_live_pilot_session',
  'update_live_pilot_session_status',
  'create_live_pilot_issue',
  'update_live_pilot_issue_status',
  'record_live_pilot_department_acceptance',
]);

const patch78IdentityIntegrityActions = new Set([
  'create_identity_role_integrity_review',
  'update_identity_role_integrity_review_status',
  'record_identity_role_integrity_finding',
  'update_identity_role_integrity_finding_status',
  'record_privileged_role_recertification',
]);

const patch79OperationsGovernanceActions = new Set([
  'create_production_hypercare_window',
  'update_production_hypercare_window_status',
  'record_production_hypercare_item',
  'update_production_hypercare_item_status',
  'create_executive_governance_board_pack',
  'update_executive_governance_board_pack_status',
]);

const patch83mDepartmentImportActions = new Set([
  'department_import_execute',
]);

const patch83q1ProductionReadinessActions = new Set([
  'create_pilot_go_no_go_review',
  'update_pilot_go_no_go_review_status',
  'record_pilot_go_no_go_event',
  'record_executive_production_signoff',
]);

const patch83rDepartmentLifecycleActions = new Set([
  'department_lifecycle_preview',
  'department_lifecycle_rename',
  'department_lifecycle_archive',
  'department_lifecycle_restore',
]);

const f1r2BusinessCycleActions = new Set([
  'f1r2_create_work_item',
  'f1r2_create_ovr_report',
  'f1r2_create_corrective_project',
  'f1r2_assign_work_item',
  'f1r2_respond_work_item_assignment',
  'f1r2_cancel_work_item_assignment',
  'f1r2_list_my_work',
  'f1r2_list_item_participants',
  'f1r2_list_project_assignments',
  'f1r2_search_eligible_participants',
  'f1r2_decide_approval',
  'f1r2_get_evidence_pack',
  'f1r2_relink_evidence_parent',
  'f1r2_finalize_corrective_ovr',
]);

const patch26DocumentActions = new Set([
  'record_document_acknowledgment',
]);

const patch29TrainingActions = new Set([
  'decide_sop_rollout_requirements',
  'publish_sop_training_obligations',
  'reconcile_sop_training_population',
  'start_training_assignment',
  'complete_training_assignment',
  'record_competency_assessment',
  'waive_training_assignment_with_reason',
  'cancel_training_assignment_with_reason',
  'reopen_training_assignment_with_reason',
]);

const f1OvrGovernedVersionActions = new Set([
  'link_ovr_governed_document_version',
  'unlink_ovr_governed_document_version',
]);

const f2OvrGovernanceFeedbackActions = new Set([
  'initiate_ovr_governance_feedback_review',
  'complete_ovr_governance_feedback_review',
  'sync_ovr_corrective_action_capa_link',
]);

const allowedActions = new Set([
  'ovr_executive_dashboard_analytics',
  'search_grc_global',
  'list_user_management_roster',
  'create_board_pack_snapshot',
  'acknowledge_escalation_event',
  'resolve_escalation_event',
  'assign_user_role',
  'deactivate_user_role',
  'create_department',
  'update_ovr_workflow',
  'create_ovr_corrective_action_project',
  'acc_v13_update_work_item_status',
  'acc_v13_evidence_access',
  'acc_v13_list_eligible_approvers',
  'acc_v13_request_approval',
  'v99_create_scenario',
  'v99_cleanup_scenarios',
  'v99_scenario_status',
  'patch19_update_user_profile',
  'patch19_update_user_department',
  'patch19_assign_user_role',
  'patch19_deactivate_user',
  'patch19_reactivate_user',
  'patch19_archive_user',
  'patch19_unarchive_user',
  'patch83t_get_user_import_capabilities',
  'patch83t_apply_user_excel_import',
  'patch83t_user_import_identity_references',
  'patch83u_get_capabilities',
  'patch83u_get_credential_state',
  'patch83u_list_provisioning',
  'patch83u_provision_account',
  'patch83u_reconcile_provisioning',
  'patch83u_reconcile_credential_state',
  'patch83u_change_required_password',
  'patch83u_admin_reset_password',
  ...patch22RiskActions,
  ...patch23EvidenceActions,
  ...patch24AuditActions,
  ...patch26DocumentActions,
  ...patch29TrainingActions,
  ...f1OvrGovernedVersionActions,
  ...f2OvrGovernanceFeedbackActions,
  ...patch68EvidenceClosureActions,
  ...patch76CutoverDecisionActions,
  ...patch77LivePilotActions,
  ...patch78IdentityIntegrityActions,
  ...patch79OperationsGovernanceActions,
  ...patch83q1ProductionReadinessActions,
  ...patch83rDepartmentLifecycleActions,
  ...f1r2BusinessCycleActions,
  ...v14e1rGovernedDocumentActions,
]);

const patch19LifecycleActions = new Set([
  'patch19_deactivate_user',
  'patch19_reactivate_user',
  'patch19_archive_user',
  'patch19_unarchive_user',
]);

const patch19OrganizationScopedTargetActions = new Set([
  'patch19_update_user_department',
  'patch19_assign_user_role',
  ...patch19LifecycleActions,
]);

const patch83uActions = new Set([
  'patch83u_get_capabilities',
  'patch83u_get_credential_state',
  'patch83u_list_provisioning',
  'patch83u_provision_account',
  'patch83u_reconcile_provisioning',
  'patch83u_reconcile_credential_state',
  'patch83u_change_required_password',
  'patch83u_admin_reset_password',
]);

const patch83tUserImportActions = new Set([
  'patch83t_get_user_import_capabilities',
  'patch83t_user_import_identity_references',
  'patch83t_apply_user_excel_import',
]);

const patch83uEnforcedOnlyActions = new Set([
  'patch83u_list_provisioning',
  'patch83u_provision_account',
  'patch83u_reconcile_provisioning',
  'patch83u_reconcile_credential_state',
  'patch83u_change_required_password',
  'patch83u_admin_reset_password',
]);

function jsonResponse(body: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function errorResponse(
  error: string,
  status: number,
  code: string,
  detail: string,
  extra: Record<string, unknown> = {},
) {
  return jsonResponse({
    ok: false,
    error,
    code,
    detail,
    ...extra,
  }, status);
}

const userRoleOptions = new Set([
  'super_admin',
  'executive',
  'governance_admin',
  'division_head',
  'department_manager',
  'project_owner',
  'milestone_owner',
  'task_owner',
  'auditor',
  'compliance_officer',
  'viewer',
  'employee',
]);

const userTypeOptions = new Set(['employee', 'contractor', 'vendor', 'external_auditor', 'service_account']);
const accessScopeOptions = new Set(['global', 'division', 'department', 'unit', 'assigned_only']);

function safeString(value: unknown, fallback = '') {
  return value === null || value === undefined ? fallback : String(value);
}

function normalizeRole(value: unknown) {
  const role = String(value ?? '');
  if (!userRoleOptions.has(role)) throw new Error('PATCH83U_ROLE_CONTRACT_INVALID');
  return role;
}

function normalizeScope(value: unknown) {
  const scope = String(value ?? '');
  if (!accessScopeOptions.has(scope)) throw new Error('PATCH83U_SCOPE_CONTRACT_INVALID');
  return scope;
}

function patch83uRoleScopeAllowed(role: string, scope: string) {
  if (['super_admin', 'executive', 'governance_admin', 'auditor', 'compliance_officer'].includes(role)) {
    return scope === 'global';
  }
  if (role === 'division_head') return scope === 'division';
  if (role === 'department_manager') return scope === 'department';
  return ['project_owner', 'milestone_owner', 'task_owner', 'viewer', 'employee'].includes(role)
    && scope === 'assigned_only';
}

function normalizeUserType(value: unknown) {
  const userType = String(value ?? 'employee');
  return userTypeOptions.has(userType) ? userType : 'employee';
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const patch83uRequestIdPattern = /^[A-Za-z0-9._:-]{1,128}$/;
const patch83uEmployeeIdPattern = /^[A-Za-z0-9._-]{1,64}$/;
const patch83uMaxCredentialVersion = 2_147_483_647;
const patch83uPasswordPolicyMessage = 'The current Supabase Auth password policy does not accept this Employee ID as the initial password.';
const patch83uResetPasswordPolicyMessage = 'Supabase Auth did not accept the temporary password under the current password policy.';
const patch83uPermanentPasswordPolicyMessage = 'Supabase Auth did not accept the new password under the current password policy.';

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

type Patch83tUserImportCapabilities = {
  edge_contract_version: string;
  migration_173_available: boolean;
  identity_reference_action_available: boolean;
  import_execution_action_available: boolean;
  maximum_rows: number;
  runtime_status: 'compatible' | 'incompatible';
  compatible: boolean;
  server_time: string;
};

const patch83tCapabilityKeys = new Set([
  'edge_contract_version',
  'migration_173_available',
  'identity_reference_action_available',
  'import_execution_action_available',
  'maximum_rows',
  'runtime_status',
  'compatible',
  'server_time',
]);

function patch83tCapabilitiesFromResponse(value: unknown): Patch83tUserImportCapabilities | null {
  const row = asObject(value);
  const keys = Object.keys(row);
  const edgeContractVersion = String(row.edge_contract_version ?? '').trim();
  const runtimeStatus = String(row.runtime_status ?? '').trim();
  const serverTime = String(row.server_time ?? '').trim();
  if (
    keys.length !== patch83tCapabilityKeys.size
    || keys.some((key) => !patch83tCapabilityKeys.has(key))
    || !edgeContractVersion
    || !['compatible', 'incompatible'].includes(runtimeStatus)
    || typeof row.migration_173_available !== 'boolean'
    || typeof row.identity_reference_action_available !== 'boolean'
    || typeof row.import_execution_action_available !== 'boolean'
    || row.maximum_rows !== PATCH83T_MAXIMUM_ROWS
    || typeof row.compatible !== 'boolean'
    || !serverTime
    || row.compatible !== (runtimeStatus === 'compatible')
  ) {
    return null;
  }
  return {
    edge_contract_version: edgeContractVersion,
    migration_173_available: row.migration_173_available,
    identity_reference_action_available: row.identity_reference_action_available,
    import_execution_action_available: row.import_execution_action_available,
    maximum_rows: row.maximum_rows,
    runtime_status: runtimeStatus as Patch83tUserImportCapabilities['runtime_status'],
    compatible: row.compatible,
    server_time: serverTime,
  };
}

function patch83tCapabilityErrorText(error: unknown) {
  const row = asObject(error);
  return [row.code, row.message, row.details, row.hint]
    .map((value) => String(value ?? ''))
    .join(' ');
}

function isMissingPatch83tCapabilityContract(error: unknown) {
  const row = asObject(error);
  const code = String(row.code ?? '').trim().toUpperCase();
  const diagnostic = patch83tCapabilityErrorText(error);
  return ['PGRST202', '42883'].includes(code)
    && /patch83t_get_user_import_capabilities/i.test(diagnostic)
    && /does not exist|could not find|not find the function|schema cache/i.test(diagnostic);
}

function isMissingPatch83tActionContract(error: unknown, rpcName: string) {
  const row = asObject(error);
  const code = String(row.code ?? '').trim().toUpperCase();
  const diagnostic = patch83tCapabilityErrorText(error);
  return ['PGRST202', '42883'].includes(code)
    && diagnostic.includes(rpcName)
    && /does not exist|could not find|not find the function|schema cache/i.test(diagnostic);
}

function patch83tActionUnavailableResponse(action: string) {
  return errorResponse(
    'User Excel Import backend compatibility is unavailable.',
    503,
    'PATCH83T_USER_IMPORT_ACTION_UNAVAILABLE',
    'The controlled User Excel Import backend is not fully deployed. No user data was changed.',
    { action },
  );
}

function patch83tCapabilityErrorResponse(action: string, error: unknown) {
  const diagnostic = patch83tCapabilityErrorText(error);
  if (/PATCH83T_USER_ADMIN_REQUIRED/i.test(diagnostic)) {
    return errorResponse(
      'User Excel Import administrator access is required.',
      403,
      'PATCH83T_USER_ADMIN_REQUIRED',
      'The authenticated user is not authorized for controlled User Excel Import.',
      { action },
    );
  }
  if (isMissingPatch83tCapabilityContract(error)) {
    return errorResponse(
      'User Excel Import backend compatibility is unavailable.',
      503,
      'PATCH83T_USER_IMPORT_MIGRATION_REQUIRED',
      'The controlled User Excel Import backend is not fully deployed. No user data was changed.',
      { action },
    );
  }
  return errorResponse(
    'User Excel Import backend compatibility could not be verified.',
    503,
    'PATCH83T_USER_IMPORT_ACTION_UNAVAILABLE',
    'The controlled User Excel Import backend is unavailable. No user data was changed.',
    { action },
  );
}

function patch83uCredentialVersionFromMetadata(metadata: Record<string, unknown>) {
  if (!Object.prototype.hasOwnProperty.call(metadata, 'credential_version')) return 0;
  const value = metadata.credential_version;
  if (
    typeof value === 'number'
    && Number.isInteger(value)
    && value >= 0
    && value <= patch83uMaxCredentialVersion
  ) {
    return value;
  }
  if (typeof value === 'string' && /^[0-9]+$/.test(value)) {
    const parsed = Number(value);
    if (Number.isInteger(parsed) && parsed <= patch83uMaxCredentialVersion) return parsed;
  }
  return -1;
}

function patch83uStrictResponseInteger(value: unknown) {
  return typeof value === 'number'
    && Number.isInteger(value)
    && value >= 0
    && value <= patch83uMaxCredentialVersion
    ? value
    : -1;
}

function patch83uSafeCode(error: unknown, fallback: string) {
  const message = error && typeof error === 'object' && 'message' in error
    ? String((error as { message?: unknown }).message ?? '')
    : String(error ?? '');
  const code = message.match(/PATCH83U_[A-Z0-9_]+/)?.[0];
  return code ?? fallback;
}

function patch83uAuthErrorText(error: unknown) {
  const row = asObject(error);
  return [row.code, row.name, row.message, row.status]
    .map((value) => String(value ?? ''))
    .join(' ')
    .toLowerCase();
}

function patch83uIsPasswordPolicyError(error: unknown) {
  const diagnostic = patch83uAuthErrorText(error);
  return /password/.test(diagnostic)
    && /policy|weak|length|characters|at least|too short|invalid/.test(diagnostic);
}

function patch83uIsCaptchaError(error: unknown) {
  return /captcha|turnstile|challenge/.test(patch83uAuthErrorText(error));
}

function patch83uInitialPasswordPolicyResponse(action: string) {
  return errorResponse(
    patch83uPasswordPolicyMessage,
    409,
    'PATCH83U_INITIAL_PASSWORD_POLICY_BLOCKED',
    patch83uPasswordPolicyMessage,
    { action },
  );
}

function isMissingPatch83uCredentialContract(error: unknown) {
  const row = asObject(error);
  const code = String(row.code ?? '').trim().toUpperCase();
  const diagnostic = [row.message, row.details, row.hint]
    .map((value) => String(value ?? ''))
    .join(' ');
  const referencesCredentialContract = /patch83u_get_credential_state/i.test(diagnostic);
  const explicitlyMissing = /does not exist|could not find|not find the function|schema cache/i.test(diagnostic);
  return referencesCredentialContract
    && explicitlyMissing
    && ['PGRST202', '42883'].includes(code);
}

function isMissingPatch83uRuntimeContract(error: unknown) {
  const row = asObject(error);
  const code = String(row.code ?? '').trim().toUpperCase();
  const diagnostic = [row.message, row.details, row.hint]
    .map((value) => String(value ?? ''))
    .join(' ');
  const referencesRuntimeContract = /patch83u_get_capabilities/i.test(diagnostic);
  const explicitlyMissing = /does not exist|could not find|not find the function|schema cache/i.test(diagnostic);
  return referencesRuntimeContract
    && explicitlyMissing
    && ['PGRST202', '42883'].includes(code);
}

type Patch83uCapabilities = {
  edge_contract_version: string;
  installed_schema_version: number;
  runtime_enforcement_state: 'disabled' | 'prepared' | 'enforced' | 'emergency_suspended';
  credential_state_action_available: boolean;
  password_change_action_available: boolean;
  provisioning_action_available: boolean;
  reset_action_available: boolean;
  server_time: string;
  compatibility_status: string;
};

function patch83uCapabilitiesFromResponse(value: unknown): Patch83uCapabilities | null {
  const row = asObject(value);
  const runtimeState = String(row.runtime_enforcement_state ?? '');
  const installedSchemaVersion = patch83uStrictResponseInteger(row.installed_schema_version);
  const edgeContractVersion = String(row.edge_contract_version ?? '');
  const serverTime = String(row.server_time ?? '');
  const compatibilityStatus = String(row.compatibility_status ?? '');
  if (
    !patch83uRuntimeStates.has(runtimeState)
    || installedSchemaVersion !== PATCH83U_INSTALLED_SCHEMA_VERSION
    || edgeContractVersion !== PATCH83U_EDGE_CONTRACT_VERSION
    || !serverTime
    || !compatibilityStatus
    || typeof row.credential_state_action_available !== 'boolean'
    || typeof row.password_change_action_available !== 'boolean'
    || typeof row.provisioning_action_available !== 'boolean'
    || typeof row.reset_action_available !== 'boolean'
  ) {
    return null;
  }
  return {
    edge_contract_version: edgeContractVersion,
    installed_schema_version: installedSchemaVersion,
    runtime_enforcement_state: runtimeState as Patch83uCapabilities['runtime_enforcement_state'],
    credential_state_action_available: row.credential_state_action_available,
    password_change_action_available: row.password_change_action_available,
    provisioning_action_available: row.provisioning_action_available,
    reset_action_available: row.reset_action_available,
    server_time: serverTime,
    compatibility_status: compatibilityStatus,
  };
}

function patch83uRuntimeErrorResponse(action: string, error: unknown) {
  if (isMissingPatch83uRuntimeContract(error)) {
    return errorResponse(
      'Credential-governance capabilities are unavailable.',
      503,
      'PATCH83U_CREDENTIAL_MIGRATION_REQUIRED',
      'Patch 83U migration 174 is not installed on this deployment.',
      { action },
    );
  }
  return errorResponse(
    'Credential-governance capabilities could not be verified.',
    503,
    'PATCH83U_CREDENTIAL_STATE_UNAVAILABLE',
    'The authenticated deployment contract could not be verified. No application action was opened.',
    { action },
  );
}

function patch83uFailureResponse(action: string, error: unknown, fallback: string) {
  const code = patch83uSafeCode(error, fallback);
  const status = /SUPER_ADMIN|SERVICE_ROLE|ORGANIZATION|CONFIRMATION|SELF_RESET|SELF_LIFECYCLE|ACCESS_DENIED/.test(code)
    ? 403
    : /INVALID|REQUIRED/.test(code) ? 400 : 409;
  return errorResponse(
    'The protected identity operation could not be completed.',
    status,
    code,
    'No password, token, or server credential was retained in the error response.',
    { action },
  );
}
const pilotReviewStatuses = new Set([
  'draft',
  'ready_for_review',
  'approved_for_controlled_pilot',
  'approved_with_limitations',
  'blocked',
  'rejected',
]);
const pilotEventTypePattern = /^[a-z][a-z0-9_]{1,63}$/;

async function authorizePatch83q1Actor(
  serviceClient: any,
  actorId: string,
  allowedRoles: string[],
) {
  const { data: actorProfile, error: actorProfileError } = await serviceClient
    .from('profiles')
    .select('organization_id,is_active')
    .eq('id', actorId)
    .maybeSingle();
  if (actorProfileError) throw new Error('PATCH83Q1_ACTOR_PROFILE_LOOKUP_FAILED');
  if (!actorProfile?.organization_id || actorProfile.is_active === false) return false;

  const { data: actorRoles, error: actorRolesError } = await serviceClient
    .from('user_roles')
    .select('role,organization_id')
    .eq('user_id', actorId)
    .eq('is_active', true);
  if (actorRolesError) throw new Error('PATCH83Q1_ACTOR_ROLE_LOOKUP_FAILED');

  return (actorRoles ?? []).some((assignment: any) =>
    allowedRoles.includes(String(assignment.role))
    && (
      assignment.organization_id === null
      || assignment.organization_id === actorProfile.organization_id
    )
  );
}

async function authorizePatch83rActor(serviceClient: any, actorId: string): Promise<string | null> {
  const { data: actorProfile, error: actorProfileError } = await serviceClient
    .from('profiles')
    .select('organization_id,is_active,user_status')
    .eq('id', actorId)
    .maybeSingle();
  if (actorProfileError) throw new Error('PATCH83R_ACTOR_PROFILE_LOOKUP_FAILED');
  if (
    !actorProfile?.organization_id
    || actorProfile.is_active === false
    || (actorProfile.user_status && actorProfile.user_status !== 'active')
  ) return null;

  const { data: actorRoles, error: actorRolesError } = await serviceClient
    .from('user_roles')
    .select('role,scope,organization_id')
    .eq('user_id', actorId)
    .eq('is_active', true);
  if (actorRolesError) throw new Error('PATCH83R_ACTOR_ROLE_LOOKUP_FAILED');

  const authorized = (actorRoles ?? []).some((assignment: any) =>
    ['super_admin', 'governance_admin'].includes(String(assignment.role))
    && assignment.scope === 'global'
    && (
      assignment.organization_id === null
      || assignment.organization_id === actorProfile.organization_id
    )
  );
  return authorized ? String(actorProfile.organization_id) : null;
}

function normalizedDepartmentValue(value: unknown) {
  return typeof value === 'string'
    ? value.trim().replace(/\s+/g, ' ').toLocaleLowerCase()
    : '';
}

async function readUserManagementRoster(serviceClient: any, actorId: string, filters: Record<string, unknown> = {}) {
  const { data: actorProfile, error: actorProfileError } = await serviceClient
    .from('profiles')
    .select('id,organization_id,is_active,user_status')
    .eq('id', actorId)
    .maybeSingle();
  if (
    actorProfileError
    || !actorProfile?.is_active
    || actorProfile.user_status !== 'active'
    || !actorProfile.organization_id
  ) {
    throw new Error('USER_MANAGEMENT_ACTIVE_ACTOR_REQUIRED');
  }

  const { data: actorRoles, error: actorRolesError } = await serviceClient
    .from('user_roles')
    .select('role,scope,organization_id,division_id,department_id,unit_id,is_active')
    .eq('user_id', actorId)
    .eq('is_active', true);
  if (actorRolesError) throw new Error(actorRolesError.message);

  const authorized = (actorRoles ?? []).some((assignment: any) =>
    ['super_admin', 'governance_admin'].includes(String(assignment.role))
    && assignment.scope === 'global'
    && (
      assignment.organization_id === null
      || assignment.organization_id === actorProfile.organization_id
    )
    && assignment.division_id === null
    && assignment.department_id === null
    && assignment.unit_id === null
  );
  if (!authorized) throw new Error('USER_MANAGEMENT_ADMIN_REQUIRED');

  const { paged, pageSize, offset } = normalizeRosterPageRequest(filters);
  const search = safeString(filters.search).trim().replaceAll('%', '').replaceAll(',', ' ');
  const departmentId = safeString(filters.department_id).trim();
  const status = safeString(filters.status).trim();
  const userType = safeString(filters.user_type).trim();
  const requestedUserId = safeString(filters.user_id).trim();
  const roleFilter = safeString(filters.role).trim();
  let roleUserIds: string[] | null = null;
  let excludedRoleUserIds: string[] = [];
  if (roleFilter && roleFilter !== 'all') {
    let roleFilterQuery = serviceClient
      .from('user_roles')
      .select('user_id')
      .eq('is_active', true)
      .or(`organization_id.is.null,organization_id.eq.${actorProfile.organization_id}`)
      .limit(10000);
    if (roleFilter !== 'missing') roleFilterQuery = roleFilterQuery.eq('role', roleFilter);
    const roleFilterResult = await roleFilterQuery;
    if (roleFilterResult.error) throw new Error(roleFilterResult.error.message);
    const ids = Array.from(new Set<string>((roleFilterResult.data ?? []).reduce((result: string[], row: any) => {
      const userId = safeString(row.user_id);
      if (userId) result.push(userId);
      return result;
    }, [])));
    if (roleFilter === 'missing') excludedRoleUserIds = ids;
    else roleUserIds = ids;
  }
  const applyRosterFilters = (query: any) => {
    let filtered = query.eq('organization_id', actorProfile.organization_id).order('full_name_en', { ascending: true });
    if (departmentId) filtered = filtered.eq('department_id', departmentId);
    if (status && status !== 'all') filtered = filtered.eq('user_status', status);
    if (userType && userType !== 'all') filtered = filtered.eq('user_type', userType);
    if (requestedUserId) filtered = filtered.eq('id', requestedUserId);
    if (filters.missing_department === true) filtered = filtered.is('department_id', null);
    if (filters.never_logged_in === true) filtered = filtered.is('last_login_at', null);
    if (search) filtered = filtered.or(`full_name_en.ilike.%${search}%,full_name_ar.ilike.%${search}%,email.ilike.%${search}%,employee_no.ilike.%${search}%`);
    if (roleUserIds) filtered = roleUserIds.length ? filtered.in('id', roleUserIds) : filtered.eq('id', '00000000-0000-0000-0000-000000000000');
    if (excludedRoleUserIds.length) filtered = filtered.not('id', 'in', `(${excludedRoleUserIds.join(',')})`);
    return paged ? filtered.range(offset, offset + pageSize - 1) : filtered.limit(pageSize);
  };

  const patch83tSelect = 'id,organization_id,employee_no,full_name_en,full_name_ar,email,contact_email,phone,job_title,division_id,department_id,unit_id,is_active,created_at,updated_at,user_status,user_type,last_login_at,last_reviewed_at,deactivated_at,deactivated_by,deactivation_reason';
  const patch19Select = 'id,organization_id,employee_no,full_name_en,full_name_ar,email,phone,job_title,division_id,department_id,unit_id,is_active,created_at,updated_at,user_status,user_type,last_login_at,last_reviewed_at,deactivated_at,deactivated_by,deactivation_reason';
  const legacySelect = 'id,organization_id,employee_no,full_name_en,full_name_ar,email,phone,job_title,division_id,department_id,unit_id,is_active,created_at,updated_at';
  let profileResult = await applyRosterFilters(serviceClient.from('profiles').select(patch83tSelect));

  if (profileResult.error) {
    profileResult = await applyRosterFilters(serviceClient.from('profiles').select(patch19Select));
  }
  if (profileResult.error) {
    profileResult = await applyRosterFilters(serviceClient.from('profiles').select(legacySelect));
  }
  if (profileResult.error) throw new Error(profileResult.error.message);

  const profiles = profileResult.data ?? [];
  const userIds = profiles.map((profile: any) => safeString(profile.id)).filter(Boolean);
  if (!userIds.length) return [];
  const [departmentResult, divisionResult, unitResult, roleResult, credentialResult, provisioningResult] = await Promise.all([
    serviceClient.from('departments').select('id,code,name_en,name_ar').eq('organization_id', actorProfile.organization_id).limit(5000),
    serviceClient.from('divisions').select('id,name_en').eq('organization_id', actorProfile.organization_id).limit(5000),
    serviceClient.from('units').select('id,name_en').eq('organization_id', actorProfile.organization_id).limit(5000),
    userIds.length
      ? serviceClient
        .from('user_roles')
        .select('id,user_id,role,scope,organization_id,division_id,department_id,unit_id,is_active,assigned_at')
        .in('user_id', userIds)
        .or(`organization_id.is.null,organization_id.eq.${actorProfile.organization_id}`)
        .limit(20000)
      : Promise.resolve({ data: [], error: null }),
    serviceClient
      .from('user_credential_states')
      .select('user_id,auth_email,identity_mode,credential_state,credential_version,password_changed_at,password_reset_at,provisioning_id')
      .eq('organization_id', actorProfile.organization_id)
      .in('user_id', userIds),
    serviceClient
      .from('user_account_provisioning')
      .select('id,profile_id,auth_user_id,provisioning_status,updated_at')
      .eq('organization_id', actorProfile.organization_id)
      .in('profile_id', userIds),
  ]);

  if (departmentResult.error) throw new Error(departmentResult.error.message);
  if (divisionResult.error) throw new Error(divisionResult.error.message);
  if (unitResult.error) throw new Error(unitResult.error.message);
  if (roleResult.error) throw new Error(roleResult.error.message);
  if (credentialResult.error) throw new Error(credentialResult.error.message);
  if (provisioningResult.error) throw new Error(provisioningResult.error.message);

  const departments = new Map((departmentResult.data ?? []).map((row: any) => [row.id, row]));
  const divisions = new Map((divisionResult.data ?? []).map((row: any) => [row.id, row]));
  const units = new Map((unitResult.data ?? []).map((row: any) => [row.id, row]));
  const rolesByUser = new Map<string, any[]>();
  const credentialsByUser = new Map((credentialResult.data ?? []).map((row: any) => [String(row.user_id), row]));
  const provisioningByUser = new Map((provisioningResult.data ?? []).map((row: any) => [String(row.profile_id ?? row.auth_user_id), row]));
  const visibleUserIds = new Set(userIds);
  for (const row of roleResult.data ?? []) {
    const userId = safeString(row.user_id);
    if (!visibleUserIds.has(userId)) continue;
    const role = {
      user_role_id: safeString(row.id),
      role: normalizeRole(row.role),
      scope: normalizeScope(row.scope),
      organization_id: row.organization_id ?? null,
      division_id: row.division_id ?? null,
      department_id: row.department_id ?? null,
      unit_id: row.unit_id ?? null,
      is_active: row.is_active !== false,
      assigned_at: row.assigned_at ?? null,
    };
    rolesByUser.set(userId, [...(rolesByUser.get(userId) ?? []), role]);
  }

  return profiles.map((profile: any) => {
    const userId = safeString(profile.id);
    const roles = rolesByUser.get(userId) ?? [];
    const roleDepartmentId = roles.find((role: any) => role.is_active && role.department_id)?.department_id ?? null;
    const resolvedDepartmentId = profile.department_id ?? roleDepartmentId;
    const department = resolvedDepartmentId ? departments.get(resolvedDepartmentId) as any | undefined : undefined;
    const division = profile.division_id ? divisions.get(profile.division_id) as any | undefined : undefined;
    const unit = profile.unit_id ? units.get(profile.unit_id) as any | undefined : undefined;
    const active = profile.is_active !== false;
    const credential = credentialsByUser.get(userId) as any | undefined;
    const provisioning = provisioningByUser.get(userId) as any | undefined;
    const userStatus = typeof profile.user_status === 'string'
      ? profile.user_status
      : active ? 'active' : 'inactive';

    return {
      organization_id: profile.organization_id ?? null,
      user_id: userId,
      employee_no: profile.employee_no ?? null,
      full_name_en: safeString(profile.full_name_en, profile.email ?? 'User'),
      full_name_ar: profile.full_name_ar ?? null,
      email: safeString(profile.email),
      auth_email: ['employee_id_managed', 'legacy_verified'].includes(String(credential?.identity_mode ?? ''))
        && typeof credential?.auth_email === 'string' && credential.auth_email.trim()
        ? credential.auth_email.trim().toLowerCase()
        : null,
      contact_email: profile.contact_email ?? null,
      phone: profile.phone ?? null,
      job_title: profile.job_title ?? null,
      user_type: normalizeUserType(profile.user_type),
      user_status: userStatus,
      is_active: active,
      created_at: profile.created_at ?? new Date(0).toISOString(),
      updated_at: profile.updated_at ?? null,
      last_login_at: profile.last_login_at ?? null,
      last_reviewed_at: profile.last_reviewed_at ?? null,
      deactivated_at: profile.deactivated_at ?? null,
      deactivated_by: profile.deactivated_by ?? null,
      deactivation_reason: profile.deactivation_reason ?? null,
      division_id: profile.division_id ?? null,
      division_name: division?.name_en ?? null,
      department_id: resolvedDepartmentId ?? null,
      department_code: department?.code ?? null,
      department_name: department?.name_en ?? null,
      department_name_ar: department?.name_ar ?? null,
      unit_id: profile.unit_id ?? null,
      unit_name: unit?.name_en ?? null,
      active_role_count: roles.filter((role: any) => role.is_active).length,
      roles,
      linked_project_count: 0,
      linked_task_count: 0,
      linked_approval_count: 0,
      linked_evidence_count: 0,
      open_project_count: 0,
      open_task_count: 0,
      pending_approval_count: 0,
      managed_identity: credential?.identity_mode === 'employee_id_managed',
      identity_mode: credential?.identity_mode ?? null,
      synthetic_auth_email: credential?.identity_mode === 'employee_id_managed'
        ? credential.auth_email ?? null
        : null,
      credential_state: credential?.credential_state ?? null,
      credential_version: credential?.credential_version ?? null,
      must_change_password: [
        'initial_change_required',
        'admin_reset_change_required',
        'reactivation_change_required',
        'password_change_in_progress',
      ].includes(String(credential?.credential_state ?? '')),
      last_password_reset_at: credential?.password_reset_at ?? null,
      last_password_changed_at: credential?.password_changed_at ?? null,
      provisioning_state: provisioning?.provisioning_status ?? null,
      credential_proof_available: Boolean(credential),
    };
  });
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (request.method !== 'POST') {
    return errorResponse(
      'Method not allowed.',
      405,
      'METHOD_NOT_ALLOWED',
      'Privileged actions only accept POST requests.',
    );
  }

  const authorization = request.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) {
    return errorResponse(
      'Authenticated user token required.',
      401,
      'AUTH_TOKEN_REQUIRED',
      'Send a valid Authorization Bearer token from the signed-in Supabase session.',
    );
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return errorResponse(
      'Edge Function environment is incomplete.',
      500,
      'EDGE_ENV_INCOMPLETE',
      'Required server-side Supabase environment variables are not configured.',
    );
  }

  let requestBody: { action?: string; payload?: Record<string, unknown> };
  try {
    requestBody = await request.json();
  } catch {
    return errorResponse(
      'A JSON request body is required.',
      400,
      'JSON_BODY_REQUIRED',
      'Send a JSON body containing the privileged action name and payload.',
    );
  }

  const action = requestBody.action ?? '';
  if (
    !allowedActions.has(action) &&
    !patch83mDepartmentImportActions.has(action)
  ) {
    return errorResponse(
      `Unsupported privileged action: ${action}`,
      400,
      'UNSUPPORTED_PRIVILEGED_ACTION',
      'The requested privileged action is not registered on this server bridge.',
      { action },
    );
  }

  const token = authorization.slice('Bearer '.length);
  const authClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userError } = await authClient.auth.getUser(token);
  if (userError || !userData.user) {
    return errorResponse(
      'Invalid or expired authenticated user token.',
      401,
      'AUTH_TOKEN_INVALID',
      'Supabase Auth could not validate the caller session token.',
    );
  }

  const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token);
  if (claimsError || !claimsData?.claims) {
    return errorResponse(
      'Authenticated token claims could not be verified.',
      401,
      'AUTH_CLAIMS_INVALID',
      'Credential-state enforcement requires the verified JWT claims for this session.',
    );
  }
  const signedClaims = claimsData.claims as Record<string, unknown>;
  const claimAppMetadata = signedClaims.app_metadata && typeof signedClaims.app_metadata === 'object'
    ? signedClaims.app_metadata as Record<string, unknown>
    : {};
  const tokenCredentialVersion = patch83uCredentialVersionFromMetadata(claimAppMetadata);
  const tokenEmail = String(signedClaims.email ?? userData.user.email ?? '').trim().toLowerCase();
  const tokenSessionId = String(signedClaims.session_id ?? '').trim();

  const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const requestPayload = asObject(requestBody.payload);
  const frontendContractHeader = String(
    request.headers.get('x-patch83u-frontend-contract-version') ?? '',
  ).trim();
  const patch83tFrontendContractHeader = String(
    request.headers.get('x-patch83t-frontend-contract-version') ?? '',
  ).trim();
  const frontendContractPayload = String(requestPayload.frontend_contract_version ?? '').trim();
  if (
    action === 'patch83u_get_capabilities'
    && frontendContractHeader
    && frontendContractPayload
    && frontendContractHeader !== frontendContractPayload
  ) {
    return errorResponse(
      'Frontend credential-governance contracts do not match.',
      409,
      'PATCH83U_FRONTEND_CONTRACT_MISMATCH',
      'The authenticated client supplied inconsistent frontend contract versions.',
      { action },
    );
  }
  const frontendContractVersion = action === 'patch83u_get_capabilities'
    ? (frontendContractPayload || frontendContractHeader)
    : frontendContractHeader;

  const capabilityResult = await serviceClient.rpc('patch83u_get_capabilities', {
    p_actor_id: userData.user.id,
    p_edge_contract_version: PATCH83U_EDGE_CONTRACT_VERSION,
    p_frontend_contract_version: frontendContractVersion,
  });
  let capabilities: Patch83uCapabilities | null = null;
  if (capabilityResult.error) {
    // The controlled deployment order installs migration 174 in disabled mode
    // before this Edge build. If that authenticated runtime proof is missing or
    // unavailable, do not guess whether enforcement is active and never bypass
    // it with the service-role dispatcher.
    if (!(patch83tUserImportActions.has(action) && isMissingPatch83uRuntimeContract(capabilityResult.error))) {
      return patch83uRuntimeErrorResponse(action, capabilityResult.error);
    }
    // Migration 174 is an optional, later credential-governance release in the
    // Patch 83T deployment order. Only the three Patch 83T actions may continue
    // when its capability RPC is proven absent by the exact PostgREST/Postgres
    // missing-function diagnostics above. If migration 174 exists, all existing
    // capability, credential-state, session, and enforcement checks still run;
    // every other runtime error remains fail closed.
  } else {
    capabilities = patch83uCapabilitiesFromResponse(capabilityResult.data);
    if (!capabilities) {
      return errorResponse(
        'Credential-governance capability proof was invalid.',
        503,
        'PATCH83U_EDGE_CONTRACT_MISMATCH',
        'The authenticated Edge and database capability contracts are incompatible.',
        { action },
      );
    }
  }

  if (action === 'patch83u_get_capabilities') {
    if (!capabilities) {
      return errorResponse(
        'Credential-governance capabilities are unavailable.',
        503,
        'PATCH83U_CREDENTIAL_MIGRATION_REQUIRED',
        'Patch 83U migration 174 is not installed on this deployment.',
        { action },
      );
    }
    return jsonResponse({ ok: true, action, result: capabilities }, 200);
  }

  if (capabilities && patch83uActions.has(action) && frontendContractHeader !== PATCH83U_FRONTEND_CONTRACT_VERSION) {
    return errorResponse(
      'The frontend credential-governance contract is incompatible.',
      409,
      'PATCH83U_FRONTEND_CONTRACT_MISMATCH',
      'Refresh to the compatible application build or sign out.',
      { action },
    );
  }

  const runtimeState = capabilities?.runtime_enforcement_state ?? 'disabled';
  if (capabilities && patch83uEnforcedOnlyActions.has(action) && runtimeState !== 'enforced') {
    const emergency = runtimeState === 'emergency_suspended';
    return errorResponse(
      emergency
        ? 'Credential governance is temporarily suspended.'
        : 'Credential governance is not prepared for mutations.',
      409,
      emergency ? 'PATCH83U_RUNTIME_EMERGENCY_SUSPENDED' : 'PATCH83U_RUNTIME_NOT_PREPARED',
      emergency
        ? 'Password transitions, provisioning, resets, and reconciliation are disabled during emergency suspension.'
        : 'The protected runtime must be fully compatible and enforced before this action is available.',
      { action },
    );
  }

  if (
    capabilities
    && runtimeState === 'enforced'
    && (
      (action === 'patch83u_change_required_password' && !capabilities.password_change_action_available)
      || (action === 'patch83u_admin_reset_password' && !capabilities.reset_action_available)
      || (
        [
          'patch83u_list_provisioning',
          'patch83u_provision_account',
          'patch83u_reconcile_provisioning',
          'patch83u_reconcile_credential_state',
        ].includes(action)
        && !capabilities.provisioning_action_available
      )
    )
  ) {
    return errorResponse(
      'The requested credential-governance action is unavailable.',
      503,
      'PATCH83U_CREDENTIAL_STATE_UNAVAILABLE',
      'The authenticated capability contract does not advertise this protected action.',
      { action },
    );
  }

  if (
    capabilities
    && runtimeState === 'enforced'
    && (
      frontendContractHeader !== PATCH83U_FRONTEND_CONTRACT_VERSION
      || capabilities.compatibility_status !== 'compatible'
    )
  ) {
    return errorResponse(
      'The authenticated deployment contract is incompatible.',
      409,
      frontendContractHeader === PATCH83U_FRONTEND_CONTRACT_VERSION
        ? 'PATCH83U_EDGE_CONTRACT_MISMATCH'
        : 'PATCH83U_FRONTEND_CONTRACT_MISMATCH',
      'No application action was opened. Refresh to the compatible application build or sign out.',
      { action },
    );
  }

  let credentialState: Record<string, unknown> = {};
  if (
    capabilities
    && (
      runtimeState === 'enforced'
      || runtimeState === 'emergency_suspended'
      || action === 'patch83u_get_credential_state'
    )
  ) {
    if (!capabilities.credential_state_action_available) {
      return errorResponse(
        'Credential-state verification is unavailable.',
        503,
        'PATCH83U_CREDENTIAL_STATE_UNAVAILABLE',
        'The authenticated deployment does not expose the required credential-state action.',
        { action },
      );
    }
    const credentialStateResult = await serviceClient.rpc('patch83u_get_credential_state', {
      p_actor_id: userData.user.id,
      p_token_credential_version: tokenCredentialVersion,
      p_token_email: tokenEmail,
      p_session_id: tokenSessionId,
    });
    if (credentialStateResult.error) {
      if (!isMissingPatch83uCredentialContract(credentialStateResult.error)) {
        return errorResponse(
          'Credential-state verification failed.',
          503,
          'PATCH83U_CREDENTIAL_STATE_UNAVAILABLE',
          'The credential-state service could not verify this session. Access remains denied.',
          { action },
        );
      }
      return errorResponse(
        'Credential-state verification is unavailable.',
        503,
        'PATCH83U_CREDENTIAL_MIGRATION_REQUIRED',
        'Apply Patch 83U migration 174 before using the matching privileged-action deployment.',
        { action },
      );
    }
    credentialState = (credentialStateResult.data ?? {}) as Record<string, unknown>;
  }

  if (action === 'patch83u_get_credential_state') {
    return jsonResponse({ ok: true, action, result: credentialState }, 200);
  }

  let actorOrganizationId = String(credentialState.organization_id ?? '').trim();
  if (
    !actorOrganizationId
    && (
      ['assign_user_role', 'patch19_assign_user_role', 'deactivate_user_role'].includes(action)
      || patch19LifecycleActions.has(action)
    )
  ) {
    const { data: actorProfile, error: actorProfileError } = await serviceClient
      .from('profiles')
      .select('organization_id,is_active')
      .eq('id', userData.user.id)
      .maybeSingle();
    actorOrganizationId = String(actorProfile?.organization_id ?? '').trim();
    if (actorProfileError || actorProfile?.is_active !== true || !uuidPattern.test(actorOrganizationId)) {
      return errorResponse(
        'The authenticated actor organization could not be verified.',
        403,
        'PATCH83U_ORGANIZATION_SCOPE_REQUIRED',
        'Role mutations require an active profile with an exact organization boundary.',
        { action },
      );
    }
  }

  if (
    capabilities
    && ['enforced', 'emergency_suspended'].includes(runtimeState)
    && action !== 'patch83u_change_required_password'
    && credentialState.access_allowed !== true
  ) {
    return errorResponse(
      'Credential state does not permit this action.',
      403,
      'PATCH83U_CREDENTIAL_ACCESS_DENIED',
      String(credentialState.message ?? 'Change or reconcile the credential before accessing application actions.'),
      { action, credential_state: credentialState.credential_state ?? 'unknown' },
    );
  }

  let patch83tCapabilities: Patch83tUserImportCapabilities | null = null;
  if (patch83tUserImportActions.has(action)) {
    const patch83tFrontendContractPayload = action === 'patch83t_get_user_import_capabilities'
      ? frontendContractPayload
      : '';
    if (
      patch83tFrontendContractHeader !== PATCH83T_FRONTEND_CONTRACT_VERSION
      || (
        action === 'patch83t_get_user_import_capabilities'
        && patch83tFrontendContractPayload !== PATCH83T_FRONTEND_CONTRACT_VERSION
      )
    ) {
      return errorResponse(
        'The User Excel Import frontend contract is incompatible.',
        409,
        'PATCH83T_FRONTEND_CONTRACT_MISMATCH',
        'Use the matching controlled User Excel Import application build. No user data was changed.',
        { action },
      );
    }

    const patch83tCapabilityResult = await serviceClient.rpc('patch83t_get_user_import_capabilities', {
      p_actor_id: userData.user.id,
      p_edge_contract_version: PATCH83T_EDGE_CONTRACT_VERSION,
      p_frontend_contract_version: patch83tFrontendContractHeader,
    });
    if (patch83tCapabilityResult.error) {
      return patch83tCapabilityErrorResponse(action, patch83tCapabilityResult.error);
    }
    patch83tCapabilities = patch83tCapabilitiesFromResponse(patch83tCapabilityResult.data);
    if (!patch83tCapabilities) {
      return errorResponse(
        'The User Excel Import Edge contract is incompatible.',
        503,
        'PATCH83T_EDGE_CONTRACT_MISMATCH',
        'The controlled User Excel Import backend returned an invalid compatibility response. No user data was changed.',
        { action },
      );
    }

    if (action === 'patch83t_get_user_import_capabilities') {
      return jsonResponse({ ok: true, action, result: patch83tCapabilities }, 200);
    }

    const requiredActionAvailable = action === 'patch83t_user_import_identity_references'
      ? patch83tCapabilities.identity_reference_action_available
      : patch83tCapabilities.import_execution_action_available;
    if (patch83tCapabilities.edge_contract_version !== PATCH83T_EDGE_CONTRACT_VERSION) {
      return errorResponse(
        'The User Excel Import Edge contract is incompatible.',
        409,
        'PATCH83T_EDGE_CONTRACT_MISMATCH',
        'The controlled User Excel Import backend is not fully deployed. No user data was changed.',
        { action },
      );
    }
    if (
      !patch83tCapabilities.migration_173_available
      || !patch83tCapabilities.compatible
      || patch83tCapabilities.runtime_status !== 'compatible'
      || !requiredActionAvailable
    ) {
      return errorResponse(
        'User Excel Import backend compatibility is unavailable.',
        503,
        patch83tCapabilities.migration_173_available
          ? 'PATCH83T_USER_IMPORT_ACTION_UNAVAILABLE'
          : 'PATCH83T_USER_IMPORT_MIGRATION_REQUIRED',
        'The controlled User Excel Import backend is not fully deployed. No user data was changed.',
        { action },
      );
    }
  }

  if (action === 'search_grc_global') {
    const payload = asObject(requestBody.payload);
    const query = typeof payload.query === 'string' ? payload.query.trim() : '';
    const requestedLimit = typeof payload.limit === 'number' && Number.isInteger(payload.limit)
      ? payload.limit
      : 60;
    if (!query || query.length > 200 || requestedLimit < 1 || requestedLimit > 100) {
      return errorResponse(
        'The global search request is invalid.',
        400,
        'PATCH83U_GLOBAL_SEARCH_REQUEST_INVALID',
        'Provide a non-empty query of at most 200 characters and a result limit from 1 to 100.',
        { action },
      );
    }

    // Keep the caller JWT on this read. Unlike serviceClient, this client cannot
    // bypass security-invoker view dependencies or base-table RLS. The global
    // Patch 83U credential-state check above remains an additional fail-closed
    // gate before the search RPC is reached.
    const rlsClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
          // The incoming client contract has already been checked above. Carry
          // the pinned compatible contract through the caller-JWT PostgREST hop
          // so enforced credential-gated RLS can verify the same deployment.
          'x-patch83u-frontend-contract-version': PATCH83U_FRONTEND_CONTRACT_VERSION,
        },
      },
    });
    const { data, error } = await rlsClient.rpc('search_grc_global', {
      p_query: query,
      p_limit: requestedLimit,
    });
    if (error) {
      return errorResponse(
        'Global search could not be completed.',
        502,
        'PATCH83U_GLOBAL_SEARCH_FAILED',
        'The RLS-scoped search RPC rejected or could not complete the request.',
        { action },
      );
    }
    return jsonResponse({ ok: true, action, result: data ?? [] }, 200);
  }

  if (action === 'patch83t_user_import_identity_references') {
    const payload = asObject(requestBody.payload);
    const employeeIds = Array.isArray(payload.employee_ids)
      ? payload.employee_ids
      : [];
    if (
      employeeIds.length < 1
      || employeeIds.length > 5000
      || employeeIds.some((value) => typeof value !== 'string' || !patch83uEmployeeIdPattern.test(value))
      || new Set(employeeIds).size !== employeeIds.length
    ) {
      return errorResponse(
        'The User Import identity-reference request is invalid.',
        400,
        'PATCH83T_IDENTITY_REFERENCE_REQUEST_INVALID',
        'Provide 1-5,000 unique, exact Employee IDs using only letters, numbers, periods, underscores, or hyphens.',
        { action },
      );
    }
    const { data, error } = await serviceClient.rpc('patch83t_user_import_identity_references', {
      p_actor_id: userData.user.id,
      p_employee_ids: employeeIds,
    });
    if (error) {
      if (isMissingPatch83tActionContract(error, 'patch83t_user_import_identity_references')) {
        return patch83tActionUnavailableResponse(action);
      }
      return patch83uFailureResponse(action, error, 'PATCH83T_IDENTITY_REFERENCE_LOOKUP_FAILED');
    }
    return jsonResponse({ ok: true, action, result: data }, 200);
  }

  if (action === 'patch83u_list_provisioning') {
    const { data, error } = await serviceClient.rpc('patch83u_list_provisioning', {
      p_actor_id: userData.user.id,
    });
    if (error) return patch83uFailureResponse(action, error, 'PATCH83U_PROVISIONING_LIST_FAILED');
    return jsonResponse({ ok: true, action, result: data }, 200);
  }

  if (action === 'patch83u_provision_account') {
    const payload = asObject(requestBody.payload);
    const provisioningId = String(payload.provisioning_id ?? '');
    const employeeIdConfirmation = typeof payload.employee_id_confirmation === 'string'
      ? payload.employee_id_confirmation
      : '';
    const requestId = String(payload.request_id ?? '');
    if (
      !uuidPattern.test(provisioningId)
      || !employeeIdConfirmation
      || employeeIdConfirmation !== employeeIdConfirmation.trim()
      || !patch83uRequestIdPattern.test(requestId)
    ) {
      return errorResponse(
        'Valid provisioning identity and exact Employee ID confirmation are required.',
        400,
        'PATCH83U_PROVISIONING_REQUEST_INVALID',
        'Provide the protected provisioning UUID, exact Employee ID, and a safe idempotency request ID.',
        { action },
      );
    }

    const claimResult = await serviceClient.rpc('patch83u_claim_provisioning', {
      p_actor_id: userData.user.id,
      p_provisioning_id: provisioningId,
      p_request_id: requestId,
      p_employee_id_confirmation: employeeIdConfirmation,
    });
    if (claimResult.error) {
      return patch83uFailureResponse(action, claimResult.error, 'PATCH83U_PROVISIONING_CLAIM_FAILED');
    }

    const claim = asObject(claimResult.data);
    const attemptId = String(claim.attempt_id ?? '');
    const claimedProvisioningId = String(claim.provisioning_id ?? '');
    const employeeId = String(claim.employee_id ?? '');
    const authEmail = String(claim.auth_email ?? '').trim().toLowerCase();
    const expectedAuthEmail = `${employeeId.toLowerCase()}@almodawat.sa`;
    const claimOrganizationId = String(claim.organization_id ?? '');
    const authCreateRequired = claim.auth_create_required === true;
    const claimedAuthUserId = claim.auth_user_id ? String(claim.auth_user_id) : '';
    let createdAuthUserId = '';
    let reconciliationRequired = false;
    let initialPasswordPolicyBlocked = false;
    let finalizeAttempted = false;

    try {
      if (
        !uuidPattern.test(attemptId)
        || claimedProvisioningId !== provisioningId
        || employeeId !== employeeIdConfirmation
        || !patch83uEmployeeIdPattern.test(employeeId)
        || authEmail !== expectedAuthEmail
        || !uuidPattern.test(claimOrganizationId)
        || (!authCreateRequired && !uuidPattern.test(claimedAuthUserId))
      ) {
        reconciliationRequired = true;
        throw new Error('PATCH83U_PROVISIONING_CLAIM_PROOF_FAILED');
      }

      let authUser: any;
      if (authCreateRequired) {
        // A create response can be lost after Auth commits. Until a concrete
        // returned identity is verified, every non-policy failure must stop in
        // reconciliation rather than permit a duplicate retry.
        reconciliationRequired = true;
        const createResult = await serviceClient.auth.admin.createUser({
          email: authEmail,
          password: employeeId,
          email_confirm: true,
          app_metadata: {
            patch83u_managed: true,
            patch83u_provisioning_id: provisioningId,
            credential_version: 1,
            credential_state: 'initial_change_required',
            organization_id: claimOrganizationId,
          },
          user_metadata: {
            full_name_en: String(claim.full_name_en ?? ''),
            full_name_ar: claim.full_name_ar ?? null,
          },
        });
        if (createResult.error || !createResult.data.user) {
          if (patch83uIsPasswordPolicyError(createResult.error)) {
            initialPasswordPolicyBlocked = true;
            reconciliationRequired = false;
            throw new Error('PATCH83U_INITIAL_PASSWORD_POLICY_BLOCKED');
          }
          throw new Error('PATCH83U_AUTH_CREATE_FAILED');
        }
        authUser = createResult.data.user;
        createdAuthUserId = String(authUser.id ?? '');
        reconciliationRequired = false;
      } else {
        const getResult = await serviceClient.auth.admin.getUserById(claimedAuthUserId);
        if (getResult.error || !getResult.data.user) {
          reconciliationRequired = true;
          throw new Error('PATCH83U_BOUND_AUTH_LOOKUP_FAILED');
        }
        authUser = getResult.data.user;
      }

      const authUserId = String(authUser.id ?? '');
      const appMetadata = asObject(authUser.app_metadata);
      if (
        !uuidPattern.test(authUserId)
        || String(authUser.email ?? '').trim().toLowerCase() !== authEmail
        || String(appMetadata.patch83u_provisioning_id ?? '') !== provisioningId
        || patch83uCredentialVersionFromMetadata(appMetadata) !== 1
      ) {
        reconciliationRequired = true;
        throw new Error('PATCH83U_AUTH_IDENTITY_PROOF_FAILED');
      }

      // Once finalization is attempted, its database commit status can be
      // ambiguous if the response is lost. Never delete the Auth identity after
      // this point; reconciliation must prove whether finalization committed.
      finalizeAttempted = true;
      reconciliationRequired = true;
      const finalizeResult = await serviceClient.rpc('patch83u_finalize_provisioning', {
        p_actor_id: userData.user.id,
        p_provisioning_id: provisioningId,
        p_attempt_id: attemptId,
        p_auth_user_id: authUserId,
        p_verified_auth_email: authEmail,
      });
      if (finalizeResult.error) throw new Error(patch83uSafeCode(finalizeResult.error, 'PATCH83U_PROVISIONING_FINALIZE_FAILED'));

      const finalized = asObject(finalizeResult.data);
      if (
        String(finalized.provisioning_id ?? '') !== provisioningId
        || String(finalized.profile_id ?? '') !== authUserId
        || String(finalized.provisioning_status ?? '') !== 'initial_change_required'
        || String(finalized.credential_state ?? '') !== 'initial_change_required'
        || patch83uStrictResponseInteger(finalized.credential_version) !== 1
        || finalized.must_change_password !== true
      ) {
        throw new Error('PATCH83U_PROVISIONING_FINALIZE_PROOF_FAILED');
      }
      reconciliationRequired = false;
      return jsonResponse({
        ok: true,
        action,
        result: {
          provisioningId: String(finalized.provisioning_id ?? provisioningId),
          profileId: String(finalized.profile_id ?? authUserId),
          status: String(finalized.provisioning_status ?? 'initial_change_required'),
          mustChangePassword: finalized.must_change_password === true,
        },
      }, 200);
    } catch (operationError) {
      if (!finalizeAttempted && createdAuthUserId && uuidPattern.test(createdAuthUserId)) {
        const rollbackResult = await serviceClient.auth.admin.deleteUser(createdAuthUserId);
        if (rollbackResult.error) reconciliationRequired = true;
      }
      if (uuidPattern.test(attemptId)) {
        await serviceClient.rpc('patch83u_fail_provisioning', {
          p_actor_id: userData.user.id,
          p_provisioning_id: provisioningId,
          p_attempt_id: attemptId,
          p_error_code: patch83uSafeCode(operationError, 'PATCH83U_AUTH_PROVISIONING_FAILED'),
          p_error_message: initialPasswordPolicyBlocked
            ? patch83uPasswordPolicyMessage
            : 'The server-side Auth provisioning operation did not complete.',
          p_reconciliation_required: reconciliationRequired,
        });
      }
      if (initialPasswordPolicyBlocked) {
        return patch83uInitialPasswordPolicyResponse(action);
      }
      return patch83uFailureResponse(action, operationError, 'PATCH83U_AUTH_PROVISIONING_FAILED');
    }
  }

  if (action === 'patch83u_reconcile_provisioning') {
    const payload = asObject(requestBody.payload);
    const provisioningId = String(payload.provisioning_id ?? '');
    const employeeIdConfirmation = typeof payload.employee_id_confirmation === 'string'
      ? payload.employee_id_confirmation
      : '';
    const requestId = String(payload.request_id ?? '');
    if (
      !uuidPattern.test(provisioningId)
      || !employeeIdConfirmation
      || employeeIdConfirmation !== employeeIdConfirmation.trim()
      || !patch83uRequestIdPattern.test(requestId)
    ) {
      return errorResponse(
        'Valid reconciliation identity and exact Employee ID confirmation are required.',
        400,
        'PATCH83U_RECONCILIATION_REQUEST_INVALID',
        'Provide the protected provisioning UUID, exact Employee ID, and a safe idempotency request ID.',
        { action },
      );
    }
    const { data, error } = await serviceClient.rpc('patch83u_reconcile_provisioning', {
      p_actor_id: userData.user.id,
      p_provisioning_id: provisioningId,
      p_request_id: requestId,
      p_employee_id_confirmation: employeeIdConfirmation,
    });
    if (error) return patch83uFailureResponse(action, error, 'PATCH83U_PROVISIONING_RECONCILIATION_FAILED');
    const reconciled = asObject(data);
    const provisioningStatus = String(reconciled.provisioning_status ?? '');
    const reconciliationOutcome = String(reconciled.outcome ?? '');
    const allowedStatuses = new Set([
      'queued', 'auth_created_pending_finalize', 'initial_change_required',
      'completed', 'reconciliation_required',
    ]);
    const allowedOutcomes = new Set([
      'employee_id_case_insensitive_conflict', 'auth_missing_with_bound_records',
      'auth_missing_ready_to_retry', 'auth_identity_not_owned',
      'auth_user_binding_conflict', 'profile_identity_conflict',
      'profile_finalize_required', 'profile_snapshot_mismatch',
      'credential_state_mismatch', 'already_completed',
      'password_change_pending', 'lifecycle_or_role_mismatch',
    ]);
    if (
      String(reconciled.provisioning_id ?? '') !== provisioningId
      || !allowedStatuses.has(provisioningStatus)
      || !allowedOutcomes.has(reconciliationOutcome)
      || typeof reconciled.reconciliation_required !== 'boolean'
      || reconciled.reconciliation_required !== (provisioningStatus === 'reconciliation_required')
    ) {
      return errorResponse(
        'Provisioning reconciliation result proof failed.',
        409,
        'PATCH83U_PROVISIONING_RECONCILIATION_PROOF_FAILED',
        'The database mutation may already have committed. Inspect the protected provisioning and audit state before retrying.',
        { action },
      );
    }
    return jsonResponse({
      ok: true,
      action,
      result: {
        provisioningId,
        status: provisioningStatus,
        outcome: reconciliationOutcome,
      },
    }, 200);
  }

  if (action === 'patch83u_change_required_password') {
    const payload = asObject(requestBody.payload);
    const currentPassword = typeof payload.current_password === 'string' ? payload.current_password : '';
    const newPassword = typeof payload.new_password === 'string' ? payload.new_password : '';
    const confirmNewPassword = typeof payload.confirm_new_password === 'string'
      ? payload.confirm_new_password
      : '';
    const captchaToken = typeof payload.captcha_token === 'string' ? payload.captcha_token : '';
    const requestId = String(payload.request_id ?? '');
    if (
      !currentPassword
      || !newPassword
      || !confirmNewPassword
      || newPassword !== confirmNewPassword
      || currentPassword !== currentPassword.trim()
      || newPassword !== newPassword.trim()
      || confirmNewPassword !== confirmNewPassword.trim()
      || currentPassword.length > 256
      || newPassword.length > 256
      || confirmNewPassword.length > 256
      || newPassword === currentPassword
      || !uuidPattern.test(tokenSessionId)
      || !patch83uRequestIdPattern.test(requestId)
      || (payload.captcha_token !== undefined && typeof payload.captcha_token !== 'string')
      || captchaToken !== captchaToken.trim()
      || captchaToken.length > 8192
    ) {
      return errorResponse(
        'Password input or confirmation validation failed.',
        400,
        'PATCH83U_PASSWORD_CHANGE_INPUT_INVALID',
        'Provide matching non-empty password fields without surrounding whitespace, a safe request ID, and a fresh CAPTCHA token when required.',
        { action },
      );
    }

    // This first database step is read-only. The current credential is verified
    // against Supabase Auth before the idempotent transition is claimed.
    const prepareResult = await serviceClient.rpc('patch83u_prepare_required_password_change', {
      p_actor_id: userData.user.id,
      p_session_id: tokenSessionId,
      p_token_credential_version: tokenCredentialVersion,
      p_request_id: requestId,
    });
    if (prepareResult.error) {
      return patch83uFailureResponse(action, prepareResult.error, 'PATCH83U_PASSWORD_CHANGE_PREPARE_FAILED');
    }

    const prepared = asObject(prepareResult.data);
    const authEmail = String(prepared.auth_email ?? '').trim().toLowerCase();
    const employeeId = prepared.employee_id === null ? '' : String(prepared.employee_id ?? '');
    const identityMode = String(prepared.identity_mode ?? '');
    const currentCredentialVersion = patch83uStrictResponseInteger(prepared.current_credential_version);
    const completed = prepared.completed;
    const preparedStatus = String(prepared.result_status ?? '');
    if (
      String(prepared.user_id ?? '') !== userData.user.id
      || String(prepared.request_id ?? '') !== requestId
      || !authEmail
      || authEmail !== tokenEmail
      || !['employee_id_managed', 'legacy_verified'].includes(identityMode)
      || (employeeId !== '' && employeeId !== employeeId.trim())
      || (
        identityMode === 'employee_id_managed'
        && (
          !patch83uEmployeeIdPattern.test(employeeId)
          || authEmail !== `${employeeId.toLowerCase()}@almodawat.sa`
        )
      )
      || currentCredentialVersion < 0
      || typeof completed !== 'boolean'
      || !preparedStatus
      || prepared.must_reauthenticate !== true
    ) {
      return errorResponse(
        'Password-change preparation proof failed.',
        409,
        'PATCH83U_PASSWORD_CHANGE_PREPARE_PROOF_FAILED',
        'The protected credential state did not return the exact authenticated identity proof.',
        { action },
      );
    }

    if (completed) {
      if (!['active', 'recovery_required', 'session_revocation_review_required'].includes(preparedStatus)) {
        return errorResponse(
          'Password-change replay proof failed.',
          409,
          'PATCH83U_PASSWORD_CHANGE_REPLAY_PROOF_FAILED',
          'The completed idempotency result was not safe to replay.',
          { action },
        );
      }
      return jsonResponse({
        ok: true,
        action,
        result: {
          userId: userData.user.id,
          requestId,
          status: preparedStatus,
          credentialVersion: currentCredentialVersion,
          mustReauthenticate: true,
          reconciliationRequired: preparedStatus === 'recovery_required',
          sessionRevocationReviewRequired: preparedStatus === 'session_revocation_review_required',
          idempotentReplay: true,
        },
      }, 200);
    }

    const normalizedNewPassword = newPassword.toLowerCase();
    const authEmailLocalPart = authEmail.slice(0, authEmail.lastIndexOf('@')).toLowerCase();
    if (
      (employeeId && normalizedNewPassword === employeeId.toLowerCase())
      || normalizedNewPassword === authEmailLocalPart
    ) {
      return errorResponse(
        'The new password reuses a protected login identifier.',
        400,
        'PATCH83U_PERMANENT_PASSWORD_MANAGED_IDENTITY_REUSE_DENIED',
        'Choose a new password that is not the trusted Employee ID or Auth-email local part.',
        { action },
      );
    }

    const verificationClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    let operationId = '';
    let nextCredentialVersion = -1;
    let authChanged = false;
    let sessionRevocationConfirmed = false;
    let globalSessionRevocationAttempted = false;
    let globalSessionRevocationConfirmed = false;
    let reauthenticationAccessToken = '';

    try {
      const verification = await verificationClient.auth.signInWithPassword({
        email: authEmail,
        password: currentPassword,
        ...(captchaToken ? { options: { captchaToken } } : {}),
      });
      if (
        verification.error
        || !verification.data.user
        || !verification.data.session
        || verification.data.user.id !== userData.user.id
        || String(verification.data.user.email ?? '').trim().toLowerCase() !== authEmail
      ) {
        throw new Error(
          patch83uIsCaptchaError(verification.error)
            ? 'PATCH83U_CAPTCHA_VERIFICATION_FAILED'
            : 'PATCH83U_CURRENT_PASSWORD_VERIFICATION_FAILED',
        );
      }
      reauthenticationAccessToken = verification.data.session.access_token;
      const reauthenticationClaims = await verificationClient.auth.getClaims(reauthenticationAccessToken);
      const replacementClaims = asObject(reauthenticationClaims.data?.claims);
      const replacementSessionId = String(replacementClaims.session_id ?? '').trim();
      const replacementCredentialVersion = patch83uCredentialVersionFromMetadata(
        asObject(verification.data.user.app_metadata),
      );
      if (
        reauthenticationClaims.error
        || String(replacementClaims.sub ?? '') !== userData.user.id
        || !uuidPattern.test(replacementSessionId)
        || replacementCredentialVersion !== currentCredentialVersion
      ) {
        throw new Error('PATCH83U_CURRENT_PASSWORD_SESSION_PROOF_FAILED');
      }

      const beginResult = await serviceClient.rpc('patch83u_begin_required_password_change', {
        p_actor_id: userData.user.id,
        p_session_id: replacementSessionId,
        p_token_credential_version: replacementCredentialVersion,
        p_request_id: requestId,
      });
      if (beginResult.error) {
        throw new Error(patch83uSafeCode(beginResult.error, 'PATCH83U_PASSWORD_CHANGE_BEGIN_FAILED'));
      }
      const begun = asObject(beginResult.data);
      operationId = String(begun.operation_id ?? '');
      nextCredentialVersion = patch83uStrictResponseInteger(begun.next_credential_version);
      if (
        String(begun.user_id ?? '') !== userData.user.id
        || String(begun.request_id ?? '') !== requestId
        || String(begun.auth_email ?? '').trim().toLowerCase() !== authEmail
        || (begun.employee_id === null ? '' : String(begun.employee_id ?? '')) !== employeeId
        || String(begun.identity_mode ?? '') !== identityMode
        || !uuidPattern.test(operationId)
        || patch83uStrictResponseInteger(begun.current_credential_version) !== currentCredentialVersion
        || nextCredentialVersion !== currentCredentialVersion + 1
        || typeof begun.idempotent_replay !== 'boolean'
      ) {
        throw new Error('PATCH83U_PASSWORD_CHANGE_BEGIN_PROOF_FAILED');
      }

      const authLookup = await serviceClient.auth.admin.getUserById(userData.user.id);
      if (authLookup.error || !authLookup.data.user) {
        throw new Error('PATCH83U_AUTH_USER_LOOKUP_FAILED');
      }
      const currentAuthUser = authLookup.data.user;
      const currentAppMetadata = asObject(currentAuthUser.app_metadata);
      if (
        String(currentAuthUser.email ?? '').trim().toLowerCase() !== authEmail
        || patch83uCredentialVersionFromMetadata(currentAppMetadata) !== currentCredentialVersion
      ) {
        throw new Error('PATCH83U_AUTH_DATABASE_VERSION_MISMATCH');
      }

      // Revoke every currently applicable Auth session while the disposable
      // current-password proof still names an active session. Updating the Auth
      // password first can invalidate that disposable session and make a later
      // global sign-out return session_not_found without proving that every
      // other session was revoked. A failed or ambiguous global sign-out is
      // never promoted to revocation proof; finalization remains fail closed.
      globalSessionRevocationAttempted = true;
      try {
        const signOutResult = await serviceClient.auth.admin.signOut(
          reauthenticationAccessToken,
          'global',
        );
        globalSessionRevocationConfirmed = !signOutResult.error;
      } catch {
        globalSessionRevocationConfirmed = false;
      }

      // The Auth request may commit even if the client receives a transport or
      // response error. From this point forward, fail closed into database
      // reconciliation unless exact Auth proof lets the workflow finalize.
      authChanged = true;
      const updateResult = await serviceClient.auth.admin.updateUserById(userData.user.id, {
        password: newPassword,
        app_metadata: {
          ...currentAppMetadata,
          patch83u_managed: true,
          credential_version: nextCredentialVersion,
          credential_state: 'active',
        },
      });
      if (updateResult.error && patch83uIsPasswordPolicyError(updateResult.error)) {
        authChanged = false;
        throw new Error('PATCH83U_PERMANENT_PASSWORD_POLICY_REJECTED');
      }
      let verifiedAuthUser = updateResult.data.user;
      if (updateResult.error || !verifiedAuthUser) {
        const ambiguousProof = await serviceClient.auth.admin.getUserById(userData.user.id);
        const ambiguousMetadata = asObject(ambiguousProof.data.user?.app_metadata);
        const ambiguousVersion = patch83uCredentialVersionFromMetadata(ambiguousMetadata);
        if (
          ambiguousProof.error
          || !ambiguousProof.data.user
          || String(ambiguousProof.data.user.email ?? '').trim().toLowerCase() !== authEmail
        ) {
          throw new Error('PATCH83U_AUTH_PASSWORD_UPDATE_FAILED');
        }
        if (ambiguousVersion === currentCredentialVersion) {
          authChanged = false;
          throw new Error('PATCH83U_AUTH_PASSWORD_UPDATE_FAILED');
        }
        if (ambiguousVersion !== nextCredentialVersion) {
          throw new Error('PATCH83U_AUTH_PASSWORD_UPDATE_VERSION_AMBIGUOUS');
        }
        verifiedAuthUser = ambiguousProof.data.user;
      }
      const verifiedMetadata = asObject(verifiedAuthUser.app_metadata);
      if (
        verifiedAuthUser.id !== userData.user.id
        || String(verifiedAuthUser.email ?? '').trim().toLowerCase() !== authEmail
        || patch83uCredentialVersionFromMetadata(verifiedMetadata) !== nextCredentialVersion
      ) {
        throw new Error('PATCH83U_AUTH_PASSWORD_UPDATE_PROOF_FAILED');
      }

      // Only a successful supported Auth global sign-out may enter the atomic
      // zero-session finalizer. That service-only RPC holds auth.sessions stable
      // while it proves zero and finalizes, closing the insert race between a
      // separate proof query and the credential-state update. session_not_found
      // or any other ambiguous Auth result takes the existing false-proof path,
      // which can only persist session_revocation_review_required.
      let finalizeResult: { data: unknown; error: unknown };
      if (globalSessionRevocationConfirmed) {
        sessionRevocationConfirmed = true;
        finalizeResult = await serviceClient.rpc(
          'patch83u_finalize_password_change_after_revocation',
          {
            p_actor_id: userData.user.id,
            p_operation_id: operationId,
            p_request_id: requestId,
            p_applied_credential_version: nextCredentialVersion,
            p_verified_auth_email: authEmail,
          },
        );
      } else {
        sessionRevocationConfirmed = false;
        finalizeResult = await serviceClient.rpc('patch83u_finalize_required_password_change', {
          p_actor_id: userData.user.id,
          p_operation_id: operationId,
          p_request_id: requestId,
          p_applied_credential_version: nextCredentialVersion,
          p_verified_auth_email: authEmail,
          p_session_revocation_confirmed: false,
        });
      }

      if (finalizeResult.error) {
        throw new Error(patch83uSafeCode(finalizeResult.error, 'PATCH83U_PASSWORD_CHANGE_FINALIZE_FAILED'));
      }

      const finalized = asObject(finalizeResult.data);
      const finalizedState = String(finalized.credential_state ?? '');
      const finalizedNeedsReconciliation = finalized.reconciliation_required === true;
      const sessionRevocationReviewRequired = finalized.session_revocation_review_required === true;
      if (
        String(finalized.user_id ?? '') !== userData.user.id
        || String(finalized.request_id ?? '') !== requestId
        || patch83uStrictResponseInteger(finalized.credential_version) !== nextCredentialVersion
        || !['active', 'recovery_required', 'session_revocation_review_required'].includes(finalizedState)
        || finalized.must_reauthenticate !== true
        || typeof finalized.reconciliation_required !== 'boolean'
        || typeof finalized.session_revocation_review_required !== 'boolean'
        || typeof finalized.idempotent_replay !== 'boolean'
        || finalizedNeedsReconciliation !== (finalizedState === 'recovery_required')
        || sessionRevocationReviewRequired !== (finalizedState === 'session_revocation_review_required')
      ) {
        throw new Error('PATCH83U_PASSWORD_CHANGE_FINALIZE_PROOF_FAILED');
      }
      return jsonResponse({
        ok: true,
        action,
        result: {
          userId: userData.user.id,
          requestId,
          status: finalizedState,
          credentialVersion: nextCredentialVersion,
          mustReauthenticate: true,
          reconciliationRequired: finalizedNeedsReconciliation,
          sessionRevocationReviewRequired,
          idempotentReplay: finalized.idempotent_replay,
        },
      }, 200);
    } catch (operationError) {
      let abortResult: Record<string, unknown> | null = null;
      if (uuidPattern.test(operationId)) {
        const aborted = await serviceClient.rpc('patch83u_abort_required_password_change', {
          p_actor_id: userData.user.id,
          p_operation_id: operationId,
          p_request_id: requestId,
          p_auth_changed: authChanged,
          p_session_revocation_confirmed: sessionRevocationConfirmed,
          p_error_code: patch83uSafeCode(operationError, 'PATCH83U_PASSWORD_CHANGE_FAILED'),
          p_error_message: 'The protected password-change operation did not complete.',
        });
        if (!aborted.error) abortResult = asObject(aborted.data);
      }

      // A finalize response can be lost after the database commits, and an
      // attempted Auth write can be ambiguous even when the Edge call fails.
      // Prefer the idempotency ledger's exact terminal state over a generic
      // error so the browser always closes the old session and never retries a
      // completed password write under a new request ID.
      if (abortResult) {
        const abortedState = String(abortResult.credential_state ?? '');
        const abortedVersion = patch83uStrictResponseInteger(abortResult.credential_version);
        const abortedReconciliation = abortResult.reconciliation_required;
        const abortedSessionReview = abortResult.session_revocation_review_required;
        if (
          String(abortResult.user_id ?? '') === userData.user.id
          && String(abortResult.request_id ?? '') === requestId
          && ['active', 'recovery_required', 'session_revocation_review_required'].includes(abortedState)
          && abortedVersion >= 0
          && typeof abortedReconciliation === 'boolean'
          && typeof abortedSessionReview === 'boolean'
          && typeof abortResult.idempotent_replay === 'boolean'
          && abortedReconciliation === (abortedState === 'recovery_required')
          && abortedSessionReview === (abortedState === 'session_revocation_review_required')
        ) {
          return jsonResponse({
            ok: true,
            action,
            result: {
              userId: userData.user.id,
              requestId,
              status: abortedState,
              credentialVersion: abortedVersion,
              mustReauthenticate: true,
              reconciliationRequired: abortedReconciliation,
              sessionRevocationReviewRequired: abortedSessionReview,
              idempotentReplay: abortResult.idempotent_replay,
            },
          }, 200);
        }
      }
      const operationCode = patch83uSafeCode(operationError, 'PATCH83U_PASSWORD_CHANGE_FAILED');
      if (operationCode === 'PATCH83U_PERMANENT_PASSWORD_POLICY_REJECTED') {
        return errorResponse(
          patch83uPermanentPasswordPolicyMessage,
          409,
          'PATCH83U_PERMANENT_PASSWORD_POLICY_REJECTED',
          patch83uPermanentPasswordPolicyMessage,
          { action },
        );
      }
      if (operationCode === 'PATCH83U_CAPTCHA_VERIFICATION_FAILED') {
        return errorResponse(
          'The CAPTCHA challenge was not accepted.',
          400,
          operationCode,
          'Complete a fresh CAPTCHA challenge and try the authenticated password change again.',
          { action },
        );
      }
      if (operationCode === 'PATCH83U_CURRENT_PASSWORD_VERIFICATION_FAILED') {
        return errorResponse(
          'The current credential could not be verified.',
          401,
          operationCode,
          'The protected credential transition was not started.',
          { action },
        );
      }
      return patch83uFailureResponse(action, operationError, 'PATCH83U_PASSWORD_CHANGE_FAILED');
    } finally {
      if (reauthenticationAccessToken && !globalSessionRevocationAttempted) {
        try {
          await serviceClient.auth.admin.signOut(
            reauthenticationAccessToken,
            'local',
          );
        } catch {
          // Best-effort cleanup for the disposable current-password session.
          // This path runs only before any global attempt and is never global
          // revocation proof or input to credential-state finalization.
        }
      }
      reauthenticationAccessToken = '';
    }
  }

  if (action === 'patch83u_admin_reset_password') {
    const payload = asObject(requestBody.payload);
    const targetUserId = String(payload.user_id ?? '');
    const temporaryPassword = typeof payload.temporary_password === 'string'
      ? payload.temporary_password
      : '';
    const confirmTemporaryPassword = typeof payload.confirm_temporary_password === 'string'
      ? payload.confirm_temporary_password
      : '';
    const employeeIdConfirmation = typeof payload.employee_id_confirmation === 'string'
      ? payload.employee_id_confirmation
      : '';
    const resetConfirmation = typeof payload.confirmation === 'string'
      ? payload.confirmation
      : '';
    const reason = typeof payload.reason === 'string' ? payload.reason.trim() : '';
    const requestId = String(payload.request_id ?? '');
    if (
      !uuidPattern.test(targetUserId)
      || targetUserId === userData.user.id
      || !employeeIdConfirmation
      || employeeIdConfirmation !== employeeIdConfirmation.trim()
      || !temporaryPassword
      || !confirmTemporaryPassword
      || temporaryPassword !== confirmTemporaryPassword
      || temporaryPassword.length > 256
      || confirmTemporaryPassword.length > 256
      || temporaryPassword !== temporaryPassword.trim()
      || confirmTemporaryPassword !== confirmTemporaryPassword.trim()
      || resetConfirmation !== 'PATCH83U_RESET_USER_PASSWORD'
      || !reason
      || reason.length > 500
      || !patch83uRequestIdPattern.test(requestId)
    ) {
      return errorResponse(
        'The administrator reset request is invalid.',
        400,
        'PATCH83U_ADMIN_RESET_INPUT_INVALID',
        'A non-self target, exact Employee ID, matching temporary-password confirmation, exact reset confirmation, reason, and safe request ID are required.',
        { action },
      );
    }
    if (reason.includes(temporaryPassword)) {
      return errorResponse(
        'The administrator reset request is invalid.',
        400,
        'PATCH83U_ADMIN_RESET_REASON_INVALID',
        'The reset reason must not contain credential material.',
        { action },
      );
    }

    const beginResult = await serviceClient.rpc('patch83u_begin_admin_reset', {
      p_actor_id: userData.user.id,
      p_target_user_id: targetUserId,
      p_request_id: requestId,
      p_employee_id_confirmation: employeeIdConfirmation,
      p_reason: reason,
      p_confirmation: resetConfirmation,
    });
    if (beginResult.error) {
      return patch83uFailureResponse(action, beginResult.error, 'PATCH83U_ADMIN_RESET_BEGIN_FAILED');
    }

    const begun = asObject(beginResult.data);
    const operationId = String(begun.operation_id ?? '');
    const authEmail = String(begun.auth_email ?? '').trim().toLowerCase();
    const currentCredentialVersion = patch83uStrictResponseInteger(begun.current_credential_version);
    const nextCredentialVersion = patch83uStrictResponseInteger(begun.next_credential_version);
    const resultCredentialVersion = patch83uStrictResponseInteger(begun.credential_version);
    const resultStatus = String(begun.result_status ?? '');
    const completed = begun.completed;
    const begunReconciliationRequired = begun.reconciliation_required;
    const begunSessionRevocationReviewRequired = begun.session_revocation_review_required;
    const begunIdempotentReplay = begun.idempotent_replay;
    let authChanged = false;
    let sessionRevocationConfirmed = false;

    try {
      if (
        !uuidPattern.test(operationId)
        || String(begun.user_id ?? '') !== targetUserId
        || String(begun.request_id ?? '') !== requestId
        || !authEmail
        || !Number.isInteger(currentCredentialVersion)
        || !Number.isInteger(nextCredentialVersion)
        || currentCredentialVersion < 0
        || nextCredentialVersion < 1
        || nextCredentialVersion !== currentCredentialVersion + 1
        || resultCredentialVersion < 0
        || typeof completed !== 'boolean'
        || typeof begunReconciliationRequired !== 'boolean'
        || typeof begunSessionRevocationReviewRequired !== 'boolean'
        || typeof begunIdempotentReplay !== 'boolean'
      ) {
        throw new Error('PATCH83U_ADMIN_RESET_BEGIN_PROOF_FAILED');
      }

      if (completed) {
        if (
          ![
            'admin_reset_change_required',
            'recovery_required',
            'session_revocation_review_required',
          ].includes(resultStatus)
          || begunReconciliationRequired !== [
            'recovery_required',
            'session_revocation_review_required',
          ].includes(resultStatus)
          || begunSessionRevocationReviewRequired
            !== (resultStatus === 'session_revocation_review_required')
          || begunIdempotentReplay !== true
        ) {
          throw new Error('PATCH83U_ADMIN_RESET_REPLAY_PROOF_FAILED');
        }
        return jsonResponse({
          ok: true,
          action,
          result: {
            userId: targetUserId,
            requestId,
            status: resultStatus,
            credentialVersion: resultCredentialVersion,
            mustChangePassword: resultStatus === 'admin_reset_change_required',
            mustReauthenticate: true,
            reconciliationRequired: begunReconciliationRequired,
            sessionRevocationReviewRequired: begunSessionRevocationReviewRequired,
            idempotentReplay: true,
          },
        }, 200);
      }

      // A second caller must never resume an operation whose first Edge request
      // may still be updating Auth. Reconciliation owns abandoned in-progress
      // operations; only a terminal ledger result is safe to replay.
      if (begunIdempotentReplay) {
        return errorResponse(
          'The protected reset operation is already in progress.',
          409,
          'PATCH83U_ADMIN_RESET_ALREADY_IN_PROGRESS',
          'Do not change the request ID or repeat the Auth mutation. Reconcile the protected operation if it does not reach a terminal result.',
          { action },
        );
      }
      if (
        resultStatus !== 'in_progress'
        || resultCredentialVersion !== currentCredentialVersion
        || begunReconciliationRequired
        || begunSessionRevocationReviewRequired
      ) {
        throw new Error('PATCH83U_ADMIN_RESET_BEGIN_PROOF_FAILED');
      }

      const authLookup = await serviceClient.auth.admin.getUserById(targetUserId);
      if (authLookup.error || !authLookup.data.user) {
        throw new Error('PATCH83U_RESET_AUTH_USER_LOOKUP_FAILED');
      }
      const currentAuthUser = authLookup.data.user;
      const currentAppMetadata = asObject(currentAuthUser.app_metadata);
      if (
        String(currentAuthUser.email ?? '').trim().toLowerCase() !== authEmail
        || patch83uCredentialVersionFromMetadata(currentAppMetadata) !== currentCredentialVersion
      ) {
        throw new Error('PATCH83U_RESET_AUTH_DATABASE_VERSION_MISMATCH');
      }

      // Treat every attempted Auth update as potentially committed. A timeout
      // or malformed response must not restore roles against an ambiguous
      // password/version write; recovery is driven by protected Auth proof.
      authChanged = true;
      const updateResult = await serviceClient.auth.admin.updateUserById(targetUserId, {
        password: temporaryPassword,
        app_metadata: {
          ...currentAppMetadata,
          patch83u_managed: true,
          credential_version: nextCredentialVersion,
          credential_state: 'admin_reset_change_required',
        },
      });
      if (updateResult.error && patch83uIsPasswordPolicyError(updateResult.error)) {
        authChanged = false;
        throw new Error('PATCH83U_RESET_PASSWORD_POLICY_REJECTED');
      }
      if (updateResult.error || !updateResult.data.user) {
        throw new Error('PATCH83U_RESET_AUTH_PASSWORD_UPDATE_FAILED');
      }
      const updatedAuthUser = updateResult.data.user;
      const updatedMetadata = asObject(updatedAuthUser.app_metadata);
      if (
        updatedAuthUser.id !== targetUserId
        || String(updatedAuthUser.email ?? '').trim().toLowerCase() !== authEmail
        || patch83uCredentialVersionFromMetadata(updatedMetadata) !== nextCredentialVersion
      ) {
        throw new Error('PATCH83U_RESET_AUTH_UPDATE_PROOF_FAILED');
      }

      // A successful Admin response is necessary but not sufficient. Read the
      // Auth user back through the Admin API and require the exact canonical
      // email and credential-version metadata before database finalization.
      // The temporary password is never used for a target sign-in: hosted Auth
      // CAPTCHA may be mandatory and no trusted CAPTCHA token exists here.
      const followUpAuthLookup = await serviceClient.auth.admin.getUserById(targetUserId);
      const verifiedAuthUser = followUpAuthLookup.data.user;
      const verifiedMetadata = asObject(verifiedAuthUser?.app_metadata);
      if (
        followUpAuthLookup.error
        || !verifiedAuthUser
        || verifiedAuthUser.id !== targetUserId
        || String(verifiedAuthUser.email ?? '').trim().toLowerCase() !== authEmail
        || patch83uCredentialVersionFromMetadata(verifiedMetadata) !== nextCredentialVersion
      ) {
        throw new Error('PATCH83U_RESET_AUTH_FOLLOW_UP_PROOF_FAILED');
      }

      const sessionProofResult = await serviceClient.rpc(
        'patch83u_admin_reset_session_revocation_proof',
        {
          p_actor_id: userData.user.id,
          p_target_user_id: targetUserId,
          p_operation_id: operationId,
          p_request_id: requestId,
          p_applied_credential_version: nextCredentialVersion,
          p_verified_auth_email: authEmail,
        },
      );
      if (sessionProofResult.error) {
        throw new Error(patch83uSafeCode(
          sessionProofResult.error,
          'PATCH83U_ADMIN_RESET_SESSION_PROOF_FAILED',
        ));
      }
      const sessionProof = asObject(sessionProofResult.data);
      if (
        String(sessionProof.user_id ?? '') !== targetUserId
        || String(sessionProof.operation_id ?? '') !== operationId
        || String(sessionProof.request_id ?? '') !== requestId
        || patch83uStrictResponseInteger(sessionProof.credential_version) !== nextCredentialVersion
        || typeof sessionProof.sessions_revoked !== 'boolean'
      ) {
        throw new Error('PATCH83U_ADMIN_RESET_SESSION_PROOF_FAILED');
      }
      sessionRevocationConfirmed = sessionProof.sessions_revoked;

      const finalizeResult = await serviceClient.rpc('patch83u_finalize_admin_reset', {
        p_actor_id: userData.user.id,
        p_target_user_id: targetUserId,
        p_operation_id: operationId,
        p_request_id: requestId,
        p_applied_credential_version: nextCredentialVersion,
        p_verified_auth_email: authEmail,
        p_session_revocation_confirmed: sessionRevocationConfirmed,
      });
      if (finalizeResult.error) {
        throw new Error(patch83uSafeCode(finalizeResult.error, 'PATCH83U_ADMIN_RESET_FINALIZE_FAILED'));
      }

      const finalized = asObject(finalizeResult.data);
      const finalizedState = String(finalized.credential_state ?? '');
      const sessionRevocationReviewRequired = finalized.session_revocation_review_required === true;
      const mustChangePassword = finalized.must_change_password === true;
      if (
        String(finalized.user_id ?? '') !== targetUserId
        || String(finalized.request_id ?? '') !== requestId
        || !['admin_reset_change_required', 'session_revocation_review_required'].includes(finalizedState)
        || patch83uStrictResponseInteger(finalized.credential_version) !== nextCredentialVersion
        || mustChangePassword !== (finalizedState === 'admin_reset_change_required')
        || finalized.must_reauthenticate !== true
        || typeof finalized.reconciliation_required !== 'boolean'
        || typeof finalized.session_revocation_review_required !== 'boolean'
        || typeof finalized.idempotent_replay !== 'boolean'
        || sessionRevocationReviewRequired !== !sessionRevocationConfirmed
      ) {
        throw new Error('PATCH83U_ADMIN_RESET_FINALIZE_PROOF_FAILED');
      }

      return jsonResponse({
        ok: true,
        action,
        result: {
          userId: targetUserId,
          requestId,
          status: finalizedState,
          credentialVersion: nextCredentialVersion,
          mustChangePassword,
          mustReauthenticate: true,
          reconciliationRequired: finalized.reconciliation_required,
          sessionRevocationReviewRequired,
          idempotentReplay: finalized.idempotent_replay,
        },
      }, 200);
    } catch (operationError) {
      let abortResult: Record<string, unknown> | null = null;
      if (uuidPattern.test(operationId)) {
        const aborted = await serviceClient.rpc('patch83u_abort_admin_reset', {
          p_actor_id: userData.user.id,
          p_target_user_id: targetUserId,
          p_operation_id: operationId,
          p_request_id: requestId,
          p_auth_changed: authChanged,
          p_session_revocation_confirmed: sessionRevocationConfirmed,
          p_error_code: patch83uSafeCode(operationError, 'PATCH83U_ADMIN_RESET_FAILED'),
          p_error_message: 'The protected administrator reset operation did not complete.',
        });
        if (!aborted.error) abortResult = asObject(aborted.data);
      }

      // The reset ledger is authoritative after a potentially committed Auth
      // write. Return only its typed non-secret terminal proof; recovery and
      // session-review states remain non-active and are surfaced distinctly by
      // the administrator UI.
      if (abortResult) {
        const abortedState = String(abortResult.credential_state ?? '');
        const abortedVersion = patch83uStrictResponseInteger(abortResult.credential_version);
        const abortedReconciliation = abortResult.reconciliation_required;
        const abortedSessionReview = abortResult.session_revocation_review_required;
        if (
          String(abortResult.user_id ?? '') === targetUserId
          && String(abortResult.request_id ?? '') === requestId
          && [
            'admin_reset_change_required',
            'recovery_required',
            'session_revocation_review_required',
          ].includes(abortedState)
          && abortedVersion >= 0
          && typeof abortedReconciliation === 'boolean'
          && typeof abortedSessionReview === 'boolean'
          && typeof abortResult.idempotent_replay === 'boolean'
          && abortedReconciliation === [
            'recovery_required',
            'session_revocation_review_required',
          ].includes(abortedState)
          && abortedSessionReview === (abortedState === 'session_revocation_review_required')
        ) {
          return jsonResponse({
            ok: true,
            action,
            result: {
              userId: targetUserId,
              requestId,
              status: abortedState,
              credentialVersion: abortedVersion,
              mustChangePassword: abortedState === 'admin_reset_change_required',
              mustReauthenticate: true,
              reconciliationRequired: abortedReconciliation,
              sessionRevocationReviewRequired: abortedSessionReview,
              idempotentReplay: abortResult.idempotent_replay,
            },
          }, 200);
        }
      }
      if (patch83uSafeCode(operationError, '') === 'PATCH83U_RESET_PASSWORD_POLICY_REJECTED') {
        return errorResponse(
          patch83uResetPasswordPolicyMessage,
          409,
          'PATCH83U_RESET_PASSWORD_POLICY_REJECTED',
          patch83uResetPasswordPolicyMessage,
          { action },
        );
      }
      return patch83uFailureResponse(action, operationError, 'PATCH83U_ADMIN_RESET_FAILED');
    }
  }

  if (action === 'patch83u_reconcile_credential_state') {
    const payload = asObject(requestBody.payload);
    const targetUserId = String(payload.user_id ?? '');
    const employeeIdConfirmation = typeof payload.employee_id_confirmation === 'string'
      ? payload.employee_id_confirmation
      : '';
    const requestId = String(payload.request_id ?? '');
    if (
      !uuidPattern.test(targetUserId)
      || !employeeIdConfirmation
      || employeeIdConfirmation !== employeeIdConfirmation.trim()
      || !patch83uRequestIdPattern.test(requestId)
    ) {
      return errorResponse(
        'The credential reconciliation request is invalid.',
        400,
        'PATCH83U_CREDENTIAL_RECONCILIATION_INPUT_INVALID',
        'A target user, exact Employee ID, and safe request ID are required.',
        { action },
      );
    }
    const { data, error } = await serviceClient.rpc('patch83u_reconcile_credential_state', {
      p_actor_id: userData.user.id,
      p_target_user_id: targetUserId,
      p_request_id: requestId,
      p_employee_id_confirmation: employeeIdConfirmation,
    });
    if (error) {
      return patch83uFailureResponse(action, error, 'PATCH83U_CREDENTIAL_RECONCILIATION_FAILED');
    }
    const reconciled = asObject(data);
    const credentialStateValue = String(reconciled.credential_state ?? '');
    const reconciliationOutcome = String(reconciled.outcome ?? '');
    const allowedCredentialStates = new Set([
      'active', 'initial_change_required', 'admin_reset_change_required',
      'reactivation_change_required', 'disabled', 'recovery_required',
      'reconciliation_required',
    ]);
    const allowedOutcomes = new Set([
      'stale_admin_reset_aborted', 'admin_reset_auth_change_recovery_required',
      'admin_reset_finalized_from_proof', 'stale_password_change_aborted',
      'password_change_auth_change_recovery_required',
      'password_change_finalized_from_proof',
      'admin_reset_change_required_restored',
      'admin_reset_abort_restored_from_database_proof',
      'credential_access_restored_from_database_proof',
      'role_reconciliation_still_blocked', 'manual_reconciliation_still_required',
    ]);
    const reconciliationRequired = reconciled.reconciliation_required;
    if (
      String(reconciled.user_id ?? '') !== targetUserId
      || !allowedCredentialStates.has(credentialStateValue)
      || !allowedOutcomes.has(reconciliationOutcome)
      || typeof reconciliationRequired !== 'boolean'
      || reconciliationRequired !== ['recovery_required', 'reconciliation_required'].includes(credentialStateValue)
    ) {
      return errorResponse(
        'Credential reconciliation result proof failed.',
        409,
        'PATCH83U_CREDENTIAL_RECONCILIATION_PROOF_FAILED',
        'The database mutation may already have committed. Inspect protected credential and audit state before retrying.',
        { action },
      );
    }
    return jsonResponse({
      ok: true,
      action,
      result: {
        userId: targetUserId,
        credentialState: credentialStateValue,
        outcome: reconciliationOutcome,
        reconciliationRequired,
      },
    }, 200);
  }

  if (action === 'list_user_management_roster') {
    try {
      const roster = await readUserManagementRoster(serviceClient, userData.user.id, requestPayload);
      return jsonResponse({ ok: true, action, result: roster }, 200);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to load user management roster.';
      return jsonResponse({
        ok: false,
        error: message,
        action,
      }, /REQUIRED|NOT_AUTHORIZED|DENIED/i.test(message) ? 403 : 409);
    }
  }

  if (action === 'assign_user_role' || action === 'patch19_assign_user_role') {
    const payload = asObject(requestBody.payload);
    const targetUserId = String(payload.user_id ?? '').trim();
    const role = String(payload.role ?? '').trim();
    const scope = String(payload.scope ?? '').trim();
    const organizationId = payload.organization_id === null || payload.organization_id === undefined
      ? null
      : String(payload.organization_id).trim();
    const divisionId = payload.division_id === null || payload.division_id === undefined
      ? null
      : String(payload.division_id).trim();
    const departmentId = payload.department_id === null || payload.department_id === undefined
      ? null
      : String(payload.department_id).trim();
    const unitId = payload.unit_id === null || payload.unit_id === undefined
      ? null
      : String(payload.unit_id).trim();
    const reason = payload.reason === null || payload.reason === undefined
      ? null
      : String(payload.reason).trim();
    if (
      !uuidPattern.test(targetUserId)
      || !userRoleOptions.has(role)
      || !accessScopeOptions.has(scope)
      || !patch83uRoleScopeAllowed(role, scope)
      || (organizationId !== null && !uuidPattern.test(organizationId))
      || (organizationId !== null && organizationId !== actorOrganizationId)
      || (divisionId !== null && !uuidPattern.test(divisionId))
      || (departmentId !== null && !uuidPattern.test(departmentId))
      || (unitId !== null && !uuidPattern.test(unitId))
      || (reason !== null && (!reason || reason.length > 500))
    ) {
      return errorResponse(
        'The role assignment request is invalid or outside the authenticated organization.',
        400,
        'PATCH83U_ROLE_ASSIGNMENT_REQUEST_INVALID',
        'Provide an exact supported role/scope, valid hierarchy references, and an optional reason of 1-500 characters.',
        { action },
      );
    }
    const { data, error } = await serviceClient.rpc('patch83u_assign_user_role', {
      p_actor_id: userData.user.id,
      p_target_user_id: targetUserId,
      p_role: role,
      p_scope: scope,
      p_division_id: divisionId,
      p_department_id: departmentId,
      p_unit_id: unitId,
      p_reason: reason,
    });
    if (error) return patch83uFailureResponse(action, error, 'PATCH83U_ROLE_ASSIGNMENT_FAILED');
    const assigned = asObject(data);
    const assignedId = String(assigned.user_role_id ?? '').trim();
    if (
      !uuidPattern.test(assignedId)
      || String(assigned.id ?? '').trim() !== assignedId
      || String(assigned.target_user_id ?? '').trim() !== targetUserId
      || String(assigned.organization_id ?? '').trim() !== actorOrganizationId
      || String(assigned.role ?? '') !== role
      || String(assigned.scope ?? '') !== scope
      || (assigned.division_id ?? null) !== divisionId
      || (assigned.department_id ?? null) !== departmentId
      || (assigned.unit_id ?? null) !== unitId
      || !['assigned', 'reactivated', 'unchanged'].includes(String(assigned.action ?? ''))
      || assigned.is_active !== true
    ) {
      return errorResponse(
        'Role assignment result proof failed.',
        409,
        'PATCH83U_ROLE_ASSIGNMENT_PROOF_FAILED',
        'The database response could not prove the requested assignment. Inspect audit state before retrying.',
        { action },
      );
    }
    return jsonResponse({ ok: true, action, result: assigned }, 200);
  }

  if (action === 'deactivate_user_role') {
    const payload = asObject(requestBody.payload);
    const userRoleId = String(payload.user_role_id ?? '').trim();
    const reason = payload.reason === null || payload.reason === undefined
      ? null
      : String(payload.reason).trim();
    if (!uuidPattern.test(userRoleId) || (reason !== null && (!reason || reason.length > 500))) {
      return errorResponse(
        'The role deactivation request is invalid.',
        400,
        'PATCH83U_ROLE_DEACTIVATION_REQUEST_INVALID',
        'Provide the exact role-assignment UUID and an optional reason of 1-500 characters.',
        { action },
      );
    }
    const { data, error } = await serviceClient.rpc('patch83u_deactivate_user_role', {
      p_actor_id: userData.user.id,
      p_user_role_id: userRoleId,
      p_reason: reason,
    });
    if (error) return patch83uFailureResponse(action, error, 'PATCH83U_ROLE_DEACTIVATION_FAILED');
    const deactivated = asObject(data);
    const deactivatedRole = String(deactivated.role ?? '');
    const deactivatedScope = String(deactivated.scope ?? '');
    const deactivatedDivisionId = deactivated.division_id ?? null;
    const deactivatedDepartmentId = deactivated.department_id ?? null;
    const deactivatedUnitId = deactivated.unit_id ?? null;
    if (
      String(deactivated.id ?? '').trim() !== userRoleId
      || String(deactivated.user_role_id ?? '').trim() !== userRoleId
      || !uuidPattern.test(String(deactivated.target_user_id ?? '').trim())
      || String(deactivated.organization_id ?? '').trim() !== actorOrganizationId
      || !userRoleOptions.has(deactivatedRole)
      || !accessScopeOptions.has(deactivatedScope)
      || (deactivatedDivisionId !== null && !uuidPattern.test(String(deactivatedDivisionId)))
      || (deactivatedDepartmentId !== null && !uuidPattern.test(String(deactivatedDepartmentId)))
      || (deactivatedUnitId !== null && !uuidPattern.test(String(deactivatedUnitId)))
      || deactivated.action !== 'deactivated'
      || deactivated.is_active !== false
    ) {
      return errorResponse(
        'Role deactivation result proof failed.',
        409,
        'PATCH83U_ROLE_DEACTIVATION_PROOF_FAILED',
        'The database response could not prove the requested deactivation. Inspect audit state before retrying.',
        { action },
      );
    }
    return jsonResponse({ ok: true, action, result: deactivated }, 200);
  }

  if (action.startsWith('v99_')) {
    const localRuntime = /(^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$)|(^https?:\/\/kong(:\d+)?$)/i
      .test(supabaseUrl);
    const controlledPilotEnabled = Deno.env.get('V99_SCENARIO_LAB_ENABLED') === 'true';
    if (!localRuntime && !controlledPilotEnabled) {
      return jsonResponse({
        ok: false,
        error: 'Scenario Lab is disabled outside local development or an explicitly enabled controlled pilot.',
        action,
      }, 403);
    }

    const confirmation = String(requestBody.payload?.test_dataset_tag ?? '');
    if (confirmation !== 'V99_SCENARIO_LAB') {
      return jsonResponse({
        ok: false,
        error: 'Exact V99_SCENARIO_LAB dataset confirmation is required.',
        action,
      }, 400);
    }

    const rpcName = action === 'v99_create_scenario'
      ? 'v99_create_scenario'
      : action === 'v99_cleanup_scenarios'
        ? 'v99_cleanup_scenarios'
        : 'v99_scenario_status';
    const rpcArgs = action === 'v99_create_scenario'
      ? {
          p_actor_id: userData.user.id,
          p_scenario: requestBody.payload?.scenario,
          p_confirmation: confirmation,
        }
      : {
          p_actor_id: userData.user.id,
          p_confirmation: confirmation,
        };
    const { data, error } = await serviceClient.rpc(rpcName, rpcArgs);

    if (error) {
      const authorizationFailure =
        /SERVICE_ROLE|ADMIN_REQUIRED|ACTIVE_ACTOR|ORGANIZATION_MISMATCH|CONFIRMATION_REQUIRED/i
          .test(error.message);
      return jsonResponse({
        ok: false,
        error: error.message,
        code: error.code,
        action,
      }, authorizationFailure ? 403 : 409);
    }

    return jsonResponse({ ok: true, action, result: data }, 200);
  }

  if (action === 'patch83t_apply_user_excel_import') {
    if (String(requestBody.payload?.execution_confirmation ?? '') !== 'EXECUTE USER IMPORT') {
      return errorResponse(
        'Exact User Import execution confirmation is required.',
        400,
        'PATCH83T_EXECUTION_CONFIRMATION_REQUIRED',
        'Type EXECUTE USER IMPORT exactly before executing the validated workbook.',
        { action },
      );
    }
    const { data, error } = await serviceClient.rpc('patch83t_apply_user_excel_import', {
      p_actor_id: userData.user.id,
      p_payload: requestBody.payload ?? {},
    });

    if (error) {
      if (isMissingPatch83tActionContract(error, 'patch83t_apply_user_excel_import')) {
        return patch83tActionUnavailableResponse(action);
      }
      const authorizationFailure =
        /NOT_AUTHORIZED|DENIED|REQUIRED|SERVICE_ROLE|ACTIVE_ACTOR|ORGANIZATION|ADMIN|PRIVILEGED_ROLE/i
          .test(error.message);
      return jsonResponse({
        ok: false,
        error: error.message,
        code: error.code,
        action,
      }, authorizationFailure ? 403 : 409);
    }

    return jsonResponse({ ok: true, action, result: data }, 200);
  }

  if (action === 'patch19_update_user_profile') {
    const profilePayload = asObject(requestBody.payload);
    const { user_id: _targetUserId, ...profileUpdatePayload } = profilePayload;
    const { data, error } = await serviceClient.rpc('patch83t_update_user_profile', {
      p_actor_id: userData.user.id,
      p_target_user_id: profilePayload.user_id,
      p_payload: profileUpdatePayload,
    });
    if (error) {
      const authorizationFailure =
        /NOT_AUTHORIZED|DENIED|REQUIRED|SERVICE_ROLE|ACTIVE_ACTOR|ORGANIZATION|ADMIN|SUPER_ADMIN|CROSS_ORG/i
          .test(error.message);
      return jsonResponse({
        ok: false,
        error: error.message,
        code: error.code,
        action,
      }, authorizationFailure ? 403 : 409);
    }
    return jsonResponse({ ok: true, action, result: data }, 200);
  }

  if (patch19OrganizationScopedTargetActions.has(action)) {
    const payload = asObject(requestBody.payload);
    const targetUserId = String(payload.user_id ?? '');
    if (!uuidPattern.test(targetUserId)) {
      return errorResponse(
        'A valid target user is required.',
        400,
        'PATCH83U_USER_MANAGEMENT_TARGET_INVALID',
        'Provide the exact target user UUID for the controlled User Management action.',
        { action },
      );
    }
    const [actorProfileResult, targetProfileResult, actorRolesResult] = await Promise.all([
      serviceClient
        .from('profiles')
        .select('organization_id,is_active,user_status')
        .eq('id', userData.user.id)
        .maybeSingle(),
      serviceClient
        .from('profiles')
        .select('organization_id')
        .eq('id', targetUserId)
        .maybeSingle(),
      serviceClient
        .from('user_roles')
        .select('role,scope,organization_id,division_id,department_id,unit_id,is_active')
        .eq('user_id', userData.user.id)
        .eq('is_active', true),
    ]);
    const actorOrganizationId = actorProfileResult.data?.organization_id ?? null;
    const targetOrganizationId = targetProfileResult.data?.organization_id ?? null;
    const actorAuthorized = !actorProfileResult.error
      && !targetProfileResult.error
      && !actorRolesResult.error
      && actorProfileResult.data?.is_active === true
      && actorProfileResult.data?.user_status === 'active'
      && Boolean(actorOrganizationId)
      && actorOrganizationId === targetOrganizationId
      && (actorRolesResult.data ?? []).some((role: any) => (
        ['super_admin', 'governance_admin'].includes(String(role.role))
        && role.scope === 'global'
        && (role.organization_id === null || role.organization_id === actorOrganizationId)
        && role.division_id === null
        && role.department_id === null
        && role.unit_id === null
      ));
    if (!actorAuthorized) {
      return errorResponse(
        'Organization-scoped User Management authority is required.',
        403,
        'PATCH83U_USER_MANAGEMENT_ORGANIZATION_DENIED',
        'The actor and target must be active in the same organization under a canonical global Super Admin or Governance Admin role.',
        { action },
      );
    }
  }

  if (patch19LifecycleActions.has(action)) {
    const payload = asObject(requestBody.payload);
    const targetUserId = String(payload.user_id ?? '').trim();
    const reason = typeof payload.reason === 'string' ? payload.reason.trim() : '';
    const expected = ({
      patch19_deactivate_user: {
        status: 'inactive', auditAction: 'deactivated', active: false,
      },
      patch19_reactivate_user: {
        status: 'active', auditAction: 'reactivated', active: true,
      },
      patch19_archive_user: {
        status: 'archived', auditAction: 'archived', active: false,
      },
      patch19_unarchive_user: {
        status: 'active', auditAction: 'unarchived', active: true,
      },
    } as Record<string, { status: string; auditAction: string; active: boolean }>)[action];
    if (!uuidPattern.test(targetUserId) || !reason || reason.length > 500 || !expected) {
      return errorResponse(
        'The user lifecycle request is invalid.',
        400,
        'PATCH83U_USER_LIFECYCLE_REQUEST_INVALID',
        'Provide the exact target user and a non-empty lifecycle reason of at most 500 characters.',
        { action },
      );
    }

    const { data, error } = await serviceClient.rpc('patch83u_apply_user_lifecycle', {
      p_actor_id: userData.user.id,
      p_target_user_id: targetUserId,
      p_action: action,
      p_reason: reason,
    });
    if (error) return patch83uFailureResponse(action, error, 'PATCH83U_USER_LIFECYCLE_FAILED');

    const proof = asObject(data);
    const deactivatedRoleCount = patch83uStrictResponseInteger(proof.deactivated_role_count);
    const roleAuditRecordCount = patch83uStrictResponseInteger(proof.role_audit_record_count);
    const remainingActiveRoleCount = patch83uStrictResponseInteger(proof.remaining_active_role_count);
    const reactivatedRoleCount = patch83uStrictResponseInteger(proof.reactivated_role_count);
    const auditRecordCount = patch83uStrictResponseInteger(proof.audit_record_count);
    const credentialEventRecords = patch83uStrictResponseInteger(proof.credential_event_records);
    const linkedRecordCount = patch83uStrictResponseInteger(proof.linked_record_count);
    const credentialState = String(proof.credential_state ?? '');
    const expectedCredentialEventRecords = credentialState === 'reconciliation_required' ? 0 : 1;
    if (
      proof.updated !== true
      || String(proof.user_id ?? '') !== targetUserId
      || String(proof.organization_id ?? '') !== actorOrganizationId
      || proof.action !== action
      || proof.audit_action !== expected.auditAction
      || proof.user_status !== expected.status
      || proof.is_active !== expected.active
      || proof.requested_lifecycle !== expected.status
      || !uuidPattern.test(String(proof.audit_id ?? ''))
      || deactivatedRoleCount < 0
      || roleAuditRecordCount < 0
      || remainingActiveRoleCount < 0
      || reactivatedRoleCount < 0
      || auditRecordCount < 0
      || credentialEventRecords < 0
      || linkedRecordCount < 0
      || auditRecordCount !== 1
      || reactivatedRoleCount !== 0
      || deactivatedRoleCount !== roleAuditRecordCount
      || credentialEventRecords !== expectedCredentialEventRecords
      || (
        !expected.active
        && (
          credentialState !== 'disabled'
          || remainingActiveRoleCount !== 0
        )
      )
      || (
        expected.active
        && (
          !['reactivation_change_required', 'reconciliation_required'].includes(credentialState)
          || deactivatedRoleCount !== 0
          || roleAuditRecordCount !== 0
          || remainingActiveRoleCount !== 0
        )
      )
    ) {
      return errorResponse(
        'User lifecycle result proof failed.',
        409,
        'PATCH83U_USER_LIFECYCLE_PROOF_FAILED',
        'The database did not prove the exact profile, credential, role, and audit transition. Reconcile before retrying.',
        { action },
      );
    }
    return jsonResponse({ ok: true, action, result: proof }, 200);
  }

  if (action.startsWith('patch19_')) {
    const { data, error } = await serviceClient.rpc('patch19_user_management_bridge', {
      p_actor_id: userData.user.id,
      p_action: action,
      p_payload: requestBody.payload ?? {},
    });

    if (error) {
      const authorizationFailure =
        /NOT_AUTHORIZED|DENIED|REQUIRED|SERVICE_ROLE|ACTIVE_ACTOR|CROSS_ORG|ADMIN|LAST_SUPER_ADMIN|SELF_DEACTIVATION/i
          .test(error.message);
      return jsonResponse({
        ok: false,
        error: error.message,
        code: error.code,
        action,
      }, authorizationFailure ? 403 : 409);
    }

    return jsonResponse({ ok: true, action, result: data }, 200);
  }

  if (action === 'ovr_executive_dashboard_analytics') {
    const requestId = String(requestPayload.request_id ?? '').trim();
    if (!/^[A-Za-z0-9._:-]{8,96}$/.test(requestId)) {
      return errorResponse(
        'A valid analytics request ID is required.',
        400,
        'OVR_ANALYTICS_REQUEST_ID_INVALID',
        'Use a non-sensitive 8-96 character request ID.',
      );
    }

    const { data: snapshot, error: snapshotError } = await serviceClient.rpc(
      'refresh_ovr_executive_analytics_snapshot_v1',
      { p_actor_id: userData.user.id },
    );
    if (snapshotError) {
      const authorizationFailure = /NOT_AUTHORIZED|DENIED|REQUIRED|SERVICE_ROLE|ACTIVE_ACTOR|EXECUTIVE|ENTITLEMENT|CREDENTIAL|IDENTITY/i
        .test(snapshotError.message);
      console.error('OVR executive analytics snapshot refresh failed', {
        action,
        phase: 'snapshot_refresh',
        code: snapshotError.code,
        message: snapshotError.message,
      });
      return errorResponse(
        authorizationFailure ? 'Executive analytics access is restricted.' : 'Executive analytics are temporarily unavailable.',
        authorizationFailure ? 403 : 409,
        authorizationFailure ? 'OVR_EXECUTIVE_ANALYTICS_ACCESS_RESTRICTED' : 'OVR_EXECUTIVE_ANALYTICS_UNAVAILABLE',
        authorizationFailure ? 'Use an active Executive-authorized account.' : 'Retry later or contact an administrator.',
        { action },
      );
    }

    const [headlineResult, trendResult] = await Promise.all([
      serviceClient.rpc('ovr_executive_analytics_v1', {
        p_actor_id: userData.user.id,
        p_query_shape: 'headline_current_period',
        p_department_filter_id: null,
        p_category_filter: null,
        p_idempotency_key: `${requestId}:headline`,
      }),
      serviceClient.rpc('ovr_executive_analytics_v1', {
        p_actor_id: userData.user.id,
        p_query_shape: 'monthly_trend_12',
        p_department_filter_id: null,
        p_category_filter: null,
        p_idempotency_key: `${requestId}:trend`,
      }),
    ]);
    const analyticsError = headlineResult.error ?? trendResult.error;
    if (analyticsError) {
      const authorizationFailure = /NOT_AUTHORIZED|DENIED|REQUIRED|SERVICE_ROLE|ACTIVE_ACTOR|EXECUTIVE|ENTITLEMENT|CREDENTIAL|IDENTITY|FILTER|QUERY_SHAPE/i
        .test(analyticsError.message);
      console.error('OVR executive analytics query failed', {
        action,
        phase: 'fixed_query_family',
        code: analyticsError.code,
        message: analyticsError.message,
      });
      return errorResponse(
        authorizationFailure ? 'Executive analytics access is restricted.' : 'Executive analytics are temporarily unavailable.',
        authorizationFailure ? 403 : 409,
        authorizationFailure ? 'OVR_EXECUTIVE_ANALYTICS_ACCESS_RESTRICTED' : 'OVR_EXECUTIVE_ANALYTICS_UNAVAILABLE',
        authorizationFailure ? 'Use an active Executive-authorized account.' : 'Retry later or contact an administrator.',
        { action },
      );
    }

    const snapshotRecord = asObject(snapshot);
    return jsonResponse({
      ok: true,
      action,
      result: {
        snapshot: {
          snapshot_id: snapshotRecord.snapshot_id,
          snapshot_date: snapshotRecord.snapshot_date,
          generated_at: snapshotRecord.generated_at,
          definition_version: snapshotRecord.definition_version,
          privacy_model: snapshotRecord.privacy_model,
        },
        headline: headlineResult.data,
        trend: trendResult.data,
      },
    }, 200);
  }

  if (patch22RiskActions.has(action)) {
    const { data, error } = await serviceClient.rpc('patch22_risk_workflow_bridge', {
      p_actor_id: userData.user.id,
      p_action: action,
      p_payload: requestBody.payload ?? {},
    });

    if (error) {
      const authorizationFailure =
        /NOT_AUTHORIZED|DENIED|REQUIRED|SERVICE_ROLE|ACTIVE_ACTOR|CROSS_ORGANIZATION|APPROVER|RANGE|REASON|EXPIRY|BLOCKED/i
          .test(error.message);
      return jsonResponse({
        ok: false,
        error: error.message,
        code: error.code,
        action,
      }, authorizationFailure ? 403 : 409);
    }

    return jsonResponse({ ok: true, action, result: data }, 200);
  }

  if (f1r2BusinessCycleActions.has(action)) {
    const payload = requestPayload;
    let rpcName = action;
    let rpcArgs: Record<string, unknown> = { p_actor_id: userData.user.id };

    if (action === 'f1r2_create_work_item') {
      const itemType = safeString(payload.item_type).trim().toLowerCase();
      if (!['project', 'milestone', 'task'].includes(itemType)) {
        return errorResponse('The work-item type is invalid.', 400, 'F1R2_ITEM_TYPE_INVALID', 'Choose project, milestone, or task.', { action });
      }
      rpcArgs = { ...rpcArgs, p_item_type: itemType, p_payload: payload };
    } else if (action === 'f1r2_create_ovr_report' || action === 'f1r2_create_corrective_project') {
      rpcArgs = { ...rpcArgs, p_payload: payload };
    } else if (action === 'f1r2_assign_work_item') {
      rpcArgs = {
        ...rpcArgs,
        p_item_type: safeString(payload.item_type).trim().toLowerCase(),
        p_item_id: safeString(payload.item_id).trim(),
        p_assignee_id: safeString(payload.assignee_id).trim(),
        p_reason: safeString(payload.reason).trim() || null,
      };
    } else if (action === 'f1r2_respond_work_item_assignment') {
      rpcArgs = {
        ...rpcArgs,
        p_assignment_id: safeString(payload.assignment_id).trim(),
        p_decision: safeString(payload.decision).trim().toLowerCase(),
        p_decline_reason: safeString(payload.decline_reason).trim() || null,
      };
    } else if (action === 'f1r2_cancel_work_item_assignment') {
      rpcArgs = {
        ...rpcArgs,
        p_assignment_id: safeString(payload.assignment_id).trim(),
        p_reason: safeString(payload.reason).trim(),
      };
    } else if (action === 'f1r2_list_item_participants') {
      rpcArgs = {
        ...rpcArgs,
        p_item_type: safeString(payload.item_type).trim().toLowerCase(),
        p_item_id: safeString(payload.item_id).trim(),
      };
    } else if (action === 'f1r2_list_project_assignments') {
      rpcArgs = { ...rpcArgs, p_project_id: safeString(payload.project_id).trim() };
    } else if (action === 'f1r2_search_eligible_participants') {
      const itemType = safeString(payload.item_type).trim().toLowerCase();
      const itemId = safeString(payload.item_id).trim();
      const assignmentPurpose = safeString(payload.assignment_purpose).trim().toLowerCase();
      if (!['project_create', 'ovr', 'project', 'milestone', 'task'].includes(itemType)
        || (itemType !== 'project_create' && !itemId)
        || !['project_owner', 'milestone_owner', 'task_owner', 'sponsor'].includes(assignmentPurpose)) {
        return errorResponse('The participant-search context is invalid.', 400, 'F1R2_PARTICIPANT_SEARCH_CONTEXT_INVALID', 'Choose an item and assignment purpose.', { action });
      }
      rpcArgs = {
        ...rpcArgs,
        p_item_type: itemType,
        p_item_id: itemId || null,
        p_assignment_purpose: assignmentPurpose,
        p_query: safeString(payload.query).trim() || null,
        p_limit: Math.min(Math.max(Number(payload.limit) || 50, 1), 100),
      };
    } else if (action === 'f1r2_decide_approval') {
      rpcArgs = {
        ...rpcArgs,
        p_approval_id: safeString(payload.approval_id).trim(),
        p_decision: safeString(payload.decision).trim().toLowerCase(),
        p_note: safeString(payload.note).trim() || null,
      };
    } else if (action === 'f1r2_get_evidence_pack') {
      rpcArgs = {
        ...rpcArgs,
        p_item_type: safeString(payload.item_type).trim().toLowerCase(),
        p_item_id: safeString(payload.item_id).trim(),
      };
    } else if (action === 'f1r2_relink_evidence_parent') {
      const itemType = safeString(payload.item_type).trim().toLowerCase();
      const evidenceFileId = safeString(payload.evidence_file_id).trim();
      const itemId = safeString(payload.item_id).trim();
      const reason = safeString(payload.reason).trim();
      if (!['project', 'milestone', 'task', 'ovr', 'risk', 'compliance', 'audit_finding'].includes(itemType)
        || !evidenceFileId || !itemId || !reason) {
        return errorResponse('The evidence relink request is invalid.', 400, 'F1R2_EVIDENCE_RELINK_PAYLOAD_INVALID', 'Choose one governed parent and provide a reason.', { action });
      }
      rpcArgs = {
        ...rpcArgs,
        p_evidence_file_id: evidenceFileId,
        p_item_type: itemType,
        p_item_id: itemId,
        p_reason: reason,
      };
    } else if (action === 'f1r2_finalize_corrective_ovr') {
      rpcArgs = {
        ...rpcArgs,
        p_ovr_report_id: safeString(payload.ovr_report_id).trim(),
        p_final_verdict: safeString(payload.final_verdict).trim(),
        p_final_severity: safeString(payload.final_severity).trim().toLowerCase(),
        p_closure_comment: safeString(payload.closure_comment).trim(),
        p_idempotency_key: safeString(payload.idempotency_key).trim(),
      };
    }

    const { data, error } = await serviceClient.rpc(rpcName, rpcArgs);
    if (error) {
      const authorizationFailure = /DENIED|NOT_AUTHORIZED|REQUIRED|SERVICE_ROLE|ACTIVE_ACTOR|ACTIVE_CREDENTIAL|CROSS_ORGANIZATION|ONLY_ASSIGNEE|IMPERSONATION|NOT_ELIGIBLE/i.test(error.message);
      return errorResponse(
        authorizationFailure ? 'The governed business-cycle action was denied.' : 'The governed business-cycle action failed safely.',
        authorizationFailure ? 403 : 409,
        authorizationFailure ? 'F1R2_ACTION_DENIED' : 'F1R2_ACTION_FAILED',
        error.message,
        { action },
      );
    }
    return jsonResponse({ ok: true, action, result: data }, 200);
  }

  if (action === 'acc_v13_update_work_item_status') {
    const itemType = safeString(requestPayload.item_type).trim().toLowerCase();
    const itemId = safeString(requestPayload.item_id).trim();
    const status = safeString(requestPayload.status).trim().toLowerCase();
    const progress = Number(requestPayload.progress_percent);
    if (!['project', 'milestone', 'task'].includes(itemType) || !itemId || !status || !Number.isFinite(progress)) {
      return errorResponse(
        'The work-item status request is invalid.',
        400,
        'ACC_V13_STATUS_PAYLOAD_INVALID',
        'Select a supported work item, status, and progress from 0 through 100.',
        { action },
      );
    }
    const { data, error } = await serviceClient.rpc('acc_v13_update_work_item_status', {
      p_actor_id: userData.user.id,
      p_item_type: itemType,
      p_item_id: itemId,
      p_status: status,
      p_progress_percent: progress,
      p_delay_reason: safeString(requestPayload.delay_reason).trim() || null,
    });
    if (error) {
      return errorResponse(
        'The status update was not applied.',
        403,
        'ACC_V13_STATUS_UPDATE_DENIED',
        safeString(error.message).startsWith('ACC_V13_')
          ? 'Your current assignment does not authorize this status update, or the request no longer matches the controlled record.'
          : 'The controlled status update failed safely.',
        { action },
      );
    }
    return jsonResponse({ ok: true, action, result: data }, 200);
  }

  if (action === 'acc_v13_list_eligible_approvers') {
    const itemType = safeString(requestPayload.item_type).trim().toLowerCase();
    const itemId = safeString(requestPayload.item_id).trim();
    if (!['project', 'milestone', 'task'].includes(itemType) || !itemId) {
      return errorResponse('The approval context is invalid.', 400, 'ACC_V13_APPROVAL_CONTEXT_INVALID', 'Select a supported work item before choosing an approver.', { action });
    }
    const { data, error } = await serviceClient.rpc('acc_v13_list_eligible_approvers', {
      p_actor_id: userData.user.id,
      p_item_type: itemType,
      p_item_id: itemId,
    });
    if (error) {
      return errorResponse('Unable to load eligible approvers.', 403, 'ACC_V13_APPROVER_LOOKUP_DENIED', 'The work item or its governed approver scope is unavailable.', { action });
    }
    return jsonResponse({ ok: true, action, result: data ?? [] }, 200);
  }

  if (action === 'acc_v13_request_approval') {
    const itemType = safeString(requestPayload.item_type).trim().toLowerCase();
    const itemId = safeString(requestPayload.item_id).trim();
    const organizationId = safeString(requestPayload.organization_id).trim();
    const approverId = safeString(requestPayload.approver_id).trim();
    if (!['project', 'milestone', 'task'].includes(itemType) || !itemId || !organizationId || !approverId) {
      return errorResponse('The approval request is invalid.', 400, 'ACC_V13_APPROVAL_REQUEST_INVALID', 'Select a supported work item and eligible approver.', { action });
    }
    const { data, error } = await serviceClient.rpc('acc_v13_request_approval', {
      p_actor_id: userData.user.id,
      p_organization_id: organizationId,
      p_item_type: itemType,
      p_item_id: itemId,
      p_approver_id: approverId,
      p_request_note: safeString(requestPayload.request_note).trim() || null,
    });
    if (error) {
      return errorResponse('The approval request was not created.', 403, 'ACC_V13_APPROVAL_REQUEST_DENIED', 'The requester, work item, or approver no longer satisfies the governed approval scope.', { action });
    }
    return jsonResponse({ ok: true, action, result: data }, 200);
  }

  if (action === 'acc_v13_evidence_access') {
    const evidenceFileId = safeString(requestPayload.evidence_file_id).trim();
    const intent = safeString(requestPayload.intent, 'view').trim().toLowerCase();
    if (!evidenceFileId || !['view', 'download'].includes(intent)) {
      return errorResponse('The evidence access request is invalid.', 400, 'ACC_V13_EVIDENCE_REQUEST_INVALID', 'Select an evidence record and a supported access action.', { action });
    }
    const { data: accessProof, error: accessError } = await serviceClient.rpc('acc_v13_authorize_evidence_access', {
      p_actor_id: userData.user.id,
      p_evidence_file_id: evidenceFileId,
      p_intent: intent,
    });
    if (accessError || !accessProof?.file_path || !accessProof?.file_name) {
      return errorResponse('Evidence access was denied.', 403, 'ACC_V13_EVIDENCE_ACCESS_DENIED', 'The evidence record is unavailable in your current assignment and authorization scope.', { action });
    }
    const { data: signed, error: signedError } = await serviceClient.storage
      .from('grc-evidence')
      .createSignedUrl(
        String(accessProof.file_path),
        60,
        intent === 'download' ? { download: String(accessProof.file_name) } : undefined,
      );
    if (signedError || !signed?.signedUrl) {
      return errorResponse('Evidence access could not be prepared.', 503, 'ACC_V13_EVIDENCE_SIGNING_FAILED', 'The private evidence link could not be issued.', { action });
    }
    return jsonResponse({
      ok: true,
      action,
      result: {
        evidence_file_id: evidenceFileId,
        file_name: accessProof.file_name,
        file_type: accessProof.file_type ?? null,
        intent,
        expires_in_seconds: 60,
        signed_url: signed.signedUrl,
      },
    }, 200);
  }

  if (patch23EvidenceActions.has(action)) {
    const { data, error } = await serviceClient.rpc('patch23_evidence_governance_bridge', {
      p_actor_id: userData.user.id,
      p_action: action,
      p_payload: requestBody.payload ?? {},
    });

    if (error) {
      const authorizationFailure =
        /NOT_AUTHORIZED|DENIED|REQUIRED|SERVICE_ROLE|ACTIVE_ACTOR|CROSS_ORGANIZATION|REVIEWER|ADMIN|LOCKED|CLASSIFICATION|WAIVER/i
          .test(error.message);
      return jsonResponse({
        ok: false,
        error: error.message,
        code: error.code,
        action,
      }, authorizationFailure ? 403 : 409);
    }

    return jsonResponse({ ok: true, action, result: data }, 200);
  }

  if (patch24AuditActions.has(action)) {
    const { data, error } = await serviceClient.rpc('patch24_audit_finding_workflow_bridge', {
      p_actor_id: userData.user.id,
      p_action: action,
      p_payload: requestBody.payload ?? {},
    });

    if (error) {
      const authorizationFailure =
        /NOT_AUTHORIZED|DENIED|REQUIRED|SERVICE_ROLE|ACTIVE_ACTOR|CROSS_ORGANIZATION|REVIEWER|VALIDATOR|APPROVER|ADMIN|BLOCKED|EVIDENCE|WAIVER|REASON/i
          .test(error.message);
      return jsonResponse({
        ok: false,
        error: error.message,
        code: error.code,
        action,
      }, authorizationFailure ? 403 : 409);
    }

    return jsonResponse({ ok: true, action, result: data }, 200);
  }

  if (patch68EvidenceClosureActions.has(action)) {
    const rpcName = action;
    const rpcArgs = action === 'record_production_evidence_closure_action'
      ? {
          p_actor_id: userData.user.id,
          p_evidence_id: requestBody.payload?.evidence_id,
          p_action_type: requestBody.payload?.action_type,
          p_action_reason: requestBody.payload?.action_reason ?? null,
          p_action_note: requestBody.payload?.action_note ?? null,
          p_previous_state: requestBody.payload?.previous_state ?? null,
          p_has_blocker: Boolean(requestBody.payload?.has_blocker),
          p_metadata: requestBody.payload?.metadata ?? {},
        }
      : {
          p_actor_id: userData.user.id,
          p_evidence_id: requestBody.payload?.evidence_id,
        };
    const { data, error } = await serviceClient.rpc(rpcName, rpcArgs);

    if (error) {
      const authorizationFailure =
        /NOT_AUTHORIZED|DENIED|REQUIRED|SERVICE_ROLE|ACTIVE_ACTOR|ORGANIZATION|ROLE|REASON|BLOCKER|AUTHORIZED/i
          .test(error.message);
      return jsonResponse({
        ok: false,
        error: error.message,
        code: error.code,
        action,
      }, authorizationFailure ? 403 : 409);
    }

    return jsonResponse({ ok: true, action, result: data }, 200);
  }

  if (patch76CutoverDecisionActions.has(action)) {
    const rpcName = action;
    const rpcArgs = action === 'create_controlled_production_cutover_decision'
      ? {
          p_actor_id: userData.user.id,
          p_decision_state: requestBody.payload?.decision_state,
          p_decision_title: requestBody.payload?.decision_title,
          p_decision_summary: requestBody.payload?.decision_summary ?? null,
          p_critical_blockers_count: requestBody.payload?.critical_blockers_count ?? 0,
          p_limitations_count: requestBody.payload?.limitations_count ?? 0,
          p_limitations_reviewed: Boolean(requestBody.payload?.limitations_reviewed),
          p_cutover_checklist_complete: Boolean(requestBody.payload?.cutover_checklist_complete),
          p_evidence_gate_snapshot: requestBody.payload?.evidence_gate_snapshot ?? {},
          p_decision_rationale: requestBody.payload?.decision_rationale,
        }
      : {
          p_actor_id: userData.user.id,
          p_decision_id: requestBody.payload?.decision_id,
          p_event_type: requestBody.payload?.event_type,
          p_event_summary: requestBody.payload?.event_summary,
          p_event_payload: requestBody.payload?.event_payload ?? {},
        };
    const { data, error } = await serviceClient.rpc(rpcName, rpcArgs);

    if (error) {
      const authorizationFailure =
        /NOT_AUTHORIZED|DENIED|REQUIRED|SERVICE_ROLE|ACTIVE_ACTOR|ORGANIZATION|ROLE|AUTHORIZED|BLOCKERS|CHECKLIST|LIMITATION|RATIONALE/i
          .test(error.message);
      return jsonResponse({
        ok: false,
        error: error.message,
        code: error.code,
        action,
      }, authorizationFailure ? 403 : 409);
    }

    return jsonResponse({ ok: true, action, result: data }, 200);
  }

  if (patch77LivePilotActions.has(action)) {
    const rpcName = action;
    const payload = requestBody.payload ?? {};
    const rpcArgs = action === 'create_live_pilot_session'
      ? {
          p_actor_id: userData.user.id,
          p_session_title: payload.session_title,
          p_department_id: payload.department_id ?? null,
          p_participant_count: payload.participant_count ?? 0,
        }
      : action === 'update_live_pilot_session_status'
        ? {
            p_actor_id: userData.user.id,
            p_session_id: payload.session_id,
            p_session_status: payload.session_status,
            p_exit_review_notes: payload.exit_review_notes ?? null,
            p_exit_criteria_met: Boolean(payload.exit_criteria_met),
          }
        : action === 'create_live_pilot_issue'
          ? {
              p_actor_id: userData.user.id,
              p_pilot_session_id: payload.pilot_session_id,
              p_issue_title: payload.issue_title,
              p_issue_description: payload.issue_description ?? null,
              p_severity: payload.severity ?? 'medium',
              p_owner_id: payload.owner_id ?? null,
              p_department_id: payload.department_id ?? null,
              p_due_date: payload.due_date ?? null,
              p_retest_required: payload.retest_required ?? true,
            }
          : action === 'update_live_pilot_issue_status'
            ? {
                p_actor_id: userData.user.id,
                p_issue_id: payload.issue_id,
                p_issue_status: payload.issue_status,
                p_retest_status: payload.retest_status ?? null,
                p_retest_evidence_summary: payload.retest_evidence_summary ?? null,
                p_closure_summary: payload.closure_summary ?? null,
              }
            : {
                p_actor_id: userData.user.id,
                p_pilot_session_id: payload.pilot_session_id,
                p_department_id: payload.department_id,
                p_acceptance_status: payload.acceptance_status,
                p_acceptance_notes: payload.acceptance_notes ?? null,
                p_open_blockers_count: payload.open_blockers_count ?? 0,
                p_training_confirmed: Boolean(payload.training_confirmed),
                p_issue_burndown_confirmed: Boolean(payload.issue_burndown_confirmed),
              };
    const { data, error } = await serviceClient.rpc(rpcName, rpcArgs);

    if (error) {
      const authorizationFailure =
        /NOT_AUTHORIZED|DENIED|REQUIRED|SERVICE_ROLE|ACTIVE_ACTOR|ORGANIZATION|ROLE|AUTHORIZED|RETEST|BLOCKERS|TRAINING|BURN-DOWN|CRITERIA|ACCEPTANCE/i
          .test(error.message);
      return jsonResponse({
        ok: false,
        error: error.message,
        code: error.code,
        action,
      }, authorizationFailure ? 403 : 409);
    }

    return jsonResponse({ ok: true, action, result: data }, 200);
  }

  if (patch78IdentityIntegrityActions.has(action)) {
    const rpcName = action;
    const payload = requestBody.payload ?? {};
    const rpcArgs = action === 'create_identity_role_integrity_review'
      ? {
          p_actor_id: userData.user.id,
          p_review_title: payload.review_title,
          p_review_notes: payload.review_notes ?? null,
          p_sso_mfa_readiness_status: payload.sso_mfa_readiness_status ?? 'review_required',
          p_access_export_status: payload.access_export_status ?? 'not_ready',
        }
      : action === 'update_identity_role_integrity_review_status'
        ? {
            p_actor_id: userData.user.id,
            p_review_id: payload.review_id,
            p_review_status: payload.review_status,
            p_review_notes: payload.review_notes ?? null,
            p_sso_mfa_readiness_status: payload.sso_mfa_readiness_status ?? null,
            p_access_export_status: payload.access_export_status ?? null,
          }
        : action === 'record_identity_role_integrity_finding'
          ? {
              p_actor_id: userData.user.id,
              p_review_id: payload.review_id,
              p_finding_type: payload.finding_type,
              p_severity: payload.severity ?? 'medium',
              p_entity_type: payload.entity_type ?? 'user',
              p_finding_title: payload.finding_title,
              p_finding_summary: payload.finding_summary ?? null,
              p_entity_id: payload.entity_id ?? null,
              p_department_id: payload.department_id ?? null,
              p_owner_id: payload.owner_id ?? null,
              p_due_date: payload.due_date ?? null,
            }
          : action === 'update_identity_role_integrity_finding_status'
            ? {
                p_actor_id: userData.user.id,
                p_finding_id: payload.finding_id,
                p_finding_status: payload.finding_status,
                p_resolution_summary: payload.resolution_summary ?? null,
              }
            : {
                p_actor_id: userData.user.id,
                p_review_id: payload.review_id,
                p_user_id: payload.user_id,
                p_role_name: payload.role_name,
                p_recertification_status: payload.recertification_status,
                p_recertification_rationale: payload.recertification_rationale ?? null,
                p_department_id: payload.department_id ?? null,
              };
    const { data, error } = await serviceClient.rpc(rpcName, rpcArgs);

    if (error) {
      const authorizationFailure =
        /NOT_AUTHORIZED|DENIED|REQUIRED|SERVICE_ROLE|ACTIVE_ACTOR|ORGANIZATION|ROLE|AUTHORIZED|HIGH-RISK|RECERTIFICATION|OWNER|REVIEWER|EXPORT|RATIONALE|LIMITATION/i
          .test(error.message);
      return jsonResponse({
        ok: false,
        error: error.message,
        code: error.code,
        action,
      }, authorizationFailure ? 403 : 409);
    }

    return jsonResponse({ ok: true, action, result: data }, 200);
  }

  if (patch79OperationsGovernanceActions.has(action)) {
    const rpcName = action;
    const payload = requestBody.payload ?? {};
    const rpcArgs = action === 'create_production_hypercare_window'
      ? {
          p_actor_id: userData.user.id,
          p_hypercare_title: payload.hypercare_title,
          p_exit_review_notes: payload.exit_review_notes ?? null,
        }
      : action === 'update_production_hypercare_window_status'
        ? {
            p_actor_id: userData.user.id,
            p_hypercare_window_id: payload.hypercare_window_id,
            p_hypercare_status: payload.hypercare_status,
            p_day_30_status: payload.day_30_status ?? null,
            p_day_60_status: payload.day_60_status ?? null,
            p_day_90_status: payload.day_90_status ?? null,
            p_evidence_pack_status: payload.evidence_pack_status ?? null,
            p_board_pack_status: payload.board_pack_status ?? null,
            p_exit_review_notes: payload.exit_review_notes ?? null,
          }
        : action === 'record_production_hypercare_item'
          ? {
              p_actor_id: userData.user.id,
              p_hypercare_window_id: payload.hypercare_window_id,
              p_item_type: payload.item_type,
              p_item_title: payload.item_title,
              p_severity: payload.severity ?? 'medium',
              p_item_summary: payload.item_summary ?? null,
              p_department_id: payload.department_id ?? null,
              p_owner_id: payload.owner_id ?? null,
              p_due_date: payload.due_date ?? null,
            }
          : action === 'update_production_hypercare_item_status'
            ? {
                p_actor_id: userData.user.id,
                p_item_id: payload.item_id,
                p_item_status: payload.item_status,
                p_evidence_summary: payload.evidence_summary ?? null,
                p_closure_summary: payload.closure_summary ?? null,
              }
            : action === 'create_executive_governance_board_pack'
              ? {
                  p_actor_id: userData.user.id,
                  p_pack_title: payload.pack_title,
                  p_reporting_period: payload.reporting_period,
                  p_hypercare_window_id: payload.hypercare_window_id ?? null,
                  p_executive_summary: payload.executive_summary ?? null,
                }
              : {
                  p_actor_id: userData.user.id,
                  p_board_pack_id: payload.board_pack_id,
                  p_pack_status: payload.pack_status,
                  p_board_review_notes: payload.board_review_notes ?? null,
                };
    const { data, error } = await serviceClient.rpc(rpcName, rpcArgs);

    if (error) {
      const authorizationFailure =
        /NOT_AUTHORIZED|DENIED|REQUIRED|SERVICE_ROLE|ACTIVE_ACTOR|ORGANIZATION|ROLE|AUTHORIZED|HYPERCARE|BOARD|CRITICAL|SUPPORT|EVIDENCE|CLOSURE|LIMITATION/i
          .test(error.message);
      return jsonResponse({
        ok: false,
        error: error.message,
        code: error.code,
        action,
      }, authorizationFailure ? 403 : 409);
    }

    return jsonResponse({ ok: true, action, result: data }, 200);
  }

  if (patch83rDepartmentLifecycleActions.has(action)) {
    const payload = requestBody.payload ?? {};
    let actorOrganizationId: string | null = null;
    try {
      actorOrganizationId = await authorizePatch83rActor(serviceClient, userData.user.id);
    } catch {
      return errorResponse(
        'Unable to verify department lifecycle authority.',
        500,
        'DEPARTMENT_LIFECYCLE_AUTHORIZATION_FAILED',
        'The server could not safely verify the authenticated actor profile and organization-scoped role.',
        { action },
      );
    }
    if (!actorOrganizationId) {
      return errorResponse(
        'Department lifecycle authority required.',
        403,
        'DEPARTMENT_LIFECYCLE_ROLE_REQUIRED',
        'An active global super_admin or governance_admin role in the authenticated actor organization is required.',
        { action },
      );
    }

    const departmentId = typeof payload.department_id === 'string' ? payload.department_id.trim() : '';
    const successorDepartmentId = payload.successor_department_id === null || payload.successor_department_id === undefined
      ? null
      : typeof payload.successor_department_id === 'string' ? payload.successor_department_id.trim() : '';
    const nameEn = typeof payload.name_en === 'string' ? payload.name_en.trim() : '';
    const nameAr = typeof payload.name_ar === 'string' ? payload.name_ar.trim() : '';
    const archiveReason = typeof payload.archive_reason === 'string' ? payload.archive_reason.trim() : '';
    const requestId = payload.request_id === null || payload.request_id === undefined
      ? null
      : typeof payload.request_id === 'string' ? payload.request_id.trim() : '';

    if (!uuidPattern.test(departmentId)) {
      return errorResponse('A valid department UUID is required.', 400, 'DEPARTMENT_UUID_INVALID',
        'The department_id must be a canonical UUID.', { action });
    }
    if (successorDepartmentId !== null && !uuidPattern.test(successorDepartmentId)) {
      return errorResponse('A valid successor department UUID is required.', 400, 'SUCCESSOR_DEPARTMENT_UUID_INVALID',
        'When provided, successor_department_id must be a canonical UUID.', { action });
    }
    if (requestId !== null && (!requestId || requestId.length > 128 || !/^[a-zA-Z0-9:._-]+$/.test(requestId))) {
      return errorResponse('Invalid lifecycle request identifier.', 400, 'DEPARTMENT_REQUEST_ID_INVALID',
        'When provided, request_id must use safe identifier characters and be no longer than 128 characters.', { action });
    }
    if (action === 'department_lifecycle_rename' && ((!nameEn && !nameAr) || nameEn.length > 180 || nameAr.length > 180)) {
      return errorResponse('Valid department names are required.', 400, 'DEPARTMENT_NAMES_INVALID',
        'Provide at least one non-empty Arabic or English name; each name may be at most 180 characters.', { action });
    }
    if (action === 'department_lifecycle_archive' && (!archiveReason || archiveReason.length > 1000)) {
      return errorResponse('A valid archive reason is required.', 400, 'DEPARTMENT_ARCHIVE_REASON_INVALID',
        'Provide a non-empty archive reason no longer than 1,000 characters.', { action });
    }
    if (action === 'department_lifecycle_archive' && successorDepartmentId === departmentId) {
      return errorResponse('A department cannot succeed itself.', 400, 'DEPARTMENT_SUCCESSOR_SELF_DENIED',
        'Choose a different active department as the successor.', { action });
    }

    let rpcResult: { data: unknown; error: any };
    if (action === 'department_lifecycle_preview') {
      rpcResult = await serviceClient.rpc('department_lifecycle_preview', {
        p_actor_id: userData.user.id,
        p_department_id: departmentId,
      });
    } else if (action === 'department_lifecycle_rename') {
      rpcResult = await serviceClient.rpc('department_lifecycle_rename', {
        p_actor_id: userData.user.id,
        p_department_id: departmentId,
        p_name_en: nameEn,
        p_name_ar: nameAr,
        p_request_id: requestId,
      });
    } else if (action === 'department_lifecycle_archive') {
      rpcResult = await serviceClient.rpc('department_lifecycle_archive', {
        p_actor_id: userData.user.id,
        p_department_id: departmentId,
        p_archive_reason: archiveReason,
        p_successor_department_id: successorDepartmentId,
        p_request_id: requestId,
      });
    } else {
      rpcResult = await serviceClient.rpc('department_lifecycle_restore', {
        p_actor_id: userData.user.id,
        p_department_id: departmentId,
        p_request_id: requestId,
      });
    }

    const { data, error } = rpcResult;
    if (error) {
      const message = String(error.message ?? '');
      const knownCode = [
        'PATCH83R_ADMIN_ROLE_REQUIRED',
        'PATCH83R_DEPARTMENT_NOT_FOUND',
        'PATCH83R_DEPARTMENT_NAME_REQUIRED',
        'PATCH83R_DEPARTMENT_NAME_TOO_LONG',
        'PATCH83R_ARCHIVED_DEPARTMENT_RENAME_DENIED',
        'PATCH83R_ACTIVE_DEPARTMENT_NAME_CONFLICT',
        'PATCH83R_ARCHIVE_REASON_REQUIRED',
        'PATCH83R_ARCHIVE_REASON_TOO_LONG',
        'PATCH83R_DEPARTMENT_ALREADY_ARCHIVED',
        'PATCH83R_SUCCESSOR_SELF_DENIED',
        'PATCH83R_ACTIVE_USERS_REQUIRE_SUCCESSOR',
        'PATCH83R_ACTIVE_SUCCESSOR_REQUIRED',
        'PATCH83R_USER_REASSIGNMENT_INCOMPLETE',
        'PATCH83R_DEPARTMENT_NOT_ARCHIVED',
      ].find((code) => message.includes(code));
      return errorResponse(
        knownCode === 'PATCH83R_ADMIN_ROLE_REQUIRED'
          ? 'Department lifecycle authority was denied.'
          : 'The department lifecycle action could not be completed.',
        knownCode === 'PATCH83R_ADMIN_ROLE_REQUIRED' ? 403 : knownCode === 'PATCH83R_DEPARTMENT_NOT_FOUND' ? 404 : 409,
        knownCode ?? 'DEPARTMENT_LIFECYCLE_ACTION_FAILED',
        knownCode
          ? 'The fixed lifecycle operation rejected the validated request without changing historical references.'
          : 'The database rejected the fixed lifecycle operation. No raw database detail is exposed.',
        { action },
      );
    }
    return jsonResponse({ ok: true, action, result: data }, 200);
  }

  if (patch83q1ProductionReadinessActions.has(action)) {
    const payload = requestBody.payload ?? {};
    const allowedRoles = action === 'record_executive_production_signoff'
      ? ['governance_admin', 'super_admin']
      : ['governance_admin', 'executive'];

    let authorized = false;
    try {
      authorized = await authorizePatch83q1Actor(serviceClient, userData.user.id, allowedRoles);
    } catch {
      return errorResponse(
        'Unable to verify production-readiness authority.',
        500,
        'PRODUCTION_READINESS_AUTHORIZATION_FAILED',
        'The server could not safely verify the authenticated actor profile and organization-scoped role.',
        { action },
      );
    }
    if (!authorized) {
      return errorResponse(
        'Production-readiness authority required.',
        403,
        'PRODUCTION_READINESS_ROLE_REQUIRED',
        action === 'record_executive_production_signoff'
          ? 'An active governance_admin or super_admin role in the authenticated actor organization is required.'
          : 'An active governance_admin or executive role in the authenticated actor organization is required.',
        { action },
      );
    }

    const reviewId = typeof payload.review_id === 'string' ? payload.review_id.trim() : '';
    const title = typeof payload.title === 'string' ? payload.title.trim() : '';
    const status = typeof payload.status === 'string' ? payload.status.trim() : '';
    const notes = typeof payload.notes === 'string' ? payload.notes.trim() : '';
    const eventType = typeof payload.event_type === 'string' ? payload.event_type.trim() : '';
    const eventSummary = typeof payload.event_summary === 'string' ? payload.event_summary.trim() : '';
    const decision = typeof payload.decision === 'string' ? payload.decision.trim() : '';
    const snapshotHash = payload.snapshot_hash === null || payload.snapshot_hash === undefined
      ? null
      : typeof payload.snapshot_hash === 'string' ? payload.snapshot_hash.trim() : '';

    if (action === 'create_pilot_go_no_go_review' && (!title || title.length > 200)) {
      return errorResponse(
        'A valid pilot review title is required.',
        400,
        'PILOT_REVIEW_TITLE_INVALID',
        'Provide a non-empty title no longer than 200 characters.',
        { action },
      );
    }
    if (
      (action === 'update_pilot_go_no_go_review_status' || action === 'record_pilot_go_no_go_event')
      && !uuidPattern.test(reviewId)
    ) {
      return errorResponse(
        'A valid pilot review UUID is required.',
        400,
        'PILOT_REVIEW_UUID_INVALID',
        'The review_id must be a canonical UUID.',
        { action },
      );
    }
    if (action === 'update_pilot_go_no_go_review_status' && !pilotReviewStatuses.has(status)) {
      return errorResponse(
        'Unsupported pilot review status.',
        400,
        'PILOT_REVIEW_STATUS_INVALID',
        'Use a status defined by the live pilot_go_no_go_reviews constraint.',
        { action },
      );
    }
    if (action === 'update_pilot_go_no_go_review_status' && (!notes || notes.length > 4000)) {
      return errorResponse(
        'Valid pilot review notes are required.',
        400,
        'PILOT_REVIEW_NOTES_INVALID',
        'Provide non-empty review notes no longer than 4,000 characters.',
        { action },
      );
    }
    if (action === 'record_pilot_go_no_go_event' && !pilotEventTypePattern.test(eventType)) {
      return errorResponse(
        'Invalid pilot review event type.',
        400,
        'PILOT_EVENT_TYPE_INVALID',
        'Use a lowercase snake_case event type between 2 and 64 characters.',
        { action },
      );
    }
    if (action === 'record_pilot_go_no_go_event' && (!eventSummary || eventSummary.length > 2000)) {
      return errorResponse(
        'A valid pilot event summary is required.',
        400,
        'PILOT_EVENT_SUMMARY_INVALID',
        'Provide a non-empty event summary no longer than 2,000 characters.',
        { action },
      );
    }
    if (action === 'record_executive_production_signoff' && decision !== 'approved') {
      return errorResponse(
        'Invalid executive production decision.',
        400,
        'EXECUTIVE_PRODUCTION_DECISION_INVALID',
        'The live RPC and table constraint permit only the approved decision.',
        { action },
      );
    }
    if (action === 'record_executive_production_signoff' && (!notes || notes.length > 4000)) {
      return errorResponse(
        'Valid executive authorization notes are required.',
        400,
        'EXECUTIVE_PRODUCTION_NOTES_INVALID',
        'Provide non-empty authorization notes no longer than 4,000 characters.',
        { action },
      );
    }
    if (
      action === 'record_executive_production_signoff'
      && snapshotHash !== null
      && (!snapshotHash || snapshotHash.length > 256 || !/^[a-zA-Z0-9:_-]+$/.test(snapshotHash))
    ) {
      return errorResponse(
        'Invalid production snapshot hash.',
        400,
        'EXECUTIVE_PRODUCTION_SNAPSHOT_HASH_INVALID',
        'When provided, snapshot_hash must contain only letters, digits, colons, underscores, or hyphens and be no longer than 256 characters.',
        { action },
      );
    }

    if (reviewId) {
      const { data: review, error: reviewError } = await serviceClient
        .from('pilot_go_no_go_reviews')
        .select('id')
        .eq('id', reviewId)
        .maybeSingle();
      if (reviewError) {
        return errorResponse(
          'Unable to verify the pilot review.',
          500,
          'PILOT_REVIEW_LOOKUP_FAILED',
          'The server could not safely verify the requested pilot review.',
          { action },
        );
      }
      if (!review) {
        return errorResponse(
          'Pilot review not found.',
          404,
          'PILOT_REVIEW_NOT_FOUND',
          'No pilot go/no-go review exists for the supplied review_id.',
          { action },
        );
      }
    }

    let rpcResult: { data: unknown; error: any };
    if (action === 'create_pilot_go_no_go_review') {
      rpcResult = await serviceClient.rpc('create_pilot_go_no_go_review', {
        p_title: title,
        p_actor_id: userData.user.id,
      });
    } else if (action === 'update_pilot_go_no_go_review_status') {
      rpcResult = await serviceClient.rpc('update_pilot_go_no_go_review_status', {
        p_review_id: reviewId,
        p_status: status,
        p_notes: notes,
        p_actor_id: userData.user.id,
      });
    } else if (action === 'record_pilot_go_no_go_event') {
      rpcResult = await serviceClient.rpc('record_pilot_go_no_go_event', {
        p_review_id: reviewId,
        p_event_type: eventType,
        p_event_summary: eventSummary,
        p_actor_id: userData.user.id,
      });
    } else {
      rpcResult = await serviceClient.rpc('record_executive_production_signoff', {
        p_actor_id: userData.user.id,
        p_decision: decision,
        p_notes: notes,
        p_snapshot_hash: snapshotHash,
      });
    }

    if (rpcResult.error) {
      const authorizationFailure = /UNAUTHORIZED|DENIED|REQUIRED|ACTIVE_ACTOR|ORGANIZATION|ROLE/i
        .test(rpcResult.error.message ?? '');
      return errorResponse(
        authorizationFailure
          ? 'Production-readiness authority was denied.'
          : 'The production-readiness action could not be completed.',
        authorizationFailure ? 403 : 409,
        authorizationFailure ? 'PRODUCTION_READINESS_AUTHORITY_DENIED' : 'PRODUCTION_READINESS_ACTION_FAILED',
        'The fixed production-readiness RPC rejected the validated request.',
        { action },
      );
    }

    return jsonResponse({ ok: true, action, result: rpcResult.data }, 200);
  }

  if (action === 'create_department') {
    const { data, error } = await serviceClient.rpc('v98_create_department', {
      p_actor_id: userData.user.id,
      p_name_en: requestBody.payload?.name_en,
      p_name_ar: requestBody.payload?.name_ar ?? null,
      p_code: requestBody.payload?.code,
    });

    if (error) {
      const authorizationFailure = /NOT_AUTHORIZED|REQUIRES_SUPER_ADMIN|SERVICE_ROLE_REQUIRED|ACTIVE_ACTOR_REQUIRED/i
        .test(error.message);
      return jsonResponse({
        ok: false,
        error: error.message,
        code: error.code,
        action,
      }, authorizationFailure ? 403 : 409);
    }

    return jsonResponse({ ok: true, action, result: data }, 200);
  }

  if (action === 'update_ovr_workflow') {
    const { data, error } = await serviceClient.rpc('v98_update_ovr_workflow', {
      p_actor_id: userData.user.id,
      p_ovr_report_id: requestBody.payload?.ovr_report_id,
      p_next_status: requestBody.payload?.next_status,
      p_payload: requestBody.payload ?? {},
    });

    if (error) {
      const authorizationFailure =
        /NOT_AUTHORIZED|DENIED|READ_ONLY|REQUIRED|SERVICE_ROLE|ACTIVE_ACTOR|CROSS_ORGANIZATION/i
          .test(error.message);
      return jsonResponse({
        ok: false,
        error: error.message,
        code: error.code,
        action,
      }, authorizationFailure ? 403 : 409);
    }

    return jsonResponse({ ok: true, action, result: data }, 200);
  }

  if (action === 'create_ovr_corrective_action_project') {
    const reportId = String(requestBody.payload?.ovr_report_id ?? '');
    const { data: report, error: reportError } = await serviceClient
      .from('ovr_reports')
      .select('organization_id,department_id,referred_user_id,referred_department_id')
      .eq('id', reportId)
      .maybeSingle();
    const { data: actorRoles, error: actorRolesError } = await serviceClient
      .from('user_roles')
      .select('role,scope,organization_id,department_id')
      .eq('user_id', userData.user.id)
      .eq('is_active', true);

    const authorized = !reportError && report && !actorRolesError && (actorRoles ?? []).some((assignment) => {
      if (
        ['super_admin', 'governance_admin', 'compliance_officer'].includes(assignment.role)
        && (assignment.organization_id === null || assignment.organization_id === report.organization_id)
      ) return true;
      return assignment.role === 'department_manager'
        && assignment.organization_id === report.organization_id
        && (
          assignment.scope === 'global'
          || assignment.department_id === report.department_id
          || assignment.department_id === report.referred_department_id
        );
    });

    if (!authorized) {
      return jsonResponse({
        ok: false,
        error: 'OVR corrective-action project creation requires Quality/Admin or a relevant department manager.',
        action,
      }, 403);
    }
  }

  if (action === 'department_import_execute') {
    const payload = requestBody.payload ?? {};
    const rows = payload.rows;
    if (!Array.isArray(rows)) {
      return jsonResponse({ ok: false, error: 'Rows array is required', action }, 400);
    }
    if (rows.length > 5000) {
      return jsonResponse({ ok: false, error: 'Maximum 5,000 rows allowed per import batch', action }, 400);
    }
    const payloadSize = new TextEncoder().encode(JSON.stringify(payload)).length;
    if (payloadSize > 5 * 1024 * 1024) {
      return jsonResponse({ ok: false, error: 'Payload exceeds 5MB limit', action }, 400);
    }

    let actorOrganizationId: string | null = null;
    try {
      actorOrganizationId = await authorizePatch83rActor(serviceClient, userData.user.id);
    } catch {
      return errorResponse('Unable to verify department import authority.', 500,
        'DEPARTMENT_IMPORT_AUTHORIZATION_FAILED',
        'The server could not safely verify the authenticated actor organization and role.', { action });
    }
    if (!actorOrganizationId || payload.organization_id !== actorOrganizationId) {
      return errorResponse('Department import organization scope denied.', 403,
        'DEPARTMENT_IMPORT_ORGANIZATION_SCOPE_DENIED',
        'The import organization must match the authenticated administrator organization.', { action });
    }

    const { data: archivedDepartments, error: archivedLookupError } = await serviceClient
      .from('departments')
      .select('id,code,name_en,name_ar')
      .eq('organization_id', actorOrganizationId)
      .eq('is_active', false)
      .not('archived_at', 'is', null)
      .limit(5000);
    if (archivedLookupError) {
      return errorResponse('Unable to verify archived department matches.', 500,
        'DEPARTMENT_IMPORT_ARCHIVED_LOOKUP_FAILED',
        'The server could not safely complete the archived department preflight.', { action });
    }
    const archivedKeys = new Set<string>();
    for (const department of archivedDepartments ?? []) {
      const code = normalizedDepartmentValue(department.code);
      const nameEn = normalizedDepartmentValue(department.name_en);
      const nameAr = normalizedDepartmentValue(department.name_ar);
      if (code) archivedKeys.add(`code:${code}`);
      if (nameEn) archivedKeys.add(`name:${nameEn}`);
      if (nameAr) archivedKeys.add(`name:${nameAr}`);
    }
    const archivedMatchRows = rows.flatMap((row: any, index: number) => {
      const raw = row && typeof row === 'object' && row.raw_data && typeof row.raw_data === 'object'
        ? row.raw_data : {};
      const code = normalizedDepartmentValue(raw.department_code);
      const nameEn = normalizedDepartmentValue(raw.department_name_en);
      const nameAr = normalizedDepartmentValue(raw.department_name_ar);
      const matched = (code && archivedKeys.has(`code:${code}`))
        || (nameEn && archivedKeys.has(`name:${nameEn}`))
        || (nameAr && archivedKeys.has(`name:${nameAr}`));
      return matched ? [Number(row?.row_number ?? index + 1)] : [];
    });
    if (archivedMatchRows.length) {
      return errorResponse('Department import contains an archived department match.', 409,
        'archived_department_match',
        'Restore the matching department explicitly from Department Management before importing it.',
        { action, row_numbers: archivedMatchRows });
    }

    const { data, error } = await serviceClient.rpc('apply_department_import_batch', {
      p_actor_id: userData.user.id,
      p_organization_id: payload.organization_id,
      p_source_filename: payload.source_filename,
      p_import_mode: payload.import_mode,
      p_rows: rows,
    });

    if (error) {
      const authFailure = /unauthorized|service_role_required|active_actor_required|organization_scope_denied|division_scope_denied/i.test(error.message);
      return jsonResponse({ ok: false, error: error.message, action }, authFailure ? 403 : 409);
    }
    return jsonResponse({ ok: true, action, result: data }, 200);
  }

  if (v14e2b2TrainingActions.has(action)) {
    const payloadBytes = new TextEncoder().encode(JSON.stringify(requestPayload)).length;
    if (payloadBytes > MAX_E2B2_PAYLOAD_BYTES) {
      return errorResponse(
        'Training or acknowledgment operation payload exceeds maximum allowable size.',
        400,
        'PAYLOAD_TOO_LARGE',
        'The submitted payload exceeds the 64 KiB limit.',
        { action },
      );
    }
  }

  const loadTrainingActorContext = async (actorUserId: string) => {
    const { data: actorProfile, error: profErr } = await serviceClient
      .from('profiles')
      .select('id, organization_id, department_id, division_id, is_active, user_status')
      .eq('id', actorUserId)
      .maybeSingle();

    if (profErr || !actorProfile) {
      throw new Error('CALLER_PROFILE_NOT_FOUND');
    }
    if (!actorProfile.is_active || actorProfile.user_status !== 'active') {
      throw new Error('CALLER_PROFILE_INACTIVE');
    }

    const { data: userRoles, error: rolesErr } = await serviceClient
      .from('user_roles')
      .select('id, role, scope, organization_id, division_id, department_id, is_active')
      .eq('user_id', actorUserId)
      .eq('is_active', true);

    if (rolesErr) {
      throw new Error(rolesErr.message);
    }

    return { actorProfile, userRoles: userRoles ?? [] };
  };

  if (action === 'decide_sop_rollout_requirements') {
    try {
      const payload = asPlainObject(requestBody.payload);
      assertNoIdentityOverrides(payload);
      assertOnlyAllowedKeys(
        payload,
        new Set([
          'version_id',
          'retraining_required',
          'reacknowledgment_required',
          'competency_reassessment_required',
          'rationale',
          'actor_id',
        ]),
        'DECIDE_SOP_ROLLOUT_REQUIREMENTS_PAYLOAD'
      );
      validateLegacyActorId(payload, userData.user.id);

      const versionId = requireCanonicalUuid(payload.version_id, 'version_id');
      const retrainingRequired = validateStrictBoolean(payload.retraining_required, 'retraining_required');
      const reacknowledgmentRequired = validateStrictBoolean(payload.reacknowledgment_required, 'reacknowledgment_required');
      const competencyReassessmentRequired = validateStrictBoolean(payload.competency_reassessment_required, 'competency_reassessment_required');
      const rationale = boundedString(payload.rationale, 5, 4000, 'rationale', true) as string;

      const { actorProfile, userRoles } = await loadTrainingActorContext(userData.user.id);

      const { data: version, error: verErr } = await serviceClient
        .from('document_versions')
        .select('id, document_id')
        .eq('id', versionId)
        .maybeSingle();
      if (verErr || !version) throw new Error('DOCUMENT_VERSION_NOT_FOUND');

      const { data: doc, error: docErr } = await serviceClient
        .from('controlled_documents')
        .select('id, organization_id, document_owner_id')
        .eq('id', version.document_id)
        .maybeSingle();
      if (docErr || !doc) throw new Error('DOCUMENT_NOT_FOUND');

      if (doc.organization_id !== actorProfile.organization_id) {
        throw new Error('TENANT_ISOLATION_VIOLATION');
      }

      const hasGlobal = hasActiveGlobalGovernanceRole(userRoles, actorProfile.organization_id);
      const isDocOwner = doc.document_owner_id === userData.user.id;

      if (!hasGlobal && !isDocOwner) {
        throw new Error('UNAUTHORIZED_GOVERNANCE_ROLE');
      }

      const { data, error } = await serviceClient.rpc('decide_sop_rollout_requirements', {
        p_actor_id: userData.user.id,
        p_version_id: versionId,
        p_retraining_required: retrainingRequired,
        p_reacknowledgment_required: reacknowledgmentRequired,
        p_competency_reassessment_required: competencyReassessmentRequired,
        p_rationale: rationale,
      });

      if (error) {
        const e = mapV14e2b2DatabaseError(action, error);
        return errorResponse(e.error, e.status, e.code, e.detail, e.extra);
      }

      return jsonResponse({ ok: true, action, result: data }, 200);
    } catch (err) {
      const e = mapV14e2b2DatabaseError(action, err);
      return errorResponse(e.error, e.status, e.code, e.detail, e.extra);
    }
  }

  if (action === 'publish_sop_training_obligations') {
    try {
      const payload = asPlainObject(requestBody.payload);
      assertNoIdentityOverrides(payload);
      assertOnlyAllowedKeys(payload, new Set(['version_id', 'actor_id']), 'PUBLISH_SOP_TRAINING_OBLIGATIONS_PAYLOAD');
      validateLegacyActorId(payload, userData.user.id);

      const versionId = requireCanonicalUuid(payload.version_id, 'version_id');

      // Migration 208 Capability Probe
      const probe = await serviceClient
        .from('v_sop_training_compliance_matrix')
        .select('training_target_count, acknowledgment_target_count, competency_target_count')
        .limit(1);

      if (probe.error) {
        const errText = String(probe.error.message || probe.error.details || '');
        const code = String(probe.error.code || '');
        if (code === '42703' || code === 'PGRST204' || errText.includes('column') || errText.includes('does not exist')) {
          return errorResponse(
            'Database migration 208 is required for publishing SOP training obligations.',
            409,
            'E2B2_MIGRATION_208_REQUIRED',
            'Migration 208 adds training obligation population and compliance matrix columns required for publishing.',
            { action }
          );
        }
        const e = mapV14e2b2DatabaseError(action, probe.error);
        return errorResponse(e.error, e.status, e.code, e.detail, e.extra);
      }

      const { actorProfile, userRoles } = await loadTrainingActorContext(userData.user.id);

      const { data: version, error: verErr } = await serviceClient
        .from('document_versions')
        .select('id, document_id')
        .eq('id', versionId)
        .maybeSingle();
      if (verErr || !version) throw new Error('DOCUMENT_VERSION_NOT_FOUND');

      const { data: doc, error: docErr } = await serviceClient
        .from('controlled_documents')
        .select('id, organization_id, document_owner_id')
        .eq('id', version.document_id)
        .maybeSingle();
      if (docErr || !doc) throw new Error('DOCUMENT_NOT_FOUND');

      if (doc.organization_id !== actorProfile.organization_id) {
        throw new Error('TENANT_ISOLATION_VIOLATION');
      }

      const hasGlobal = hasActiveGlobalGovernanceRole(userRoles, actorProfile.organization_id);
      const isDocOwner = doc.document_owner_id === userData.user.id;

      if (!hasGlobal && !isDocOwner) {
        throw new Error('UNAUTHORIZED_GOVERNANCE_ROLE');
      }

      const { data, error } = await serviceClient.rpc('publish_sop_training_obligations', {
        p_actor_id: userData.user.id,
        p_version_id: versionId,
      });

      if (error) {
        const e = mapV14e2b2DatabaseError(action, error);
        return errorResponse(e.error, e.status, e.code, e.detail, e.extra);
      }

      return jsonResponse({ ok: true, action, result: data }, 200);
    } catch (err) {
      const e = mapV14e2b2DatabaseError(action, err);
      return errorResponse(e.error, e.status, e.code, e.detail, e.extra);
    }
  }

  if (action === 'reconcile_sop_training_population') {
    try {
      const payload = asPlainObject(requestBody.payload);
      assertNoIdentityOverrides(payload, [
        'p_actor_id',
        'acting_user_id',
        'authenticated_user_id',
        'target_user_id',
        'organization_id',
        'p_organization_id',
      ]);
      assertOnlyAllowedKeys(
        payload,
        new Set(['version_id', 'confirm_reconciliation', 'actor_id']),
        'RECONCILE_SOP_TRAINING_POPULATION_PAYLOAD'
      );
      validateLegacyActorId(payload, userData.user.id);

      const versionId = requireCanonicalUuid(payload.version_id, 'version_id');
      const confirmReconciliation = validateStrictBoolean(
        payload.confirm_reconciliation,
        'confirm_reconciliation'
      );
      if (confirmReconciliation !== true) {
        throw new Error('RECONCILIATION_CONFIRMATION_REQUIRED');
      }

      const capabilityProbe = await serviceClient.rpc(
        'get_e2b3_training_reconciliation_capabilities'
      );

      if (capabilityProbe.error) {
        if (isE2B3Migration209CapabilityUnavailable(capabilityProbe.error)) {
          return errorResponse(
            'Database migration 209 is required for SOP training population reconciliation.',
            409,
            'E2B3_MIGRATION_209_REQUIRED',
            'Migration 209 installs the fail-closed population lifecycle reconciliation contract.',
            { action }
          );
        }
        const e = mapV14e2b2DatabaseError(action, capabilityProbe.error);
        return errorResponse(e.error, e.status, e.code, e.detail, e.extra);
      }

      if (!hasExactE2B3TrainingReconciliationCapability(capabilityProbe.data)) {
        return errorResponse(
          'Database migration 209 capability contract is unavailable or incompatible.',
          409,
          'E2B3_MIGRATION_209_REQUIRED',
          'The reconciliation capability must exactly match e2b3-training-population-v1 at schema version 209.',
          { action }
        );
      }

      const { actorProfile, userRoles } = await loadTrainingActorContext(userData.user.id);

      const { data: version, error: verErr } = await serviceClient
        .from('document_versions')
        .select('id, document_id')
        .eq('id', versionId)
        .maybeSingle();
      if (verErr || !version) throw new Error('DOCUMENT_VERSION_NOT_FOUND');

      const { data: doc, error: docErr } = await serviceClient
        .from('controlled_documents')
        .select('id, organization_id, document_type, document_owner_id')
        .eq('id', version.document_id)
        .maybeSingle();
      if (docErr || !doc) throw new Error('DOCUMENT_NOT_FOUND');
      if (doc.document_type !== 'sop') throw new Error('INVALID_DOC_TYPE');
      if (!doc.organization_id || doc.organization_id !== actorProfile.organization_id) {
        throw new Error('TENANT_ISOLATION_VIOLATION');
      }

      const hasGlobal = hasExactE2B3GlobalGovernanceRole(userRoles, actorProfile.organization_id);
      const isDocumentOwner = doc.document_owner_id === userData.user.id;
      if (!hasGlobal && !isDocumentOwner) {
        throw new Error('UNAUTHORIZED_GOVERNANCE_ROLE');
      }

      const { data: sopDetail, error: sopDetailErr } = await serviceClient
        .from('governed_sop_details')
        .select('version_id, training_obligations_published_at')
        .eq('version_id', versionId)
        .maybeSingle();
      if (sopDetailErr || !sopDetail) {
        throw new Error('GOVERNED_SOP_VERSION_CONTEXT_INVALID');
      }
      if (!sopDetail.training_obligations_published_at) {
        return errorResponse(
          'Training obligations have not been published for this exact SOP version.',
          409,
          'TRAINING_OBLIGATIONS_NOT_PUBLISHED',
          'Publish obligations for the selected SOP version before running population reconciliation.',
          { action, version_id: versionId }
        );
      }

      const { data, error } = await serviceClient.rpc('reconcile_sop_training_population', {
        p_actor_id: userData.user.id,
        p_version_id: versionId,
      });

      if (error) {
        const e = mapV14e2b2DatabaseError(action, error);
        return errorResponse(e.error, e.status, e.code, e.detail, e.extra);
      }

      return jsonResponse({ ok: true, action, result: data }, 200);
    } catch (err) {
      const e = mapV14e2b2DatabaseError(action, err);
      return errorResponse(e.error, e.status, e.code, e.detail, e.extra);
    }
  }

  if (f1OvrGovernedVersionActions.has(action)) {
    try {
      const payload = asPlainObject(requestBody.payload);
      assertNoIdentityOverrides(payload, [
        'actor_id',
        'p_actor_id',
        'user_id',
        'organization_id',
        'document_id',
        'acting_user_id',
        'authenticated_user_id',
        'target_user_id',
      ]);

      if (action === 'link_ovr_governed_document_version') {
        assertOnlyAllowedKeys(
          payload,
          new Set(['ovr_id', 'version_id', 'note']),
          'F1_LINK_OVR_GOVERNED_VERSION_PAYLOAD',
        );
      } else {
        assertOnlyAllowedKeys(
          payload,
          new Set(['link_id', 'reason']),
          'F1_UNLINK_OVR_GOVERNED_VERSION_PAYLOAD',
        );
      }

      const ovrId = action === 'link_ovr_governed_document_version'
        ? requireCanonicalUuid(payload.ovr_id, 'ovr_id')
        : null;
      const versionId = action === 'link_ovr_governed_document_version'
        ? requireCanonicalUuid(payload.version_id, 'version_id')
        : null;
      const note = action === 'link_ovr_governed_document_version'
        ? boundedString(payload.note, 1000, 'note')
        : null;
      const linkId = action === 'unlink_ovr_governed_document_version'
        ? requireCanonicalUuid(payload.link_id, 'link_id')
        : null;
      const reason = action === 'unlink_ovr_governed_document_version'
        ? boundedString(payload.reason, 1000, 'reason', true)
        : null;
      if (reason !== null && reason.length < 3) {
        throw new Error('F1_UNLINK_REASON_LENGTH_REQUIRED');
      }

      // This exact capability check is the DB209-safe boundary. No Migration210
      // view or mutation RPC is referenced above this point.
      const capabilityProbe = await serviceClient.rpc(
        'get_f1_ovr_governed_version_link_capabilities',
      );
      if (capabilityProbe.error) {
        if (isF1Migration210CapabilityUnavailable(capabilityProbe.error)) {
          return errorResponse(
            'Database migration 210 is required for OVR governed-version links.',
            409,
            'F1_MIGRATION_210_REQUIRED',
            'Migration210 installs the exact-version link capability contract.',
            { action },
          );
        }
        const mapped = mapF1OvrGovernedVersionError(capabilityProbe.error);
        return errorResponse(mapped.error, mapped.status, mapped.code, mapped.detail, { action });
      }
      if (!hasExactF1OvrGovernedVersionCapability(capabilityProbe.data)) {
        return errorResponse(
          'Database migration 210 capability contract is unavailable or incompatible.',
          409,
          'F1_MIGRATION_210_REQUIRED',
          'The capability must exactly match f1-ovr-governed-version-links-v1 at schema version 210.',
          { action },
        );
      }

      const { actorProfile, userRoles } = await loadTrainingActorContext(userData.user.id);
      let targetOrganizationId: string;

      if (action === 'link_ovr_governed_document_version') {
        const { data: ovr, error: ovrError } = await serviceClient
          .from('ovr_reports')
          .select('id, organization_id')
          .eq('id', ovrId as string)
          .maybeSingle();
        if (ovrError || !ovr) throw new Error('F1_OVR_NOT_FOUND');

        const { data: version, error: versionError } = await serviceClient
          .from('document_versions')
          .select('id, document_id, approved_at, locked_at')
          .eq('id', versionId as string)
          .maybeSingle();
        if (versionError || !version) throw new Error('F1_DOCUMENT_VERSION_NOT_FOUND');

        const { data: document, error: documentError } = await serviceClient
          .from('controlled_documents')
          .select('id, organization_id, document_type')
          .eq('id', version.document_id)
          .maybeSingle();
        if (documentError || !document) throw new Error('F1_DOCUMENT_NOT_FOUND');
        if (!['policy', 'sop'].includes(document.document_type)) {
          throw new Error('F1_POLICY_OR_SOP_REQUIRED');
        }
        if (!version.approved_at) throw new Error('F1_APPROVED_VERSION_REQUIRED');
        if (!version.locked_at) throw new Error('F1_IMMUTABLE_VERSION_REQUIRED');
        if (!ovr.organization_id || document.organization_id !== ovr.organization_id) {
          throw new Error('F1_CROSS_ORGANIZATION_LINK_DENIED');
        }
        targetOrganizationId = ovr.organization_id;
      } else {
        const { data: link, error: linkError } = await serviceClient
          .from('v_f1_ovr_governed_version_links')
          .select('link_id, ovr_id, organization_id, document_id, document_type, version_id, approved_at, locked_at')
          .eq('link_id', linkId as string)
          .maybeSingle();
        if (linkError || !link) throw new Error('F1_CANONICAL_LINK_NOT_FOUND');
        if (!['policy', 'sop'].includes(link.document_type)) {
          throw new Error('F1_POLICY_OR_SOP_REQUIRED');
        }
        if (!link.approved_at || !link.locked_at) {
          throw new Error('F1_IMMUTABLE_VERSION_REQUIRED');
        }
        targetOrganizationId = link.organization_id;
      }

      if (!actorProfile.organization_id
        || actorProfile.organization_id !== targetOrganizationId
        || !hasExactF1GlobalGovernanceRole(userRoles, targetOrganizationId)) {
        throw new Error('F1_EXACT_GLOBAL_GOVERNANCE_ROLE_REQUIRED');
      }

      const rpcResult = action === 'link_ovr_governed_document_version'
        ? await serviceClient.rpc('link_ovr_governed_document_version', {
            p_actor_id: userData.user.id,
            p_ovr_id: ovrId,
            p_version_id: versionId,
            p_note: note,
          })
        : await serviceClient.rpc('unlink_ovr_governed_document_version', {
            p_actor_id: userData.user.id,
            p_link_id: linkId,
            p_reason: reason,
          });
      if (rpcResult.error) throw rpcResult.error;

      return jsonResponse({ ok: true, action, result: rpcResult.data }, 200);
    } catch (error) {
      const mapped = mapF1OvrGovernedVersionError(error);
      return errorResponse(mapped.error, mapped.status, mapped.code, mapped.detail, { action });
    }
  }

  if (f2OvrGovernanceFeedbackActions.has(action)) {
    try {
      const payload = asPlainObject(requestBody.payload);
      assertNoIdentityOverrides(payload, [
        'actor_id',
        'p_actor_id',
        'user_id',
        'organization_id',
        'acting_user_id',
        'authenticated_user_id',
        'target_user_id',
        'triggered_by',
        'review_owner_id',
        'document_id',
        'version_id',
        'project_id',
      ]);

      if (action === 'initiate_ovr_governance_feedback_review') {
        assertOnlyAllowedKeys(
          payload,
          new Set(['ovr_id', 'document_link_id', 'due_date', 'rationale']),
          'F2_INITIATE_OVR_GOVERNANCE_FEEDBACK_PAYLOAD',
        );
      } else if (action === 'complete_ovr_governance_feedback_review') {
        assertOnlyAllowedKeys(
          payload,
          new Set(['trigger_id', 'outcome', 'outcome_note']),
          'F2_COMPLETE_OVR_GOVERNANCE_FEEDBACK_PAYLOAD',
        );
      } else {
        assertOnlyAllowedKeys(
          payload,
          new Set(['ovr_id']),
          'F2_SYNC_OVR_CORRECTIVE_ACTION_CAPA_PAYLOAD',
        );
      }

      const ovrId = action !== 'complete_ovr_governance_feedback_review'
        ? requireCanonicalUuid(payload.ovr_id, 'ovr_id')
        : null;
      const documentLinkId = action === 'initiate_ovr_governance_feedback_review'
        ? requireCanonicalUuid(payload.document_link_id, 'document_link_id')
        : null;
      const triggerId = action === 'complete_ovr_governance_feedback_review'
        ? requireCanonicalUuid(payload.trigger_id, 'trigger_id')
        : null;
      const dueDate = action === 'initiate_ovr_governance_feedback_review'
        ? boundedString(payload.due_date, 10, 'due_date', true)
        : null;
      const rationale = action === 'initiate_ovr_governance_feedback_review'
        ? boundedString(payload.rationale, 2000, 'rationale', true)
        : null;
      const outcome = action === 'complete_ovr_governance_feedback_review'
        ? boundedString(payload.outcome, 32, 'outcome', true)
        : null;
      const outcomeNote = action === 'complete_ovr_governance_feedback_review'
        ? boundedString(payload.outcome_note, 2000, 'outcome_note', true)
        : null;

      if (dueDate !== null && !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
        throw new Error('F2_REVIEW_DUE_DATE_INVALID');
      }
      if (rationale !== null && rationale.length < 3) {
        throw new Error('F2_REVIEW_RATIONALE_LENGTH_REQUIRED');
      }
      if (outcome !== null && !F2_REVIEW_OUTCOMES.has(outcome)) {
        throw new Error('F2_REVIEW_OUTCOME_INVALID');
      }
      if (outcomeNote !== null && outcomeNote.length < 3) {
        throw new Error('F2_OUTCOME_NOTE_LENGTH_REQUIRED');
      }

      // This exact probe is the DB210-safe boundary. No Migration211 view or
      // mutation RPC is referenced above this point.
      const capabilityProbe = await serviceClient.rpc(
        'get_f2_ovr_governance_feedback_capabilities',
      );
      if (capabilityProbe.error) {
        if (isF2Migration211CapabilityUnavailable(capabilityProbe.error)) {
          return errorResponse(
            'Database migration 211 is required for OVR governance feedback.',
            409,
            'F2_MIGRATION_211_REQUIRED',
            'Migration211 installs the OVR governance-feedback capability contract.',
            { action },
          );
        }
        const mapped = mapF2OvrGovernanceFeedbackError(capabilityProbe.error);
        return errorResponse(mapped.error, mapped.status, mapped.code, mapped.detail, { action });
      }
      if (!hasExactF2OvrGovernanceFeedbackCapability(capabilityProbe.data)) {
        return errorResponse(
          'Database migration 211 capability contract is unavailable or incompatible.',
          409,
          'F2_MIGRATION_211_REQUIRED',
          'The capability must exactly match f2-ovr-governance-feedback-v1 at schema version 211.',
          { action },
        );
      }

      const { actorProfile, userRoles } = await loadTrainingActorContext(userData.user.id);
      let targetOrganizationId: string;

      if (action === 'initiate_ovr_governance_feedback_review') {
        const { data: link, error: linkError } = await serviceClient
          .from('v_f1_ovr_governed_version_links')
          .select('link_id, ovr_id, organization_id, document_type, version_id, approved_at, locked_at, is_historical_version')
          .eq('link_id', documentLinkId as string)
          .eq('ovr_id', ovrId as string)
          .maybeSingle();
        if (linkError || !link) throw new Error('F2_CANONICAL_F1_LINK_NOT_FOUND');
        if (!['policy', 'sop'].includes(link.document_type)) {
          throw new Error('F2_POLICY_OR_SOP_REQUIRED');
        }
        if (!link.approved_at || !link.locked_at) {
          throw new Error('F2_IMMUTABLE_SOURCE_VERSION_REQUIRED');
        }
        targetOrganizationId = link.organization_id;
      } else if (action === 'complete_ovr_governance_feedback_review') {
        const { data: review, error: reviewError } = await serviceClient
          .from('v_f2_ovr_governance_feedback')
          .select('trigger_id, ovr_id, organization_id, source_version_id, current_version_id, review_status')
          .eq('trigger_id', triggerId as string)
          .maybeSingle();
        if (reviewError || !review) throw new Error('F2_REVIEW_TRIGGER_NOT_FOUND');
        if (!['open', 'in_progress'].includes(review.review_status)) {
          throw new Error('F2_REVIEW_TRIGGER_NOT_OPEN');
        }
        targetOrganizationId = review.organization_id;
      } else {
        const { data: ovr, error: ovrError } = await serviceClient
          .from('ovr_reports')
          .select('id, organization_id')
          .eq('id', ovrId as string)
          .maybeSingle();
        if (ovrError || !ovr) throw new Error('F2_OVR_NOT_FOUND');
        targetOrganizationId = ovr.organization_id;
      }

      if (!actorProfile.organization_id
        || actorProfile.organization_id !== targetOrganizationId
        || !hasExactF2GlobalGovernanceRole(userRoles, targetOrganizationId)) {
        throw new Error('F2_EXACT_GLOBAL_GOVERNANCE_ROLE_REQUIRED');
      }

      const rpcResult = action === 'initiate_ovr_governance_feedback_review'
        ? await serviceClient.rpc('initiate_ovr_governance_feedback_review', {
            p_actor_id: userData.user.id,
            p_ovr_id: ovrId,
            p_document_link_id: documentLinkId,
            p_due_date: dueDate,
            p_rationale: rationale,
          })
        : action === 'complete_ovr_governance_feedback_review'
        ? await serviceClient.rpc('complete_ovr_governance_feedback_review', {
            p_actor_id: userData.user.id,
            p_trigger_id: triggerId,
            p_outcome: outcome,
            p_outcome_note: outcomeNote,
          })
        : await serviceClient.rpc('sync_ovr_corrective_action_capa_link', {
            p_actor_id: userData.user.id,
            p_ovr_id: ovrId,
          });
      if (rpcResult.error) throw rpcResult.error;

      return jsonResponse({ ok: true, action, result: rpcResult.data }, 200);
    } catch (error) {
      const mapped = mapF2OvrGovernanceFeedbackError(error);
      return errorResponse(mapped.error, mapped.status, mapped.code, mapped.detail, { action });
    }
  }

  if (action === 'record_document_acknowledgment') {
    try {
      const payload = asPlainObject(requestBody.payload);
      assertNoIdentityOverrides(payload, [
        'user_id', 'p_user_id', 'target_user_id',
        'p_actor_id', 'acting_user_id', 'authenticated_user_id',
        'organization_id', 'p_organization_id'
      ]);
      assertOnlyAllowedKeys(
        payload,
        new Set(['document_id', 'version_id', 'acknowledgment_method', 'acknowledgment_note', 'actor_id']),
        'RECORD_DOCUMENT_ACKNOWLEDGMENT_PAYLOAD'
      );
      validateLegacyActorId(payload, userData.user.id);

      const documentId = requireCanonicalUuid(payload.document_id, 'document_id');
      const versionId = requireCanonicalUuid(payload.version_id, 'version_id');

      if ('acknowledgment_method' in payload && payload.acknowledgment_method !== undefined && payload.acknowledgment_method !== null && payload.acknowledgment_method !== '') {
        if (payload.acknowledgment_method !== 'web_ui') {
          throw new Error('INVALID_ACKNOWLEDGMENT_METHOD');
        }
      }

      const acknowledgmentNote = boundedString(payload.acknowledgment_note, 0, 4000, 'acknowledgment_note', false);

      const { actorProfile, userRoles } = await loadTrainingActorContext(userData.user.id);

      const { data: doc, error: docErr } = await serviceClient
        .from('controlled_documents')
        .select('id, organization_id')
        .eq('id', documentId)
        .maybeSingle();
      if (docErr || !doc) throw new Error('DOCUMENT_NOT_FOUND');

      const { data: ver, error: verErr } = await serviceClient
        .from('document_versions')
        .select('id, document_id')
        .eq('id', versionId)
        .maybeSingle();
      if (verErr || !ver) throw new Error('DOCUMENT_VERSION_NOT_FOUND');
      if (ver.document_id !== documentId) throw new Error('VERSION_DOCUMENT_MISMATCH');

      if (doc.organization_id !== actorProfile.organization_id) {
        throw new Error('TENANT_ISOLATION_VIOLATION');
      }

      const { data: reqs, error: reqsErr } = await serviceClient
        .from('document_acknowledgment_requirements')
        .select('id, document_id, version_id, requirement_scope, user_id, department_id, role_name, required_flag')
        .eq('document_id', documentId)
        .eq('version_id', versionId)
        .eq('required_flag', true);
      if (reqsErr) throw new Error(reqsErr.message);

      if (reqs && reqs.length > 0) {
        const isEligible = reqs.some((r: any) => {
          if (r.requirement_scope === 'specific_users') {
            return r.user_id === userData.user.id;
          }
          if (r.requirement_scope === 'department') {
            return Boolean(r.department_id && r.department_id === actorProfile.department_id);
          }
          if (r.requirement_scope === 'role') {
            return hasActiveRoleForAcknowledgmentRequirement(userRoles, r.role_name, actorProfile.organization_id);
          }
          if (r.requirement_scope === 'all_employees') {
            return doc.organization_id === actorProfile.organization_id;
          }
          return false;
        });

        if (!isEligible) {
          throw new Error('NOT_ELIGIBLE_FOR_ACKNOWLEDGMENT');
        }
      }

      const { data, error } = await serviceClient.rpc('record_document_acknowledgment', {
        p_document_id: documentId,
        p_version_id: versionId,
        p_user_id: userData.user.id,
        p_acknowledgment_method: 'web_ui',
        p_acknowledgment_note: acknowledgmentNote,
      });

      if (error) {
        const e = mapV14e2b2DatabaseError(action, error);
        return errorResponse(e.error, e.status, e.code, e.detail, e.extra);
      }

      return jsonResponse({ ok: true, action, result: data }, 200);
    } catch (err) {
      const e = mapV14e2b2DatabaseError(action, err);
      return errorResponse(e.error, e.status, e.code, e.detail, e.extra);
    }
  }

  if (action === 'start_training_assignment') {
    try {
      const payload = asPlainObject(requestBody.payload);
      assertNoIdentityOverrides(payload);
      assertOnlyAllowedKeys(payload, new Set(['assignment_id', 'actor_id']), 'START_TRAINING_ASSIGNMENT_PAYLOAD');
      validateLegacyActorId(payload, userData.user.id);

      const assignmentId = requireCanonicalUuid(payload.assignment_id, 'assignment_id');

      await loadTrainingActorContext(userData.user.id);

      const { data: assign, error: assignErr } = await serviceClient
        .from('training_assignments')
        .select('id, program_id, assigned_to_user_id, status, document_version_id, cycle_type')
        .eq('id', assignmentId)
        .maybeSingle();
      if (assignErr || !assign) throw new Error('ASSIGNMENT_NOT_FOUND');

      if (assign.assigned_to_user_id !== userData.user.id) {
        throw new Error('PATCH29_ASSIGNMENT_FORBIDDEN');
      }

      if (!['assigned', 'overdue'].includes(assign.status)) {
        throw new Error('INVALID_ASSIGNMENT_STATUS');
      }

      if (assign.document_version_id) {
        const { data: ver, error: verErr } = await serviceClient
          .from('document_versions')
          .select('id, document_id, version_number, supersedes_version_id')
          .eq('id', assign.document_version_id)
          .maybeSingle();
        if (verErr || !ver) throw new Error('GOVERNED_SOP_VERSION_CONTEXT_INVALID');

        const { data: sopDetails, error: sopErr } = await serviceClient
          .from('governed_sop_details')
          .select('version_id, training_required, retraining_required, competency_assessment_required, competency_reassessment_required')
          .eq('version_id', assign.document_version_id)
          .maybeSingle();
        if (sopErr || !sopDetails) throw new Error('GOVERNED_SOP_VERSION_CONTEXT_INVALID');

        const { formalTrainingRequired } = resolveGovernedVersionTrainingRequirements(ver, sopDetails);
        if (formalTrainingRequired !== true) {
          throw new Error('TRAINING_NOT_REQUIRED_FOR_ASSIGNMENT');
        }
      }

      const { data, error } = await serviceClient.rpc('start_training_assignment', {
        p_assignment_id: assignmentId,
        p_actor_id: userData.user.id,
      });

      if (error) {
        const e = mapV14e2b2DatabaseError(action, error);
        return errorResponse(e.error, e.status, e.code, e.detail, e.extra);
      }

      return jsonResponse({ ok: true, action, result: data }, 200);
    } catch (err) {
      const e = mapV14e2b2DatabaseError(action, err);
      return errorResponse(e.error, e.status, e.code, e.detail, e.extra);
    }
  }

  if (action === 'complete_training_assignment') {
    try {
      const payload = asPlainObject(requestBody.payload);
      assertNoIdentityOverrides(payload);
      assertOnlyAllowedKeys(payload, new Set(['assignment_id', 'evidence_id', 'actor_id']), 'COMPLETE_TRAINING_ASSIGNMENT_PAYLOAD');
      validateLegacyActorId(payload, userData.user.id);

      const assignmentId = requireCanonicalUuid(payload.assignment_id, 'assignment_id');
      const evidenceId = optionalCanonicalUuid(payload.evidence_id, 'evidence_id');

      const { actorProfile, userRoles } = await loadTrainingActorContext(userData.user.id);

      const { data: assign, error: assignErr } = await serviceClient
        .from('training_assignments')
        .select('id, program_id, assigned_to_user_id, status, document_version_id, cycle_type')
        .eq('id', assignmentId)
        .maybeSingle();
      if (assignErr || !assign) throw new Error('ASSIGNMENT_NOT_FOUND');

      if (!['assigned', 'in_progress', 'overdue'].includes(assign.status)) {
        throw new Error('INVALID_ASSIGNMENT_STATUS');
      }

      const { data: targetProfile, error: targetProfErr } = await serviceClient
        .from('profiles')
        .select('id, organization_id, department_id, division_id, is_active, user_status')
        .eq('id', assign.assigned_to_user_id)
        .maybeSingle();
      if (targetProfErr || !targetProfile) throw new Error('TARGET_USER_NOT_FOUND');
      if (!targetProfile.is_active || targetProfile.user_status !== 'active') {
        throw new Error('TARGET_USER_NOT_FOUND');
      }
      if (targetProfile.organization_id !== actorProfile.organization_id) {
        throw new Error('TENANT_ISOLATION_VIOLATION');
      }

      const { data: program, error: progErr } = await serviceClient
        .from('training_programs')
        .select('id, owner_user_id, linked_document_id, linked_sop_id, department_id, created_by, training_type')
        .eq('id', assign.program_id)
        .maybeSingle();
      if (progErr || !program) throw new Error('PROGRAM_NOT_FOUND');

      await verifyProgramTenancy(serviceClient, program, targetProfile.organization_id);

      let isGovernedFormal = false;
      if (assign.document_version_id) {
        const { data: ver, error: verErr } = await serviceClient
          .from('document_versions')
          .select('id, document_id, version_number, supersedes_version_id')
          .eq('id', assign.document_version_id)
          .maybeSingle();
        if (verErr || !ver) throw new Error('GOVERNED_SOP_VERSION_CONTEXT_INVALID');

        const { data: sopDetails, error: sopErr } = await serviceClient
          .from('governed_sop_details')
          .select('version_id, training_required, retraining_required, competency_assessment_required, competency_reassessment_required')
          .eq('version_id', assign.document_version_id)
          .maybeSingle();
        if (sopErr || !sopDetails) throw new Error('GOVERNED_SOP_VERSION_CONTEXT_INVALID');

        const { formalTrainingRequired } = resolveGovernedVersionTrainingRequirements(ver, sopDetails);
        if (formalTrainingRequired !== true) {
          throw new Error('TRAINING_NOT_REQUIRED_FOR_ASSIGNMENT');
        }
        isGovernedFormal = true;
      }

      if (isGovernedFormal && userData.user.id === assign.assigned_to_user_id) {
        throw new Error('EMPLOYEE_CANNOT_COMPLETE_GOVERNED_TRAINING');
      }

      const hasGlobal = hasActiveGlobalGovernanceRole(userRoles, actorProfile.organization_id);
      const hasDept = hasActiveDepartmentManagerRole(userRoles, targetProfile.department_id, actorProfile.organization_id);
      const hasDiv = hasActiveDivisionHeadRole(userRoles, targetProfile.division_id, actorProfile.organization_id);
      const isProgramOwner = program.owner_user_id === userData.user.id;

      if (!hasGlobal && !hasDept && !hasDiv && !isProgramOwner) {
        throw new Error('UNAUTHORIZED_COMPLETION_CERTIFIER');
      }

      const { data, error } = await serviceClient.rpc('complete_training_assignment', {
        p_assignment_id: assignmentId,
        p_evidence_id: evidenceId,
        p_actor_id: userData.user.id,
      });

      if (error) {
        const e = mapV14e2b2DatabaseError(action, error);
        return errorResponse(e.error, e.status, e.code, e.detail, e.extra);
      }

      return jsonResponse({ ok: true, action, result: data }, 200);
    } catch (err) {
      const e = mapV14e2b2DatabaseError(action, err);
      return errorResponse(e.error, e.status, e.code, e.detail, e.extra);
    }
  }

  if (action === 'record_competency_assessment') {
    try {
      const payload = asPlainObject(requestBody.payload);
      assertNoIdentityOverrides(payload, [
        'p_actor_id', 'acting_user_id', 'authenticated_user_id',
        'organization_id', 'p_organization_id'
      ]);
      assertOnlyAllowedKeys(
        payload,
        new Set(['assignment_id', 'user_id', 'competency_area', 'result', 'score', 'evidence_id', 'notes', 'actor_id']),
        'RECORD_COMPETENCY_ASSESSMENT_PAYLOAD'
      );
      validateLegacyActorId(payload, userData.user.id);

      const userId = requireCanonicalUuid(payload.user_id, 'user_id');
      const assignmentId = optionalCanonicalUuid(payload.assignment_id, 'assignment_id');
      const competencyArea = boundedString(payload.competency_area, 1, 500, 'competency_area', true) as string;

      const result = String(payload.result ?? '').trim();
      if (!validCompetencyResults.has(result)) {
        throw new Error('INVALID_COMPETENCY_RESULT');
      }

      const score = optionalStrictFiniteNumber(payload.score, 'score');
      const evidenceId = optionalCanonicalUuid(payload.evidence_id, 'evidence_id');
      const notes = boundedString(payload.notes, 0, 4000, 'notes', false);

      const { actorProfile, userRoles } = await loadTrainingActorContext(userData.user.id);

      if (userData.user.id === userId) {
        throw new Error('SOD_VIOLATION_SELF_ASSESSMENT');
      }

      const { data: targetProfile, error: targetProfErr } = await serviceClient
        .from('profiles')
        .select('id, organization_id, department_id, division_id, is_active, user_status')
        .eq('id', userId)
        .maybeSingle();
      if (targetProfErr || !targetProfile) throw new Error('TARGET_USER_NOT_FOUND');
      if (!targetProfile.is_active || targetProfile.user_status !== 'active') {
        throw new Error('TARGET_USER_NOT_FOUND');
      }
      if (targetProfile.organization_id !== actorProfile.organization_id) {
        throw new Error('TENANT_ISOLATION_VIOLATION');
      }

      if (assignmentId) {
        const { data: assign, error: assignErr } = await serviceClient
          .from('training_assignments')
          .select('id, program_id, assigned_to_user_id, document_version_id, cycle_type')
          .eq('id', assignmentId)
          .maybeSingle();
        if (assignErr || !assign) throw new Error('ASSIGNMENT_NOT_FOUND');
        if (assign.assigned_to_user_id !== userId) {
          throw new Error('COMPETENCY_ASSIGNMENT_SUBJECT_MISMATCH');
        }

        if (assign.document_version_id) {
          const { data: ver, error: verErr } = await serviceClient
            .from('document_versions')
            .select('id, document_id, version_number, supersedes_version_id')
            .eq('id', assign.document_version_id)
            .maybeSingle();
          if (verErr || !ver) throw new Error('GOVERNED_SOP_VERSION_CONTEXT_INVALID');

          const { data: sopDetails, error: sopErr } = await serviceClient
            .from('governed_sop_details')
            .select('version_id, training_required, retraining_required, competency_assessment_required, competency_reassessment_required')
            .eq('version_id', assign.document_version_id)
            .maybeSingle();
          if (sopErr || !sopDetails) throw new Error('GOVERNED_SOP_VERSION_CONTEXT_INVALID');

          const { competencyRequired } = resolveGovernedVersionTrainingRequirements(ver, sopDetails);
          if (competencyRequired !== true) {
            throw new Error('COMPETENCY_NOT_REQUIRED_FOR_ASSIGNMENT');
          }
        }
      }

      const hasGlobal = hasActiveGlobalGovernanceRole(userRoles, actorProfile.organization_id);
      const hasDept = hasActiveDepartmentManagerRole(userRoles, targetProfile.department_id, actorProfile.organization_id);
      const hasDiv = hasActiveDivisionHeadRole(userRoles, targetProfile.division_id, actorProfile.organization_id);

      if (!hasGlobal && !hasDept && !hasDiv) {
        throw new Error('UNAUTHORIZED_ASSESSOR');
      }

      const { data, error } = await serviceClient.rpc('record_competency_assessment', {
        p_assignment_id: assignmentId,
        p_user_id: userId,
        p_competency_area: competencyArea,
        p_result: result,
        p_score: score,
        p_evidence_id: evidenceId,
        p_notes: notes,
        p_actor_id: userData.user.id,
      });

      if (error) {
        const e = mapV14e2b2DatabaseError(action, error);
        return errorResponse(e.error, e.status, e.code, e.detail, e.extra);
      }

      return jsonResponse({ ok: true, action, result: data }, 200);
    } catch (err) {
      const e = mapV14e2b2DatabaseError(action, err);
      return errorResponse(e.error, e.status, e.code, e.detail, e.extra);
    }
  }

  if (action === 'waive_training_assignment_with_reason') {
    try {
      const payload = asPlainObject(requestBody.payload);
      assertNoIdentityOverrides(payload);
      assertOnlyAllowedKeys(payload, new Set(['assignment_id', 'reason', 'actor_id']), 'WAIVE_ASSIGNMENT_PAYLOAD');
      validateLegacyActorId(payload, userData.user.id);

      const assignmentId = requireCanonicalUuid(payload.assignment_id, 'assignment_id');
      const reason = boundedString(payload.reason, 3, 1000, 'reason', true) as string;

      const { actorProfile, userRoles } = await loadTrainingActorContext(userData.user.id);

      const { data: assign, error: assignErr } = await serviceClient
        .from('training_assignments')
        .select('id, assigned_to_user_id, status')
        .eq('id', assignmentId)
        .maybeSingle();
      if (assignErr || !assign) throw new Error('ASSIGNMENT_NOT_FOUND');

      if (!['assigned', 'in_progress', 'overdue'].includes(assign.status)) {
        throw new Error('INVALID_ASSIGNMENT_STATUS');
      }

      if (assign.assigned_to_user_id === userData.user.id) {
        throw new Error('UNAUTHORIZED_WAIVER_AUTHORITY');
      }

      const { data: targetProfile, error: targetProfErr } = await serviceClient
        .from('profiles')
        .select('id, organization_id, department_id, division_id, is_active, user_status')
        .eq('id', assign.assigned_to_user_id)
        .maybeSingle();
      if (targetProfErr || !targetProfile) throw new Error('TARGET_USER_NOT_FOUND');
      if (!targetProfile.is_active || targetProfile.user_status !== 'active') {
        throw new Error('TARGET_USER_NOT_FOUND');
      }
      if (targetProfile.organization_id !== actorProfile.organization_id) {
        throw new Error('TENANT_ISOLATION_VIOLATION');
      }

      const hasGlobal = hasActiveGlobalGovernanceRole(userRoles, actorProfile.organization_id);
      const hasDept = hasActiveDepartmentManagerRole(userRoles, targetProfile.department_id, actorProfile.organization_id);
      const hasDiv = hasActiveDivisionHeadRole(userRoles, targetProfile.division_id, actorProfile.organization_id);

      if (!hasGlobal && !hasDept && !hasDiv) {
        throw new Error('UNAUTHORIZED_WAIVER_AUTHORITY');
      }

      const { data, error } = await serviceClient.rpc('waive_training_assignment_with_reason', {
        p_assignment_id: assignmentId,
        p_reason: reason,
        p_actor_id: userData.user.id,
      });

      if (error) {
        const e = mapV14e2b2DatabaseError(action, error);
        return errorResponse(e.error, e.status, e.code, e.detail, e.extra);
      }

      return jsonResponse({ ok: true, action, result: data }, 200);
    } catch (err) {
      const e = mapV14e2b2DatabaseError(action, err);
      return errorResponse(e.error, e.status, e.code, e.detail, e.extra);
    }
  }

  if (action === 'cancel_training_assignment_with_reason') {
    try {
      const payload = asPlainObject(requestBody.payload);
      assertNoIdentityOverrides(payload);
      assertOnlyAllowedKeys(payload, new Set(['assignment_id', 'reason', 'actor_id']), 'CANCEL_ASSIGNMENT_PAYLOAD');
      validateLegacyActorId(payload, userData.user.id);

      const assignmentId = requireCanonicalUuid(payload.assignment_id, 'assignment_id');
      const reason = boundedString(payload.reason, 3, 1000, 'reason', true) as string;

      const { actorProfile, userRoles } = await loadTrainingActorContext(userData.user.id);

      const { data: assign, error: assignErr } = await serviceClient
        .from('training_assignments')
        .select('id, assigned_to_user_id, status')
        .eq('id', assignmentId)
        .maybeSingle();
      if (assignErr || !assign) throw new Error('ASSIGNMENT_NOT_FOUND');

      if (assign.status === 'completed') {
        throw new Error('CANNOT_CANCEL_COMPLETED_ASSIGNMENT');
      }

      if (!['assigned', 'in_progress', 'overdue'].includes(assign.status)) {
        throw new Error('INVALID_ASSIGNMENT_STATUS');
      }

      if (assign.assigned_to_user_id === userData.user.id) {
        throw new Error('UNAUTHORIZED_CANCELLATION_AUTHORITY');
      }

      const { data: targetProfile, error: targetProfErr } = await serviceClient
        .from('profiles')
        .select('id, organization_id, department_id, division_id, is_active, user_status')
        .eq('id', assign.assigned_to_user_id)
        .maybeSingle();
      if (targetProfErr || !targetProfile) throw new Error('TARGET_USER_NOT_FOUND');
      if (!targetProfile.is_active || targetProfile.user_status !== 'active') {
        throw new Error('TARGET_USER_NOT_FOUND');
      }
      if (targetProfile.organization_id !== actorProfile.organization_id) {
        throw new Error('TENANT_ISOLATION_VIOLATION');
      }

      const hasGlobal = hasActiveGlobalGovernanceRole(userRoles, actorProfile.organization_id);
      const hasDept = hasActiveDepartmentManagerRole(userRoles, targetProfile.department_id, actorProfile.organization_id);
      const hasDiv = hasActiveDivisionHeadRole(userRoles, targetProfile.division_id, actorProfile.organization_id);

      if (!hasGlobal && !hasDept && !hasDiv) {
        throw new Error('UNAUTHORIZED_CANCELLATION_AUTHORITY');
      }

      const { data, error } = await serviceClient.rpc('cancel_training_assignment_with_reason', {
        p_assignment_id: assignmentId,
        p_reason: reason,
        p_actor_id: userData.user.id,
      });

      if (error) {
        const e = mapV14e2b2DatabaseError(action, error);
        return errorResponse(e.error, e.status, e.code, e.detail, e.extra);
      }

      return jsonResponse({ ok: true, action, result: data }, 200);
    } catch (err) {
      const e = mapV14e2b2DatabaseError(action, err);
      return errorResponse(e.error, e.status, e.code, e.detail, e.extra);
    }
  }

  if (action === 'reopen_training_assignment_with_reason') {
    try {
      const payload = asPlainObject(requestBody.payload);
      assertNoIdentityOverrides(payload);
      assertOnlyAllowedKeys(payload, new Set(['assignment_id', 'reason', 'actor_id']), 'REOPEN_ASSIGNMENT_PAYLOAD');
      validateLegacyActorId(payload, userData.user.id);

      const assignmentId = requireCanonicalUuid(payload.assignment_id, 'assignment_id');
      const reason = boundedString(payload.reason, 3, 1000, 'reason', true) as string;

      const { actorProfile, userRoles } = await loadTrainingActorContext(userData.user.id);

      const { data: assign, error: assignErr } = await serviceClient
        .from('training_assignments')
        .select('id, assigned_to_user_id, status')
        .eq('id', assignmentId)
        .maybeSingle();
      if (assignErr || !assign) throw new Error('ASSIGNMENT_NOT_FOUND');

      if (!['completed', 'waived', 'cancelled'].includes(assign.status)) {
        throw new Error('CANNOT_REOPEN_OPEN_ASSIGNMENT');
      }

      if (assign.assigned_to_user_id === userData.user.id) {
        throw new Error('UNAUTHORIZED_REOPEN_AUTHORITY');
      }

      const { data: targetProfile, error: targetProfErr } = await serviceClient
        .from('profiles')
        .select('id, organization_id, department_id, division_id, is_active, user_status')
        .eq('id', assign.assigned_to_user_id)
        .maybeSingle();
      if (targetProfErr || !targetProfile) throw new Error('TARGET_USER_NOT_FOUND');
      if (!targetProfile.is_active || targetProfile.user_status !== 'active') {
        throw new Error('TARGET_USER_NOT_FOUND');
      }
      if (targetProfile.organization_id !== actorProfile.organization_id) {
        throw new Error('TENANT_ISOLATION_VIOLATION');
      }

      const hasGlobal = hasActiveGlobalGovernanceRole(userRoles, actorProfile.organization_id);
      const hasDept = hasActiveDepartmentManagerRole(userRoles, targetProfile.department_id, actorProfile.organization_id);
      const hasDiv = hasActiveDivisionHeadRole(userRoles, targetProfile.division_id, actorProfile.organization_id);

      if (!hasGlobal && !hasDept && !hasDiv) {
        throw new Error('UNAUTHORIZED_REOPEN_AUTHORITY');
      }

      const { data, error } = await serviceClient.rpc('reopen_training_assignment_with_reason', {
        p_assignment_id: assignmentId,
        p_reason: reason,
        p_actor_id: userData.user.id,
      });

      if (error) {
        const e = mapV14e2b2DatabaseError(action, error);
        return errorResponse(e.error, e.status, e.code, e.detail, e.extra);
      }

      return jsonResponse({ ok: true, action, result: data }, 200);
    } catch (err) {
      const e = mapV14e2b2DatabaseError(action, err);
      return errorResponse(e.error, e.status, e.code, e.detail, e.extra);
    }
  }

  if (v14e1rGovernedDocumentActions.has(action)) {
    const payloadBytes = new TextEncoder().encode(JSON.stringify(requestPayload)).length;
    if (payloadBytes > MAX_E1R2_PAYLOAD_BYTES) {
      return errorResponse(
        'Governed document operation payload exceeds maximum allowable size.',
        400,
        'PAYLOAD_BYTE_BOUND_EXCEEDED',
        'The submitted payload exceeds the 1 MiB limit.',
        { action },
      );
    }
  }

  if (action === 'v14e1r_configure_approval_authority_rule_stages') {
    try {
      const payload = asPlainObject(requestBody.payload);
      assertNoIdentityOverrides(payload, [
        'actor_id', 'p_actor_id',
        'organization_id', 'p_organization_id',
        'stage_order',
      ]);
      assertOnlyAllowedKeys(payload, new Set(['authority_rule_id', 'stages']), 'CONFIGURE_STAGES_PAYLOAD');
      const { authorityRuleId, stages } = validateStageConfigInput(payload);

      const { data, error } = await serviceClient.rpc('configure_approval_authority_rule_stages', {
        p_actor_id: userData.user.id,
        p_authority_rule_id: authorityRuleId,
        p_stages: stages,
      });

      if (error) {
        const err = mapV14e1rDatabaseError(action, error);
        return errorResponse(err.error, err.status, err.code, err.detail, err.extra);
      }

      if (!validateConfigureStagesProof(data, authorityRuleId)) {
        return errorResponse('Configure stages response failed proof verification.', 409, 'PROOF_VALIDATION_FAILED', 'Server response failed proof contract verification.', { action });
      }

      return jsonResponse({ ok: true, action, result: data }, 200);
    } catch (err) {
      const e = mapV14e1rDatabaseError(action, err);
      return errorResponse(e.error, e.status, e.code, e.detail, e.extra);
    }
  }

  if (action === 'v14e1r_create_governed_sop_draft') {
    try {
      const payload = asPlainObject(requestBody.payload);
      assertNoIdentityOverrides(payload, ['actor_id', 'p_actor_id', 'organization_id', 'p_organization_id']);
      assertOnlyAllowedKeys(payload, new Set([
        'title_en',
        'title_ar',
        'process_name_en',
        'process_name_ar',
        'purpose_en',
        'purpose_ar',
        'process_owner_id',
        'primary_policy_version_id',
        'governance_link_state',
        'scope_en',
        'scope_ar',
        'department_id',
        'criticality_level',
        'confidentiality_level',
        'content_mode',
        'training_required',
        'acknowledgment_required',
        'competency_assessment_required',
        'acknowledgment_sla_days',
        'training_renewal_months',
        'procedure_sections',
        'procedure_steps',
        'department_scopes',
        'role_scopes',
        'definitions',
        'role_responsibilities',
        'monitoring_kpis',
        'risk_links',
        'accreditation_links',
        'version_links',
      ]), 'CREATE_SOP_PAYLOAD');

      const { data: actorProfile, error: profileErr } = await serviceClient
        .from('profiles')
        .select('id, organization_id, is_active')
        .eq('id', userData.user.id)
        .single();

      if (profileErr || !actorProfile || !actorProfile.organization_id || actorProfile.is_active === false) {
        const e = mapV14e1rDatabaseError(action, 'PATCH202_ACTOR_NOT_AUTHORIZED');
        return errorResponse(e.error, e.status, e.code, e.detail, e.extra);
      }

      const titleEn = boundedString(payload.title_en, 500, 'title_en', true)!;
      const titleAr = boundedString(payload.title_ar, 500, 'title_ar');
      const processNameEn = boundedString(payload.process_name_en, 255, 'process_name_en');
      const processNameAr = boundedString(payload.process_name_ar, 255, 'process_name_ar');
      const purposeEn = boundedString(payload.purpose_en, 5000, 'purpose_en');
      const purposeAr = boundedString(payload.purpose_ar, 5000, 'purpose_ar');
      const processOwnerId = optionalCanonicalUuid(payload.process_owner_id, 'process_owner_id');
      const primaryPolicyVersionId = optionalCanonicalUuid(payload.primary_policy_version_id, 'primary_policy_version_id');
      const governanceLinkState = resolveCreateGovernanceLinkState(payload.governance_link_state, primaryPolicyVersionId);

      const scopeEn = boundedString(payload.scope_en, 5000, 'scope_en');
      const scopeAr = boundedString(payload.scope_ar, 5000, 'scope_ar');
      const departmentId = optionalCanonicalUuid(payload.department_id, 'department_id');

      let criticalityLevel = 'medium';
      if (payload.criticality_level !== undefined && payload.criticality_level !== null) {
        if (typeof payload.criticality_level !== 'string') throw new Error('INVALID_CRITICALITY_LEVEL');
        const c = payload.criticality_level.trim();
        if (!validCriticalityLevels.has(c)) throw new Error('INVALID_CRITICALITY_LEVEL');
        criticalityLevel = c;
      }

      let confidentialityLevel = 'internal';
      if (payload.confidentiality_level !== undefined && payload.confidentiality_level !== null) {
        if (typeof payload.confidentiality_level !== 'string') throw new Error('INVALID_CONFIDENTIALITY_LEVEL');
        const c = payload.confidentiality_level.trim();
        if (!validConfidentialityLevels.has(c)) throw new Error('INVALID_CONFIDENTIALITY_LEVEL');
        confidentialityLevel = c;
      }

      let contentMode = 'structured';
      if (payload.content_mode !== undefined && payload.content_mode !== null) {
        if (typeof payload.content_mode !== 'string') throw new Error('INVALID_CONTENT_MODE');
        const cm = payload.content_mode.trim();
        if (!validContentModes.has(cm)) throw new Error('INVALID_CONTENT_MODE');
        contentMode = cm;
      }

      const trainingRequired = validateStrictBoolean(payload.training_required, 'training_required', false);
      const acknowledgmentRequired = validateStrictBoolean(payload.acknowledgment_required, 'acknowledgment_required', false);
      const competencyAssessmentRequired = validateStrictBoolean(payload.competency_assessment_required, 'competency_assessment_required', false);
      const acknowledgmentSlaDays = validateStrictInteger(payload.acknowledgment_sla_days, 'acknowledgment_sla_days', 1, 365, 30);
      const trainingRenewalMonths = validateStrictInteger(payload.training_renewal_months, 'training_renewal_months', 1, 120, 12);

      const sections = validateProcedureSections(payload.procedure_sections) ?? [];
      const steps = validateProcedureSteps(payload.procedure_steps) ?? [];
      const deptScopes = validateDepartmentScopes(payload.department_scopes) ?? [];
      const roleScopes = validateRoleScopes(payload.role_scopes) ?? [];
      const definitions = validateDefinitions(payload.definitions) ?? [];
      const roleResponsibilities = validateRoleResponsibilities(payload.role_responsibilities) ?? [];
      const monitoringKpis = validateMonitoringKpis(payload.monitoring_kpis) ?? [];
      const riskLinks = validateRiskLinks(payload.risk_links) ?? [];
      const accreditationLinks = validateAccreditationLinks(payload.accreditation_links) ?? [];
      const versionLinks = validateVersionLinks(payload.version_links) ?? [];

      const { data, error } = await serviceClient.rpc('create_governed_sop_draft', {
        p_actor_id: userData.user.id,
        p_organization_id: actorProfile.organization_id,
        p_title_en: titleEn,
        p_title_ar: titleAr,
        p_process_name_en: processNameEn,
        p_process_name_ar: processNameAr,
        p_purpose_en: purposeEn,
        p_purpose_ar: purposeAr,
        p_process_owner_id: processOwnerId,
        p_primary_policy_version_id: primaryPolicyVersionId,
        p_governance_link_state: governanceLinkState,
        p_scope_en: scopeEn,
        p_scope_ar: scopeAr,
        p_department_id: departmentId,
        p_criticality_level: criticalityLevel,
        p_confidentiality_level: confidentialityLevel,
        p_training_required: trainingRequired,
        p_acknowledgment_required: acknowledgmentRequired,
        p_competency_assessment_required: competencyAssessmentRequired,
        p_acknowledgment_sla_days: acknowledgmentSlaDays,
        p_training_renewal_months: trainingRenewalMonths,
        p_content_mode: contentMode,
        p_procedure_sections: sections,
        p_procedure_steps: steps,
        p_department_scopes: deptScopes,
        p_role_scopes: roleScopes,
        p_definitions: definitions,
        p_role_responsibilities: roleResponsibilities,
        p_monitoring_kpis: monitoringKpis,
        p_risk_links: riskLinks,
        p_accreditation_links: accreditationLinks,
        p_version_links: versionLinks,
      });

      if (error) {
        const e = mapV14e1rDatabaseError(action, error);
        return errorResponse(e.error, e.status, e.code, e.detail, e.extra);
      }

      if (!validateCreateSopDraftProof(data)) {
        return errorResponse('Create draft response failed proof verification.', 409, 'PROOF_VALIDATION_FAILED', 'Server response failed proof contract verification.', { action });
      }

      return jsonResponse({ ok: true, action, result: data }, 200);
    } catch (err) {
      const e = mapV14e1rDatabaseError(action, err);
      return errorResponse(e.error, e.status, e.code, e.detail, e.extra);
    }
  }

  if (action === 'v14e1r_save_governed_sop_draft') {
    try {
      const payload = asPlainObject(requestBody.payload);
      assertNoIdentityOverrides(payload, ['actor_id', 'p_actor_id', 'organization_id', 'p_organization_id']);
      assertOnlyAllowedKeys(payload, new Set([
        'version_id',
        'title_en',
        'title_ar',
        'process_name_en',
        'process_name_ar',
        'purpose_en',
        'purpose_ar',
        'process_owner_id',
        'primary_policy_version_id',
        'governance_link_state',
        'scope_en',
        'scope_ar',
        'content_mode',
        'transcription_status',
        'training_required',
        'acknowledgment_required',
        'competency_assessment_required',
        'acknowledgment_sla_days',
        'training_renewal_months',
        'procedure_sections',
        'procedure_steps',
        'department_scopes',
        'role_scopes',
        'definitions',
        'role_responsibilities',
        'monitoring_kpis',
        'risk_links',
        'accreditation_links',
        'version_links',
      ]), 'SAVE_SOP_PAYLOAD');

      const versionId = requireCanonicalUuid(payload.version_id, 'version_id');

      const titleEn = boundedString(payload.title_en, 500, 'title_en');
      const titleAr = boundedString(payload.title_ar, 500, 'title_ar');
      const processNameEn = boundedString(payload.process_name_en, 255, 'process_name_en');
      const processNameAr = boundedString(payload.process_name_ar, 255, 'process_name_ar');
      const purposeEn = boundedString(payload.purpose_en, 5000, 'purpose_en');
      const purposeAr = boundedString(payload.purpose_ar, 5000, 'purpose_ar');
      const processOwnerId = optionalCanonicalUuid(payload.process_owner_id, 'process_owner_id');
      const primaryPolicyVersionId = optionalCanonicalUuid(payload.primary_policy_version_id, 'primary_policy_version_id');

      let governanceLinkState: string | null = null;
      if (payload.governance_link_state !== undefined && payload.governance_link_state !== null) {
        if (typeof payload.governance_link_state !== 'string') throw new Error('INVALID_GOVERNANCE_LINK_STATE');
        const gls = payload.governance_link_state.trim();
        if (!validGovernanceLinkStates.has(gls)) throw new Error('INVALID_GOVERNANCE_LINK_STATE');
        governanceLinkState = gls;
      }
      if (governanceLinkState === 'linked' && primaryPolicyVersionId === null && payload.primary_policy_version_id !== undefined) {
        throw new Error('PATCH206_LINKED_STATE_REQUIRES_POLICY');
      }
      if (governanceLinkState === 'not_applicable' && primaryPolicyVersionId) {
        throw new Error('PATCH206_NOT_APPLICABLE_FORBIDS_POLICY');
      }

      const scopeEn = boundedString(payload.scope_en, 5000, 'scope_en');
      const scopeAr = boundedString(payload.scope_ar, 5000, 'scope_ar');

      let contentMode: string | null = null;
      if (payload.content_mode !== undefined && payload.content_mode !== null) {
        if (typeof payload.content_mode !== 'string') throw new Error('INVALID_CONTENT_MODE');
        const cm = payload.content_mode.trim();
        if (!validContentModes.has(cm)) throw new Error('INVALID_CONTENT_MODE');
        contentMode = cm;
      }

      let transcriptionStatus: string | null = null;
      if (payload.transcription_status !== undefined && payload.transcription_status !== null) {
        if (typeof payload.transcription_status !== 'string') throw new Error('INVALID_TRANSCRIPTION_STATUS');
        const ts = payload.transcription_status.trim();
        if (!validTranscriptionStatuses.has(ts)) throw new Error('INVALID_TRANSCRIPTION_STATUS');
        transcriptionStatus = ts;
      }

      const trainingRequired = optionalStrictBoolean(payload.training_required, 'training_required');
      const acknowledgmentRequired = optionalStrictBoolean(payload.acknowledgment_required, 'acknowledgment_required');
      const competencyAssessmentRequired = optionalStrictBoolean(payload.competency_assessment_required, 'competency_assessment_required');
      const acknowledgmentSlaDays = optionalStrictInteger(payload.acknowledgment_sla_days, 'acknowledgment_sla_days', 1, 365);
      const trainingRenewalMonths = optionalStrictInteger(payload.training_renewal_months, 'training_renewal_months', 1, 120);

      const sections = validateProcedureSections(payload.procedure_sections);
      const steps = validateProcedureSteps(payload.procedure_steps);
      const deptScopes = validateDepartmentScopes(payload.department_scopes);
      const roleScopes = validateRoleScopes(payload.role_scopes);
      const definitions = validateDefinitions(payload.definitions);
      const roleResponsibilities = validateRoleResponsibilities(payload.role_responsibilities);
      const monitoringKpis = validateMonitoringKpis(payload.monitoring_kpis);
      const riskLinks = validateRiskLinks(payload.risk_links);
      const accreditationLinks = validateAccreditationLinks(payload.accreditation_links);
      const versionLinks = validateVersionLinks(payload.version_links);

      const { data, error } = await serviceClient.rpc('save_governed_sop_draft', {
        p_actor_id: userData.user.id,
        p_version_id: versionId,
        p_title_en: titleEn,
        p_title_ar: titleAr,
        p_process_name_en: processNameEn,
        p_process_name_ar: processNameAr,
        p_purpose_en: purposeEn,
        p_purpose_ar: purposeAr,
        p_process_owner_id: processOwnerId,
        p_primary_policy_version_id: primaryPolicyVersionId,
        p_governance_link_state: governanceLinkState,
        p_scope_en: scopeEn,
        p_scope_ar: scopeAr,
        p_training_required: trainingRequired,
        p_acknowledgment_required: acknowledgmentRequired,
        p_competency_assessment_required: competencyAssessmentRequired,
        p_acknowledgment_sla_days: acknowledgmentSlaDays,
        p_training_renewal_months: trainingRenewalMonths,
        p_content_mode: contentMode,
        p_transcription_status: transcriptionStatus,
        p_procedure_sections: sections,
        p_procedure_steps: steps,
        p_department_scopes: deptScopes,
        p_role_scopes: roleScopes,
        p_definitions: definitions,
        p_role_responsibilities: roleResponsibilities,
        p_monitoring_kpis: monitoringKpis,
        p_risk_links: riskLinks,
        p_accreditation_links: accreditationLinks,
        p_version_links: versionLinks,
      });

      if (error) {
        const e = mapV14e1rDatabaseError(action, error);
        return errorResponse(e.error, e.status, e.code, e.detail, e.extra);
      }

      if (!validateSaveSopDraftProof(data, versionId)) {
        return errorResponse('Save draft response failed proof verification.', 409, 'PROOF_VALIDATION_FAILED', 'Server response failed proof contract verification.', { action });
      }

      return jsonResponse({ ok: true, action, result: data }, 200);
    } catch (err) {
      const e = mapV14e1rDatabaseError(action, err);
      return errorResponse(e.error, e.status, e.code, e.detail, e.extra);
    }
  }

  if (action === 'v14e1r_start_governed_document_revision') {
    try {
      const payload = asPlainObject(requestBody.payload);
      assertNoIdentityOverrides(payload, ['actor_id', 'p_actor_id', 'organization_id', 'p_organization_id']);
      assertOnlyAllowedKeys(payload, new Set(['source_version_id', 'revision_type', 'revision_reason']), 'START_REVISION_PAYLOAD');
      const sourceVersionId = requireCanonicalUuid(payload.source_version_id, 'source_version_id');

      let revisionType = 'minor';
      if (payload.revision_type !== undefined && payload.revision_type !== null) {
        if (typeof payload.revision_type !== 'string') throw new Error('INVALID_REVISION_TYPE');
        const rt = payload.revision_type.trim();
        if (!validRevisionTypes.has(rt)) throw new Error('INVALID_REVISION_TYPE');
        revisionType = rt;
      }
      const revisionReason = boundedString(payload.revision_reason, 1000, 'revision_reason');

      const { data, error } = await serviceClient.rpc('start_governed_document_revision', {
        p_actor_id: userData.user.id,
        p_source_version_id: sourceVersionId,
        p_revision_type: revisionType,
        p_revision_reason: revisionReason,
      });

      if (error) {
        const e = mapV14e1rDatabaseError(action, error);
        return errorResponse(e.error, e.status, e.code, e.detail, e.extra);
      }

      if (!validateStartRevisionProof(data, sourceVersionId)) {
        return errorResponse('Start revision response failed proof verification.', 409, 'PROOF_VALIDATION_FAILED', 'Server response failed proof contract verification.', { action });
      }

      return jsonResponse({ ok: true, action, result: data }, 200);
    } catch (err) {
      const e = mapV14e1rDatabaseError(action, err);
      return errorResponse(e.error, e.status, e.code, e.detail, e.extra);
    }
  }

  if (action === 'v14e1r_submit_governed_document_for_review') {
    try {
      const payload = asPlainObject(requestBody.payload);
      assertNoIdentityOverrides(payload, ['actor_id', 'p_actor_id', 'organization_id', 'p_organization_id']);
      assertOnlyAllowedKeys(payload, new Set(['version_id', 'submission_note']), 'SUBMIT_REVIEW_PAYLOAD');
      const versionId = requireCanonicalUuid(payload.version_id, 'version_id');
      const submissionNote = boundedString(payload.submission_note, 2000, 'submission_note');

      const { data, error } = await serviceClient.rpc('submit_governed_document_for_review', {
        p_actor_id: userData.user.id,
        p_version_id: versionId,
        p_submission_note: submissionNote,
      });

      if (error) {
        const e = mapV14e1rDatabaseError(action, error);
        return errorResponse(e.error, e.status, e.code, e.detail, e.extra);
      }

      if (!validateSubmitReviewProof(data, versionId)) {
        return errorResponse('Submit review response failed proof verification.', 409, 'PROOF_VALIDATION_FAILED', 'Server response failed proof contract verification.', { action });
      }

      return jsonResponse({ ok: true, action, result: data }, 200);
    } catch (err) {
      const e = mapV14e1rDatabaseError(action, err);
      return errorResponse(e.error, e.status, e.code, e.detail, e.extra);
    }
  }

  if (action === 'v14e1r_record_governed_document_approval_decision') {
    try {
      const payload = asPlainObject(requestBody.payload);
      assertNoIdentityOverrides(payload, [
        'actor_id', 'p_actor_id',
        'approver_id', 'p_approver_id',
        'approver_role', 'p_approver_role',
        'stage_id', 'request_stage_id',
        'organization_id', 'p_organization_id',
        'workflow_type', 'linked_item_type', 'linked_item_id',
      ]);
      assertOnlyAllowedKeys(payload, new Set(['approval_request_id', 'decision', 'decision_note']), 'RECORD_DECISION_PAYLOAD');

      const approvalRequestId = requireCanonicalUuid(payload.approval_request_id, 'approval_request_id');

      if (typeof payload.decision !== 'string') {
        throw new Error('INVALID_DECISION');
      }
      const rawDecision = boundedString(payload.decision, 50, 'decision', true)!;
      if (!validApprovalDecisions.has(rawDecision)) {
        throw new Error('INVALID_DECISION');
      }
      const decision = rawDecision;
      const decisionNote = boundedString(payload.decision_note, 2000, 'decision_note');

      // ------------------------------------------------------------
      // MANDATORY EDGE PATH-A PREFLIGHT (SERVICE-ROLE READS)
      // ------------------------------------------------------------
      const { data: reqRow, error: reqErr } = await serviceClient
        .from('approval_requests')
        .select('id, organization_id, workflow_type, linked_item_type, linked_item_id, request_status')
        .eq('id', approvalRequestId)
        .single();

      if (reqErr || !reqRow) {
        const e = mapV14e1rDatabaseError(action, 'PATCH202_APPROVAL_REQUEST_NOT_FOUND');
        return errorResponse(e.error, e.status, e.code, e.detail, e.extra);
      }

      const { data: actorProfile, error: profileErr } = await serviceClient
        .from('profiles')
        .select('id, organization_id, is_active')
        .eq('id', userData.user.id)
        .single();

      if (profileErr || !actorProfile || !actorProfile.organization_id || actorProfile.is_active === false) {
        const e = mapV14e1rDatabaseError(action, 'PATCH202_ACTOR_NOT_AUTHORIZED');
        return errorResponse(e.error, e.status, e.code, e.detail, e.extra);
      }

      if (reqRow.organization_id !== actorProfile.organization_id) {
        const e = mapV14e1rDatabaseError(action, 'PATCH202_ACTOR_CROSS_ORG_FORBIDDEN');
        return errorResponse(e.error, e.status, e.code, e.detail, e.extra);
      }

      if (reqRow.workflow_type !== 'document_control' || reqRow.linked_item_type !== 'document_version') {
        return errorResponse('Invalid workflow type for governed document approval.', 400, 'PATCH206_INVALID_WORKFLOW_TYPE', 'This action strictly supports document_control on document_version.', { action });
      }

      const { data: linkedVer, error: verErr } = await serviceClient
        .from('document_versions')
        .select('id, document_id, controlled_documents(organization_id)')
        .eq('id', reqRow.linked_item_id)
        .single();

      if (verErr || !linkedVer) {
        const e = mapV14e1rDatabaseError(action, 'PATCH202_VERSION_NOT_FOUND');
        return errorResponse(e.error, e.status, e.code, e.detail, e.extra);
      }
      const docOrg = (linkedVer.controlled_documents as { organization_id?: string })?.organization_id;
      if (docOrg !== actorProfile.organization_id) {
        const e = mapV14e1rDatabaseError(action, 'PATCH202_ACTOR_CROSS_ORG_FORBIDDEN');
        return errorResponse(e.error, e.status, e.code, e.detail, e.extra);
      }

      if (!['pending', 'partially_approved'].includes(reqRow.request_status)) {
        return errorResponse('Approval request is not open for review.', 409, 'PATCH206_REQUEST_NOT_OPEN', 'The approval request is already closed or completed.', { action });
      }

      const { data: stageRows, error: stageErr } = await serviceClient
        .from('approval_request_stages')
        .select('id, stage_order, stage_status')
        .eq('approval_request_id', approvalRequestId);

      if (stageErr || !stageRows || stageRows.length === 0) {
        return errorResponse('No approval stages instantiated.', 409, 'PATCH206_NO_STAGES_INSTANTIATED', 'The approval request has no instantiated stages.', { action });
      }

      const inProgressStages = stageRows.filter((s: { stage_status?: string }) => s.stage_status === 'in_progress');
      if (inProgressStages.length !== 1) {
        return errorResponse('Approval request stage state is invalid.', 409, 'PATCH206_INVALID_STAGE_STATE', `Expected exactly 1 in-progress stage, found ${inProgressStages.length}.`, { action });
      }

      // EXACT 5-PARAMETER RPC CALL (NO p_decision_metadata or sixth argument)
      const { data, error } = await serviceClient.rpc('record_approval_decision', {
        p_approval_request_id: approvalRequestId,
        p_approver_id: userData.user.id,
        p_decision: decision,
        p_decision_note: decisionNote,
        p_approver_role: null,
      });

      if (error) {
        const e = mapV14e1rDatabaseError(action, error);
        return errorResponse(e.error, e.status, e.code, e.detail, e.extra);
      }

      if (!validateApprovalDecisionProof(data, approvalRequestId)) {
        return errorResponse('Record decision response failed proof verification.', 409, 'PROOF_VALIDATION_FAILED', 'Server response failed proof contract verification.', { action });
      }

      return jsonResponse({ ok: true, action, result: data }, 200);
    } catch (err) {
      const e = mapV14e1rDatabaseError(action, err);
      return errorResponse(e.error, e.status, e.code, e.detail, e.extra);
    }
  }

  if (action === 'v14e1r_finalize_governed_document_approval') {
    try {
      const payload = asPlainObject(requestBody.payload);
      assertNoIdentityOverrides(payload, ['actor_id', 'p_actor_id', 'organization_id', 'p_organization_id']);
      assertOnlyAllowedKeys(payload, new Set(['version_id', 'approval_note']), 'FINALIZE_APPROVAL_PAYLOAD');
      const versionId = requireCanonicalUuid(payload.version_id, 'version_id');
      const approvalNote = boundedString(payload.approval_note, 2000, 'approval_note');

      const { data, error } = await serviceClient.rpc('finalize_governed_document_approval', {
        p_actor_id: userData.user.id,
        p_version_id: versionId,
        p_approval_note: approvalNote,
      });

      if (error) {
        const e = mapV14e1rDatabaseError(action, error);
        return errorResponse(e.error, e.status, e.code, e.detail, e.extra);
      }

      if (!validateFinalizeApprovalProof(data, versionId)) {
        return errorResponse('Finalize approval response failed proof verification.', 409, 'PROOF_VALIDATION_FAILED', 'Server response failed proof contract verification.', { action });
      }

      return jsonResponse({ ok: true, action, result: data }, 200);
    } catch (err) {
      const e = mapV14e1rDatabaseError(action, err);
      return errorResponse(e.error, e.status, e.code, e.detail, e.extra);
    }
  }

  const { data, error } = await serviceClient.rpc('v72_execute_privileged_action', {
    p_actor_id: userData.user.id,
    p_action: action,
    p_payload: requestBody.payload ?? {},
  });

  if (error) {
    const authorizationFailure =
      /NOT_AUTHORIZED|DENIED|REQUIRES_SUPER_ADMIN|SERVICE_ROLE_REQUIRED|ACTIVE_ACTOR_REQUIRED/i
        .test(error.message);
    return jsonResponse({
      ok: false,
      error: error.message,
      code: error.code,
      action,
    }, authorizationFailure ? 403 : 409);
  }

  return jsonResponse({ ok: true, action, result: data }, 200);
});
