export const F1_OVR_GOVERNED_VERSION_LINK_CONTRACT = {
  contract_version: 'f1-ovr-governed-version-links-v1',
  schema_version: 210,
  link_available: true,
  unlink_available: true,
} as const;

export interface F1GovernanceRoleAssignment {
  role: string;
  scope: string;
  is_active?: boolean;
  organization_id?: string | null;
}

const F1_GLOBAL_GOVERNANCE_ROLES = new Set([
  'super_admin',
  'governance_admin',
  'compliance_officer',
]);

export function hasExactF1GlobalGovernanceRole(
  userRoles: readonly F1GovernanceRoleAssignment[],
  organizationId: string,
): boolean {
  if (!organizationId) return false;
  return userRoles.some((assignment) =>
    assignment.is_active === true
    && F1_GLOBAL_GOVERNANCE_ROLES.has(assignment.role)
    && assignment.scope === 'global'
    && assignment.organization_id === organizationId
  );
}

export function hasExactF1OvrGovernedVersionCapability(
  value: unknown,
): value is typeof F1_OVR_GOVERNED_VERSION_LINK_CONTRACT {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const capability = value as Record<string, unknown>;
  const keys = Object.keys(capability).sort();
  return keys.length === 4
    && keys[0] === 'contract_version'
    && keys[1] === 'link_available'
    && keys[2] === 'schema_version'
    && keys[3] === 'unlink_available'
    && capability.contract_version === F1_OVR_GOVERNED_VERSION_LINK_CONTRACT.contract_version
    && capability.schema_version === F1_OVR_GOVERNED_VERSION_LINK_CONTRACT.schema_version
    && capability.link_available === true
    && capability.unlink_available === true;
}

export function isF1Migration210CapabilityUnavailable(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as { code?: unknown; message?: unknown; details?: unknown; hint?: unknown };
  const code = String(candidate.code ?? '');
  const message = [candidate.message, candidate.details, candidate.hint]
    .filter((part) => typeof part === 'string')
    .join(' ')
    .toLowerCase();
  return code === 'PGRST202'
    || code === '42883'
    || message.includes('get_f1_ovr_governed_version_link_capabilities')
      && (message.includes('not find') || message.includes('does not exist'));
}

export function mapF1OvrGovernedVersionError(error: unknown): {
  error: string;
  status: number;
  code: string;
  detail: string;
} {
  const candidate = error && typeof error === 'object'
    ? error as { message?: unknown; code?: unknown }
    : {};
  const message = String(candidate.message ?? error ?? 'F1_OPERATION_FAILED');

  if (
    message.startsWith('INVALID_UUID_')
    || message.startsWith('PROHIBITED_IDENTITY_OVERRIDE_')
    || message.startsWith('UNKNOWN_FIELD_')
    || message.startsWith('INVALID_STRING_')
    || message.startsWith('MAX_LENGTH_EXCEEDED_')
    || message.startsWith('REQUIRED_')
    || message === 'F1_UNLINK_REASON_LENGTH_REQUIRED'
  ) {
    return {
      error: message,
      status: 400,
      code: 'F1_MALFORMED_REQUEST',
      detail: 'The F1 governed-version request payload is invalid.',
    };
  }
  if (
    message.includes('ACTIVE_ACTOR_REQUIRED')
    || message.includes('PROFILE_INACTIVE')
    || message.includes('ORGANIZATION_DENIED')
    || message.includes('GLOBAL_GOVERNANCE_ROLE_REQUIRED')
    || message.includes('CROSS_ORGANIZATION')
    || message.includes('TENANCY')
  ) {
    return {
      error: message,
      status: 403,
      code: 'F1_GOVERNANCE_AUTHORITY_DENIED',
      detail: 'An active exact-org global governance assignment is required.',
    };
  }
  if (message.includes('NOT_FOUND')) {
    return {
      error: message,
      status: 404,
      code: 'F1_RESOURCE_NOT_FOUND',
      detail: 'The requested OVR, governed version, or exact link was not found.',
    };
  }
  return {
    error: message,
    status: 409,
    code: 'F1_GOVERNED_VERSION_CONFLICT',
    detail: 'The exact governed-version relationship could not be changed.',
  };
}
