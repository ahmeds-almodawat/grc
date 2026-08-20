/**
 * GRC v1.4 E2B2 Training, Competency & Acknowledgment Privileged-Action Bridge
 *
 * Provides strict payload validation, caller identity binding, governance preflight,
 * Migration 208 capability gating, and controlled error mapping for:
 * - record_document_acknowledgment
 * - start_training_assignment
 * - complete_training_assignment
 * - record_competency_assessment
 * - waive_training_assignment_with_reason
 * - cancel_training_assignment_with_reason
 * - reopen_training_assignment_with_reason
 * - decide_sop_rollout_requirements
 * - publish_sop_training_obligations
 * - reconcile_sop_training_population (E2B3 fail-closed)
 */

export const canonicalUuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const MAX_E2B2_PAYLOAD_BYTES = 64 * 1024; // 64 KiB

export const v14e2b2TrainingActions = new Set([
  'record_document_acknowledgment',
  'start_training_assignment',
  'complete_training_assignment',
  'record_competency_assessment',
  'waive_training_assignment_with_reason',
  'cancel_training_assignment_with_reason',
  'reopen_training_assignment_with_reason',
  'decide_sop_rollout_requirements',
  'publish_sop_training_obligations',
  'reconcile_sop_training_population',
]);

export const validCompetencyResults = new Set([
  'passed',
  'failed',
  'needs_retraining',
  'pending',
]);

export const globalGovernanceRoles = new Set([
  'super_admin',
  'governance_admin',
  'compliance_officer',
]);

export function asPlainObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function isCanonicalUuid(value: unknown): value is string {
  return typeof value === 'string' && canonicalUuidPattern.test(value.trim());
}

export function requireCanonicalUuid(value: unknown, fieldName: string): string {
  if (typeof value !== 'string' || !canonicalUuidPattern.test(value.trim())) {
    throw new Error(`INVALID_UUID_${fieldName.toUpperCase()}`);
  }
  return value.trim();
}

export function optionalCanonicalUuid(value: unknown, fieldName: string): string | null {
  if (value === null || value === undefined || value === '') return null;
  return requireCanonicalUuid(value, fieldName);
}

export function validateStrictBoolean(
  value: unknown,
  fieldName: string,
  defaultValue?: boolean
): boolean {
  if (value === null || value === undefined) {
    if (defaultValue !== undefined) return defaultValue;
    throw new Error(`MISSING_STRICT_BOOLEAN_${fieldName.toUpperCase()}`);
  }
  if (typeof value !== 'boolean') {
    throw new Error(`INVALID_STRICT_BOOLEAN_${fieldName.toUpperCase()}`);
  }
  return value;
}

export function optionalStrictFiniteNumber(
  value: unknown,
  fieldName: string
): number | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`INVALID_NUMERIC_${fieldName.toUpperCase()}`);
  }
  return value;
}

export function boundedString(
  value: unknown,
  minLen: number,
  maxLen: number,
  fieldName: string,
  required = true
): string | null {
  if (value === null || value === undefined || value === '') {
    if (!required) return null;
    throw new Error(`MISSING_REQUIRED_STRING_${fieldName.toUpperCase()}`);
  }
  if (typeof value !== 'string') {
    throw new Error(`INVALID_STRING_TYPE_${fieldName.toUpperCase()}`);
  }
  const trimmed = value.trim();
  if (trimmed.length < minLen || trimmed.length > maxLen) {
    throw new Error(`STRING_LENGTH_OUT_OF_BOUNDS_${fieldName.toUpperCase()}`);
  }
  return trimmed;
}

export function assertOnlyAllowedKeys(
  payload: Record<string, unknown>,
  allowedKeys: Set<string>,
  contextName: string
): void {
  for (const key of Object.keys(payload)) {
    if (!allowedKeys.has(key)) {
      throw new Error(`UNKNOWN_PAYLOAD_KEY_${key.toUpperCase()}_FOR_${contextName}`);
    }
  }
}

export function assertNoIdentityOverrides(
  payload: Record<string, unknown>,
  forbiddenKeys: string[] = [
    'p_actor_id',
    'acting_user_id',
    'authenticated_user_id',
    'organization_id',
    'p_organization_id',
    'user_id',
    'p_user_id',
    'target_user_id',
  ]
): void {
  for (const key of forbiddenKeys) {
    if (key in payload && payload[key] !== undefined) {
      throw new Error(`FORBIDDEN_IDENTITY_OVERRIDE_${key.toUpperCase()}`);
    }
  }
}

/**
 * Validates backward-compatible actor_id.
 * If omitted: accepted.
 * If present: must be canonical UUID AND match authenticated user ID.
 * Identity aliases (p_actor_id, acting_user_id, etc.) are strictly rejected.
 */
export function validateLegacyActorId(
  payload: Record<string, unknown>,
  authenticatedActorId: string
): void {
  assertNoIdentityOverrides(payload, [
    'p_actor_id',
    'acting_user_id',
    'authenticated_user_id',
    'organization_id',
    'p_organization_id',
  ]);

  if ('actor_id' in payload && payload.actor_id !== undefined && payload.actor_id !== null && payload.actor_id !== '') {
    const actorId = requireCanonicalUuid(payload.actor_id, 'actor_id');
    if (actorId !== authenticatedActorId) {
      throw new Error('CALLER_ACTOR_MISMATCH');
    }
  }
}

/**
 * Map PostgreSQL and Preflight errors to controlled, stable status codes and error payloads.
 */
export function mapV14e2b2DatabaseError(
  action: string,
  error: unknown
): {
  error: string;
  status: number;
  code: string;
  detail: string;
  extra?: Record<string, unknown>;
} {
  const errObj = asPlainObject(error);
  const msg = String(errObj.message || (error instanceof Error ? error.message : String(error || '')));
  const code = String(errObj.code || '');

  // Validation / Schema errors (400)
  if (
    msg.startsWith('INVALID_UUID_') ||
    msg.startsWith('MISSING_REQUIRED_STRING_') ||
    msg.startsWith('INVALID_STRING_TYPE_') ||
    msg.startsWith('STRING_LENGTH_OUT_OF_BOUNDS_') ||
    msg.startsWith('UNKNOWN_PAYLOAD_KEY_') ||
    msg.startsWith('FORBIDDEN_IDENTITY_OVERRIDE_') ||
    msg.startsWith('MISSING_STRICT_BOOLEAN_') ||
    msg.startsWith('INVALID_STRICT_BOOLEAN_') ||
    msg.startsWith('INVALID_NUMERIC_') ||
    msg === 'INVALID_ACKNOWLEDGMENT_METHOD' ||
    msg === 'INVALID_COMPETENCY_RESULT' ||
    msg === 'REASON_TOO_LONG' ||
    msg === 'PAYLOAD_TOO_LARGE' ||
    msg === 'REQUEST_PAYLOAD_TOO_LARGE'
  ) {
    return {
      error: msg,
      status: 400,
      code: 'MALFORMED_REQUEST_PAYLOAD',
      detail: 'The provided payload does not adhere to the strict schema requirements.',
      extra: { action },
    };
  }

  // Caller identity / Authorization / Tenancy errors (403)
  if (
    msg === 'CALLER_ACTOR_MISMATCH' ||
    msg === 'CALLER_PROFILE_INACTIVE' ||
    msg === 'CALLER_PROFILE_NOT_FOUND' ||
    msg === 'TENANT_ISOLATION_VIOLATION' ||
    msg === 'EMPLOYEE_CANNOT_COMPLETE_GOVERNED_TRAINING' ||
    msg === 'SOD_VIOLATION_SELF_ASSESSMENT' ||
    msg === 'UNAUTHORIZED_COMPLETION_CERTIFIER' ||
    msg === 'UNAUTHORIZED_ASSESSOR' ||
    msg === 'UNAUTHORIZED_WAIVER_AUTHORITY' ||
    msg === 'UNAUTHORIZED_CANCELLATION_AUTHORITY' ||
    msg === 'UNAUTHORIZED_REOPEN_AUTHORITY' ||
    msg === 'UNAUTHORIZED_GOVERNANCE_ROLE' ||
    msg === 'NOT_ELIGIBLE_FOR_ACKNOWLEDGMENT' ||
    msg.includes('PATCH29_ASSIGNMENT_FORBIDDEN') ||
    msg.includes('UNAUTHORIZED') ||
    msg.includes('FORBIDDEN') ||
    msg.includes('NOT_AUTHORIZED') ||
    msg.includes('DENIED')
  ) {
    return {
      error: msg,
      status: 403,
      code: 'AUTHORIZATION_DENIED',
      detail: 'The authenticated actor is not authorized to perform this operation.',
      extra: { action },
    };
  }

  // Not Found errors (404)
  if (
    msg === 'DOCUMENT_NOT_FOUND' ||
    msg === 'DOCUMENT_VERSION_NOT_FOUND' ||
    msg === 'ASSIGNMENT_NOT_FOUND' ||
    msg === 'TARGET_USER_NOT_FOUND' ||
    msg === 'PROGRAM_NOT_FOUND'
  ) {
    return {
      error: msg,
      status: 404,
      code: 'OBJECT_NOT_FOUND',
      detail: 'The requested entity could not be found in the organization.',
      extra: { action },
    };
  }

  // State / Capability / Constraint conflict errors (409)
  if (
    msg === 'E2B2_MIGRATION_208_REQUIRED' ||
    msg === 'E2B3_RECONCILIATION_NOT_RELEASED' ||
    msg === 'TRAINING_NOT_REQUIRED_FOR_ASSIGNMENT' ||
    msg === 'COMPETENCY_NOT_REQUIRED_FOR_ASSIGNMENT' ||
    msg === 'COMPETENCY_ASSIGNMENT_SUBJECT_MISMATCH' ||
    msg === 'INVALID_ASSIGNMENT_STATUS' ||
    msg === 'CANNOT_CANCEL_COMPLETED_ASSIGNMENT' ||
    msg === 'CANNOT_REOPEN_OPEN_ASSIGNMENT' ||
    msg === 'VERSION_DOCUMENT_MISMATCH' ||
    msg.includes('CYCLE_TYPE_MISMATCH') ||
    msg.includes('CONFLICT')
  ) {
    return {
      error: msg,
      status: 409,
      code: msg === 'E2B2_MIGRATION_208_REQUIRED'
        ? 'E2B2_MIGRATION_208_REQUIRED'
        : msg === 'E2B3_RECONCILIATION_NOT_RELEASED'
        ? 'E2B3_RECONCILIATION_NOT_RELEASED'
        : 'INVALID_LIFECYCLE_STATE',
      detail: 'The operation cannot be completed in the current lifecycle or migration state.',
      extra: { action },
    };
  }

  // Database 42703 (undefined column) or PGRST204 -> Migration capability probe failure
  if (code === '42703' || code === 'PGRST204' || msg.includes('column') && msg.includes('does not exist')) {
    return {
      error: 'E2B2_MIGRATION_208_REQUIRED',
      status: 409,
      code: 'E2B2_MIGRATION_208_REQUIRED',
      detail: 'Database migration 208 is required for this operation.',
      extra: { action },
    };
  }

  return {
    error: 'Internal server error',
    status: 500,
    code: 'EDGE_DATABASE_ERROR',
    detail: 'An unexpected database error occurred.',
    extra: { action },
  };
}

/**
 * Check whether an actor has an active global governance role in the target organization.
 */
export function hasActiveGlobalGovernanceRole(
  userRoles: Array<{ role: string; scope: string; is_active?: boolean; organization_id?: string | null }>,
  organizationId: string
): boolean {
  return userRoles.some(
    (r) =>
      r.is_active !== false &&
      globalGovernanceRoles.has(r.role) &&
      (r.organization_id === organizationId || r.organization_id === null)
  );
}

/**
 * Check whether an actor is an active department manager for a specific department.
 */
export function hasActiveDepartmentManagerRole(
  userRoles: Array<{ role: string; scope: string; is_active?: boolean; department_id?: string | null; organization_id?: string | null }>,
  departmentId: string | null | undefined,
  organizationId: string
): boolean {
  if (!departmentId) return false;
  return userRoles.some(
    (r) =>
      r.is_active !== false &&
      r.role === 'department_manager' &&
      r.department_id === departmentId &&
      (r.organization_id === organizationId || r.organization_id === null)
  );
}

/**
 * Check whether an actor is an active division head for a specific division.
 */
export function hasActiveDivisionHeadRole(
  userRoles: Array<{ role: string; scope: string; is_active?: boolean; division_id?: string | null; organization_id?: string | null }>,
  divisionId: string | null | undefined,
  organizationId: string
): boolean {
  if (!divisionId) return false;
  return userRoles.some(
    (r) =>
      r.is_active !== false &&
      r.role === 'division_head' &&
      r.division_id === divisionId &&
      (r.organization_id === organizationId || r.organization_id === null)
  );
}
