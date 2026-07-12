export function isDepartmentImportExecutionEnabled(
  value: unknown = import.meta.env.VITE_DEPARTMENT_IMPORT_EXECUTION_ENABLED,
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
