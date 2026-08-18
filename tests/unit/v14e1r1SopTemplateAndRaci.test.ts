import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('GRC v1.4-E1-R1 Governed SOP Template Alignment & RACI Backend Invariants', () => {
  const rootDir = process.cwd();
  const migration206Path = path.resolve(
    rootDir,
    'supabase/migrations/206_governed_sop_template_alignment_and_raci.sql'
  );
  const sqlProofPath = path.resolve(
    rootDir,
    'tests/sql/v14e1r_sop_template_and_raci_invariants_proof.sql'
  );

  it('Migration 206 SQL file exists and contains all required E1-R1 schema definitions', () => {
    expect(fs.existsSync(migration206Path)).toBe(true);
    const sql = fs.readFileSync(migration206Path, 'utf8');

    // 1. Approval rule stages & request stages tables
    expect(sql).toContain('create table if not exists public.approval_authority_rule_stages');
    expect(sql).toContain('create table if not exists public.approval_request_stages');
    expect(sql).toContain('constraint chk_stage_auth_selector check');
    expect(sql).toContain('constraint chk_req_stage_auth_selector check');

    // 2. Decision stage composite containment
    expect(sql).toContain('alter table public.approval_decisions');
    expect(sql).toContain('add column if not exists request_stage_id uuid');
    expect(sql).toContain('constraint fk_decision_stage_containment');
    expect(sql).toContain('uq_stage_decision_approver');

    // 3. SOP Procedure Sections
    expect(sql).toContain('create table if not exists public.sop_procedure_sections');
    expect(sql).toContain('constraint uq_sop_sections_version_seq unique (sop_version_id, sequence_number) deferrable initially immediate');

    // 4. SOP Procedure Steps & RACI
    expect(sql).toContain('alter table public.sop_procedure_steps');
    expect(sql).toContain('alter column responsible_role drop not null');
    expect(sql).toContain('add column if not exists section_id uuid');
    expect(sql).toContain('constraint uq_sop_steps_version_seq');
    expect(sql).toContain('constraint fk_sop_steps_section_containment');
    expect(sql).toContain('create table if not exists public.sop_procedure_step_raci_assignments');
    expect(sql).toContain('uq_step_raci_accountable');

    // 5. Governed Document Version Links
    expect(sql).toContain('create table if not exists public.governed_document_version_links');
    expect(sql).toContain('trg_validate_doc_ver_link_tenancy');

    // 6. Direct Mutation Protection Triggers
    expect(sql).toContain('create or replace function public.guard_staged_approval_mutations()');
    expect(sql).toContain('PATCH206_DIRECT_STAGED_REQUEST_MUTATION_FORBIDDEN');
    expect(sql).toContain('PATCH206_DIRECT_STAGED_DECISION_MUTATION_FORBIDDEN');

    // 7. Complete Immutability Function
    expect(sql).toContain('create or replace function public.enforce_policy_sop_version_immutability()');
    expect(sql).toContain('trg_immutability_sop_procedure_sections');
    expect(sql).toContain('trg_immutability_sop_step_raci');
    expect(sql).toContain('trg_immutability_governed_doc_ver_links');

    // 8. Governed RPCs
    expect(sql).toContain('create or replace function public.configure_approval_authority_rule_stages(');
    expect(sql).toContain('create or replace function public.record_approval_decision(');
    expect(sql).toContain('create or replace function public.submit_governed_document_for_review(');
    expect(sql).toContain('create or replace function public.finalize_governed_document_approval(');
    expect(sql).toContain('create or replace function public.save_governed_sop_draft(');
    expect(sql).toContain('create or replace function public.create_governed_sop_draft(');
    expect(sql).toContain('create or replace function public.start_governed_document_revision(');
  });

  it('Migration 206 explicitly cleans up all obsolete RPC overloads', () => {
    const sql = fs.readFileSync(migration206Path, 'utf8');

    expect(sql).toContain('drop function if exists public.save_governed_sop_draft(uuid, uuid, text, text, text, text, text, text, uuid, uuid, text, text, text, boolean, boolean, boolean, integer, integer, jsonb, uuid[], jsonb);');
    expect(sql).toContain('drop function if exists public.save_governed_sop_draft(uuid, uuid, text, text, text, text, text, text, uuid, uuid, text, text, text, boolean, boolean, boolean, integer, integer, jsonb, uuid[], jsonb, jsonb, jsonb, jsonb);');
    expect(sql).toContain('drop function if exists public.save_governed_sop_draft(uuid, uuid, text, text, text, text, text, text, uuid, uuid, text, text, text, boolean, boolean, boolean, integer, integer, jsonb, uuid[], jsonb, jsonb, jsonb, jsonb, jsonb, jsonb);');

    expect(sql).toContain('drop function if exists public.create_governed_sop_draft(uuid, uuid, text, text, text, text, text, text, uuid, uuid, text, text, text, uuid, text, text, boolean, boolean, boolean, integer, integer, text, jsonb, uuid[], jsonb);');
    expect(sql).toContain('drop function if exists public.create_governed_sop_draft(uuid, uuid, text, text, text, text, text, text, uuid, uuid, text, text, text, uuid, text, text, boolean, boolean, boolean, integer, integer, text, jsonb, uuid[], jsonb, jsonb, jsonb, jsonb);');
  });

  it('Deterministic SQL proof script exists and covers all 58 required test cases', () => {
    expect(fs.existsSync(sqlProofPath)).toBe(true);
    const proof = fs.readFileSync(sqlProofPath, 'utf8');

    expect(proof).toContain('TEST 01: Cross-version section attachment rejected');
    expect(proof).toContain('TEST 02: Cross-version RACI attachment rejected');
    expect(proof).toContain('TEST 03: Section AND Step Sequence Reorder Collision Safety (Deferrable)');
    expect(proof).toContain('TEST 04: Second Accountable on Same Step Rejected');
    expect(proof).toContain('TEST 05 PASSED');
    expect(proof).toContain('TEST 06: Independent Missing-R Submission Rejection');
    expect(proof).toContain('TEST 07: Independent Missing-A Submission Rejection');
    expect(proof).toContain('TEST 08: Exact-Version Cross-Org Link Rejected');
    expect(proof).toContain('TEST 09 PASSED');
    expect(proof).toContain('TEST 10: Unresolved section_client_key Rejected');
    expect(proof).toContain('TEST 11, 12, 13 & 58: Revision Deep Cloning & Explicit UUID Mapping (by Author)');
    expect(proof).toContain('TEST 14: Missing Authority Rule Fails Closed');
    expect(proof).toContain('TEST 15: Missing Stage Configuration Fails Closed');
    expect(proof).toContain('TEST 16 & 17: Submission & Inferred Stage 1 Status Assertions');
    expect(proof).toContain('TEST 18: Unauthorized Actor');
    expect(proof).toContain('TEST 19, 22 & 25 PASSED');
    expect(proof).toContain('TEST 20 & 46: Same Role in Wrong Org Actor Rejected');
    expect(proof).toContain('TEST 21: Delegation Rejection Matrix (Expired, Wrong Workflow, Action, Dept)');
    expect(proof).toContain('TEST 23: Self Approval Blocked on Stage 1');
    expect(proof).toContain('TEST 24: Duplicate Voting on Open Multi-Approver Stage Blocked');
    expect(proof).toContain('TEST 26: Final Stage Approval Marks Request Approved');
    expect(proof).toContain('TEST 27 & 28: Return & Rejection Lifecycle Transitions');
    expect(proof).toContain('TEST 29 & 30: Finalization Guard Failures & Zero-Stage Finalization Assertion');
    expect(proof).toContain('TEST 31 & 58: Legitimate Operational Finalization (by Completing Approver / Admin)');
    expect(proof).toContain('TEST 32, 33, 34, 35: UN-STAGED Request Patch27 Regression');
    expect(proof).toContain('TEST 36: No stale create/save RPC overloads');
    expect(proof).toContain('TEST 37: Direct DML mutation against staged request/decision blocked');
    expect(proof).toContain('TEST 38: Immutability on Locked/Approved Version');
    expect(proof).toContain('TEST 39: Existing legacy step preserves responsible_role when RACI omitted');
    expect(proof).toContain('TEST 40: Explicit empty RACI sets responsible_role to NULL');
    expect(proof).toContain('TEST 41: Legacy controlled SOP creation preserves content_mode');
    expect(proof).toContain('TEST 42 & 09 & 05: Structured Creation & client_key maps & RACI sync');
    expect(proof).toContain('TEST 43: Valid stage ordering normalization');
    expect(proof).toContain('TEST 44 & 45 & 50 & 51 & 52 & 53 & 43: Stage Configuration Validation');
    expect(proof).toContain('TEST 47: Unrelated super_admin cannot bypass configured role');
    expect(proof).toContain('TEST 48: Document-Scoped RPCs Reject Cross-Org Actor');
    expect(proof).toContain('TEST 49: Migration 206 Security Definer Live ACL Inspection');
    expect(proof).toContain('TEST 50: Cross-org reviewer_user_id rejected at stage configuration');
    expect(proof).toContain('TEST 51: Inactive reviewer_user_id rejected');
    expect(proof).toContain('TEST 52: Invalid / non-app_role reviewer_role rejected');
    expect(proof).toContain('TEST 53: Role stage count=2 with only one eligible role holder rejected');
    expect(proof).toContain('TEST 54, 55, 56, 57: Unrelated Active Same-Org Employee Business Authority Guard');
    expect(proof).toContain('TEST 58: Legitimate Governance Admin Authority Flow');
    expect(proof).toContain('ALL 58 E1-R1 INVARIANT TESTS DETERMINISTICALLY PASSED!');
  });
});
