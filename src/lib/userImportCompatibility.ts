import {
  isPatch83tUserExcelImportEnabled,
  PATCH83T_EXPECTED_EDGE_CONTRACT_VERSION,
  PATCH83T_EXPECTED_MAXIMUM_ROWS,
  PATCH83T_FRONTEND_CONTRACT_VERSION,
} from '../config/featureFlags';
import {
  invokePrivilegedAction,
  type PrivilegedActionOptions,
} from './privilegedAction';

export const PATCH83T_USER_IMPORT_FEATURE_DISABLED_MESSAGE = 'User Excel Import is not enabled in this deployment.';
export const PATCH83T_USER_IMPORT_DEPLOYMENT_MESSAGE = 'User Excel Import backend is not fully deployed. No user data was changed.';

export const PATCH83T_DEPLOYMENT_COMPATIBILITY_CODES = [
  'UNSUPPORTED_PRIVILEGED_ACTION',
  'PATCH83T_USER_IMPORT_MIGRATION_REQUIRED',
  'PATCH83T_USER_IMPORT_ACTION_UNAVAILABLE',
  'PATCH83T_EDGE_CONTRACT_MISMATCH',
  'PATCH83T_FRONTEND_CONTRACT_MISMATCH',
] as const;

export type Patch83tDeploymentCompatibilityCode =
  typeof PATCH83T_DEPLOYMENT_COMPATIBILITY_CODES[number];

export type Patch83tUserImportRuntimeStatus = 'compatible' | 'incompatible';

export type Patch83tUserImportCapabilities = {
  edge_contract_version: string;
  migration_173_available: boolean;
  identity_reference_action_available: boolean;
  import_execution_action_available: boolean;
  maximum_rows: number;
  runtime_status: Patch83tUserImportRuntimeStatus;
  compatible: boolean;
  server_time: string;
};

export interface Patch83tUserImportRequestOptions {
  signal?: AbortSignal;
  accessToken?: string;
}

type Patch83tCompatibilityReason =
  | Patch83tDeploymentCompatibilityCode
  | 'PATCH83T_CAPABILITY_RESPONSE_INVALID';

const CAPABILITY_KEYS = new Set<keyof Patch83tUserImportCapabilities>([
  'edge_contract_version',
  'migration_173_available',
  'identity_reference_action_available',
  'import_execution_action_available',
  'maximum_rows',
  'runtime_status',
  'compatible',
  'server_time',
]);

const DEPLOYMENT_COMPATIBILITY_CODE_SET = new Set<string>(
  PATCH83T_DEPLOYMENT_COMPATIBILITY_CODES,
);

export class Patch83tUserImportFeatureDisabledError extends Error {
  readonly code = 'PATCH83T_USER_IMPORT_FEATURE_DISABLED';

  constructor() {
    super(PATCH83T_USER_IMPORT_FEATURE_DISABLED_MESSAGE);
    this.name = 'Patch83tUserImportFeatureDisabledError';
  }
}

export class Patch83tDeploymentCompatibilityError extends Error {
  readonly code = 'PATCH83T_USER_IMPORT_DEPLOYMENT_INCOMPATIBLE';
  readonly reasonCode: Patch83tCompatibilityReason;

  constructor(reasonCode: Patch83tCompatibilityReason) {
    super(PATCH83T_USER_IMPORT_DEPLOYMENT_MESSAGE);
    this.name = 'Patch83tDeploymentCompatibilityError';
    this.reasonCode = reasonCode;
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function capabilityResponseInvalid(): never {
  throw new Patch83tDeploymentCompatibilityError('PATCH83T_CAPABILITY_RESPONSE_INVALID');
}

/**
 * Strictly accepts the fixed, non-sensitive Patch 83T capability response.
 * Extra fields are rejected so a server cannot accidentally expose details
 * through this browser-visible compatibility endpoint.
 */
export function normalizePatch83tUserImportCapabilities(
  value: unknown,
): Patch83tUserImportCapabilities {
  const row = asRecord(value);
  if (!row) return capabilityResponseInvalid();
  const keys = Object.keys(row);
  if (
    keys.length !== CAPABILITY_KEYS.size
    || keys.some((key) => !CAPABILITY_KEYS.has(key as keyof Patch83tUserImportCapabilities))
  ) return capabilityResponseInvalid();

  const edgeContractVersion = row.edge_contract_version;
  const migrationAvailable = row.migration_173_available;
  const identityActionAvailable = row.identity_reference_action_available;
  const executionActionAvailable = row.import_execution_action_available;
  const maximumRows = row.maximum_rows;
  const runtimeStatus = row.runtime_status;
  const compatible = row.compatible;
  const serverTime = row.server_time;
  if (
    typeof edgeContractVersion !== 'string'
    || !edgeContractVersion
    || edgeContractVersion !== edgeContractVersion.trim()
    || typeof migrationAvailable !== 'boolean'
    || typeof identityActionAvailable !== 'boolean'
    || typeof executionActionAvailable !== 'boolean'
    || typeof maximumRows !== 'number'
    || !Number.isInteger(maximumRows)
    || maximumRows < 1
    || (runtimeStatus !== 'compatible' && runtimeStatus !== 'incompatible')
    || typeof compatible !== 'boolean'
    || typeof serverTime !== 'string'
    || !serverTime
    || serverTime !== serverTime.trim()
    || !Number.isFinite(Date.parse(serverTime))
  ) return capabilityResponseInvalid();

  return {
    edge_contract_version: edgeContractVersion,
    migration_173_available: migrationAvailable,
    identity_reference_action_available: identityActionAvailable,
    import_execution_action_available: executionActionAvailable,
    maximum_rows: maximumRows,
    runtime_status: runtimeStatus,
    compatible,
    server_time: serverTime,
  };
}

export function patch83tCapabilityCompatibilityIssue(
  capabilities: Patch83tUserImportCapabilities,
): Patch83tDeploymentCompatibilityCode | null {
  if (capabilities.edge_contract_version !== PATCH83T_EXPECTED_EDGE_CONTRACT_VERSION) {
    return 'PATCH83T_EDGE_CONTRACT_MISMATCH';
  }
  if (!capabilities.migration_173_available) {
    return 'PATCH83T_USER_IMPORT_MIGRATION_REQUIRED';
  }
  if (
    !capabilities.identity_reference_action_available
    || !capabilities.import_execution_action_available
  ) {
    return 'PATCH83T_USER_IMPORT_ACTION_UNAVAILABLE';
  }
  if (capabilities.maximum_rows !== PATCH83T_EXPECTED_MAXIMUM_ROWS) {
    return 'PATCH83T_FRONTEND_CONTRACT_MISMATCH';
  }
  if (capabilities.runtime_status !== 'compatible' || !capabilities.compatible) {
    return 'PATCH83T_USER_IMPORT_ACTION_UNAVAILABLE';
  }
  return null;
}

export function isPatch83tUserImportCapabilityCompatible(
  capabilities: Patch83tUserImportCapabilities | null | undefined,
): capabilities is Patch83tUserImportCapabilities {
  return Boolean(capabilities && patch83tCapabilityCompatibilityIssue(capabilities) === null);
}

export function requirePatch83tUserImportEnabled(): void {
  if (!isPatch83tUserExcelImportEnabled()) {
    throw new Patch83tUserImportFeatureDisabledError();
  }
}

export function requireCompatiblePatch83tUserImportCapability(
  value: unknown,
): Patch83tUserImportCapabilities {
  requirePatch83tUserImportEnabled();
  const capabilities = normalizePatch83tUserImportCapabilities(value);
  const issue = patch83tCapabilityCompatibilityIssue(capabilities);
  if (issue) throw new Patch83tDeploymentCompatibilityError(issue);
  return capabilities;
}

export function patch83tPrivilegedActionOptions(
  options: Patch83tUserImportRequestOptions = {},
): PrivilegedActionOptions {
  requirePatch83tUserImportEnabled();
  return {
    ...(options.signal ? { signal: options.signal } : {}),
    ...(options.accessToken ? { accessToken: options.accessToken } : {}),
    headers: {
      'x-patch83t-frontend-contract-version': PATCH83T_FRONTEND_CONTRACT_VERSION,
    },
  };
}

export function patch83tDeploymentCompatibilityCode(
  error: unknown,
): Patch83tDeploymentCompatibilityCode | null {
  if (error instanceof Patch83tDeploymentCompatibilityError) {
    return DEPLOYMENT_COMPATIBILITY_CODE_SET.has(error.reasonCode)
      ? error.reasonCode as Patch83tDeploymentCompatibilityCode
      : null;
  }
  const row = asRecord(error);
  const code = row?.code;
  return typeof code === 'string' && DEPLOYMENT_COMPATIBILITY_CODE_SET.has(code)
    ? code as Patch83tDeploymentCompatibilityCode
    : null;
}

export function isPatch83tDeploymentCompatibilityError(error: unknown): boolean {
  return error instanceof Patch83tDeploymentCompatibilityError
    || patch83tDeploymentCompatibilityCode(error) !== null;
}

/** Converts only known compatibility failures; all other failures retain their semantics. */
export function rethrowPatch83tDeploymentCompatibilityError(error: unknown): never {
  if (error instanceof Patch83tDeploymentCompatibilityError) throw error;
  const code = patch83tDeploymentCompatibilityCode(error);
  if (code) throw new Patch83tDeploymentCompatibilityError(code);
  throw error;
}

export async function getPatch83tUserImportCapabilities(
  options: Patch83tUserImportRequestOptions = {},
): Promise<Patch83tUserImportCapabilities> {
  requirePatch83tUserImportEnabled();
  try {
    const result = await invokePrivilegedAction<unknown>(
      'patch83t_get_user_import_capabilities',
      { frontend_contract_version: PATCH83T_FRONTEND_CONTRACT_VERSION },
      patch83tPrivilegedActionOptions(options),
    );
    return normalizePatch83tUserImportCapabilities(result);
  } catch (error) {
    rethrowPatch83tDeploymentCompatibilityError(error);
  }
}

/**
 * Shares one in-flight compatibility request. The settled request is never
 * cached, so an explicit later Retry performs a fresh authoritative check.
 */
export function createPatch83tUserImportCapabilitySingleFlight(
  check: (
    options?: Patch83tUserImportRequestOptions,
  ) => Promise<Patch83tUserImportCapabilities> = getPatch83tUserImportCapabilities,
): (
  options?: Patch83tUserImportRequestOptions,
) => Promise<Patch83tUserImportCapabilities> {
  let pending: Promise<Patch83tUserImportCapabilities> | null = null;

  return (options = {}) => {
    if (pending) return pending;
    const request = Promise.resolve().then(() => check(options));
    pending = request;
    const clear = () => {
      if (pending === request) pending = null;
    };
    request.then(clear, clear);
    return request;
  };
}
