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

  it('Deterministic SQL proof script exists and covers all required test cases', () => {
    expect(fs.existsSync(sqlProofPath)).toBe(true);
    const proof = fs.readFileSync(sqlProofPath, 'utf8');

    expect(proof).toContain('TEST 01: Cross-version section attachment rejected');
    expect(proof).toContain('TEST 02: Cross-version RACI attachment rejected');
    expect(proof).toContain('TEST 03: Section/Step Reorder Collision Safety (Deferrable)');
    expect(proof).toContain('TEST 04: Second Accountable on Same Step Rejected');
    expect(proof).toContain('TEST 05 & 09 PASSED');
    expect(proof).toContain('TEST 06 & 07: Submission Missing R or A Rejected');
    expect(proof).toContain('TEST 08: Exact-Version Cross-Org Link Rejected');
    expect(proof).toContain('TEST 10: Unresolved section_client_key Rejected');
    expect(proof).toContain('TEST 11, 12, 13: Revision Deep Cloning & Explicit UUID Mapping');
    expect(proof).toContain('TEST 15: Missing Stage Configuration Fails Closed');
    expect(proof).toContain('TEST 16: Submission & Server-Side Inferred Stage 1');
    expect(proof).toContain('TEST 18: Unauthorized Actor');
    expect(proof).toContain('TEST 19 & 25: Correct Stage 1 Approval Advances to Stage 2');
    expect(proof).toContain('TEST 20: Wrong Org Actor Rejected');
    expect(proof).toContain('TEST 23: Self Approval Blocked on Stage 1');
    expect(proof).toContain('TEST 24: Duplicate Decision in Same Stage Blocked');
    expect(proof).toContain('TEST 31: Finalization Derives approved_by from Final Stage Approver');
    expect(proof).toContain('TEST 32, 33, 34: UN-STAGED Request Patch27 Regression');
    expect(proof).toContain('TEST 38: Immutability on Locked/Approved Version');
  });
});
