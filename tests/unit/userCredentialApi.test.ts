import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { invokePrivilegedAction, PrivilegedActionError } from '../../src/lib/privilegedAction';
import {
  ADMIN_RESET_CONFIRMATION,
  ADMIN_RESET_CONFIRMATION_TEXT,
  adminResetPassword,
  changeRequiredPassword,
  credentialGateDecision,
  getCurrentUserCredentialState,
  getPatch83uCapabilities,
  isAmbiguousPasswordChangeFailure,
  listProvisioning,
  normalizeCredentialStateResponse,
  normalizePatch83uCapabilities,
  passwordChangeFailureDisposition,
  patch83uCapabilityCompatibilityIssue,
  patch83uRuntimeAllowsStableExistingAccess,
  provisionAccount,
  reconcileProvisioning,
  type Patch83uCapabilities,
  type UserCredentialState,
} from '../../src/lib/userCredentialApi';

vi.mock('../../src/lib/privilegedAction', () => ({
  invokePrivilegedAction: vi.fn(),
  PrivilegedActionError: class PrivilegedActionError extends Error {
    code: string | null;
    status: number | null;
    retryable: boolean;
    constructor(input: { message: string; code?: string | null; status?: number | null; retryable?: boolean }) {
      super(input.message);
      this.code = input.code ?? null;
      this.status = input.status ?? null;
      this.retryable = input.retryable ?? false;
    }
  },
}));

const invokeMock = invokePrivilegedAction as unknown as Mock;
const PROVISIONING_ID = '01234567-89AB-CDEF-0123-456789ABCDEF';
const USER_ID = '11111111-2222-3333-4444-555555555555';
const REQUEST_OPTIONS = {};

const capabilities = (overrides: Partial<Patch83uCapabilities> = {}): Patch83uCapabilities => ({
  edge_contract_version: 'patch83u-edge-auth-first-v1',
  installed_schema_version: 174,
  runtime_enforcement_state: 'prepared',
  credential_state_action_available: true,
  password_change_action_available: false,
  provisioning_action_available: false,
  reset_action_available: false,
  server_time: '2026-07-16T12:00:00.000Z',
  compatibility_status: 'compatible',
  ...overrides,
});

const managedState = (overrides: Partial<UserCredentialState> = {}): UserCredentialState => ({
  managed: true,
  credential_state: 'active',
  credential_version: 1,
  auth_email: '1001@almodawat.sa',
  access_allowed: true,
  message: null,
  ...overrides,
});

beforeEach(() => {
  vi.stubEnv('VITE_PATCH83U_CREDENTIAL_GOVERNANCE_ENABLED', 'true');
  invokeMock.mockReset();
});

afterEach(() => vi.unstubAllEnvs());

describe('Patch 83U capability handshake', () => {
  it('sends the exact frontend contract and strictly parses the snake-case response', async () => {
    invokeMock.mockResolvedValueOnce(capabilities());
    await expect(getPatch83uCapabilities()).resolves.toEqual(capabilities());
    expect(invokeMock).toHaveBeenCalledWith('patch83u_get_capabilities', {
      frontend_contract_version: 'patch83u-frontend-auth-first-v1',
    }, REQUEST_OPTIONS);
  });

  it('allows compatible disabled/prepared contracts with credential lookup available', () => {
    expect(patch83uCapabilityCompatibilityIssue(capabilities({ runtime_enforcement_state: 'disabled' }))).toBeNull();
    expect(patch83uCapabilityCompatibilityIssue(capabilities({ runtime_enforcement_state: 'prepared' }))).toBeNull();
  });

  it('preserves stable managed access only while a compatible runtime is disabled or prepared', () => {
    const pending = managedState({
      credential_state: 'reconciliation_required',
      access_allowed: true,
    });
    expect(patch83uRuntimeAllowsStableExistingAccess(
      capabilities({ runtime_enforcement_state: 'disabled' }),
      pending,
    )).toBe(true);
    expect(patch83uRuntimeAllowsStableExistingAccess(
      capabilities({ runtime_enforcement_state: 'prepared' }),
      pending,
    )).toBe(true);
    expect(patch83uRuntimeAllowsStableExistingAccess(
      capabilities({ runtime_enforcement_state: 'enforced' }),
      pending,
    )).toBe(false);
    expect(patch83uRuntimeAllowsStableExistingAccess(
      capabilities({ runtime_enforcement_state: 'prepared' }),
      { ...pending, managed: false },
    )).toBe(false);
    expect(patch83uRuntimeAllowsStableExistingAccess(
      capabilities({ runtime_enforcement_state: 'prepared' }),
      { ...pending, access_allowed: false },
    )).toBe(false);
  });

  it('requires all protected actions when runtime enforcement is active', () => {
    expect(patch83uCapabilityCompatibilityIssue(capabilities({ runtime_enforcement_state: 'enforced' })))
      .toBe('PATCH83U_EDGE_CONTRACT_MISMATCH');
    expect(patch83uCapabilityCompatibilityIssue(capabilities({
      runtime_enforcement_state: 'enforced',
      password_change_action_available: true,
      provisioning_action_available: true,
      reset_action_available: true,
    }))).toBeNull();
  });

  it('fails closed for version, schema, compatibility, availability, or malformed fields', () => {
    expect(patch83uCapabilityCompatibilityIssue(capabilities({ edge_contract_version: 'old' })))
      .toBe('PATCH83U_EDGE_CONTRACT_MISMATCH');
    expect(patch83uCapabilityCompatibilityIssue(capabilities({ installed_schema_version: 173 })))
      .toBe('PATCH83U_CREDENTIAL_MIGRATION_REQUIRED');
    expect(patch83uCapabilityCompatibilityIssue(capabilities({ compatibility_status: 'runtime_not_prepared' })))
      .toBe('PATCH83U_RUNTIME_NOT_PREPARED');
    expect(patch83uCapabilityCompatibilityIssue(capabilities({ credential_state_action_available: false })))
      .toBe('PATCH83U_EDGE_CONTRACT_MISMATCH');
    expect(() => normalizePatch83uCapabilities({ ...capabilities(), server_time: 'not-a-time' })).toThrow(/malformed/i);
    expect(() => normalizePatch83uCapabilities({ ...capabilities(), compatibility_status: ' compatible ' })).toThrow(/malformed/i);
  });

  it('makes zero Patch 83U calls when the exact feature flag is not enabled', async () => {
    vi.stubEnv('VITE_PATCH83U_CREDENTIAL_GOVERNANCE_ENABLED', 'false');
    await expect(getPatch83uCapabilities()).rejects.toThrow(/disabled/i);
    await expect(getCurrentUserCredentialState()).rejects.toThrow(/disabled/i);
    await expect(listProvisioning()).rejects.toThrow(/disabled/i);
    await expect(provisionAccount({
      provisioningId: PROVISIONING_ID,
      employeeIdConfirmation: '11111',
      temporaryPassword: 'office123',
      confirmTemporaryPassword: 'office123',
      requestId: 'request-1',
    })).rejects.toThrow(/disabled/i);
    expect(invokeMock).not.toHaveBeenCalled();
  });
});

describe('Patch 83U credential-state gate', () => {
  it('rejects server-granted unmanaged compatibility and blocks a missing unmanaged record', () => {
    const missing = normalizeCredentialStateResponse({
      managed: false,
      credential_state: 'unmanaged',
      credential_version: 0,
      auth_email: null,
      access_allowed: false,
      message: null,
    });
    expect(credentialGateDecision(missing).gate).toBe('blocked');
    expect(() => normalizeCredentialStateResponse({ ...missing, access_allowed: true })).toThrow(/incomplete/i);
  });

  it.each([
    'initial_change_required',
    'admin_reset_change_required',
    'reactivation_change_required',
    'existing_password_change_required',
  ] as const)('routes %s to forced password change', (credentialState) => {
    expect(credentialGateDecision(managedState({ credential_state: credentialState, access_allowed: false })).gate)
      .toBe('password_change_required');
  });

  it.each([
    'password_change_in_progress',
    'reset_in_progress',
    'recovery_required',
    'reconciliation_required',
    'session_revocation_review_required',
  ] as const)('routes %s to protected reconciliation', (credentialState) => {
    expect(credentialGateDecision(managedState({ credential_state: credentialState, access_allowed: false })).gate)
      .toBe('reconciliation_required');
  });

  it('allows only complete active managed credentials', () => {
    expect(credentialGateDecision(normalizeCredentialStateResponse(managedState())).gate).toBe('active');
    expect(() => normalizeCredentialStateResponse(managedState({ auth_email: null }))).toThrow(/incomplete/i);
    expect(() => normalizeCredentialStateResponse(managedState({ credential_state: 'unknown' as never }))).toThrow(/incomplete/i);
  });
});

describe('Patch 83U protected commands', () => {
  it('classifies only possibly committed password-change outcomes as ambiguous', () => {
    for (const code of [
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
    ]) {
      expect(isAmbiguousPasswordChangeFailure(new PrivilegedActionError({
        message: 'Outcome unknown.',
        code,
        status: 409,
        retryable: false,
      }))).toBe(true);
    }
    expect(isAmbiguousPasswordChangeFailure(new PrivilegedActionError({
      message: 'Transport failed.',
      code: 'PRIVILEGED_ACTION_TRANSPORT_ERROR',
      retryable: true,
    }))).toBe(true);
    expect(isAmbiguousPasswordChangeFailure(new PrivilegedActionError({
      message: 'Response was lost.',
      retryable: true,
    }))).toBe(true);
    for (const code of [
      'PATCH83U_CURRENT_PASSWORD_INVALID',
      'PATCH83U_PASSWORD_POLICY_BLOCKED',
    ]) {
      const definitiveFailure = new PrivilegedActionError({
        message: 'Definitive failure.',
        code,
        status: 400,
        retryable: false,
      });
      expect(isAmbiguousPasswordChangeFailure(definitiveFailure)).toBe(false);
      expect(passwordChangeFailureDisposition(definitiveFailure)).toBe('retry_in_current_session');
    }
    expect(passwordChangeFailureDisposition(new PrivilegedActionError({
      message: 'The new password did not satisfy Auth policy.',
      code: 'PATCH83U_PERMANENT_PASSWORD_POLICY_REJECTED',
      status: 409,
      retryable: false,
    }))).toBe('close_after_password_policy_rejection');
  });

  it('preserves exact provisioning confirmation and request IDs', async () => {
    invokeMock.mockResolvedValueOnce({ provisioningId: PROVISIONING_ID.toLowerCase(), profileId: USER_ID })
      .mockResolvedValueOnce({ provisioningId: PROVISIONING_ID.toLowerCase(), status: 'completed' });
    const input = { provisioningId: PROVISIONING_ID, employeeIdConfirmation: '11111', requestId: 'request-1' };
    await provisionAccount({
      ...input,
      temporaryPassword: 'office123',
      confirmTemporaryPassword: 'office123',
    });
    await reconcileProvisioning(input);
    expect(invokeMock).toHaveBeenNthCalledWith(1, 'patch83u_provision_account', {
      provisioning_id: PROVISIONING_ID.toLowerCase(),
      employee_id_confirmation: '11111',
      temporary_password: 'office123',
      confirm_temporary_password: 'office123',
      request_id: 'request-1',
    }, REQUEST_OPTIONS);
    expect(invokeMock).toHaveBeenNthCalledWith(2, 'patch83u_reconcile_provisioning', {
      provisioning_id: PROVISIONING_ID.toLowerCase(), employee_id_confirmation: '11111', request_id: 'request-1',
    }, REQUEST_OPTIONS);
  });

  it('strictly normalizes a normal administrator reset result', async () => {
    const result = {
      userId: USER_ID.toLowerCase(),
      status: 'admin_reset_change_required',
      credentialVersion: 3,
      mustChangePassword: true,
      mustReauthenticate: true,
      reconciliationRequired: false,
      sessionRevocationReviewRequired: false,
      idempotentReplay: false,
      requestId: 'reset-1',
    };
    invokeMock.mockResolvedValueOnce(result);
    await expect(adminResetPassword({
      userId: USER_ID,
      temporaryPassword: 'Manual Temp 2026',
      confirmTemporaryPassword: 'Manual Temp 2026',
      employeeIdConfirmation: '11111',
      confirmationText: ADMIN_RESET_CONFIRMATION_TEXT,
      reason: 'Administrator requested reset.',
      requestId: 'reset-1',
    })).resolves.toEqual(result);
    expect(invokeMock).toHaveBeenCalledWith('patch83u_admin_reset_password', expect.objectContaining({
      confirmation: ADMIN_RESET_CONFIRMATION,
      confirm_temporary_password: 'Manual Temp 2026',
      request_id: 'reset-1',
    }), REQUEST_OPTIONS);
  });

  it('preserves an administrator-reset recovery terminal with a legacy credential version', async () => {
    const result = {
      userId: USER_ID.toLowerCase(),
      status: 'recovery_required',
      credentialVersion: 0,
      mustChangePassword: false,
      mustReauthenticate: true,
      reconciliationRequired: true,
      sessionRevocationReviewRequired: false,
      idempotentReplay: false,
      requestId: 'reset-recovery-1',
    };
    invokeMock.mockResolvedValueOnce(result);
    await expect(adminResetPassword({
      userId: USER_ID,
      temporaryPassword: 'Manual Temp 2026',
      confirmTemporaryPassword: 'Manual Temp 2026',
      employeeIdConfirmation: '11111',
      confirmationText: ADMIN_RESET_CONFIRMATION_TEXT,
      reason: 'Administrator requested reset.',
      requestId: 'reset-recovery-1',
    })).resolves.toEqual(result);
  });

  it('returns a strictly validated administrator-reset session-review terminal', async () => {
    const result = {
      userId: USER_ID.toLowerCase(),
      status: 'session_revocation_review_required',
      credentialVersion: 0,
      mustChangePassword: false,
      mustReauthenticate: true,
      reconciliationRequired: true,
      sessionRevocationReviewRequired: true,
      idempotentReplay: true,
      requestId: 'reset-review-1',
    };
    invokeMock.mockResolvedValueOnce(result);
    await expect(adminResetPassword({
      userId: USER_ID,
      temporaryPassword: 'Manual Temp 2026',
      confirmTemporaryPassword: 'Manual Temp 2026',
      employeeIdConfirmation: '11111',
      confirmationText: ADMIN_RESET_CONFIRMATION_TEXT,
      reason: 'Administrator requested reset.',
      requestId: 'reset-review-1',
    })).resolves.toEqual(result);
  });

  it('rejects an administrator reset before the bridge when password confirmation differs', async () => {
    await expect(adminResetPassword({
      userId: USER_ID,
      temporaryPassword: 'Manual Temp 2026',
      confirmTemporaryPassword: 'Different Temp 2026',
      employeeIdConfirmation: '11111',
      confirmationText: ADMIN_RESET_CONFIRMATION_TEXT,
      reason: 'Administrator requested reset.',
      requestId: 'reset-mismatch-1',
    })).rejects.toThrow(/confirmation does not match/i);
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it('rejects a reset reason containing the exact temporary password before the bridge', async () => {
    await expect(adminResetPassword({
      userId: USER_ID,
      temporaryPassword: 'Manual Temp 2026',
      confirmTemporaryPassword: 'Manual Temp 2026',
      employeeIdConfirmation: '11111',
      confirmationText: ADMIN_RESET_CONFIRMATION_TEXT,
      reason: 'Credential Manual Temp 2026 was shared with the employee.',
      requestId: 'reset-secret-reason-1',
    })).rejects.toThrow(/no credential material/i);
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it('sends the governed password change without a challenge token and validates completion proof', async () => {
    const result = {
      userId: USER_ID.toLowerCase(),
      status: 'active',
      credentialVersion: 2,
      mustReauthenticate: true,
      reconciliationRequired: false,
      sessionRevocationReviewRequired: false,
      idempotentReplay: false,
      requestId: 'change-1',
    };
    invokeMock.mockResolvedValueOnce(result);
    await expect(changeRequiredPassword({
      currentPassword: '11111',
      newPassword: 'Permanent.Password#2026',
      confirmNewPassword: 'Permanent.Password#2026',
      requestId: 'change-1',
    })).resolves.toEqual(result);
    expect(invokeMock).toHaveBeenCalledWith('patch83u_change_required_password', {
      current_password: '11111',
      new_password: 'Permanent.Password#2026',
      confirm_new_password: 'Permanent.Password#2026',
      request_id: 'change-1',
    }, REQUEST_OPTIONS);
  });

  it('rejects malformed completion proof after password-only reauthentication', async () => {
    invokeMock.mockResolvedValueOnce({});
    const malformedResultError = await changeRequiredPassword({
      currentPassword: '11111',
      newPassword: 'Permanent.Password#2026',
      confirmNewPassword: 'Permanent.Password#2026',
      requestId: 'change-2',
    }).catch((error: unknown) => error);
    expect(malformedResultError).toBeInstanceOf(PrivilegedActionError);
    expect(malformedResultError).toMatchObject({
      code: 'PATCH83U_PASSWORD_CHANGE_RESULT_INVALID',
    });
    expect(isAmbiguousPasswordChangeFailure(malformedResultError)).toBe(true);
  });

  it('rejects equal-current and confirmation-mismatch changes before the bridge', async () => {
    await expect(changeRequiredPassword({
      currentPassword: 'office123',
      newPassword: 'office123',
      confirmNewPassword: 'office123',
      requestId: 'change-equal-1',
    })).rejects.toThrow(/different from the current/i);
    await expect(changeRequiredPassword({
      currentPassword: 'current123',
      newPassword: 'office123',
      confirmNewPassword: 'office124',
      requestId: 'change-mismatch-1',
    })).rejects.toThrow(/confirmation does not match/i);
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it('does not reject passwords that match an employee identifier or username', async () => {
    const result = {
      userId: USER_ID.toLowerCase(),
      status: 'active',
      credentialVersion: 2,
      mustReauthenticate: true,
      reconciliationRequired: false,
      sessionRevocationReviewRequired: false,
      idempotentReplay: false,
      requestId: 'change-identifier-1',
    };
    invokeMock.mockResolvedValueOnce(result);
    await expect(changeRequiredPassword({
      currentPassword: 'current123',
      newPassword: 'employee99',
      confirmNewPassword: 'employee99',
      requestId: 'change-identifier-1',
    })).resolves.toEqual(result);
  });

  it('accepts version zero only for protected password-change terminal outcomes', async () => {
    const recoveryResult = {
      userId: USER_ID.toLowerCase(),
      status: 'recovery_required',
      credentialVersion: 0,
      mustReauthenticate: true,
      reconciliationRequired: true,
      sessionRevocationReviewRequired: false,
      idempotentReplay: false,
      requestId: 'change-recovery-1',
    };
    invokeMock.mockResolvedValueOnce(recoveryResult);
    await expect(changeRequiredPassword({
      currentPassword: '11111',
      newPassword: 'Permanent.Password#2026',
      confirmNewPassword: 'Permanent.Password#2026',
      requestId: 'change-recovery-1',
    })).resolves.toEqual(recoveryResult);

    invokeMock.mockResolvedValueOnce({
      ...recoveryResult,
      status: 'active',
      reconciliationRequired: false,
      requestId: 'change-active-zero',
    });
    await expect(changeRequiredPassword({
      currentPassword: '11111',
      newPassword: 'Permanent.Password#2026',
      confirmNewPassword: 'Permanent.Password#2026',
      requestId: 'change-active-zero',
    })).rejects.toThrow(/invalid completion/i);
  });
});
