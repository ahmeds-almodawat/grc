import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

describe('GRC v1.4-E2B2 Migration 208 Authorization & Compliance Contract Invariants', () => {
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

  it('01: frozen Migration208 exists exactly once and E2B3 Migration209 is the only successor', () => {
    expect(fs.existsSync(migration208Path)).toBe(true);
    const m208Files = fs.readdirSync(migrationsDir).filter(f => f.startsWith('208_'));
    expect(m208Files).toHaveLength(1);
    expect(m208Files[0]).toBe('208_e2b2_training_authorization_and_compliance_contract_remediation.sql');

    const m209Files = fs.readdirSync(migrationsDir).filter(f => f.startsWith('209_'));
    expect(m209Files).toEqual(['209_e2b3_training_population_reconciliation.sql']);
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

    expect(sql208).not.toContain('drop policy if exists patch83u_credential_gate');
    expect(sql208).not.toContain('drop policy patch83u_credential_gate');
  });

  it('06: training_programs SELECT policy strictly requires organization tenancy proof for program owner and eliminates broad employee fallback', () => {
    const tpPolicyMatch = sql208.match(/create policy "grc_training_programs_select_policy"[\s\S]*?;/i)?.[0];
    expect(tpPolicyMatch).toBeDefined();
    expect(tpPolicyMatch).toContain('owner_user_id = auth.uid()');
    expect(tpPolicyMatch).toContain('cd.organization_id = op.organization_id');
    expect(tpPolicyMatch).toContain('ta.assigned_to_user_id = auth.uid()');
    expect(tpPolicyMatch).not.toContain('training_programs.active');
    expect(tpPolicyMatch).not.toMatch(/\b(?<!is_)active\s*=\s*true/i);
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

  it('08: document_acknowledgment_requirements SELECT policy restricts employee to self and scoped authorities', () => {
    expect(sql208).toContain('create policy "document_ack_req_select_policy_e2b2" on public.document_acknowledgment_requirements');
    expect(sql208).toContain("requirement_scope = 'specific_users' and user_id = auth.uid()");
    expect(sql208).toContain("ur.role = 'department_manager'");
    expect(sql208).toContain("ur.role in ('super_admin', 'executive', 'governance_admin', 'auditor', 'compliance_officer')");
  });

  it('09: start_training_assignment RPC requires assignment owner and enforces governed start eligibility (rejects competency-only)', () => {
    expect(sql208).toContain('create or replace function public.start_training_assignment(');
    expect(sql208).toContain('UNAUTHORIZED_TRAINING_STARTER: Only assignment owner may start training');
    expect(sql208).toContain('ACTOR_INACTIVE: Actor profile is not active or does not exist');
    expect(sql208).toContain('TRAINING_NOT_REQUIRED_FOR_ASSIGNMENT: Assignment is competency-only; formal training is not required');
    expect(sql208).toContain("status = 'in_progress'");
  });

  it('10: complete_training_assignment RPC preserves exact Edge v13 parameter names/order and checks version-bound formal training certifier authority', () => {
    const fnMatch = sql208.match(/create or replace function public\.complete_training_assignment[\s\S]*?\$\$[\s\S]*?\$\$;/i)?.[0];
    expect(fnMatch).toBeDefined();
    expect(fnMatch).toContain('p_assignment_id uuid,\n  p_evidence_id uuid,\n  p_actor_id uuid');
    expect(sql208).not.toContain('p_completion_evidence_id');
    expect(fnMatch).toContain('v_formal_training_required');
    expect(fnMatch).toContain('UNAUTHORIZED_TRAINING_COMPLETER: Caller lacks authority to certify training completion');
    expect(fnMatch).toContain("ur.role in ('super_admin', 'governance_admin', 'compliance_officer')");
    expect(fnMatch).toContain("ur.role = 'department_manager'");
    expect(fnMatch).not.toContain("'executive'");
    expect(fnMatch).not.toContain("'auditor'");
  });

  it('11: record_competency_assessment RPC preserves exact 8 arguments, requires p_actor_id, validates subject match, competency required, and removes program owner authority', () => {
    const fnMatch = sql208.match(/create or replace function public\.record_competency_assessment[\s\S]*?\$\$[\s\S]*?\$\$;/i)?.[0];
    expect(fnMatch).toBeDefined();
    expect(fnMatch).toContain(
      'p_assignment_id uuid,\n  p_user_id uuid,\n  p_competency_area text,\n  p_result text,\n  p_score numeric,\n  p_evidence_id uuid,\n  p_notes text,\n  p_actor_id uuid'
    );
    expect(fnMatch).toContain('ACTOR_REQUIRED: Competency assessment requires authenticated actor identity');
    expect(fnMatch).toContain('COMPETENCY_ASSIGNMENT_SUBJECT_MISMATCH: Target user does not match assignment subject');
    expect(fnMatch).toContain('COMPETENCY_NOT_REQUIRED_FOR_ASSIGNMENT: Competency assessment is not required for this SOP version');
    expect(fnMatch).toContain('SOD_VIOLATION_SELF_ASSESSMENT: Employees cannot assess their own competency');
    expect(fnMatch).toContain('UNAUTHORIZED_ASSESSOR: Caller lacks authority to record competency assessment');
    expect(fnMatch).not.toContain('v_prog.owner_user_id');
    expect(fnMatch).not.toContain("'executive'");
    expect(fnMatch).not.toContain("'auditor'");
  });

  it('12: Reason fields in waive, cancel, and reopen RPCs are bounded to 3-1000 characters', () => {
    expect(sql208).toContain('length(trim(p_reason)) < 3 or length(trim(p_reason)) > 1000');
    expect(sql208).toContain('REASON_REQUIRED: A valid waiver reason between 3 and 1000 characters is mandatory');
    expect(sql208).toContain('REASON_REQUIRED: A valid cancellation reason between 3 and 1000 characters is mandatory');
    expect(sql208).toContain('REASON_REQUIRED: A valid reopening reason between 3 and 1000 characters is mandatory');
  });

  it('13: record_document_acknowledgment verifies version, active org tenancy, and target population eligibility', () => {
    expect(sql208).toContain('create or replace function public.record_document_acknowledgment(');
    expect(sql208).toContain('VERSION_NOT_FOUND: Specified document version does not exist for this document');
    expect(sql208).toContain('USER_INACTIVE: Target user profile is not active or does not exist');
    expect(sql208).toContain('USER_NOT_ELIGIBLE_FOR_ACKNOWLEDGMENT: User is not within the required target population for this version');
  });

  it('14: publish_sop_training_obligations materializes specific_users acknowledgment requirements, dual obligations, and valid cycle_type', () => {
    const fnMatch = sql208.match(/create or replace function public\.publish_sop_training_obligations[\s\S]*?\$\$[\s\S]*?\$\$;/i)?.[0];
    expect(fnMatch).toBeDefined();
    expect(fnMatch).toContain("requirement_scope = 'specific_users'");
    expect(fnMatch).not.toContain("'all_employees'");
    expect(fnMatch).toContain("v_cycle_type := 'retraining';");
    expect(fnMatch).toContain("v_cycle_type := 'initial';");
    expect(fnMatch).not.toContain("cycle_type := 'revision'");
    expect(fnMatch).not.toContain("cycle_type = 'revision'");
    expect(fnMatch).toContain('v_needs_assignment := (v_training_req or v_comp_req);');
  });

  it('15: Reporting & compliance read views are created with security_invoker = true and authoritative gap/matrix logic', () => {
    expect(sql208).toContain('create or replace view public.v_patch29_sop_acknowledgment_gap');
    expect(sql208).toContain('create or replace view public.v_patch29_competency_gap_dashboard');
    expect(sql208).toContain('create or replace view public.v_sop_training_compliance_matrix');
    expect(sql208).toContain('create or replace view public.v_patch29_training_executive_summary');

    const invokerMatches = (sql208.match(/with\s*\(\s*security_invoker\s*=\s*true\s*\)/gi) || []).length;
    expect(invokerMatches).toBeGreaterThanOrEqual(4);
  });

  it('16: All Migration 208 functions are SECURITY DEFINER with search_path = public, pg_temp and service_role-only execution ACL', () => {
    const functions = [
      'start_training_assignment(uuid, uuid)',
      'complete_training_assignment(uuid, uuid, uuid)',
      'record_competency_assessment(uuid, uuid, text, text, numeric, uuid, text, uuid)',
      'waive_training_assignment_with_reason(uuid, text, uuid)',
      'cancel_training_assignment_with_reason(uuid, text, uuid)',
      'reopen_training_assignment_with_reason(uuid, text, uuid)',
      'record_document_acknowledgment(uuid, uuid, uuid, text, text)',
      'publish_sop_training_obligations(uuid, uuid)',
    ];

    for (const fn of functions) {
      expect(sql208).toContain(`revoke all on function public.${fn} from public, anon, authenticated;`);
      expect(sql208).toContain(`grant execute on function public.${fn} to service_role;`);
    }

    const searchPathMatches = (sql208.match(/set search_path = public, pg_temp/gi) || []).length;
    expect(searchPathMatches).toBeGreaterThanOrEqual(8);
  });

  it('17: Deterministic SQL proof script exists and has exact fail-closed assertions', () => {
    expect(fs.existsSync(sqlProofPath)).toBe(true);
    const proof = fs.readFileSync(sqlProofPath, 'utf8');
    expect(proof).toContain('MIGRATION 208 AUTHORIZATION & COMPLIANCE INVARIANTS PROOF');
    expect(proof).toContain('CHECK 1 PASSED');
    expect(proof).toContain('CHECK 8 PASSED');
    expect(proof).toContain('ALL 26 BEHAVIORAL SCENARIOS DETERMINISTICALLY VERIFIED (PASSED).');
  });

  it('18: Patch83U proof reviewed ceiling includes P3 migration 225', () => {
    const content = fs.readFileSync(patch83uScriptPath, 'utf8');
    expect(content).toContain('const reviewedPatch83uMigrationCeiling = 225;');
  });

  it('19: verify-migrations script remains unchanged in parser structure', () => {
    const content = fs.readFileSync(verifyMigrationsScriptPath, 'utf8');
    expect(content).toContain('const files = fs.readdirSync(migrationsDir)');
    expect(content).toContain('026_finish_fast_release_sprint.sql');
  });
});
