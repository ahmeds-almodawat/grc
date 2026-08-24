import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');
const migration = read('supabase/migrations/212_governance_criteria_linkage_foundation.sql');
const edge = read('supabase/functions/privileged-action/index.ts');
const api = read('src/lib/governanceCriteriaLinkageApi.ts');
const edgeRoute = edge.slice(
  edge.indexOf('if (governanceCriteriaLinkageActions.has(action))'),
  edge.indexOf("if (action === 'record_document_acknowledgment')"),
);

describe('GOV-LINK-1 normalized and immutable foundation', () => {
  it('creates the five normalized objects without changing F1/F2 migrations', () => {
    for (const table of [
      'governance_linkage_reviews',
      'governance_criteria_links',
      'governance_criteria_link_decisions',
      'governance_criteria_link_lineage',
      'governance_criteria_link_evidence',
    ]) expect(migration).toContain(`create table if not exists public.${table}`);
    expect(migration).toContain('public.document_links');
    expect(migration).not.toContain('v210_grc_relationships');
  });

  it('locks supported source and target vocabularies to canonical entities', () => {
    for (const source of ['ovr', 'risk', 'audit_finding', 'capa']) expect(migration).toContain(`'${source}'`);
    for (const target of [
      'policy', 'policy_requirement', 'sop', 'sop_step',
      'compliance_obligation', 'accreditation_clause', 'control',
    ]) expect(migration).toContain(`'${target}'`);
    expect(migration).not.toMatch(/create table[^;]+(protocol|management_decision|compliance_finding)/i);
  });

  it('validates source existence, revisions, organization, and exact target containment', () => {
    for (const marker of [
      'GOV_LINK_SOURCE_NOT_FOUND',
      'GOV_LINK_RISK_REVISION_MISMATCH',
      'GOV_LINK_SOURCE_CROSS_ORGANIZATION_DENIED',
      'GOV_LINK_TARGET_CROSS_ORGANIZATION_DENIED',
      'GOV_LINK_POLICY_REQUIREMENT_VERSION_MISMATCH',
      'GOV_LINK_SOP_STEP_VERSION_MISMATCH',
      'GOV_LINK_APPROVED_LOCKED_VERSION_REQUIRED',
    ]) expect(migration).toContain(marker);
  });

  it('keeps adherence and adequacy separate with exact decision vocabularies', () => {
    expect(migration).toContain('adherence_status text');
    expect(migration).toContain('adequacy_status text');
    for (const value of [
      'procedure_not_followed', 'emergency_justified_deviation', 'unknown',
      'obsolete_version_used', 'training_competency_gap', 'control_failed_despite_compliance', 'not_assessed',
    ]) expect(migration).toContain(`'${value}'`);
  });

  it('makes links, decisions, lineage, and evidence history immutable', () => {
    expect(migration.match(/execute function public\.reject_governance_link_mutation\(\)/g)?.length).toBe(4);
    expect(migration).toContain('trg_governance_criteria_decisions_append_only');
    expect(migration).toContain('trg_governance_link_lineage_immutable');
    expect(migration).toContain('GOV_LINK_LINEAGE_CYCLE_DENIED');
  });

  it('separates suggestion from confirmation and requires a human review decision', () => {
    expect(migration).toContain("'suggested', p_actor_id");
    expect(migration).toContain("p_decision_type not in ('under_review','confirmed','rejected','superseded')");
    expect(migration).toContain('GOV_LINK_HUMAN_CONFIRMATION_REQUIRED');
    expect(migration).toContain('GOV_LINK_REVIEW_AUTHORITY_REQUIRED');
  });

  it('retains historical versions and diagnoses resolver ambiguity and gaps', () => {
    for (const status of [
      'missing_source_date', 'zero_candidates', 'expired_version',
      'superseded_or_obsolete_version', 'department_not_applicable',
      'exactly_one', 'overlapping_candidates', 'facility_scope_unavailable',
    ]) expect(migration).toContain(`'${status}'`);
    expect(migration).toContain('resolution_snapshot jsonb not null');
    expect(migration).toContain('GOV_LINK_CONFIRMED_EXACT_VERSION_REQUIRED');
    expect(migration).not.toMatch(/update public\.governance_criteria_links[\s\S]{0,100}target_version_id/i);
  });

  it('permits only governed reviewer overrides with a rationale', () => {
    expect(migration).toContain("p_resolution_method = 'reviewer_override'");
    expect(migration).toContain('GOV_LINK_OVERRIDE_RATIONALE_REQUIRED');
    expect(migration).toContain('GOV_LINK_APPROVED_LOCKED_VERSION_REQUIRED');
  });

  it('preserves root identity and distinct Policy plus SOP attribution', () => {
    expect(migration).toContain('root_source_entity_type');
    expect(migration).toContain('root_source_entity_id');
    expect(migration).toContain('GOV_LINK_LINEAGE_ROOT_IDENTITY_MISMATCH');
    expect(migration).toContain('root_event_key');
    expect(migration).toContain('uq_governance_criteria_review_target');
  });

  it('backfills F1 as context-only unknown/not-assessed continuity', () => {
    expect(migration).toContain("'legacy_f1'");
    expect(migration).toContain("'confirmed', 'context_only', 'unknown', 'not_assessed'");
    expect(migration).toContain("'classification', 'continuity_only'");
    expect(migration).toContain('no adherence, violation, or adequacy finding was inferred');
  });

  it('derives current truth from latest append-only decisions and excludes legacy context from violations', () => {
    expect(migration).toContain('create or replace view public.v_current_governance_criteria_links');
    expect(migration).toContain('create or replace view public.v_governance_linkage_review_queue');
    expect(migration).toContain('create or replace view public.v_confirmed_governance_criteria_truth');
    expect(migration).toContain("c.significance in ('primary','contributing')");
    expect(migration).toContain("c.adherence_status in ('noncompliance','procedure_not_followed')");
  });

  it('enables RLS, revokes browser DML, denies anon/PUBLIC, and uses invoker views', () => {
    expect(migration.match(/enable row level security/g)?.length).toBe(5);
    expect(migration.match(/with \(security_invoker = true\)/g)?.length).toBe(3);
    expect(migration.match(/revoke all on table public\.governance_/g)?.length).toBe(5);
    expect(migration).not.toMatch(/grant (insert|update|delete)[^;]+authenticated/i);
    expect(migration).toContain("then '[restricted]'");
    expect(migration).not.toMatch(/policy_statement|action_instruction|requirement_statement/);
  });

  it('keeps every authoritative RPC service-role only', () => {
    for (const routine of [
      'start_governance_linkage_review',
      'suggest_governance_criterion_link',
      'append_governance_criterion_decision',
      'supersede_governance_criterion_link',
      'complete_governance_linkage_review',
    ]) {
      expect(migration).toContain(`grant execute on function public.${routine}`);
      expect(edgeRoute).toContain(`'${routine}'`);
    }
    expect(edgeRoute).toContain('p_actor_id: userData.user.id');
    expect(edgeRoute).toContain('GOV_LINK_MIGRATION_212_REQUIRED');
    expect(edgeRoute).toContain('const rlsClient = createClient(supabaseUrl, anonKey');
    expect(edgeRoute).toContain('Authorization: `Bearer ${token}`');
    expect(edgeRoute).toContain("'x-patch83u-frontend-contract-version': PATCH83U_FRONTEND_CONTRACT_VERSION");
    expect(edgeRoute).toContain("const visibleDocument = await rlsClient");
  });

  it('uses module-aware authority without adding a platform role', () => {
    for (const role of ['super_admin', 'governance_admin', 'compliance_officer', 'department_manager', 'auditor']) {
      expect(migration).toContain(`'${role}'`);
    }
    expect(migration).toContain("p_source_entity_type = 'audit_finding'");
    expect(migration).toContain("p_source_entity_type = 'risk'");
    expect(migration).toContain("p_source_entity_type = 'capa'");
    expect(migration).not.toMatch(/alter type public\.app_role add value/i);
  });

  it('publishes the focused typed API without touching a UI page', () => {
    for (const contract of [
      'GovernanceLinkageReview', 'GovernanceCriteriaLink', 'GovernanceCriteriaDecision',
      'GovernanceVersionResolverCandidate', 'GovernanceLinkLineage',
      'GovernanceLinkEvidence', 'ConfirmedGovernanceCriteriaTruth',
    ]) expect(api).toContain(`interface ${contract}`);
    expect(api).toContain(".from('v_current_governance_criteria_links')");
    expect(api).toContain("invokePrivilegedAction('append_governance_criterion_decision'");
  });
});
