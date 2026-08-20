interface F1FrontendRoleAssignment {
  role: string;
  scope: string;
  organizationId?: string | null;
}

const F1_FRONTEND_GOVERNANCE_ROLES = new Set([
  'super_admin',
  'governance_admin',
  'compliance_officer',
]);

export function canManageF1OvrGovernedVersionLinks(
  roles: readonly F1FrontendRoleAssignment[],
  organizationId: string,
): boolean {
  if (!organizationId) return false;
  return roles.some(role =>
    F1_FRONTEND_GOVERNANCE_ROLES.has(role.role)
    && role.scope === 'global'
    && role.organizationId === organizationId
  );
}
