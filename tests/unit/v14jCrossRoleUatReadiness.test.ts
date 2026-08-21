import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { canAccessPageForUser } from '../../src/auth/authAccess';
import { canManageF1OvrGovernedVersionLinks } from '../../src/lib/f1OvrGovernedVersionModel';
import { canManageF2OvrGovernanceFeedback } from '../../src/lib/f2OvrGovernanceFeedbackModel';
import { getTrainingCompliancePersona } from '../../src/lib/trainingComplianceModel';
import {
  buildV14jRoleAssignment,
  V14J_GOVERNED_ROUTES,
  V14J_ORGANIZATION_ID,
  V14J_ROLES,
} from '../helpers/v14jCrossRoleMatrix';

const root = path.resolve(__dirname, '../..');
const source = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const expectedRouteAccess: Record<(typeof V14J_ROLES)[number], string[]> = {
  super_admin: V14J_GOVERNED_ROUTES.map(({ area }) => area),
  executive: V14J_GOVERNED_ROUTES.map(({ area }) => area),
  governance_admin: V14J_GOVERNED_ROUTES.map(({ area }) => area),
  division_head: V14J_GOVERNED_ROUTES.map(({ area }) => area),
  department_manager: V14J_GOVERNED_ROUTES.map(({ area }) => area),
  project_owner: ['OVR', 'F1 governed work', 'Evidence', 'Approvals'],
  milestone_owner: ['OVR', 'F1 governed work', 'Evidence', 'Approvals'],
  task_owner: ['OVR', 'F1 governed work', 'Evidence', 'Approvals'],
  auditor: ['OVR', 'F2 governance feedback', 'Policy/SOP', 'Training', 'Evidence', 'Risk', 'Audit', 'Approvals'],
  compliance_officer: V14J_GOVERNED_ROUTES.map(({ area }) => area),
  viewer: ['OVR', 'Policy/SOP', 'Evidence', 'Approvals'],
  employee: ['OVR', 'F1 governed work', 'Evidence', 'Approvals'],
};

describe('GRC v1.4-J hermetic cross-role UAT readiness contract', () => {
  it('pins all twelve personas to valid fail-closed authorization scopes', () => {
    expect(V14J_ROLES).toHaveLength(12);
    expect(new Set(V14J_ROLES).size).toBe(12);

    for (const role of V14J_ROLES) {
      const assignment = buildV14jRoleAssignment(role);
      expect(assignment.role).toBe(role);
      expect(assignment.organizationId).toBe(V14J_ORGANIZATION_ID);
      if (role === 'division_head') expect(assignment.scope).toBe('division');
      else if (role === 'department_manager') expect(assignment.scope).toBe('department');
      else if (['project_owner', 'milestone_owner', 'task_owner', 'viewer', 'employee'].includes(role)) {
        expect(assignment.scope).toBe('assigned_only');
      } else expect(assignment.scope).toBe('global');
    }
  });

  it('pins governed route visibility independently for every persona', () => {
    for (const role of V14J_ROLES) {
      const assignment = buildV14jRoleAssignment(role);
      const actual = V14J_GOVERNED_ROUTES
        .filter(({ page }) => canAccessPageForUser(page, [assignment]))
        .map(({ area }) => area);
      expect(actual, role).toEqual(expectedRouteAccess[role]);
    }
  });

  it('separates F1 and F2 mutation authority from readable OVR routes', () => {
    const mutationRoles = new Set(['super_admin', 'governance_admin', 'compliance_officer']);
    for (const role of V14J_ROLES) {
      const assignment = buildV14jRoleAssignment(role);
      expect(canAccessPageForUser('ovr', [assignment]), `${role}: OVR read`).toBe(true);
      expect(
        canManageF1OvrGovernedVersionLinks([assignment], V14J_ORGANIZATION_ID),
        `${role}: F1 mutation`,
      ).toBe(mutationRoles.has(role));
      expect(
        canManageF2OvrGovernanceFeedback([assignment], V14J_ORGANIZATION_ID),
        `${role}: F2 mutation`,
      ).toBe(mutationRoles.has(role));
    }

    expect(canManageF1OvrGovernedVersionLinks(
      [{ role: 'governance_admin', scope: 'global', organizationId: 'other-org' }],
      V14J_ORGANIZATION_ID,
    )).toBe(false);
    expect(canManageF2OvrGovernanceFeedback(
      [{ role: 'compliance_officer', scope: 'global', organizationId: 'other-org' }],
      V14J_ORGANIZATION_ID,
    )).toBe(false);
  });

  it('pins personal, manager, governance, and read-only training capabilities', () => {
    const teamRoles = new Set(['super_admin', 'governance_admin', 'division_head', 'department_manager', 'compliance_officer']);
    const publishRoles = new Set(['super_admin', 'governance_admin', 'compliance_officer']);
    const readOnlyRoles = new Set(['executive', 'auditor']);

    for (const role of V14J_ROLES) {
      const persona = getTrainingCompliancePersona([buildV14jRoleAssignment(role)]);
      expect(persona.canViewMyObligations, `${role}: personal training read`).toBe(true);
      expect(persona.canViewTeamCompliance, `${role}: team training read`).toBe(teamRoles.has(role));
      expect(persona.canPublishObligations, `${role}: publish`).toBe(publishRoles.has(role));
      expect(persona.canReconcilePopulation, `${role}: reconcile`).toBe(publishRoles.has(role));
      expect(persona.isReadOnlyGlobal, `${role}: read-only`).toBe(readOnlyRoles.has(role));
    }
  });

  it('retains explicit mutation gates and privileged approval execution', () => {
    expect(source('src/pages/Risks.tsx')).toContain(
      "['super_admin', 'governance_admin', 'division_head', 'department_manager', 'compliance_officer']",
    );
    expect(source('src/pages/Audit.tsx')).toContain(
      "['super_admin', 'governance_admin', 'auditor', 'compliance_officer', 'department_manager']",
    );
    expect(source('src/pages/Evidence.tsx')).toContain(
      "['super_admin', 'governance_admin', 'compliance_officer', 'department_manager', 'auditor']",
    );
    expect(source('src/lib/grcApi.ts')).toContain("invokePrivilegedAction('f1r2_decide_approval'");
  });

  it('records readiness evidence without claiming production UAT or release', () => {
    const evidence = JSON.parse(source('release/v1.4/j-readiness-matrix.json')) as Record<string, unknown>;
    const report = source('release/v1.4/j-readiness-report.md');

    expect(evidence.status).toBe('J READINESS ONLY — NOT PRODUCTION RELEASE');
    expect(evidence.production_uat_executed).toBe(false);
    expect(evidence.production_ready).toBe(false);
    expect(evidence.synthetic_data_only).toBe(true);
    expect(evidence.roles).toEqual(V14J_ROLES);
    expect(evidence.controlled_credentials).toBe(
      'NOT EXECUTED — REQUIRES CONTROLLED J UAT SESSION',
    );
    expect(report).toContain('J READINESS ONLY — NOT PRODUCTION RELEASE');
    expect(report).toContain('NOT EXECUTED — REQUIRES CONTROLLED J UAT SESSION');
    expect(report).not.toMatch(/password|access[_ -]?token|refresh[_ -]?token/i);
  });
});
