import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { invokePrivilegedAction } from '../../src/lib/privilegedAction';
import {
  PATCH83T_DEPLOYMENT_COMPATIBILITY_CODES,
  PATCH83T_USER_IMPORT_DEPLOYMENT_MESSAGE,
  Patch83tDeploymentCompatibilityError,
  createPatch83tUserImportCapabilitySingleFlight,
  getPatch83tUserImportCapabilities,
  isPatch83tDeploymentCompatibilityError,
  normalizePatch83tUserImportCapabilities,
  patch83tCapabilityCompatibilityIssue,
  patch83tDeploymentCompatibilityCode,
  patch83tPrivilegedActionOptions,
  requireCompatiblePatch83tUserImportCapability,
  rethrowPatch83tDeploymentCompatibilityError,
  type Patch83tUserImportCapabilities,
} from '../../src/lib/userImportCompatibility';
import {
  applyImportBatch,
  validateImportRows,
  type UserImportValidationResult,
} from '../../src/lib/userManagementApi';

vi.mock('../../src/lib/privilegedAction', () => ({
  invokePrivilegedAction: vi.fn(),
}));

const invokeMock = invokePrivilegedAction as unknown as Mock;

const capabilities = (
  overrides: Partial<Patch83tUserImportCapabilities> = {},
): Patch83tUserImportCapabilities => ({
  edge_contract_version: 'patch83t-edge-user-import-v1',
  migration_173_available: true,
  identity_reference_action_available: true,
  import_execution_action_available: true,
  maximum_rows: 5000,
  runtime_status: 'compatible',
  compatible: true,
  server_time: '2026-07-16T12:00:00.000Z',
  ...overrides,
});

beforeEach(() => {
  vi.stubEnv('VITE_PATCH83T_USER_EXCEL_IMPORT_ENABLED', 'true');
  invokeMock.mockReset();
});

afterEach(() => vi.unstubAllEnvs());

describe('Patch 83T User Excel Import capability handshake', () => {
  it('sends the exact frontend contract in the payload and header', async () => {
    invokeMock.mockResolvedValueOnce(capabilities());

    await expect(getPatch83tUserImportCapabilities()).resolves.toEqual(capabilities());
    expect(invokeMock).toHaveBeenCalledTimes(1);
    expect(invokeMock).toHaveBeenCalledWith(
      'patch83t_get_user_import_capabilities',
      { frontend_contract_version: 'patch83t-frontend-user-import-v1' },
      {
        headers: {
          'x-patch83t-frontend-contract-version': 'patch83t-frontend-user-import-v1',
        },
      },
    );
  });

  it('strictly rejects missing, extra, mistyped, and invalid capability fields', () => {
    const valid = capabilities();
    const { server_time: _omitted, ...missing } = valid;
    for (const malformed of [
      null,
      [],
      missing,
      { ...valid, internal_database_name: 'private_table' },
      { ...valid, maximum_rows: '5000' },
      { ...valid, runtime_status: 'ready' },
      { ...valid, compatible: 1 },
      { ...valid, server_time: 'not-a-time' },
    ]) {
      expect(() => normalizePatch83tUserImportCapabilities(malformed))
        .toThrow(PATCH83T_USER_IMPORT_DEPLOYMENT_MESSAGE);
    }
  });

  it('fails closed for every incompatible deployment field', () => {
    expect(patch83tCapabilityCompatibilityIssue(capabilities({ edge_contract_version: 'old' })))
      .toBe('PATCH83T_EDGE_CONTRACT_MISMATCH');
    expect(patch83tCapabilityCompatibilityIssue(capabilities({ migration_173_available: false })))
      .toBe('PATCH83T_USER_IMPORT_MIGRATION_REQUIRED');
    expect(patch83tCapabilityCompatibilityIssue(capabilities({ identity_reference_action_available: false })))
      .toBe('PATCH83T_USER_IMPORT_ACTION_UNAVAILABLE');
    expect(patch83tCapabilityCompatibilityIssue(capabilities({ import_execution_action_available: false })))
      .toBe('PATCH83T_USER_IMPORT_ACTION_UNAVAILABLE');
    expect(patch83tCapabilityCompatibilityIssue(capabilities({ maximum_rows: 4999 })))
      .toBe('PATCH83T_FRONTEND_CONTRACT_MISMATCH');
    expect(patch83tCapabilityCompatibilityIssue(capabilities({ runtime_status: 'incompatible' })))
      .toBe('PATCH83T_USER_IMPORT_ACTION_UNAVAILABLE');
    expect(patch83tCapabilityCompatibilityIssue(capabilities({ compatible: false })))
      .toBe('PATCH83T_USER_IMPORT_ACTION_UNAVAILABLE');
    expect(patch83tCapabilityCompatibilityIssue(capabilities())).toBeNull();
  });

  it.each(PATCH83T_DEPLOYMENT_COMPATIBILITY_CODES)(
    'classifies %s without using raw server details',
    (code) => {
      const raw = {
        code,
        message: 'Unsupported privileged action: patch83t_user_import_identity_references',
        detail: 'relation private_schema.internal_table does not exist',
      };
      expect(patch83tDeploymentCompatibilityCode(raw)).toBe(code);
      expect(isPatch83tDeploymentCompatibilityError(raw)).toBe(true);
      expect(() => rethrowPatch83tDeploymentCompatibilityError(raw))
        .toThrow(PATCH83T_USER_IMPORT_DEPLOYMENT_MESSAGE);
      try {
        rethrowPatch83tDeploymentCompatibilityError(raw);
      } catch (error) {
        expect(error).toBeInstanceOf(Patch83tDeploymentCompatibilityError);
        expect((error as Error).message).not.toContain('patch83t_');
        expect(error).not.toHaveProperty('detail');
      }
    },
  );

  it('maps an old Edge unsupported-action response to the fixed safe message', async () => {
    invokeMock.mockRejectedValueOnce({
      code: 'UNSUPPORTED_PRIVILEGED_ACTION',
      message: 'Unsupported privileged action: patch83t_get_user_import_capabilities',
      detail: 'raw Edge detail',
    });

    const error = await getPatch83tUserImportCapabilities().catch((failure) => failure);
    expect(error).toBeInstanceOf(Patch83tDeploymentCompatibilityError);
    expect(error.message).toBe(PATCH83T_USER_IMPORT_DEPLOYMENT_MESSAGE);
    expect(error.message).not.toContain('patch83t_');
    expect(error).not.toHaveProperty('detail');
  });

  it('preserves signal and token while preventing contract-header override', () => {
    const signal = new AbortController().signal;
    expect(patch83tPrivilegedActionOptions({ signal, accessToken: 'token' })).toEqual({
      signal,
      accessToken: 'token',
      headers: {
        'x-patch83t-frontend-contract-version': 'patch83t-frontend-user-import-v1',
      },
    });
  });

  it('shares a pending compatibility retry and starts a fresh check after it settles', async () => {
    let resolveFirst!: (value: Patch83tUserImportCapabilities) => void;
    const check = vi.fn()
      .mockImplementationOnce(() => new Promise<Patch83tUserImportCapabilities>((resolve) => {
        resolveFirst = resolve;
      }))
      .mockResolvedValueOnce(capabilities());
    const singleFlight = createPatch83tUserImportCapabilitySingleFlight(check);

    const first = singleFlight();
    const concurrent = singleFlight();
    expect(concurrent).toBe(first);
    expect(check).toHaveBeenCalledTimes(0);
    await Promise.resolve();
    expect(check).toHaveBeenCalledTimes(1);

    resolveFirst(capabilities());
    await expect(first).resolves.toEqual(capabilities());
    await expect(singleFlight()).resolves.toEqual(capabilities());
    expect(check).toHaveBeenCalledTimes(2);
  });

  it('clears a rejected single-flight check so an explicit retry can recover', async () => {
    const check = vi.fn()
      .mockRejectedValueOnce(new Patch83tDeploymentCompatibilityError('PATCH83T_EDGE_CONTRACT_MISMATCH'))
      .mockResolvedValueOnce(capabilities());
    const singleFlight = createPatch83tUserImportCapabilitySingleFlight(check);

    const first = singleFlight();
    expect(singleFlight()).toBe(first);
    await expect(first).rejects.toThrow(PATCH83T_USER_IMPORT_DEPLOYMENT_MESSAGE);
    await expect(singleFlight()).resolves.toEqual(capabilities());
    expect(check).toHaveBeenCalledTimes(2);
  });
});

describe('Patch 83T protected-action client gates', () => {
  it('makes zero Patch 83T calls when the exact feature flag is not enabled', async () => {
    vi.stubEnv('VITE_PATCH83T_USER_EXCEL_IMPORT_ENABLED', 'false');

    await expect(getPatch83tUserImportCapabilities()).rejects
      .toThrow('User Excel Import is not enabled in this deployment.');
    await expect(validateImportRows([], {}, capabilities())).rejects
      .toThrow('User Excel Import is not enabled in this deployment.');
    await expect(applyImportBatch(
      'users.xlsx',
      {} as UserImportValidationResult,
      'EXECUTE USER IMPORT',
      capabilities(),
    )).rejects.toThrow('User Excel Import is not enabled in this deployment.');
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it('blocks validation and execution before the bridge without a compatible proof', async () => {
    const incompatible = capabilities({ identity_reference_action_available: false, compatible: false });

    expect(() => requireCompatiblePatch83tUserImportCapability(incompatible))
      .toThrow(PATCH83T_USER_IMPORT_DEPLOYMENT_MESSAGE);
    await expect(validateImportRows([], {}, incompatible)).rejects
      .toThrow(PATCH83T_USER_IMPORT_DEPLOYMENT_MESSAGE);
    await expect(applyImportBatch(
      'users.xlsx',
      {} as UserImportValidationResult,
      'EXECUTE USER IMPORT',
      incompatible,
    )).rejects.toThrow(PATCH83T_USER_IMPORT_DEPLOYMENT_MESSAGE);
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it('retains exact execution confirmation after compatibility succeeds', async () => {
    await expect(applyImportBatch(
      'users.xlsx',
      {} as UserImportValidationResult,
      'execute user import',
      capabilities(),
    )).rejects.toThrow('Type EXECUTE USER IMPORT exactly');
    expect(invokeMock).not.toHaveBeenCalled();
  });
});
