import {
  invokePrivilegedAction,
  PrivilegedActionError,
  type PrivilegedActionOptions,
} from './privilegedAction';
import {
  isPatch83uCredentialGovernanceEnabled,
  PATCH83U_EXPECTED_EDGE_CONTRACT_VERSION,
  PATCH83U_EXPECTED_SCHEMA_VERSION,
  PATCH83U_FRONTEND_CONTRACT_VERSION,
} from '../config/featureFlags';

export const CAPABILITIES_ACTION = 'patch83u_get_capabilities';
export const CREDENTIAL_STATE_ACTION = 'patch83u_get_credential_state';
export const LIST_PROVISIONING_ACTION = 'patch83u_list_provisioning';
export const PROVISION_ACCOUNT_ACTION = 'patch83u_provision_account';
export const RECONCILE_PROVISIONING_ACTION = 'patch83u_reconcile_provisioning';
export const RECONCILE_CREDENTIAL_STATE_ACTION = 'patch83u_reconcile_credential_state';
export const CHANGE_REQUIRED_PASSWORD_ACTION = 'patch83u_change_required_password';
export const ADMIN_RESET_PASSWORD_ACTION = 'patch83u_admin_reset_password';
export const ADMIN_RESET_CONFIRMATION_TEXT = 'RESET USER PASSWORD';
export const ADMIN_RESET_CONFIRMATION = 'PATCH83U_RESET_USER_PASSWORD';

export interface Patch83uRequestOptions {
  signal?: AbortSignal;
  accessToken?: string;
}

export type Patch83uRuntimeEnforcementState =
  | 'disabled'
  | 'prepared'
  | 'enforced'
  | 'emergency_suspended';

export type Patch83uCapabilities = {
  edge_contract_version: string;
  installed_schema_version: number;
  runtime_enforcement_state: Patch83uRuntimeEnforcementState;
  credential_state_action_available: boolean;
  password_change_action_available: boolean;
  provisioning_action_available: boolean;
  reset_action_available: boolean;
  server_time: string;
  compatibility_status: string;
};

export class Patch83uFeatureDisabledError extends Error {
  readonly code = 'PATCH83U_FRONTEND_FEATURE_DISABLED';

  constructor() {
    super('Patch 83U credential governance is disabled by deployment configuration.');
    this.name = 'Patch83uFeatureDisabledError';
  }
}

export type UserProvisioningStatus =
  | 'queued'
  | 'held_lifecycle'
  | 'provisioning'
  | 'auth_created_pending_finalize'
  | 'initial_change_required'
  | 'completed'
  | 'retryable_failed'
  | 'policy_blocked'
  | 'reconciliation_required'
  | 'cancelled';

/** Browser-safe provisioning queue row. It deliberately contains no password material. */
export type UserProvisioningRow = {
  id: string;
  import_batch_id: string;
  import_row_id: string;
  employee_id: string;
  auth_email: string;
  contact_email: string | null;
  account_action: 'create' | 'update' | 'create_or_update';
  full_name_en: string;
  full_name_ar: string | null;
  phone: string | null;
  department_id: string;
  department_code: string;
  job_title: string;
  requested_role: string;
  requested_scope: string;
  requested_user_type: string;
  requested_lifecycle: string;
  provisioning_status: UserProvisioningStatus;
  attempt_count: number;
  last_error_code: string | null;
  last_error_message: string | null;
  profile_id: string | null;
  created_at: string;
  updated_at: string;
};

export type UserProvisioningListResult = {
  organization_id: string;
  rows: UserProvisioningRow[];
  count: number;
};

/** Whitelisted Edge result; the internal provisioning claim snapshot is never represented here. */
export type ProvisionAccountResult = {
  provisioningId: string;
  profileId: string;
  status: UserProvisioningStatus;
  mustChangePassword: boolean;
};

export type ReconcileProvisioningResult = {
  provisioningId: string;
  status: UserProvisioningStatus;
  outcome: string;
};

export type AdminResetPasswordResult = {
  userId: string;
  status: 'admin_reset_change_required' | 'session_revocation_review_required' | 'recovery_required';
  credentialVersion: number;
  mustChangePassword: boolean;
  mustReauthenticate: true;
  reconciliationRequired: boolean;
  sessionRevocationReviewRequired: boolean;
  idempotentReplay: boolean;
  requestId: string;
};

export type ReconcileCredentialStateResult = {
  userId: string;
  credentialState: string;
  outcome: string;
  reconciliationRequired: boolean;
};

export type ProvisioningCommandInput = {
  provisioningId: string;
  employeeIdConfirmation: string;
  requestId: string;
};

export type AdminResetPasswordInput = {
  userId: string;
  temporaryPassword: string;
  confirmTemporaryPassword: string;
  employeeIdConfirmation: string;
  confirmationText: string;
  reason: string;
  requestId: string;
};

export type CanonicalCredentialState =
  | 'unmanaged'
  | 'active'
  | 'initial_change_required'
  | 'admin_reset_change_required'
  | 'reactivation_change_required'
  | 'existing_password_rotation_pending'
  | 'existing_password_change_required'
  | 'password_change_in_progress'
  | 'reset_in_progress'
  | 'recovery_required'
  | 'reconciliation_required'
  | 'session_revocation_review_required'
  | 'disabled'
  | 'locked'
  | 'blocked';

export type UserCredentialState = {
  managed: boolean;
  credential_state: CanonicalCredentialState;
  credential_version: number;
  auth_email: string | null;
  access_allowed: boolean;
  message: string | null;
};

export type CredentialGateDecision =
  | { gate: 'legacy_unmanaged'; state: UserCredentialState }
  | { gate: 'active'; state: UserCredentialState }
  | { gate: 'password_change_required'; state: UserCredentialState }
  | { gate: 'reconciliation_required'; state: UserCredentialState }
  | { gate: 'blocked'; state: UserCredentialState };

const PASSWORD_CHANGE_STATES = new Set([
  'initial_change_required',
  'admin_reset_change_required',
  'reactivation_change_required',
  'existing_password_change_required',
]);

const RECONCILIATION_STATES = new Set<CanonicalCredentialState>([
  'password_change_in_progress',
  'reset_in_progress',
  'recovery_required',
  'reconciliation_required',
  'session_revocation_review_required',
]);

const CANONICAL_CREDENTIAL_STATES = new Set<CanonicalCredentialState>([
  'unmanaged',
  'active',
  'initial_change_required',
  'admin_reset_change_required',
  'reactivation_change_required',
  'existing_password_rotation_pending',
  'existing_password_change_required',
  'password_change_in_progress',
  'reset_in_progress',
  'recovery_required',
  'reconciliation_required',
  'session_revocation_review_required',
  'disabled',
  'locked',
  'blocked',
]);

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]+$/;
const MAX_REQUEST_ID_LENGTH = 128;
const MAX_PASSWORD_LENGTH = 256;
const MAX_RESET_REASON_LENGTH = 500;
const AMBIGUOUS_PASSWORD_CHANGE_CODES = new Set([
  'PATCH83U_PASSWORD_CHANGE_BEGIN_FAILED',
  'PATCH83U_PASSWORD_CHANGE_BEGIN_PROOF_FAILED',
  'PATCH83U_PASSWORD_CHANGE_FINALIZE_FAILED',
  'PATCH83U_PASSWORD_CHANGE_FINALIZE_PROOF_FAILED',
  'PATCH83U_PASSWORD_CHANGE_FAILED',
  'PATCH83U_PASSWORD_CHANGE_RECONCILIATION_REQUIRED',
  'PATCH83U_PASSWORD_CHANGE_REPLAY_PROOF_FAILED',
  'PATCH83U_PASSWORD_CHANGE_RESULT_INVALID',
  'PATCH83U_AUTH_PASSWORD_UPDATE_FAILED',
  'PATCH83U_AUTH_PASSWORD_UPDATE_VERSION_AMBIGUOUS',
  'PATCH83U_AUTH_PASSWORD_UPDATE_PROOF_FAILED',
]);

export type PasswordChangeFailureDisposition =
  | 'retry_in_current_session'
  | 'close_unconfirmed_session'
  | 'close_after_password_policy_rejection';

const LEGACY_UNMANAGED_STATE: UserCredentialState = {
  managed: false,
  credential_state: 'unmanaged',
  credential_version: 0,
  auth_email: null,
  access_allowed: true,
  message: null,
};

export type ChangeRequiredPasswordInput = {
  currentPassword: string;
  newPassword: string;
  confirmNewPassword: string;
  captchaToken?: string | null;
  requestId: string;
};

export type ChangeRequiredPasswordResult = {
  userId: string;
  status: 'active' | 'session_revocation_review_required' | 'recovery_required';
  credentialVersion: number;
  mustReauthenticate: true;
  reconciliationRequired: boolean;
  sessionRevocationReviewRequired: boolean;
  idempotentReplay: boolean;
  requestId: string;
};

function requirePatch83uEnabled(): void {
  if (!isPatch83uCredentialGovernanceEnabled()) {
    throw new Patch83uFeatureDisabledError();
  }
}

function privilegedOptions(options: Patch83uRequestOptions): PrivilegedActionOptions {
  return {
    ...(options.signal ? { signal: options.signal } : {}),
    ...(options.accessToken ? { accessToken: options.accessToken } : {}),
  };
}

export function isAmbiguousPasswordChangeFailure(error: unknown): boolean {
  if (!(error instanceof PrivilegedActionError)) return false;
  if (error.code && AMBIGUOUS_PASSWORD_CHANGE_CODES.has(error.code)) return true;
  return error.retryable
    && (
      error.code === 'PRIVILEGED_ACTION_TRANSPORT_ERROR'
      || (error.code === null && error.status === null)
    );
}

export function passwordChangeFailureDisposition(error: unknown): PasswordChangeFailureDisposition {
  if (
    error instanceof PrivilegedActionError
    && error.code === 'PATCH83U_PERMANENT_PASSWORD_POLICY_REJECTED'
  ) {
    // The policy decision is definitive, but Auth evaluates it only after the
    // protected operation begins and the Edge bridge attempts global sign-out.
    return 'close_after_password_policy_rejection';
  }
  return isAmbiguousPasswordChangeFailure(error)
    ? 'close_unconfirmed_session'
    : 'retry_in_current_session';
}

function isLegacyUnmanagedState(state: UserCredentialState): boolean {
  return state.managed === false
    && state.credential_version === 0
    && state.credential_state === 'unmanaged'
    && state.access_allowed === true;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function isCanonicalCredentialState(value: unknown): value is CanonicalCredentialState {
  return typeof value === 'string' && CANONICAL_CREDENTIAL_STATES.has(value as CanonicalCredentialState);
}

function requireBooleanField(row: Record<string, unknown>, key: string): boolean {
  const value = row[key];
  if (typeof value !== 'boolean') {
    throw new Error(`The Patch 83U capability response has an invalid ${key} field.`);
  }
  return value;
}

export function normalizePatch83uCapabilities(value: unknown): Patch83uCapabilities {
  const row = asRecord(value);
  if (!row) throw new Error('The Patch 83U capability service returned an invalid response.');

  const edgeContractVersion = row.edge_contract_version;
  const installedSchemaVersion = row.installed_schema_version;
  const runtimeEnforcementState = row.runtime_enforcement_state;
  const serverTime = row.server_time;
  const compatibilityStatus = row.compatibility_status;
  if (
    typeof edgeContractVersion !== 'string'
    || !edgeContractVersion.trim()
    || edgeContractVersion !== edgeContractVersion.trim()
    || typeof installedSchemaVersion !== 'number'
    || !Number.isInteger(installedSchemaVersion)
    || installedSchemaVersion < 0
    || typeof runtimeEnforcementState !== 'string'
    || !['disabled', 'prepared', 'enforced', 'emergency_suspended'].includes(runtimeEnforcementState)
    || typeof serverTime !== 'string'
    || !serverTime.trim()
    || serverTime !== serverTime.trim()
    || !Number.isFinite(Date.parse(serverTime))
    || typeof compatibilityStatus !== 'string'
    || !compatibilityStatus.trim()
    || compatibilityStatus !== compatibilityStatus.trim()
  ) {
    throw new Error('The Patch 83U capability response is incomplete or malformed.');
  }

  return {
    edge_contract_version: edgeContractVersion,
    installed_schema_version: installedSchemaVersion,
    runtime_enforcement_state: runtimeEnforcementState as Patch83uRuntimeEnforcementState,
    credential_state_action_available: requireBooleanField(row, 'credential_state_action_available'),
    password_change_action_available: requireBooleanField(row, 'password_change_action_available'),
    provisioning_action_available: requireBooleanField(row, 'provisioning_action_available'),
    reset_action_available: requireBooleanField(row, 'reset_action_available'),
    server_time: serverTime,
    compatibility_status: compatibilityStatus,
  };
}

export function patch83uCapabilityCompatibilityIssue(
  capabilities: Patch83uCapabilities,
): string | null {
  if (capabilities.edge_contract_version !== PATCH83U_EXPECTED_EDGE_CONTRACT_VERSION) {
    return 'PATCH83U_EDGE_CONTRACT_MISMATCH';
  }
  if (capabilities.installed_schema_version !== PATCH83U_EXPECTED_SCHEMA_VERSION) {
    return 'PATCH83U_CREDENTIAL_MIGRATION_REQUIRED';
  }
  if (capabilities.compatibility_status !== 'compatible') {
    const status = capabilities.compatibility_status.toLowerCase();
    if (status.includes('runtime')) return 'PATCH83U_RUNTIME_NOT_PREPARED';
    if (status.includes('edge')) return 'PATCH83U_EDGE_CONTRACT_MISMATCH';
    return 'PATCH83U_FRONTEND_CONTRACT_MISMATCH';
  }
  if (
    !capabilities.credential_state_action_available
  ) {
    return 'PATCH83U_EDGE_CONTRACT_MISMATCH';
  }
  if (
    capabilities.runtime_enforcement_state === 'enforced'
    && (
      !capabilities.password_change_action_available
      || !capabilities.provisioning_action_available
      || !capabilities.reset_action_available
    )
  ) return 'PATCH83U_EDGE_CONTRACT_MISMATCH';
  return null;
}

export function patch83uRuntimeAllowsStableExistingAccess(
  capabilities: Patch83uCapabilities,
  credential: UserCredentialState,
): boolean {
  return (
    capabilities.runtime_enforcement_state === 'disabled'
    || capabilities.runtime_enforcement_state === 'prepared'
    || capabilities.runtime_enforcement_state === 'emergency_suspended'
  )
    && credential.managed === true
    && credential.access_allowed === true;
}

function requireUuid(value: string, fieldName: string): string {
  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) {
    throw new Error(`${fieldName} must be a valid UUID.`);
  }
  return value.toLowerCase();
}

function requireExactEmployeeConfirmation(value: string): string {
  if (
    typeof value !== 'string'
    || !value
    || !value.trim()
    || value !== value.trim()
  ) {
    throw new Error('Employee ID confirmation must be entered exactly and cannot be empty.');
  }
  return value;
}

function requireSafeRequestId(value: string): string {
  if (
    typeof value !== 'string'
    || !value
    || value.length > MAX_REQUEST_ID_LENGTH
    || !REQUEST_ID_PATTERN.test(value)
  ) {
    throw new Error('Request ID must use 1-128 letters, numbers, dots, underscores, colons, or hyphens.');
  }
  return value;
}

function validateProvisioningCommand(input: ProvisioningCommandInput) {
  return {
    provisioningId: requireUuid(input.provisioningId, 'Provisioning ID'),
    employeeIdConfirmation: requireExactEmployeeConfirmation(input.employeeIdConfirmation),
    requestId: requireSafeRequestId(input.requestId),
  };
}

/**
 * Parses the fixed Patch 83U Edge response without silently granting access for
 * malformed or partially deployed managed credential records.
 */
export function normalizeCredentialStateResponse(value: unknown): UserCredentialState {
  const row = asRecord(value);
  if (!row) throw new Error('The credential-state service returned an invalid response.');

  const managed = row.managed;
  const version = row.credential_version;
  const credentialState = row.credential_state;
  const accessAllowed = row.access_allowed;
  const authEmail = row.auth_email;
  const message = row.message;

  if (
    managed === false
    && version === 0
    && credentialState === 'unmanaged'
    && accessAllowed === false
    && (authEmail === null || authEmail === undefined || typeof authEmail === 'string')
    && (message === null || message === undefined || typeof message === 'string')
  ) {
    return {
      ...LEGACY_UNMANAGED_STATE,
      auth_email: typeof authEmail === 'string' && authEmail.trim()
        ? authEmail.trim().toLowerCase()
        : null,
      access_allowed: accessAllowed,
      message: typeof message === 'string' && message.trim() ? message.trim() : null,
    };
  }

  if (
    managed !== true
    || typeof version !== 'number'
    || !Number.isInteger(version)
    || version < 0
    || !isCanonicalCredentialState(credentialState)
    || credentialState === 'unmanaged'
    || typeof accessAllowed !== 'boolean'
    || typeof authEmail !== 'string'
    || !authEmail.trim()
    || !(message === null || message === undefined || typeof message === 'string')
  ) {
    throw new Error('The managed credential-state response is incomplete. Access was denied.');
  }

  return {
    managed: true,
    credential_state: credentialState,
    credential_version: version,
    auth_email: typeof authEmail === 'string' && authEmail.trim()
      ? authEmail.trim().toLowerCase()
      : null,
    access_allowed: accessAllowed,
    message: typeof message === 'string' && message.trim() ? message.trim() : null,
  };
}

export function credentialGateDecision(state: UserCredentialState): CredentialGateDecision {
  if (isLegacyUnmanagedState(state)) {
    return { gate: 'legacy_unmanaged', state };
  }
  if (PASSWORD_CHANGE_STATES.has(state.credential_state)) {
    return { gate: 'password_change_required', state };
  }
  if (RECONCILIATION_STATES.has(state.credential_state)) {
    return { gate: 'reconciliation_required', state };
  }
  if (state.credential_state === 'existing_password_rotation_pending') {
    return state.access_allowed
      ? { gate: 'active', state }
      : { gate: 'reconciliation_required', state };
  }
  if (!state.access_allowed) {
    return { gate: 'blocked', state };
  }
  if (state.credential_state === 'active' && state.access_allowed) {
    return { gate: 'active', state };
  }
  return { gate: 'blocked', state };
}

export async function getPatch83uCapabilities(
  options: Patch83uRequestOptions = {},
): Promise<Patch83uCapabilities> {
  requirePatch83uEnabled();
  const result = await invokePrivilegedAction<unknown>(CAPABILITIES_ACTION, {
    frontend_contract_version: PATCH83U_FRONTEND_CONTRACT_VERSION,
  }, privilegedOptions(options));
  return normalizePatch83uCapabilities(result);
}

export async function getCurrentUserCredentialState(
  options: Patch83uRequestOptions = {},
): Promise<UserCredentialState> {
  requirePatch83uEnabled();
  const result = await invokePrivilegedAction<unknown>(
    CREDENTIAL_STATE_ACTION,
    {},
    privilegedOptions(options),
  );
  return normalizeCredentialStateResponse(result);
}

export async function listProvisioning(
  options: Patch83uRequestOptions = {},
): Promise<UserProvisioningListResult> {
  requirePatch83uEnabled();
  return invokePrivilegedAction<UserProvisioningListResult>(
    LIST_PROVISIONING_ACTION,
    {},
    privilegedOptions(options),
  );
}

export async function provisionAccount(
  input: ProvisioningCommandInput,
  options: Patch83uRequestOptions = {},
): Promise<ProvisionAccountResult> {
  requirePatch83uEnabled();
  const validated = validateProvisioningCommand(input);
  return invokePrivilegedAction<ProvisionAccountResult>(PROVISION_ACCOUNT_ACTION, {
    provisioning_id: validated.provisioningId,
    employee_id_confirmation: validated.employeeIdConfirmation,
    request_id: validated.requestId,
  }, privilegedOptions(options));
}

export async function reconcileProvisioning(
  input: ProvisioningCommandInput,
  options: Patch83uRequestOptions = {},
): Promise<ReconcileProvisioningResult> {
  requirePatch83uEnabled();
  const validated = validateProvisioningCommand(input);
  return invokePrivilegedAction<ReconcileProvisioningResult>(RECONCILE_PROVISIONING_ACTION, {
    provisioning_id: validated.provisioningId,
    employee_id_confirmation: validated.employeeIdConfirmation,
    request_id: validated.requestId,
  }, privilegedOptions(options));
}

export async function adminResetPassword(
  input: AdminResetPasswordInput,
  options: Patch83uRequestOptions = {},
): Promise<AdminResetPasswordResult> {
  requirePatch83uEnabled();
  const userId = requireUuid(input.userId, 'User ID');
  const employeeIdConfirmation = requireExactEmployeeConfirmation(input.employeeIdConfirmation);
  const requestId = requireSafeRequestId(input.requestId);
  if (
    typeof input.temporaryPassword !== 'string'
    || !input.temporaryPassword
    || input.temporaryPassword !== input.temporaryPassword.trim()
    || input.temporaryPassword.length > MAX_PASSWORD_LENGTH
    || typeof input.confirmTemporaryPassword !== 'string'
    || !input.confirmTemporaryPassword
    || input.confirmTemporaryPassword !== input.confirmTemporaryPassword.trim()
    || input.confirmTemporaryPassword.length > MAX_PASSWORD_LENGTH
  ) {
    throw new Error('Enter and confirm a non-empty temporary password without surrounding whitespace.');
  }
  if (input.temporaryPassword !== input.confirmTemporaryPassword) {
    throw new Error('Temporary password confirmation does not match.');
  }
  if (input.confirmationText !== ADMIN_RESET_CONFIRMATION_TEXT) {
    throw new Error(`Type ${ADMIN_RESET_CONFIRMATION_TEXT} exactly before resetting the password.`);
  }
  const reason = typeof input.reason === 'string' ? input.reason.trim() : '';
  if (!reason || reason.length > MAX_RESET_REASON_LENGTH) {
    throw new Error('A password reset reason of 1-500 characters is required.');
  }
  if (reason.includes(input.temporaryPassword)) {
    throw new Error('Enter a reset reason that contains no credential material.');
  }

  const result = await invokePrivilegedAction<unknown>(ADMIN_RESET_PASSWORD_ACTION, {
    user_id: userId,
    temporary_password: input.temporaryPassword,
    confirm_temporary_password: input.confirmTemporaryPassword,
    confirmation: ADMIN_RESET_CONFIRMATION,
    employee_id_confirmation: employeeIdConfirmation,
    reason,
    request_id: requestId,
  }, privilegedOptions(options));
  const row = asRecord(result);
  const status = row?.status;
  const credentialVersion = row?.credentialVersion;
  const mustChangePassword = row?.mustChangePassword;
  const mustReauthenticate = row?.mustReauthenticate;
  const reconciliationRequired = row?.reconciliationRequired;
  const sessionRevocationReviewRequired = row?.sessionRevocationReviewRequired;
  const idempotentReplay = row?.idempotentReplay;
  const responseRequestId = row?.requestId;
  if (
    row?.userId !== userId
    || ![
      'admin_reset_change_required',
      'session_revocation_review_required',
      'recovery_required',
    ].includes(String(status))
    || typeof credentialVersion !== 'number'
    || !Number.isInteger(credentialVersion)
    || credentialVersion < 0
    || (status === 'admin_reset_change_required' && credentialVersion < 1)
    || typeof mustChangePassword !== 'boolean'
    || mustChangePassword !== (status === 'admin_reset_change_required')
    || mustReauthenticate !== true
    || typeof reconciliationRequired !== 'boolean'
    || reconciliationRequired !== [
      'recovery_required',
      'session_revocation_review_required',
    ].includes(String(status))
    || typeof sessionRevocationReviewRequired !== 'boolean'
    || sessionRevocationReviewRequired !== (status === 'session_revocation_review_required')
    || typeof idempotentReplay !== 'boolean'
    || responseRequestId !== requestId
  ) {
    throw new PrivilegedActionError({
      message: 'The password-reset service returned an invalid completion result.',
      code: 'PATCH83U_ADMIN_RESET_RESULT_INVALID',
    });
  }
  return {
    userId,
    status: status as AdminResetPasswordResult['status'],
    credentialVersion,
    mustChangePassword,
    mustReauthenticate: true,
    reconciliationRequired,
    sessionRevocationReviewRequired,
    idempotentReplay,
    requestId,
  };
}

export async function reconcileCredentialState(input: {
  userId: string;
  employeeIdConfirmation: string;
  requestId: string;
}, options: Patch83uRequestOptions = {}): Promise<ReconcileCredentialStateResult> {
  requirePatch83uEnabled();
  const userId = requireUuid(input.userId, 'User ID');
  const employeeIdConfirmation = requireExactEmployeeConfirmation(input.employeeIdConfirmation);
  const requestId = requireSafeRequestId(input.requestId);
  return invokePrivilegedAction<ReconcileCredentialStateResult>(RECONCILE_CREDENTIAL_STATE_ACTION, {
    user_id: userId,
    employee_id_confirmation: employeeIdConfirmation,
    request_id: requestId,
  }, privilegedOptions(options));
}

export async function changeRequiredPassword(
  input: ChangeRequiredPasswordInput,
  options: Patch83uRequestOptions = {},
): Promise<ChangeRequiredPasswordResult> {
  requirePatch83uEnabled();
  if (!input.currentPassword || !input.newPassword || !input.confirmNewPassword) {
    throw new Error('Current password, new password, and confirmation are required.');
  }
  if (
    input.currentPassword !== input.currentPassword.trim()
    || input.newPassword !== input.newPassword.trim()
    || input.confirmNewPassword !== input.confirmNewPassword.trim()
  ) {
    throw new Error('Password fields cannot contain surrounding whitespace.');
  }
  if (
    input.currentPassword.length > MAX_PASSWORD_LENGTH
    || input.newPassword.length > MAX_PASSWORD_LENGTH
    || input.confirmNewPassword.length > MAX_PASSWORD_LENGTH
  ) {
    throw new Error(`Password fields cannot exceed ${MAX_PASSWORD_LENGTH} characters.`);
  }
  if (input.newPassword !== input.confirmNewPassword) {
    throw new Error('New password confirmation does not match.');
  }
  if (input.currentPassword === input.newPassword) {
    throw new Error('The new password must be different from the current password.');
  }

  const requestId = requireSafeRequestId(input.requestId);
  const captchaToken = input.captchaToken?.trim() || null;

  const result = await invokePrivilegedAction<unknown>(CHANGE_REQUIRED_PASSWORD_ACTION, {
    current_password: input.currentPassword,
    new_password: input.newPassword,
    confirm_new_password: input.confirmNewPassword,
    ...(captchaToken ? { captcha_token: captchaToken } : {}),
    request_id: requestId,
  }, privilegedOptions(options));

  const row = asRecord(result);
  const userId = row?.userId;
  const status = row?.status;
  const mustReauthenticate = row?.mustReauthenticate;
  const reconciliationRequired = row?.reconciliationRequired;
  const credentialVersion = row?.credentialVersion;
  const sessionRevocationReviewRequired = row?.sessionRevocationReviewRequired;
  const idempotentReplay = row?.idempotentReplay;
  const responseRequestId = row?.requestId;
  if (
    typeof userId !== 'string'
    || !UUID_PATTERN.test(userId)
    || !['active', 'session_revocation_review_required', 'recovery_required'].includes(String(status))
    || typeof credentialVersion !== 'number'
    || !Number.isInteger(credentialVersion)
    || credentialVersion < 0
    || (status === 'active' && credentialVersion < 1)
    || mustReauthenticate !== true
    || typeof reconciliationRequired !== 'boolean'
    || reconciliationRequired !== (status === 'recovery_required')
    || typeof sessionRevocationReviewRequired !== 'boolean'
    || sessionRevocationReviewRequired !== (status === 'session_revocation_review_required')
    || typeof idempotentReplay !== 'boolean'
    || responseRequestId !== requestId
  ) {
    throw new PrivilegedActionError({
      message: 'The password-change service returned an invalid completion result.',
      code: 'PATCH83U_PASSWORD_CHANGE_RESULT_INVALID',
    });
  }

  return {
    userId: userId.toLowerCase(),
    status: status as ChangeRequiredPasswordResult['status'],
    credentialVersion,
    mustReauthenticate: true,
    reconciliationRequired,
    sessionRevocationReviewRequired,
    idempotentReplay,
    requestId,
  };
}
