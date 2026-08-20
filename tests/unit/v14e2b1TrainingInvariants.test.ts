import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('GRC v1.4-E2B1 Governed SOP Training & Competency Invariants', () => {
  const rootDir = process.cwd();
  const migration205Path = path.resolve(
    rootDir,
    'supabase/migrations/205_governed_sop_training_and_competency_lifecycle.sql'
  );
  const edgeIndexPath = path.resolve(
    rootDir,
    'supabase/functions/privileged-action/index.ts'
  );
  const patch83uScriptPath = path.resolve(
    rootDir,
    'scripts/patch83u-auth-surface-proof.mjs'
  );

  it('Migration 205 SQL file exists and contains all required E2B1 schema definitions', () => {
    expect(fs.existsSync(migration205Path)).toBe(true);
    const sql = fs.readFileSync(migration205Path, 'utf8');

    // 1. Rollout decision columns
    expect(sql).toContain('alter table public.governed_sop_details');
    expect(sql).toContain('add column if not exists retraining_required boolean');
    expect(sql).toContain('add column if not exists reacknowledgment_required boolean');
    expect(sql).toContain('add column if not exists competency_reassessment_required boolean');
    expect(sql).toContain('add column if not exists rollout_decision_rationale text');
    expect(sql).toContain('add column if not exists rollout_decided_by uuid');
    expect(sql).toContain('add column if not exists rollout_decided_at timestamptz');

    // 2. Narrow training target scopes table
    expect(sql).toContain('create table if not exists public.sop_version_training_target_scopes');
    expect(sql).toContain('sop_version_id uuid not null references public.document_versions(id) on delete cascade');
    expect(sql).toContain('scope_type in (\'department\', \'role\')');
    expect(sql).toContain('alter table public.sop_version_training_target_scopes enable row level security');

    // 3. Training assignments extension & invariants
    expect(sql).toContain('alter table public.training_assignments');
    expect(sql).toContain('document_version_id uuid references public.document_versions(id) on delete restrict');
    expect(sql).toContain('obligation_cycle integer default 1');
    expect(sql).toContain('cycle_type in (\'initial\', \'retraining\', \'renewal\')');
    expect(sql).toContain('idx_training_assignments_version_cycle_uniq');

    // 4. Competency assessments SOD constraint
    expect(sql).toContain('chk_competency_no_self_assessment');
    expect(sql).toContain('assessor_user_id is null or user_id <> assessor_user_id');

    // 5. Document acknowledgment requirements uniqueness indexes
    expect(sql).toContain('idx_doc_ack_req_ver_all_uniq');
    expect(sql).toContain('idx_doc_ack_req_ver_dept_uniq');
    expect(sql).toContain('idx_doc_ack_req_ver_role_uniq');
    expect(sql).toContain('idx_doc_ack_req_ver_user_uniq');

    // 6. Governed RPCs & View
    expect(sql).toContain('create or replace function public.decide_sop_rollout_requirements(');
    expect(sql).toContain('create or replace function public.publish_sop_training_obligations(');
    expect(sql).toContain('create or replace function public.reconcile_sop_training_population(');
    expect(sql).toContain('create or replace function public.record_competency_assessment(');
    expect(sql).toContain('create or replace function public.start_governed_document_revision(');
    expect(sql).toContain('create or replace view public.v_sop_training_compliance_matrix');
    expect(sql).toContain('with (security_invoker = true)');
  });

  it('Migration 205 strictly preserves historical audit evidence (no CASCADE delete on version-bound assignments)', () => {
    const sql = fs.readFileSync(migration205Path, 'utf8');
    expect(sql).toContain('document_version_id uuid references public.document_versions(id) on delete restrict');
    expect(sql).not.toMatch(/training_assignments[\s\S]*?document_version_id[\s\S]*?on delete cascade/i);
  });

  it('Migration 205 preserves legacy non-SOP assignments (no global document_version_id NOT NULL)', () => {
    const sql = fs.readFileSync(migration205Path, 'utf8');
    expect(sql).not.toContain('document_version_id uuid not null');
  });

  it('Migration 205 does NOT permit reconciliation as a cycle_type', () => {
    const sql = fs.readFileSync(migration205Path, 'utf8');
    expect(sql).toContain("cycle_type in ('initial', 'retraining', 'renewal')");
    expect(sql).not.toMatch(/cycle_type\s*in\s*\([^)]*reconciliation[^)]*\)/i);
  });

  it('Migration 205 resets rollout decisions upon starting a new document revision', () => {
    const sql = fs.readFileSync(migration205Path, 'utf8');
    expect(sql).toMatch(/false,\s*true,\s*false,\s*null,\s*null,\s*null/);
  });

  it('Migration 209 exists exactly once with the E2B3 filename', () => {
    const migration209 = fs.readdirSync(path.resolve(rootDir, 'supabase/migrations'))
      .filter(f => f.startsWith('209_'));
    expect(migration209).toEqual(['209_e2b3_training_population_reconciliation.sql']);
  });

  it('Edge privileged-action allowlists all required Patch26 and Patch29 operational actions', () => {
    const edgeSource = fs.readFileSync(edgeIndexPath, 'utf8');
    expect(edgeSource).toContain('const patch26DocumentActions = new Set([');
    expect(edgeSource).toContain('record_document_acknowledgment');
    expect(edgeSource).toContain('const patch29TrainingActions = new Set([');
    expect(edgeSource).toContain('decide_sop_rollout_requirements');
    expect(edgeSource).toContain('publish_sop_training_obligations');
    expect(edgeSource).toContain('reconcile_sop_training_population');
    expect(edgeSource).toContain('start_training_assignment');
    expect(edgeSource).toContain('complete_training_assignment');
    expect(edgeSource).toContain('record_competency_assessment');
    expect(edgeSource).toContain('waive_training_assignment_with_reason');
    expect(edgeSource).toContain('cancel_training_assignment_with_reason');
    expect(edgeSource).toContain('reopen_training_assignment_with_reason');
  });

  it('Patch83U proof reviewed ceiling is set to 209', () => {
    const content = fs.readFileSync(patch83uScriptPath, 'utf8');
    expect(content).toContain('const reviewedPatch83uMigrationCeiling = 209;');
  });

  it('Migration 205 restricts rollout decision authority strictly to Quality and Governance authorities', () => {
    const sql = fs.readFileSync(migration205Path, 'utf8');
    expect(sql).toContain("role::text in ('super_admin', 'governance_admin', 'compliance_officer', 'quality_director')");
  });

  it('Migration 205 mandates explicit rollout governance decision before publishing revision obligations', () => {
    const sql = fs.readFileSync(migration205Path, 'utf8');
    expect(sql).toContain('ROLLOUT_DECISION_REQUIRED: Governed rollout requirements must be decided prior to publishing revision obligations');
  });

  it('Migration 205 reconciles scope-transferred active employees and cancels open uncompleted assignments', () => {
    const sql = fs.readFileSync(migration205Path, 'utf8');
    expect(sql).toContain('cancelled_out_of_scope_count');
    expect(sql).toContain("status in ('assigned', 'in_progress')");
  });

  it('Migration 205 hardens complete_training_assignment with formal authority and cross-org validation', () => {
    const sql = fs.readFileSync(migration205Path, 'utf8');
    expect(sql).toContain('create or replace function public.complete_training_assignment(');
    expect(sql).toContain('UNAUTHORIZED_TRAINING_COMPLETER');
    expect(sql).toContain('CROSS_ORGANIZATION_DENIED');
  });
});
