import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

describe('GRC v1.4-E2B2 Migration 208 Training Authorization Invariants', () => {
  const rootDir = process.cwd();
  const migrationsDir = path.resolve(rootDir, 'supabase/migrations');
  const migration207Path = path.resolve(
    migrationsDir,
    '207_governed_sop_runtime_contract_remediation.sql'
  );
  const migration208Path = path.resolve(
    migrationsDir,
    '208_e2b2_training_authorization_and_compliance_contract_remediation.sql'
  );
  const patch83uScriptPath = path.resolve(
    rootDir,
    'scripts/patch83u-auth-surface-proof.mjs'
  );
  const verifyMigrationsScriptPath = path.resolve(
    rootDir,
    'scripts/verify-migrations.mjs'
  );
  const sqlProofPath = path.resolve(
    rootDir,
    'tests/sql/v14e2b2_migration208_authorization_invariants_proof.sql'
  );

  const sql208 = fs.readFileSync(migration208Path, 'utf8');

  it('01: Migration 208 exists exactly once and Migration 209 is absent', () => {
    expect(fs.existsSync(migration208Path)).toBe(true);
    const m208Files = fs.readdirSync(migrationsDir).filter(f => f.startsWith('208_'));
    expect(m208Files).toHaveLength(1);
    expect(m208Files[0]).toBe('208_e2b2_training_authorization_and_compliance_contract_remediation.sql');

    const m209Files = fs.readdirSync(migrationsDir).filter(f => f.startsWith('209_'));
    expect(m209Files).toHaveLength(0);
  });

  it('02: Migration 207 integrity hash is unchanged', () => {
    expect(fs.existsSync(migration207Path)).toBe(true);
    const sql207 = fs.readFileSync(migration207Path, 'utf8');
    const hash = crypto.createHash('sha256').update(sql207).digest('hex');
    expect(hash.toLowerCase()).toBe(
      '8a8fd669be55e110cc0b4948df71787ab2fce33d76d50912f6ca0043af8ebd51'
    );
  });

  it('03: Browser DML is explicitly revoked on all 8 governed training tables', () => {
    const governedTables = [
      'training_programs',
      'training_assignments',
      'training_acknowledgments',
      'competency_assessments',
      'training_events',
      'document_acknowledgment_requirements',
      'document_acknowledgments',
      'sop_version_training_target_scopes',
    ];

    for (const table of governedTables) {
      expect(sql208).toMatch(new RegExp(`revoke all on table public\\.${table} from`, 'i'));
    }

    const dmlRevokedTables = [
      'training_programs',
      'training_assignments',
      'training_acknowledgments',
      'competency_assessments',
      'document_acknowledgment_requirements',
      'document_acknowledgments',
      'sop_version_training_target_scopes',
    ];

    for (const table of dmlRevokedTables) {
      expect(sql208).toContain(
        `revoke insert, update, delete, truncate, references, trigger on table public.${table} from authenticated;`
      );
      expect(sql208).toContain(`grant select on table public.${table} to authenticated;`);
    }
  });

  it('04: training_events direct browser access is completely revoked', () => {
    expect(sql208).toContain('revoke all on table public.training_events from public, anon, authenticated;');
    expect(sql208).toContain('grant all on table public.training_events to service_role;');
    expect(sql208).toContain('drop policy if exists "grc_training_events_select_policy" on public.training_events;');
    expect(sql208).not.toMatch(/grant select on table public\.training_events to authenticated/i);
  });

  it('05: Obsolete permissive browser write policies are dropped and Patch83U restrictive gate is preserved', () => {
    expect(sql208).toContain('drop policy if exists "grc_training_programs_all_policy" on public.training_programs;');
    expect(sql208).toContain('drop policy if exists "grc_training_assignments_all_policy" on public.training_assignments;');
    expect(sql208).toContain('drop policy if exists "grc_training_acknowledgments_insert_policy" on public.training_acknowledgments;');
    expect(sql208).toContain('drop policy if exists "grc_competency_assessments_all_policy" on public.competency_assessments;');
    expect(sql208).toContain('drop policy if exists "document_ack_req_org_write_patch26" on public.document_acknowledgment_requirements;');
    expect(sql208).toContain('drop policy if exists "document_ack_org_write_patch26" on public.document_acknowledgments;');

    // Restrictive Patch83U gate must NOT be dropped
    expect(sql208).not.toContain('drop policy if exists patch83u_credential_gate');
    expect(sql208).not.toContain('drop policy patch83u_credential_gate');
  });

  it('06: training_programs SELECT policy enforces organization safety', () => {
    expect(sql208).toContain('create policy "grc_training_programs_select_policy" on public.training_programs');
    expect(sql208).toContain('owner_user_id = auth.uid()');
    expect(sql208).toContain('ta.assigned_to_user_id = auth.uid()');
    expect(sql208).toContain('cd.organization_id = actor_p.organization_id');
  });

  it('07: training_assignments SELECT policy requires employee self-only or exact active department/division/global scope', () => {
    expect(sql208).toContain('create policy "grc_training_assignments_select_policy" on public.training_assignments');
    expect(sql208).toContain('assigned_to_user_id = auth.uid()');
    expect(sql208).toContain("ur.role = 'department_manager'");
    expect(sql208).toContain("ur.scope = 'department'");
    expect(sql208).toContain('p.department_id = ur.department_id');
    expect(sql208).toContain("ur.role = 'division_head'");
    expect(sql208).toContain("ur.scope = 'division'");
    expect(sql208).toContain('p.division_id = ur.division_id');
    expect(sql208).toContain("ur.role in ('super_admin', 'executive', 'governance_admin', 'auditor', 'compliance_officer')");
    expect(sql208).toContain("ur.scope = 'global'");
    expect(sql208).toContain('p.organization_id = ur.organization_id');
  });

  it('08: competency_assessments and acknowledgments SELECT policies enforce exact scope and organization match', () => {
    expect(sql208).toContain('create policy "grc_competency_assessments_select_policy" on public.competency_assessments');
    expect(sql208).toContain('user_id = auth.uid()');
    expect(sql208).toContain('assessor_user_id = auth.uid()');

    expect(sql208).toContain('create policy "grc_training_acknowledgments_select_policy" on public.training_acknowledgments');
    expect(sql208).toContain('create policy "document_ack_org_read_patch26" on public.document_acknowledgments');
  });

  it('09: start_training_assignment RPC requires assignment owner and active profile in startable state', () => {
    expect(sql208).toContain('create or replace function public.start_training_assignment(');
    expect(sql208).toContain('UNAUTHORIZED_TRAINING_STARTER: Only assignment owner may start training');
    expect(sql208).toContain('ACTOR_INACTIVE: Actor profile is not active or does not exist');
    expect(sql208).toContain("status = 'in_progress'");
  });

  it('10: complete_training_assignment RPC enforces formal certifier controls (no executive, no auditor, no self-certification for formal)', () => {
    expect(sql208).toContain('create or replace function public.complete_training_assignment(');
    expect(sql208).toContain('UNAUTHORIZED_TRAINING_COMPLETER');
    expect(sql208).toContain("ur.role in ('super_admin', 'governance_admin', 'compliance_officer')");
    expect(sql208).toContain("ur.role = 'department_manager'");
    expect(sql208).not.toMatch(/complete_training_assignment[\s\S]*?'executive'[\s\S]*?into v_has_auth/i);
    expect(sql208).not.toMatch(/complete_training_assignment[\s\S]*?'auditor'[\s\S]*?into v_has_auth/i);
    expect(sql208).not.toContain('quality_director');
    expect(sql208).not.toContain('training_coordinator');
  });

  it('11: record_competency_assessment RPC enforces segregation of duties and excludes executive/auditor as assessors', () => {
    expect(sql208).toContain('create or replace function public.record_competency_assessment(');
    expect(sql208).toContain('SOD_VIOLATION_SELF_ASSESSMENT: Employees cannot assess their own competency');
    expect(sql208).toContain('UNAUTHORIZED_ASSESSOR');
    expect(sql208).toContain("ur.role in ('super_admin', 'governance_admin', 'compliance_officer')");
    expect(sql208).toContain("ur.role = 'department_manager'");
    expect(sql208).not.toMatch(/record_competency_assessment[\s\S]*?'executive'[\s\S]*?into v_actor_has_role/i);
    expect(sql208).not.toMatch(/record_competency_assessment[\s\S]*?'auditor'[\s\S]*?into v_actor_has_role/i);
    expect(sql208).not.toMatch(/score\s*>=\s*0\s*and\s*score\s*<=\s*100/i);
  });

  it('12: waive_training_assignment_with_reason requires controlled role, non-empty reason, and open state', () => {
    expect(sql208).toContain('create or replace function public.waive_training_assignment_with_reason(');
    expect(sql208).toContain('CANNOT_WAIVE_OWN_ASSIGNMENT');
    expect(sql208).toContain('REASON_REQUIRED: A valid waiver reason is mandatory');
    expect(sql208).toContain("v_assign.status not in ('assigned', 'in_progress', 'overdue')");
    expect(sql208).toContain('UNAUTHORIZED_WAIVER_AUTHORITY');
  });

  it('13: cancel_training_assignment_with_reason prevents cancelling completed assignments and requires controlled authority', () => {
    expect(sql208).toContain('create or replace function public.cancel_training_assignment_with_reason(');
    expect(sql208).toContain('CANNOT_CANCEL_OWN_ASSIGNMENT');
    expect(sql208).toContain('REASON_REQUIRED: A valid cancellation reason is mandatory');
    expect(sql208).toContain("v_assign.status not in ('assigned', 'in_progress', 'overdue')");
    expect(sql208).toContain('UNAUTHORIZED_CANCELLATION_AUTHORITY');
  });

  it('14: reopen_training_assignment_with_reason requires closed state (completed, waived, cancelled) and clears evidence/completed_at', () => {
    expect(sql208).toContain('create or replace function public.reopen_training_assignment_with_reason(');
    expect(sql208).toContain('CANNOT_REOPEN_OWN_ASSIGNMENT');
    expect(sql208).toContain("v_assign.status not in ('completed', 'waived', 'cancelled')");
    expect(sql208).toContain("set status = 'assigned', completed_at = null, completion_evidence_id = null");
    expect(sql208).toContain('UNAUTHORIZED_REOPEN_AUTHORITY');
  });

  it('15: All Migration 208 functions are SECURITY DEFINER with search_path = public, pg_temp and service_role-only execution ACL', () => {
    const functions = [
      'start_training_assignment(uuid, uuid)',
      'complete_training_assignment(uuid, uuid, uuid)',
      'record_competency_assessment(uuid, uuid, text, text, numeric, uuid, text, uuid)',
      'waive_training_assignment_with_reason(uuid, text, uuid)',
      'cancel_training_assignment_with_reason(uuid, text, uuid)',
      'reopen_training_assignment_with_reason(uuid, text, uuid)',
    ];

    for (const fn of functions) {
      expect(sql208).toContain(`revoke all on function public.${fn} from public, anon, authenticated;`);
      expect(sql208).toContain(`grant execute on function public.${fn} to service_role;`);
    }

    const searchPathMatches = (sql208.match(/set search_path = public, pg_temp/gi) || []).length;
    expect(searchPathMatches).toBeGreaterThanOrEqual(6);
  });

  it('16: Patch83U proof reviewed ceiling is set to 208', () => {
    const content = fs.readFileSync(patch83uScriptPath, 'utf8');
    expect(content).toContain('const reviewedPatch83uMigrationCeiling = 208;');
  });

  it('17: verify-migrations script remains unchanged in parser structure', () => {
    const content = fs.readFileSync(verifyMigrationsScriptPath, 'utf8');
    expect(content).toContain('const files = fs.readdirSync(migrationsDir)');
    expect(content).toContain('026_finish_fast_release_sprint.sql');
  });

  it('18: Deterministic SQL proof script exists', () => {
    expect(fs.existsSync(sqlProofPath)).toBe(true);
    const proof = fs.readFileSync(sqlProofPath, 'utf8');
    expect(proof).toContain('MIGRATION 208 TRAINING AUTHORIZATION INVARIANTS PROOF');
  });
});
