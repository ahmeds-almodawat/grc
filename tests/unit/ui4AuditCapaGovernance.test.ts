import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  auditCriteriaResolutionDate,
  countsAsGovernanceViolation,
  evaluateUi4AuditClosureGate,
  evaluateUi4CapaClosure,
  ui4CapaProgress,
} from '../../src/lib/ui4AuditCapaModel';

const root = process.cwd();
const source = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');
const migration = source('supabase/migrations/214_ui4_audit_capa_governance.sql');
const auditPage = source('src/pages/Audit.tsx');
const capaPage = source('src/pages/Capa.tsx');
const linkage = source('src/components/governance/GovernanceCriteriaLinkage.tsx');
const edge = source('supabase/functions/privileged-action/index.ts');
const registry = source('src/lib/runtimeActionRegistry.ts');
const route = source('src/routes/pageLocation.ts');
const css = source('src/styles/ui4-audit-capa.css');

describe('UI-4 Audit and canonical Patch 28 CAPA', () => {
  it('resolves exact governed versions at audit-period end, then finding date', () => {
    expect(auditCriteriaResolutionDate({ audit_period_end_date: '2026-06-30', finding_date: '2026-07-03' })).toBe('2026-06-30');
    expect(auditCriteriaResolutionDate({ audit_period_end_date: null, finding_date: '2026-07-03' })).toBe('2026-07-03');
    expect(migration).toContain('coalesce(a.audit_period_end_date, a.finding_date, a.created_at::date)');
  });

  it('requires a legitimate confirmed criterion for formal Audit closure', () => {
    const formal = { finding_classification: 'formal_finding' } as never;
    const gate = { can_close: true, closure_blocker: null } as never;
    expect(evaluateUi4AuditClosureGate(formal, { criterion_gate_satisfied: false } as never, gate).passed).toBe(false);
    expect(evaluateUi4AuditClosureGate(formal, { criterion_gate_satisfied: true } as never, gate).passed).toBe(true);
    expect(migration).toContain('UI4_AUDIT_FORMAL_FINDING_CRITERION_REQUIRED');
  });

  it('permits the explicit advisory-observation criterion exception', () => {
    const result = evaluateUi4AuditClosureGate(
      { finding_classification: 'advisory_observation' } as never,
      { criterion_gate_satisfied: true } as never,
      { can_close: true, closure_blocker: null } as never,
    );
    expect(result.passed).toBe(true);
    expect(result.criterionException).toBe(true);
    expect(migration).toContain("finding_classification = 'advisory_observation'");
  });

  it('keeps management disputes append-only and separate from auditor decisions', () => {
    expect(migration).toContain('audit_finding_criteria_disputes');
    expect(migration).toContain('UI4_AUDIT_CRITERIA_DISPUTE_APPEND_ONLY');
    expect(migration).toContain("p_authority in ('suggest','review')");
    expect(migration).toContain("ur.role::text = 'auditor'");
    expect(auditPage).toContain('Append-only response trail');
  });

  it('inherits confirmed source links into CAPA without duplicate violation truth', () => {
    expect(countsAsGovernanceViolation({ inherited: true, significance: 'primary', adherence_status: 'noncompliance' })).toBe(false);
    expect(countsAsGovernanceViolation({ inherited: false, significance: 'primary', adherence_status: 'noncompliance' })).toBe(true);
    expect(migration).toContain('ui4_inherit_governance_links_to_capa');
    expect(migration).toContain('not c.inherited');
    expect(migration).toContain('UI4_INHERITED_GOVERNANCE_LINK_READ_ONLY');
  });

  it('keeps inherited links source-owned and requires rationale for supplemental CAPA links', () => {
    expect(linkage).toContain("mode === 'capa'");
    expect(linkage).toContain('supplementalRationale.trim().length < 3');
    expect(linkage).toContain("link.inherited ? text('Source-owned'");
    expect(capaPage).toContain('Source inheritance and supplemental criteria');
  });

  it('enforces Patch 28 action, evidence, validation, and effectiveness closure blockers', () => {
    const blocked = evaluateUi4CapaClosure({
      can_close: false,
      has_incomplete_action_items: true,
      has_evidence_blocker: true,
      has_validation_blocker: true,
      has_effectiveness_blocker: true,
    } as never);
    expect(blocked.passed).toBe(false);
    expect(blocked.blockers).toHaveLength(4);
    expect(evaluateUi4CapaClosure({ can_close: true } as never).passed).toBe(true);
  });

  it('uses the canonical Patch 28 lifecycle for progress and workflow actions', () => {
    expect(ui4CapaProgress({ capa_status: 'closed' } as never)).toBe(100);
    expect(ui4CapaProgress({ capa_status: 'in_progress', action_item_count: 4, completed_action_item_count: 2 } as never)).toBe(50);
    expect(capaPage).toContain("'ui4_complete_capa_effectiveness'");
    expect(capaPage).toContain("'ui4_approve_capa_closure'");
    expect(capaPage).toContain('triggerGovernedDocumentReview');
  });

  it('routes every UI-4 mutation through the authenticated privileged Edge bridge', () => {
    expect(edge).toContain('ui4AuditCapaActions');
    expect(edge).toContain("serviceClient.rpc('ui4_audit_capa_workflow_bridge'");
    expect(registry).toContain('authenticated_edge_bridge');
    expect(capaPage).not.toMatch(/\.from\([^)]*\)\s*\.\s*(insert|update|delete)/s);
  });

  it('publishes canonical Audit and CAPA routes and all twenty locked workspace views', () => {
    expect(route).toContain('capa: "capa"');
    for (const view of ['dashboard','register','engagement','planning','program','findings','finding','report','followup','review']) {
      expect(auditPage).toContain(`id: '${view}'`);
    }
    for (const view of ['dashboard','register','detail','plan','implementation','verification','closure','report','analytics','review']) {
      expect(capaPage).toContain(`id: '${view}'`);
    }
  });

  it('uses semantic color tokens, logical RTL rules, and mobile record cards', () => {
    expect(auditPage).not.toMatch(/#[0-9a-f]{3,8}/i);
    expect(capaPage).not.toMatch(/#[0-9a-f]{3,8}/i);
    expect(css).toContain('var(--platform-surface-primary)');
    expect(css).toContain("[dir='rtl']");
    expect(css).toContain('@media (max-width: 560px)');
    expect(css).not.toMatch(/letter-spacing:\s*-/);
  });
});
