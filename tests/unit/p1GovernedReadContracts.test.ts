import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');
const migration = read('supabase/migrations/217_p1_governed_read_contracts.sql');
const policySopApi = read('src/lib/policySopApi.ts');
const grcApi = read('src/lib/grcApi.ts');
const governancePage = read('src/pages/Governance.tsx');

describe('P1 governed read contracts', () => {
  it('restores only authenticated reads for the proven RLS-protected tables', () => {
    for (const table of [
      'accreditation_clause_review_tasks',
      'audit_findings',
      'capa_action_plans',
      'committee_decisions',
      'compliance_items',
      'policy_requirements',
      'risks',
      'sop_procedure_steps',
    ]) {
      expect(migration).toContain(`grant select on table public.${table} to authenticated, service_role`);
      expect(migration).toContain(`revoke select on table public.${table} from anon`);
    }
    expect(migration).not.toMatch(/grant\s+(insert|update|delete|all)[^;]+authenticated/i);
  });

  it('secures trusted accreditation aggregates as invoker views', () => {
    for (const view of [
      'v_accreditation_readiness_summary',
      'v_accreditation_requirement_matrix',
      'v_accreditation_gap_dashboard',
    ]) {
      expect(migration).toContain(`alter view public.${view} set (security_invoker = true)`);
      expect(migration).toContain(`grant select on public.${view} to authenticated, service_role`);
    }
  });

  it('recreates the expected critical-attention feed from canonical governed sources', () => {
    expect(migration).toContain('create or replace view public.v_critical_attention_items');
    expect(migration).toContain('with (security_invoker = true)');
    for (const source of [
      'public.projects',
      'public.risks',
      'public.compliance_obligations',
      'public.audit_findings',
      'public.capa_action_plans',
      'public.committee_decisions',
      'public.ovr_reports',
    ]) expect(migration).toContain(source);
  });

  it('publishes recent activity only from governed decision histories', () => {
    expect(migration).toContain('create or replace view public.v_recent_governed_activity');
    expect(migration).toContain('public.committee_decisions');
    expect(migration).toContain('public.governed_document_review_triggers');
    expect(migration).toContain('public.governance_criteria_link_decisions');
    expect(migration).toContain('revoke all on public.v_recent_governed_activity from public, anon');
    expect(grcApi).toContain(".from('v_recent_governed_activity')");
    expect(governancePage).toContain('getRecentGovernedActivity');
  });

  it('uses the canonical profile active-state field', () => {
    const listProfiles = policySopApi.slice(
      policySopApi.indexOf('export async function listProfiles'),
      policySopApi.indexOf('export async function listRoles'),
    );
    expect(listProfiles).toContain(".eq('is_active', true)");
    expect(listProfiles).not.toContain(".eq('active_flag', true)");
  });
});
