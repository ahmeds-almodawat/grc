interface F2FrontendRoleAssignment {
  role: string;
  scope: string;
  organizationId?: string | null;
}

const F2_FRONTEND_GOVERNANCE_ROLES = new Set([
  'super_admin',
  'governance_admin',
  'compliance_officer',
]);

export function canManageF2OvrGovernanceFeedback(
  roles: readonly F2FrontendRoleAssignment[],
  organizationId: string,
): boolean {
  if (!organizationId) return false;
  return roles.some(role =>
    F2_FRONTEND_GOVERNANCE_ROLES.has(role.role)
    && role.scope === 'global'
    && role.organizationId === organizationId
  );
}
