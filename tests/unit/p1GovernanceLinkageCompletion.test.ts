import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');
const migration = read('supabase/migrations/218_p1_governance_linkage_completion.sql');
const api = read('src/lib/governanceCriteriaLinkageApi.ts');
const component = read('src/components/governance/GovernanceCriteriaLinkage.tsx');
const compliance = read('src/pages/Compliance.tsx');
const edge = read('supabase/functions/privileged-action/index.ts');

describe('P1 shared governance-link completion', () => {
  it('makes compliance findings first-class sources without creating another link model', () => {
    expect(migration).toContain("'compliance_assessment','compliance_finding'");
    expect(migration).toContain("p_source_entity_type = 'compliance_finding'");
    expect(migration).toContain('join public.compliance_assessments a on a.id = f.assessment_id');
    expect(migration).toContain("p_source_type in ('ovr','risk','audit_finding','compliance_assessment','compliance_finding')");
    expect(migration).not.toMatch(/create table[^;]+governance[^;]+link/i);
  });

  it('retains module-aware authority and direct CAPA provenance', () => {
    expect(migration).toContain("ur.role::text = 'compliance_officer'");
    expect(migration).toContain('f.responsible_owner_id, f.created_by, f.reviewed_by');
    expect(migration).toContain("return query select p_source_type, p_source_id");
    expect(migration).not.toContain("return query select 'compliance_assessment'::text, f.assessment_id");
  });

  it('orders append-only truth by a monotonic sequence inside one transaction', () => {
    expect(migration).toContain('decision_sequence bigint generated always as identity');
    expect(migration).toContain('order by decision.link_id, decision.decision_sequence desc');
    expect(migration).not.toContain('order by decision.link_id, decision.decided_at desc, decision.id desc');
  });

  it('publishes RLS-scoped raw analytics with the required dimensions', () => {
    expect(migration).toContain('create or replace view public.v_governance_link_analytics_events');
    expect(migration).toContain('create or replace view public.v_governance_link_analytics_summary');
    for (const field of [
      'suspected_event_count', 'confirmed_event_count', 'high_critical_event_count',
      'department_count', 'recurring_source_count', 'recurrence_after_effective_capa_count',
      'training_gap_count', 'document_gap_count', 'execution_gap_count',
    ]) expect(migration).toContain(field);
    expect(migration).toContain('normalized_rate_available');
    expect(migration).toContain('No canonical exposure denominator is available');
  });

  it('opens review only through a service-only governed evaluator', () => {
    expect(migration).toContain('create or replace function public.evaluate_governance_document_review_trigger');
    expect(migration).toContain('perform public.governance_linkage_require_service_role()');
    expect(migration).toContain("'governance_pattern'");
    expect(migration).toContain('Review only; no revision is automatic.');
    expect(migration).toContain('grant execute on function public.evaluate_governance_document_review_trigger(uuid, uuid, date) to service_role');
    expect(migration).not.toMatch(/evaluate_governance_document_review_trigger[\s\S]+update public\.controlled_documents/i);
  });

  it('wires the accepted Compliance surface and privileged boundary without redesign', () => {
    expect(api).toContain("'compliance_finding'");
    expect(api).toContain("invokePrivilegedAction('evaluate_governance_document_review_trigger'");
    expect(component).toContain("'compliance_finding'");
    expect(compliance).toContain("type: 'compliance_finding'");
    expect(compliance).toContain("type: 'compliance_assessment'");
    expect(edge).toContain("'evaluate_governance_document_review_trigger'");
    expect(edge).toContain("new Set(['document_id', 'due_date'])");
    expect(edge).toContain('p_actor_id: userData.user.id');
  });
});
