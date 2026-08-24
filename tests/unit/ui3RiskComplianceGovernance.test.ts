import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  confirmedGovernanceLinks,
  evaluateRiskGovernanceGate,
  governanceGapCount,
  isCompletedGovernanceReview,
  isFindingAllowed,
  isRestrictedGovernanceLink,
  resultTone,
  versionResolutionLabel,
} from '../../src/lib/ui3RiskComplianceModel';

const root = process.cwd();
const source = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');
const component = source('src/components/governance/GovernanceCriteriaLinkage.tsx');
const riskPage = source('src/pages/Risks.tsx');
const compliancePage = source('src/pages/Compliance.tsx');
const api = source('src/lib/ui3RiskComplianceApi.ts');
const linkageApi = source('src/lib/governanceCriteriaLinkageApi.ts');
const migration = source('supabase/migrations/213_ui3_risk_compliance_governance.sql');
const linkageMigration = source('supabase/migrations/212_governance_criteria_linkage_foundation.sql');
const edge = source('supabase/functions/privileged-action/index.ts');
const css = source('src/styles/ui3-risk-compliance.css');
const riskAudit = source('scripts/patch22-risk-workflow-audit.mjs');

const completedReview = {
  id: 'review', review_status: 'completed', review_outcome: 'no_applicable_document', review_rationale: 'No governed document applies.',
} as never;

const link = (decisionType: string, adequacy = 'adequate') => ({
  link_id: `${decisionType}-${adequacy}`,
  decision_type: decisionType,
  adequacy_status: adequacy,
  target_display_label: 'POL-001 Policy',
}) as never;

describe('UI-3 Risk, Compliance, and governance criteria linkage', () => {
  it('1. renders separate searchable Policy and SOP selectors', () => {
    expect(component).toContain("text('Related Policies'");
    expect(component).toContain("text('Related SOPs'");
    expect(component).toContain('policySearch');
    expect(component).toContain('sopSearch');
    expect(component).not.toContain('Policy / SOP');
  });

  it('2. supports multiple Policy selections', () => {
    expect(component).toContain('selectedPolicies');
    expect(component).toContain('toggleSet(current, policy.document_id)');
    expect(component).toContain("policies.filter((item) => selectedPolicies.has(item.document_id))");
    expect(component).toContain('for (const choice of choices)');
  });

  it('3. supports multiple SOP selections', () => {
    expect(component).toContain('selectedSops');
    expect(component).toContain('toggleSet(current, sop.document_id)');
    expect(component).toContain("sops.filter((item) => selectedSops.has(item.document_id))");
    expect(component).toContain('for (const choice of choices)');
  });

  it('4. allows Policy and SOP links on the same Risk source', () => {
    expect(component).toContain("source.type === 'compliance_assessment'");
    expect(component).toContain('targetCriterionType: kind,');
    expect(riskPage).toContain("type: 'risk'");
  });

  it('5. permits a governed no-applicable-document review outcome with rationale', () => {
    expect(isCompletedGovernanceReview(completedReview)).toBe(true);
    expect(component).toContain("'no_applicable_document'");
    expect(component).toContain('reviewRationale.trim().length < 3');
  });

  it('6. blocks High and Critical Risk approval until governance review completes', () => {
    expect(evaluateRiskGovernanceGate({ risk_level: 'high' } as never, null).canApprove).toBe(false);
    expect(evaluateRiskGovernanceGate({ risk_level: 'critical' } as never, completedReview).canApprove).toBe(true);
    expect(migration).toContain('UI3_RISK_GOVERNANCE_REVIEW_REQUIRED');
  });

  it('7. renders Risk history against an immutable reassessment revision identity', () => {
    expect(riskPage).toContain('selectedRevision.id');
    expect(riskPage).toContain('Reassessment Governance Context');
    expect(riskPage).toContain('immutable scoring snapshot');
    expect(migration).toContain('governance_review_id uuid');
  });

  it('8. keeps Compliance obligation structurally distinct from finding', () => {
    expect(migration).toContain('create table if not exists public.compliance_assessments');
    expect(migration).toContain('create table if not exists public.compliance_findings');
    expect(migration).toContain('obligation_id uuid not null');
    expect(compliancePage).toContain('It is not the obligation and not the remediation action.');
  });

  it('9. maps an obligation assessment to a governed Policy', () => {
    expect(component).toContain("mode: 'risk' | 'compliance'");
    expect(component).toContain('targetCriterionType: kind,');
    expect(compliancePage).toContain('requiredObligationId={selected.id}');
  });

  it('10. maps an obligation assessment to a governed SOP', () => {
    expect(component).toContain("addDocuments(kind: 'policy' | 'sop')");
    expect(component).toContain('getGovernedSopDetail');
    expect(component).toContain('SopProcedureStep');
  });

  it('11. uses governed Compliance finding and assessment decisions', () => {
    expect(compliancePage).toContain('decideUi3ComplianceAssessment');
    expect(compliancePage).toContain('recordUi3ComplianceFinding');
    expect(migration).toContain("'assessment_approved'");
    expect(migration).toContain("'finding_recorded'");
  });

  it('12. preserves restricted document redaction', () => {
    expect(isRestrictedGovernanceLink({ target_display_label: '[restricted]' })).toBe(true);
    expect(component).toContain('Restricted governance document');
    expect(linkageApi).not.toMatch(/policy_statement|action_instruction|requirement_statement/);
  });

  it('13. preserves rejected linkage as append-only history', () => {
    expect(component).toContain("<option value=\"rejected\"");
    expect(linkageMigration).toContain('trg_governance_criteria_decisions_append_only');
    expect(migration).toContain('trg_ui3_compliance_events_immutable');
  });

  it('14. preserves correction and supersession history', () => {
    expect(component).toContain("<option value=\"superseded\"");
    expect(component).toContain('immutable decisions');
    expect(linkageApi).toContain('getGovernanceCriteriaDecisionHistory');
  });

  it('15. never counts a suggestion as confirmation', () => {
    expect(confirmedGovernanceLinks([link('suggested'), link('confirmed')])).toHaveLength(1);
    expect(governanceGapCount([link('suggested', 'missing_policy')])).toBe(0);
  });

  it('16. preserves UI and database permissions', () => {
    expect(riskPage).toContain('canManage');
    expect(compliancePage).toContain('canApprove');
    expect(migration).toContain('enable row level security');
    expect(migration).not.toMatch(/grant (insert|update|delete)[^;]+authenticated/i);
    expect(edge).toContain("'ui3_risk_compliance_workflow_bridge'");
  });

  it('17. converts the Risk register to mobile record cards', () => {
    expect(css).toContain('@media (max-width: 560px)');
    expect(css).toContain('.ui3-risk-table .ui3-table-row');
    expect(css).toContain('grid-template-columns: repeat(2, minmax(0, 1fr))');
  });

  it('18. converts the Compliance register to mobile record cards', () => {
    expect(css).toContain('.ui3-compliance-table .ui3-table-row');
    expect(compliancePage).toContain('data-testid="ui3-compliance-register"');
  });

  it('19. uses semantic tokens for dark Risk rendering', () => {
    expect(riskPage).not.toMatch(/#[0-9a-f]{3,8}/i);
    expect(css).toContain('var(--platform-surface-primary)');
    expect(css).toContain('var(--platform-text-primary)');
  });

  it('20. uses semantic tokens for dark Compliance rendering', () => {
    expect(compliancePage).not.toMatch(/#[0-9a-f]{3,8}/i);
    expect(css).toContain('var(--platform-border-default)');
  });

  it('21. provides Arabic Risk labels and logical RTL styling', () => {
    expect(riskPage).toContain("ar: 'سياق الحوكمة'");
    expect(riskPage).toContain("title={t('risks.title')}");
    expect(css).toContain("[dir='rtl']");
    expect(css).toContain('border-inline-start');
  });

  it('22. provides Arabic Compliance labels and logical RTL styling', () => {
    expect(compliancePage).toContain("ar: 'الالتزام وأساس الحوكمة الداخلية'");
    expect(compliancePage).toContain("title={t('compliance.title')}");
    expect(css).not.toMatch(/letter-spacing:\s*-/);
  });

  it('23. reads the canonical accreditation clause columns', () => {
    expect(api).toContain(".select('id, clause_code, clause_title, active')");
    expect(api).not.toContain(".select('id, clause_code, clause_number, clause_title, title, active')");
  });

  it('normalizes assessment result and finding eligibility without conflating records', () => {
    expect(resultTone('compliant')).toBe('success');
    expect(resultTone('noncompliant')).toBe('danger');
    expect(isFindingAllowed('partial_compliance')).toBe(true);
    expect(isFindingAllowed('compliant')).toBe(false);
  });

  it('publishes migration 213 capability and exact-version resolver diagnostics', () => {
    expect(migration).toContain("'schema_version', 213");
    expect(migration).toContain("'compliance_assessment_source_available', true");
    expect(versionResolutionLabel('overlapping_candidates')).toBe('Overlapping approved versions require review');
    expect(api).toContain("selectRows<Ui3ComplianceObligation>('v_ui3_compliance_obligation_register'");
  });

  it('keeps the Patch 22 workflow audit aligned with the accepted UI-3 risk contract', () => {
    for (const marker of ['Governed risk workflow', 'Governance review required', 'GovernedDecisionDialog', 'decideUi3RiskReassessment']) {
      expect(riskAudit).toContain(marker);
    }
    expect(riskAudit).not.toContain("'Patch 22 workflow queues'");
  });
});
