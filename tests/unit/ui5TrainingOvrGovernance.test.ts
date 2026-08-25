import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { getTrainingCompliancePersona } from '../../src/lib/trainingComplianceModel';

const root = process.cwd();
const source = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');
const training = source('src/pages/TrainingGovernanceCenter.tsx');
const ovr = source('src/pages/OVR.tsx');
const linkage = source('src/components/governance/GovernanceCriteriaLinkage.tsx');
const api = source('src/lib/governanceCriteriaLinkageApi.ts');
const migration = source('supabase/migrations/212_governance_criteria_linkage_foundation.sql');
const trainingLifecycle = source('supabase/migrations/205_governed_sop_training_and_competency_lifecycle.sql');
const fixtures = source('tests/e2e/ui5Fixtures.ts');
const css = source('src/styles/ui5-training-ovr.css');

describe('UI-5 Training and OVR governed workspace', () => {
  it('publishes all ten Training and ten OVR locked workspace views', () => {
    for (const view of ['dashboard', 'register', 'detail', 'catalog', 'my', 'framework', 'assessments', 'profile', 'reports', 'review']) {
      expect(training).toContain(`id: '${view}'`);
    }
    for (const view of ['dashboard', 'register', 'detail', 'report', 'investigations', 'root_cause', 'actions', 'reports', 'analytics', 'review']) {
      expect(ovr).toContain(`id: '${view}'`);
    }
  });

  it('keeps completion, acknowledgment, competency, evidence, and renewal independent', () => {
    for (const marker of [
      'Training completion',
      'Version acknowledgment',
      'Competency assessment',
      'Expiry / retraining',
      'Completion evidence',
    ]) expect(training).toContain(marker);
    expect(training).toContain("row.result === 'failed'");
    expect(training).toContain("row.result === 'needs_retraining'");
    expect(training).toContain('acknowledgmentRate');
    expect(training).toContain('competencyRate');
  });

  it('surfaces governed Policy/SOP origins and exact historical assignment versions', () => {
    expect(training).toContain('Policy-linked obligation');
    expect(training).toContain('SOP-linked obligation');
    expect(training).toContain('Governed source version');
    expect(training).toContain('selectedMatrixVersion.version_label');
    expect(fixtures).toContain('linked_document_id: index % 2 === 1');
    expect(trainingLifecycle).toContain('add column if not exists document_version_id');
    expect(trainingLifecycle).toContain('where document_version_id is not null');
  });

  it('protects employee-level training data with existing personas and scoped reads', () => {
    const employee = getTrainingCompliancePersona([{ role: 'employee', scope: 'assigned_only' }]);
    const admin = getTrainingCompliancePersona([{ role: 'super_admin', scope: 'global' }]);
    expect(employee.canViewMyObligations).toBe(true);
    expect(employee.canViewTeamCompliance).toBe(false);
    expect(admin.canViewTeamCompliance).toBe(true);
    expect(training).toContain('row.assigned_to_user_id === profileId');
  });

  it('keeps reporter Policy and SOP suggestions separate, optional, and multi-select', () => {
    expect(ovr).toContain('Related Policies');
    expect(ovr).toContain('Related SOPs');
    expect(ovr).toContain('reportPolicyIds');
    expect(ovr).toContain('reportSopIds');
    expect(ovr).toContain('type="checkbox"');
    expect(ovr).toContain('I am uncertain which governed documents apply');
    expect(ovr).toContain("relationshipOrigin: 'reporter_suggested'");
    expect(ovr).toContain('Suggestions are not confirmed findings or violations.');
  });

  it('uses occurrence-date exact-version resolution for investigator review', () => {
    expect(ovr).toContain('sourceDate: selectedReport.occurrence_date');
    expect(ovr).toContain('mode="ovr"');
    expect(linkage).toContain("mode === 'ovr'");
    expect(linkage).toContain('occurrence date');
    expect(linkage).toContain("relationshipOrigin: mode === 'ovr' ? 'investigator_confirmed'");
    expect(migration).toContain('GOV_LINK_CONFIRMED_EXACT_VERSION_REQUIRED');
  });

  it('preserves requirement/step drill-down and separate governance dimensions', () => {
    expect(linkage).toContain('View requirements');
    expect(linkage).toContain('View procedure steps');
    expect(linkage).toContain('Add requirement');
    expect(linkage).toContain('Add step');
    for (const dimension of ['Significance', 'Adherence', 'Adequacy']) expect(linkage).toContain(dimension);
    for (const value of ['control_failed_despite_compliance', 'training_competency_gap', 'missing_sop', 'emergency_justified_deviation']) {
      expect(api).toContain(value);
    }
  });

  it('retains append-only confirmation, rejection, correction, and uncertainty history', () => {
    for (const decision of ['confirmed', 'rejected', 'superseded']) expect(api).toContain(`'${decision}'`);
    expect(linkage).toContain('The previous decision remains in history. This action appends a new decision.');
    expect(linkage).toContain('Material uncertainty remains recorded');
    expect(migration).toContain('trg_governance_criteria_decisions_append_only');
  });

  it('keeps OVR root cause independent and blocks closure until review has an explicit outcome', () => {
    expect(ovr).toContain('Root cause remains separate from adherence and document-adequacy classifications');
    expect(ovr).toContain('Governance linkage review must be completed before closure.');
    expect(ovr).toContain("governanceReview?.review_status === 'completed'");
    expect(linkage).toContain('Zero-link outcomes are valid when the conclusion and rationale are explicit.');
    for (const outcome of ['confirmed_relationship', 'related_not_violated', 'no_applicable_document', 'document_gap', 'insufficient_evidence']) {
      expect(api).toContain(`'${outcome}'`);
    }
  });

  it('preserves OVR root lineage and excludes inherited/context-only links from violation truth', () => {
    expect(migration).toContain('root_event_key');
    expect(migration).toContain('root_source_entity_type');
    expect(migration).toContain('root_source_entity_id');
    expect(migration).toContain("c.significance in ('primary','contributing')");
    expect(migration).toContain("c.adherence_status in ('noncompliance','procedure_not_followed')");
    expect(fixtures).toContain('OVR root event inherited by CAPA without duplicate counting');
    expect(fixtures).toContain('OVR root event inherited by Audit without duplicate counting');
  });

  it('provides all required deterministic scenarios only in the test harness', () => {
    expect(fixtures).toContain('const ovrScenarios = [');
    const scenarioBlock = fixtures.slice(fixtures.indexOf('const ovrScenarios = ['), fixtures.indexOf('] as const;', fixtures.indexOf('const ovrScenarios = [')));
    expect(scenarioBlock.match(/^  '/gm)?.length).toBe(18);
    for (const marker of [
      'Reporter uncertain',
      'Policy suggestion only',
      'SOP suggestion only',
      'Correct compliance with control failure',
      'Missing SOP document gap',
      'Authorized emergency deviation',
      'Corrected decision supersedes',
      'Document adequacy finding linked',
    ]) expect(fixtures).toContain(marker);
    expect(training).not.toContain('ui5TrainingAssignments');
    expect(ovr).not.toContain('ui5OvrReports');
  });

  it('uses semantic tokens, RTL rules, mobile breakpoints, and no migration 215', () => {
    expect(training).not.toMatch(/#[0-9a-f]{3,8}/i);
    expect(ovr).not.toMatch(/#[0-9a-f]{3,8}/i);
    expect(css).toContain('var(--platform-surface-primary)');
    expect(css).toContain('padding-inline');
    expect(css).toContain('border-inline');
    expect(css).toContain('@media (max-width: 560px)');
    expect(css).not.toMatch(/letter-spacing:\s*-/);
    expect(fs.existsSync(path.join(root, 'supabase/migrations/215_ui5_training_ovr.sql'))).toBe(false);
  });
});
