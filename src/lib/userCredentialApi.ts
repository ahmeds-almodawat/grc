import { invokePrivilegedAction } from './privilegedAction';

export const CREDENTIAL_STATE_ACTION = 'patch83u_get_credential_state';
export const LIST_PROVISIONING_ACTION = 'patch83u_list_provisioning';
export const PROVISION_ACCOUNT_ACTION = 'patch83u_provision_account';
export const RECONCILE_PROVISIONING_ACTION = 'patch83u_reconcile_provisioning';
export const RECONCILE_CREDENTIAL_STATE_ACTION = 'patch83u_reconcile_credential_state';
export const CHANGE_REQUIRED_PASSWORD_ACTION = 'patch83u_change_required_password';
export const ADMIN_RESET_PASSWORD_ACTION = 'patch83u_admin_reset_password';
export const ADMIN_RESET_CONFIRMATION_TEXT = 'RESET USER PASSWORD';
export const ADMIN_RESET_CONFIRMATION = 'PATCH83U_RESET_USER_PASSWORD';

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
  status: 'admin_reset_change_required';
  mustChangePassword: boolean;
  mustReauthenticate: boolean;
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
  employeeIdConfirmation: string;
  confirmationText: string;
  reason: string;
  requestId: string;
};

export type UserCredentialState = {
  managed: boolean;
  credential_state: string;
  credential_version: number;
  auth_email: string | null;
  access_allowed: boolean;
  message: string | null;
};

export type CredentialGateDecision =
  | { gate: 'legacy_unmanaged'; state: UserCredentialState }
  | { gate: 'active'; state: UserCredentialState }
  | { gate: 'password_change_required'; state: UserCredentialState }
  | { gate: 'blocked'; state: UserCredentialState };

const PASSWORD_CHANGE_STATES = new Set([
  'initial_change_required',
  'admin_reset_change_required',
  'reactivation_change_required',
]);

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]+$/;
const MAX_REQUEST_ID_LENGTH = 128;
const MAX_PASSWORD_LENGTH = 256;
const MAX_RESET_REASON_LENGTH = 500;

const LEGACY_UNMANAGED_STATE: UserCredentialState = {
  managed: false,
  credential_state: 'unmanaged',
  credential_version: 0,
  auth_email: null,
  access_allowed: true,
  message: null,
};

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
    || typeof credentialState !== 'string'
    || !credentialState.trim()
    || typeof accessAllowed !== 'boolean'
    || !(authEmail === null || authEmail === undefined || typeof authEmail === 'string')
    || !(message === null || message === undefined || typeof message === 'string')
  ) {
    throw new Error('The managed credential-state response is incomplete. Access was denied.');
  }

  return {
    managed: true,
    credential_state: credentialState.trim(),
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
  if (!state.access_allowed) {
    return { gate: 'blocked', state };
  }
  if (state.credential_state === 'active' && state.access_allowed) {
    return { gate: 'active', state };
  }
  return { gate: 'blocked', state };
}

export async function getCurrentUserCredentialState(): Promise<UserCredentialState> {
  const result = await invokePrivilegedAction<unknown>(CREDENTIAL_STATE_ACTION, {});
  return normalizeCredentialStateResponse(result);
}

export async function listProvisioning(): Promise<UserProvisioningListResult> {
  return invokePrivilegedAction<UserProvisioningListResult>(LIST_PROVISIONING_ACTION, {});
}

export async function provisionAccount(
  input: ProvisioningCommandInput,
): Promise<ProvisionAccountResult> {
  const validated = validateProvisioningCommand(input);
  return invokePrivilegedAction<ProvisionAccountResult>(PROVISION_ACCOUNT_ACTION, {
    provisioning_id: validated.provisioningId,
    employee_id_confirmation: validated.employeeIdConfirmation,
    request_id: validated.requestId,
  });
}

export async function reconcileProvisioning(
  input: ProvisioningCommandInput,
): Promise<ReconcileProvisioningResult> {
  const validated = validateProvisioningCommand(input);
  return invokePrivilegedAction<ReconcileProvisioningResult>(RECONCILE_PROVISIONING_ACTION, {
    provisioning_id: validated.provisioningId,
    employee_id_confirmation: validated.employeeIdConfirmation,
    request_id: validated.requestId,
  });
}

export async function adminResetPassword(
  input: AdminResetPasswordInput,
): Promise<AdminResetPasswordResult> {
  const userId = requireUuid(input.userId, 'User ID');
  const employeeIdConfirmation = requireExactEmployeeConfirmation(input.employeeIdConfirmation);
  const requestId = requireSafeRequestId(input.requestId);
  if (
    typeof input.temporaryPassword !== 'string'
    || !input.temporaryPassword
    || input.temporaryPassword !== input.temporaryPassword.trim()
    || input.temporaryPassword.length > MAX_PASSWORD_LENGTH
  ) {
    throw new Error('Enter a non-empty temporary password without surrounding whitespace.');
  }
  if (input.confirmationText !== ADMIN_RESET_CONFIRMATION_TEXT) {
    throw new Error(`Type ${ADMIN_RESET_CONFIRMATION_TEXT} exactly before resetting the password.`);
  }
  const reason = typeof input.reason === 'string' ? input.reason.trim() : '';
  if (!reason || reason.length > MAX_RESET_REASON_LENGTH) {
    throw new Error('A password reset reason of 1-500 characters is required.');
  }

  return invokePrivilegedAction<AdminResetPasswordResult>(ADMIN_RESET_PASSWORD_ACTION, {
    user_id: userId,
    temporary_password: input.temporaryPassword,
    confirmation: ADMIN_RESET_CONFIRMATION,
    employee_id_confirmation: employeeIdConfirmation,
    reason,
    request_id: requestId,
  });
}

export async function reconcileCredentialState(input: {
  userId: string;
  employeeIdConfirmation: string;
  requestId: string;
}): Promise<ReconcileCredentialStateResult> {
  const userId = requireUuid(input.userId, 'User ID');
  const employeeIdConfirmation = requireExactEmployeeConfirmation(input.employeeIdConfirmation);
  const requestId = requireSafeRequestId(input.requestId);
  return invokePrivilegedAction<ReconcileCredentialStateResult>(RECONCILE_CREDENTIAL_STATE_ACTION, {
    user_id: userId,
    employee_id_confirmation: employeeIdConfirmation,
    request_id: requestId,
  });
}

export async function changeRequiredPassword(input: {
  currentPassword: string;
  newPassword: string;
  confirmNewPassword: string;
}): Promise<void> {
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

  await invokePrivilegedAction(CHANGE_REQUIRED_PASSWORD_ACTION, {
    current_password: input.currentPassword,
    new_password: input.newPassword,
    confirm_new_password: input.confirmNewPassword,
  });
}
