import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { invokePrivilegedAction } from '../../src/lib/privilegedAction';
import {
  ADMIN_RESET_CONFIRMATION,
  ADMIN_RESET_CONFIRMATION_TEXT,
  adminResetPassword,
  changeRequiredPassword,
  credentialGateDecision,
  getCurrentUserCredentialState,
  listProvisioning,
  normalizeCredentialStateResponse,
  provisionAccount,
  reconcileProvisioning,
  type UserCredentialState,
} from '../../src/lib/userCredentialApi';

vi.mock('../../src/lib/privilegedAction', () => ({
  invokePrivilegedAction: vi.fn(),
}));

const invokeMock = invokePrivilegedAction as unknown as Mock;
const PROVISIONING_ID = '01234567-89AB-CDEF-0123-456789ABCDEF';
const USER_ID = '11111111-2222-3333-4444-555555555555';

beforeEach(() => {
  invokeMock.mockReset();
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

describe('Patch 83U credential-state gate', () => {
  it('parses a missing unmanaged record as blocked and rejects server-granted compatibility', () => {
    const missingRecord = normalizeCredentialStateResponse({
      managed: false,
      credential_state: 'unmanaged',
      credential_version: 0,
      auth_email: null,
      access_allowed: false,
      message: null,
    });
    expect(missingRecord).toMatchObject({
      managed: false,
      credential_state: 'unmanaged',
      credential_version: 0,
      access_allowed: false,
    });
    expect(credentialGateDecision(missingRecord).gate).toBe('blocked');
    expect(() => normalizeCredentialStateResponse({
      managed: false,
      credential_state: 'unmanaged',
      credential_version: 0,
      auth_email: null,
      access_allowed: true,
      message: null,
    })).toThrow(/incomplete/i);
    expect(() => normalizeCredentialStateResponse({
      managed: false,
      credential_state: 'blocked',
      credential_version: 0,
      auth_email: null,
      access_allowed: true,
      message: null,
    })).toThrow(/incomplete/i);
  });

  it('normalizes a complete managed response and allows only active credentials', () => {
    const normalized = normalizeCredentialStateResponse({
      managed: true,
      credential_state: 'active',
      credential_version: 3,
      auth_email: ' 1001@ALMODAWAT.SA ',
      access_allowed: true,
      message: null,
    });

    expect(normalized.auth_email).toBe('1001@almodawat.sa');
    expect(credentialGateDecision(normalized).gate).toBe('active');
    expect(credentialGateDecision(managedState({ credential_version: 0 })).gate).toBe('active');
    expect(credentialGateDecision(managedState({ access_allowed: false })).gate).toBe('blocked');
    expect(credentialGateDecision(managedState({ credential_state: 'locked' })).gate).toBe('blocked');
  });

  it.each([
    'initial_change_required',
    'admin_reset_change_required',
    'reactivation_change_required',
  ])('routes the %s state to forced password change', (credentialState) => {
    expect(credentialGateDecision(managedState({ credential_state: credentialState })).gate)
      .toBe('password_change_required');
  });

  it('routes a canonical password-required state even while normal access is denied', () => {
    expect(credentialGateDecision(managedState({
      credential_state: 'admin_reset_change_required',
      access_allowed: false,
    })).gate).toBe('password_change_required');
  });

  it('fails closed for malformed managed responses', () => {
    expect(() => normalizeCredentialStateResponse({
      managed: true,
      credential_state: 'active',
      credential_version: 1,
      auth_email: null,
      message: null,
    })).toThrow(/access was denied/i);
    expect(() => normalizeCredentialStateResponse({
      managed: true,
      credential_state: 'active',
      credential_version: -1,
      auth_email: null,
      access_allowed: true,
      message: null,
    })).toThrow(/access was denied/i);
  });

  it.each([
    'patch83u_get_credential_state: function does not exist [42883]',
    'PATCH83U_CREDENTIAL_MIGRATION_REQUIRED',
    'Failed to fetch',
    'Unauthorized [401]',
    'UNSUPPORTED_PRIVILEGED_ACTION: patch83u_get_credential_state',
    'user_credential_states relation does not exist [42P01]',
  ])('fails closed when the credential-state read rejects with %s', async (message) => {
    invokeMock.mockRejectedValueOnce(new Error(message));
    await expect(getCurrentUserCredentialState()).rejects.toThrow(message);
  });
});

describe('Patch 83U protected provisioning APIs', () => {
  it('lists provisioning through the exact protected action with no payload', async () => {
    const result = {
      organization_id: USER_ID,
      rows: [],
      count: 0,
    };
    invokeMock.mockResolvedValueOnce(result);

    await expect(listProvisioning()).resolves.toEqual(result);
    expect(invokeMock).toHaveBeenCalledWith('patch83u_list_provisioning', {});
  });

  it('preserves exact Employee ID confirmation and sends safe provision/reconcile payloads', async () => {
    const input = {
      provisioningId: PROVISIONING_ID,
      employeeIdConfirmation: '11111',
      requestId: 'patch83u.provision:request-1',
    };
    invokeMock
      .mockResolvedValueOnce({
        provisioningId: PROVISIONING_ID.toLowerCase(),
        profileId: USER_ID,
        status: 'initial_change_required',
        mustChangePassword: true,
      })
      .mockResolvedValueOnce({
        provisioningId: PROVISIONING_ID.toLowerCase(),
        status: 'completed',
        outcome: 'reconciled',
      });

    await provisionAccount(input);
    expect(invokeMock).toHaveBeenNthCalledWith(1, 'patch83u_provision_account', {
      provisioning_id: PROVISIONING_ID.toLowerCase(),
      employee_id_confirmation: '11111',
      request_id: 'patch83u.provision:request-1',
    });

    await reconcileProvisioning(input);
    expect(invokeMock).toHaveBeenNthCalledWith(2, 'patch83u_reconcile_provisioning', {
      provisioning_id: PROVISIONING_ID.toLowerCase(),
      employee_id_confirmation: '11111',
      request_id: 'patch83u.provision:request-1',
    });
  });

  it.each([
    ['the exact five-character Employee ID', '11111'],
    ['a manually entered temporary password', 'Manual Temp 2026'],
  ])('accepts %s and sends it only to the reset action', async (_label, temporaryPassword) => {
    const result = {
      userId: USER_ID,
      status: 'admin_reset_change_required',
      mustChangePassword: true,
      mustReauthenticate: true,
    };
    invokeMock.mockResolvedValueOnce(result);

    await expect(adminResetPassword({
      userId: USER_ID,
      temporaryPassword,
      employeeIdConfirmation: '11111',
      confirmationText: ADMIN_RESET_CONFIRMATION_TEXT,
      reason: '  Employee requested an administrator reset.  ',
      requestId: 'patch83u.reset_request-1',
    })).resolves.toEqual(result);
    expect(invokeMock).toHaveBeenCalledWith('patch83u_admin_reset_password', {
      user_id: USER_ID,
      temporary_password: temporaryPassword,
      confirmation: ADMIN_RESET_CONFIRMATION,
      employee_id_confirmation: '11111',
      reason: 'Employee requested an administrator reset.',
      request_id: 'patch83u.reset_request-1',
    });
  });

  it.each([
    ['invalid provisioning UUID', {
      provisioningId: 'not-a-uuid',
      employeeIdConfirmation: '000042',
      requestId: 'request-1',
    }],
    ['empty Employee ID confirmation', {
      provisioningId: PROVISIONING_ID,
      employeeIdConfirmation: '',
      requestId: 'request-1',
    }],
    ['non-exact Employee ID confirmation', {
      provisioningId: PROVISIONING_ID,
      employeeIdConfirmation: ' 000042',
      requestId: 'request-1',
    }],
    ['unsafe request ID', {
      provisioningId: PROVISIONING_ID,
      employeeIdConfirmation: '000042',
      requestId: 'request with spaces',
    }],
    ['oversized request ID', {
      provisioningId: PROVISIONING_ID,
      employeeIdConfirmation: '000042',
      requestId: 'a'.repeat(129),
    }],
  ])('rejects %s before provisioning is invoked', async (_label, input) => {
    await expect(provisionAccount(input)).rejects.toThrow();
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it.each([
    ['invalid user UUID', { userId: 'invalid' }],
    ['blank temporary password', { temporaryPassword: '' }],
    ['temporary password with surrounding whitespace', { temporaryPassword: ' 11111' }],
    ['oversized temporary password', { temporaryPassword: 'x'.repeat(257) }],
    ['non-exact Employee ID confirmation', { employeeIdConfirmation: '000042 ' }],
    ['missing typed confirmation', { confirmationText: '' }],
    ['incorrect typed confirmation', { confirmationText: 'RESET PASSWORD' }],
    ['blank reason', { reason: '   ' }],
    ['oversized reason', { reason: 'r'.repeat(501) }],
    ['unsafe request ID', { requestId: 'unsafe request' }],
  ])('rejects reset with %s before the protected action is invoked', async (_label, override) => {
    await expect(adminResetPassword({
      userId: USER_ID,
      temporaryPassword: 'Manual Temp 2026',
      employeeIdConfirmation: '000042',
      confirmationText: ADMIN_RESET_CONFIRMATION_TEXT,
      reason: 'Administrator reset requested.',
      requestId: 'patch83u.reset-1',
      ...override,
    })).rejects.toThrow();
    expect(invokeMock).not.toHaveBeenCalled();
  });
});

describe('Patch 83U permanent password-change API', () => {
  it('sends current, new, and confirmation values only to the protected action', async () => {
    invokeMock.mockResolvedValueOnce(undefined);

    await expect(changeRequiredPassword({
      currentPassword: '11111',
      newPassword: 'Permanent.Password#2026',
      confirmNewPassword: 'Permanent.Password#2026',
    })).resolves.toBeUndefined();

    expect(invokeMock).toHaveBeenCalledWith('patch83u_change_required_password', {
      current_password: '11111',
      new_password: 'Permanent.Password#2026',
      confirm_new_password: 'Permanent.Password#2026',
    });
  });

  it.each([
    ['missing current password', { currentPassword: '' }],
    ['missing new password', { newPassword: '' }],
    ['missing confirmation', { confirmNewPassword: '' }],
    ['confirmation mismatch', { confirmNewPassword: 'different' }],
    ['new password equal to current password', {
      currentPassword: 'same-password',
      newPassword: 'same-password',
      confirmNewPassword: 'same-password',
    }],
    ['surrounding whitespace', { newPassword: ' Permanent.Password#2026' }],
    ['oversized input', { confirmNewPassword: 'x'.repeat(257) }],
  ])('rejects %s before invoking the protected action', async (_label, override) => {
    await expect(changeRequiredPassword({
      currentPassword: '11111',
      newPassword: 'Permanent.Password#2026',
      confirmNewPassword: 'Permanent.Password#2026',
      ...override,
    })).rejects.toThrow();
    expect(invokeMock).not.toHaveBeenCalled();
  });
});
