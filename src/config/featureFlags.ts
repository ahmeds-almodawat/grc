export function isDepartmentImportExecutionEnabled(
  value: unknown = import.meta.env.VITE_DEPARTMENT_IMPORT_EXECUTION_ENABLED,
): boolean {
  return value === "true";
}

export const PATCH83T_EXPECTED_EDGE_CONTRACT_VERSION = "patch83t-edge-user-import-v1";
export const PATCH83T_FRONTEND_CONTRACT_VERSION = "patch83t-frontend-user-import-v1";
export const PATCH83T_EXPECTED_MAXIMUM_ROWS = 5000;

/**
 * Patch 83T User Excel Import is deployment-gated. Only the exact lower-case
 * string enables the browser capability handshake and protected import calls.
 */
export function isPatch83tUserExcelImportEnabled(
  value: unknown = import.meta.env.VITE_PATCH83T_USER_EXCEL_IMPORT_ENABLED,
): boolean {
  return value === "true";
}

export const PATCH83U_EXPECTED_EDGE_CONTRACT_VERSION = "patch83u-edge-auth-first-v1";
export const PATCH83U_FRONTEND_CONTRACT_VERSION = "patch83u-frontend-auth-first-v1";
export const PATCH83U_EXPECTED_SCHEMA_VERSION = 174;

/**
 * Patch 83U is deployment-gated. Missing, blank, or truthy-looking values must
 * preserve the pre-Patch 83U authentication path and make no credential calls.
 */
export function isPatch83uCredentialGovernanceEnabled(
  value: unknown = import.meta.env.VITE_PATCH83U_CREDENTIAL_GOVERNANCE_ENABLED,
): boolean {
  return value === "true";
}

export type DepartmentImportMode = "create_only" | "create_and_update";

interface DepartmentImportExecutionEligibility {
  featureEnabled: boolean;
  roles: readonly string[];
  previewExists: boolean;
  validRowCount: number;
  hasBlockingValidationErrors: boolean;
  organizationId: unknown;
  importMode: unknown;
}

export function isDepartmentImportExecutionEligible({
  featureEnabled,
  roles,
  previewExists,
  validRowCount,
  hasBlockingValidationErrors,
  organizationId,
  importMode,
}: DepartmentImportExecutionEligibility): boolean {
  const hasAuthorizedRole = roles.some(
    (role) => role === "super_admin" || role === "governance_admin",
  );
  const organizationResolved =
    typeof organizationId === "string" && organizationId.trim().length > 0;
  const modeAllowed =
    importMode === "create_only" || importMode === "create_and_update";

  return (
    featureEnabled &&
    hasAuthorizedRole &&
    previewExists &&
    Number.isFinite(validRowCount) &&
    validRowCount > 0 &&
    !hasBlockingValidationErrors &&
    organizationResolved &&
    modeAllowed
  );
}
