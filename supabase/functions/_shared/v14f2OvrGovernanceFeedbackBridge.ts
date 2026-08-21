export const F2_OVR_GOVERNANCE_FEEDBACK_CONTRACT = {
  contract_version: 'f2-ovr-governance-feedback-v1',
  schema_version: 211,
  initiate_review_available: true,
  complete_review_available: true,
  sync_capa_available: true,
} as const;

export interface F2GovernanceRoleAssignment {
  role: string;
  scope: string;
  is_active?: boolean;
  organization_id?: string | null;
}

const F2_GLOBAL_GOVERNANCE_ROLES = new Set([
  'super_admin',
  'governance_admin',
  'compliance_officer',
]);

export const F2_REVIEW_OUTCOMES = new Set([
  'no_change',
  'minor_revision',
  'major_revision',
  'retire',
]);

export function hasExactF2GlobalGovernanceRole(
  userRoles: readonly F2GovernanceRoleAssignment[],
  organizationId: string,
): boolean {
  if (!organizationId) return false;
  return userRoles.some((assignment) =>
    assignment.is_active === true
    && F2_GLOBAL_GOVERNANCE_ROLES.has(assignment.role)
    && assignment.scope === 'global'
    && assignment.organization_id === organizationId
  );
}

export function hasExactF2OvrGovernanceFeedbackCapability(
  value: unknown,
): value is typeof F2_OVR_GOVERNANCE_FEEDBACK_CONTRACT {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const capability = value as Record<string, unknown>;
  const keys = Object.keys(capability).sort();
  return keys.length === 5
    && keys[0] === 'complete_review_available'
    && keys[1] === 'contract_version'
    && keys[2] === 'initiate_review_available'
    && keys[3] === 'schema_version'
    && keys[4] === 'sync_capa_available'
    && capability.contract_version === F2_OVR_GOVERNANCE_FEEDBACK_CONTRACT.contract_version
    && capability.schema_version === F2_OVR_GOVERNANCE_FEEDBACK_CONTRACT.schema_version
    && capability.initiate_review_available === true
    && capability.complete_review_available === true
    && capability.sync_capa_available === true;
}

export function isF2Migration211CapabilityUnavailable(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as { code?: unknown; message?: unknown; details?: unknown; hint?: unknown };
  const code = String(candidate.code ?? '');
  const message = [candidate.message, candidate.details, candidate.hint]
    .filter((part) => typeof part === 'string')
    .join(' ')
    .toLowerCase();
  return code === 'PGRST202'
    || code === '42883'
    || message.includes('get_f2_ovr_governance_feedback_capabilities')
      && (message.includes('not find') || message.includes('does not exist'));
}

export function mapF2OvrGovernanceFeedbackError(error: unknown): {
  error: string;
  status: number;
  code: string;
  detail: string;
} {
  const candidate = error && typeof error === 'object'
    ? error as { message?: unknown }
    : {};
  const message = String(candidate.message ?? error ?? 'F2_OPERATION_FAILED');

  if (
    message.startsWith('INVALID_UUID_')
    || message.startsWith('PROHIBITED_IDENTITY_OVERRIDE_')
    || message.startsWith('UNKNOWN_FIELD_')
    || message.startsWith('INVALID_STRING_')
    || message.startsWith('MAX_LENGTH_EXCEEDED_')
    || message.startsWith('REQUIRED_')
    || message.includes('LENGTH_REQUIRED')
    || message.includes('DUE_DATE_INVALID')
    || message.includes('OUTCOME_INVALID')
  ) {
    return {
      error: message,
      status: 400,
      code: 'F2_MALFORMED_REQUEST',
      detail: 'The F2 governance-feedback request payload is invalid.',
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
      code: 'F2_GOVERNANCE_AUTHORITY_DENIED',
      detail: 'An active exact-org global governance assignment is required.',
    };
  }
  if (message.includes('NOT_FOUND')) {
    return {
      error: message,
      status: 404,
      code: 'F2_RESOURCE_NOT_FOUND',
      detail: 'The requested OVR, review, exact link, or corrective project was not found.',
    };
  }
  return {
    error: message,
    status: 409,
    code: 'F2_GOVERNANCE_FEEDBACK_CONFLICT',
    detail: 'The governed feedback operation could not be completed safely.',
  };
}
