import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { analyzePatch83uAuthSurface } from '../../scripts/patch83u-auth-surface-proof.mjs';

describe('GRC v1.4-E1-R Migration 207 Runtime Contract Remediation Invariants', () => {
  const rootDir = process.cwd();
  const migration206Path = path.resolve(
    rootDir,
    'supabase/migrations/206_governed_sop_template_alignment_and_raci.sql'
  );
  const migration207Path = path.resolve(
    rootDir,
    'supabase/migrations/207_governed_sop_runtime_contract_remediation.sql'
  );
  const sqlProofPath = path.resolve(
    rootDir,
    'tests/sql/v14e1r_migration207_invariants_proof.sql'
  );

  const sql207 = fs.readFileSync(migration207Path, 'utf8');

  // 01 Migration207 same save RPC signature
  it('01: Migration 207 defines save_governed_sop_draft with the exact 30-argument RPC signature', () => {
    expect(fs.existsSync(migration207Path)).toBe(true);
    expect(sql207).toContain('create or replace function public.save_governed_sop_draft(');
    expect(sql207).toContain('p_actor_id uuid,');
    expect(sql207).toContain('p_version_id uuid,');
    expect(sql207).toContain('p_title_en text default null,');
    expect(sql207).toContain('p_title_ar text default null,');
    expect(sql207).toContain('p_process_name_en text default null,');
    expect(sql207).toContain('p_process_name_ar text default null,');
    expect(sql207).toContain('p_purpose_en text default null,');
    expect(sql207).toContain('p_purpose_ar text default null,');
    expect(sql207).toContain('p_process_owner_id uuid default null,');
    expect(sql207).toContain('p_primary_policy_version_id uuid default null,');
    expect(sql207).toContain('p_governance_link_state text default null,');
    expect(sql207).toContain('p_scope_en text default null,');
    expect(sql207).toContain('p_scope_ar text default null,');
    expect(sql207).toContain('p_training_required boolean default null,');
    expect(sql207).toContain('p_acknowledgment_required boolean default null,');
    expect(sql207).toContain('p_competency_assessment_required boolean default null,');
    expect(sql207).toContain('p_acknowledgment_sla_days integer default null,');
    expect(sql207).toContain('p_training_renewal_months integer default null,');
    expect(sql207).toContain('p_content_mode text default null,');
    expect(sql207).toContain('p_transcription_status text default null,');
    expect(sql207).toContain('p_procedure_sections jsonb default null,');
    expect(sql207).toContain('p_procedure_steps jsonb default null,');
    expect(sql207).toContain('p_department_scopes uuid[] default null,');
    expect(sql207).toContain('p_role_scopes jsonb default null,');
    expect(sql207).toContain('p_definitions jsonb default null,');
    expect(sql207).toContain('p_role_responsibilities jsonb default null,');
    expect(sql207).toContain('p_monitoring_kpis jsonb default null,');
    expect(sql207).toContain('p_risk_links jsonb default null,');
    expect(sql207).toContain('p_accreditation_links jsonb default null,');
    expect(sql207).toContain('p_version_links jsonb default null');
    expect(sql207).toContain('returns jsonb');
  });

  // 02 no obsolete overload added
  it('02: Migration 207 drops existing 30-argument function before create and adds no obsolete overload', () => {
    expect(sql207).toContain('drop function if exists public.save_governed_sop_draft(uuid, uuid, text, text, text, text, text, text, uuid, uuid, text, text, text, boolean, boolean, boolean, integer, integer, text, text, jsonb, jsonb, uuid[], jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb);');
    const createCount = (sql207.match(/create\s+(or\s+replace\s+)?function\s+public\.save_governed_sop_draft/gi) || []).length;
    expect(createCount).toBe(1);
  });

  // 03 service_role-only ACL
  it('03: Migration 207 enforces service_role-only execution ACL', () => {
    expect(sql207).toContain('revoke all on function public.save_governed_sop_draft(uuid, uuid, text, text, text, text, text, text, uuid, uuid, text, text, text, boolean, boolean, boolean, integer, integer, text, text, jsonb, jsonb, uuid[], jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb) from public, anon, authenticated;');
    expect(sql207).toContain('grant execute on function public.save_governed_sop_draft(uuid, uuid, text, text, text, text, text, text, uuid, uuid, text, text, text, boolean, boolean, boolean, integer, integer, text, text, jsonb, jsonb, uuid[], jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb) to service_role;');
  });

  // 04 role scopes persist role_name/job_title
  it('04: role scopes persist role_name and job_title without referencing obsolete role_label_ar or is_mandatory', () => {
    expect(sql207).toContain('insert into public.document_version_role_scope (version_id, role_name, job_title)');
    expect(sql207).not.toContain('role_label_ar, is_mandatory');
    expect(sql207).not.toContain('v_role->>\'role_label_ar\'');
  });

  // 05 role responsibilities persist accountable_for fields
  it('05: role responsibilities persist accountable_for_en and accountable_for_ar without referencing role_label_ar', () => {
    expect(sql207).toContain('insert into public.sop_role_responsibilities (');
    expect(sql207).toContain('accountable_for_en, accountable_for_ar');
    expect(sql207).toContain('v_resp->>\'accountable_for_en\'');
    expect(sql207).toContain('v_resp->>\'accountable_for_ar\'');
    expect(sql207).not.toMatch(/insert into public\.sop_role_responsibilities\s*\([^)]*role_label_ar/i);
  });

  // 06 KPI persists target_value
  it('06: KPI persists target_value (with fallback for legacy target_metric_en)', () => {
    expect(sql207).toContain('insert into public.sop_monitoring_kpis (');
    expect(sql207).toContain('target_value');
    expect(sql207).toContain("coalesce(v_kpi->>'target_value', coalesce(v_kpi->>'target_metric_en', 'Target'))");
    expect(sql207).not.toMatch(/insert into public\.sop_monitoring_kpis\s*\([^)]*target_metric_en/i);
  });

  // 07 KPI persists owner_id
  it('07: KPI persists owner_id as UUID foreign key to profiles', () => {
    expect(sql207).toContain("nullif(v_kpi->>'owner_id', '')::uuid");
  });

  // 08 KPI persists description EN/AR
  it('08: KPI persists description_en and description_ar', () => {
    expect(sql207).toContain("v_kpi->>'description_en'");
    expect(sql207).toContain("v_kpi->>'description_ar'");
  });

  // 09 risk link persists relationship_type
  it('09: risk link persists relationship_type with domain validation and fallback', () => {
    expect(sql207).toContain('insert into public.sop_version_risk_links (');
    expect(sql207).toContain('relationship_type');
    expect(sql207).toContain("coalesce(v_risk->>'relationship_type', coalesce(v_risk->>'mitigation_type', 'mitigates'))");
    expect(sql207).not.toMatch(/insert into public\.sop_version_risk_links\s*\([^)]*mitigation_type/i);
  });

  // 10 risk link persists context_note EN/AR
  it('10: risk link persists context_note_en and context_note_ar', () => {
    expect(sql207).toContain("coalesce(v_risk->>'context_note_en', v_risk->>'notes')");
    expect(sql207).toContain("v_risk->>'context_note_ar'");
  });

  // 11 accreditation persists clause_id
  it('11: accreditation persists clause_id (with fallback for legacy requirement_id)', () => {
    expect(sql207).toContain('insert into public.sop_version_accreditation_links (');
    expect(sql207).toContain('clause_id');
    expect(sql207).toContain("coalesce(nullif(v_acc->>'clause_id', '')::uuid, nullif(v_acc->>'requirement_id', '')::uuid)");
  });

  // 12 accreditation persists link_strength
  it('12: accreditation persists link_strength (with fallback for legacy compliance_type)', () => {
    expect(sql207).toContain('link_strength');
    expect(sql207).toContain("coalesce(v_acc->>'link_strength', 'primary')");
  });

  // 13 accreditation persists context_note EN/AR
  it('13: accreditation persists context_note_en and context_note_ar', () => {
    expect(sql207).toContain("coalesce(v_acc->>'context_note_en', v_acc->>'notes')");
    expect(sql207).toContain("v_acc->>'context_note_ar'");
  });

  // 14 version link persists context notes
  it('14: version link persists context_note_en and context_note_ar', () => {
    expect(sql207).toContain("v_link->>'context_note_en'");
    expect(sql207).toContain("v_link->>'context_note_ar'");
  });

  // 15 version link persists sequence
  it('15: version link persists sequence_number on insert and update', () => {
    expect(sql207).toContain("coalesce((v_link->>'sequence_number')::integer, sequence_number)");
    expect(sql207).toContain("coalesce((v_link->>'sequence_number')::integer, 1)");
  });

  // 16 procedure action_instruction EN/AR persists exactly
  it('16: procedure step action_instruction_en and action_instruction_ar persist exactly', () => {
    expect(sql207).toContain("action_instruction_en = coalesce(v_step->>'action_instruction_en', action_instruction_en)");
    expect(sql207).toContain("action_instruction_ar = v_step->>'action_instruction_ar'");
  });

  // 17 required_control_id persists
  it('17: procedure step required_control_id persists as nullable uuid', () => {
    expect(sql207).toContain("nullif(v_step->>'required_control_id', '')::uuid");
  });

  // 18 expected evidence fields persist
  it('18: expected evidence fields expected_evidence_record_en and expected_evidence_record_ar persist', () => {
    expect(sql207).toContain("v_step->>'expected_evidence_record_en'");
    expect(sql207).toContain("v_step->>'expected_evidence_record_ar'");
  });

  // 19 SLA fields persist
  it('19: procedure step SLA fields timing_sla_en and timing_sla_ar persist', () => {
    expect(sql207).toContain("v_step->>'timing_sla_en'");
    expect(sql207).toContain("v_step->>'timing_sla_ar'");
  });

  // 20 decision fields persist
  it('20: decision point fields is_decision_point, decision_criteria_en, decision_criteria_ar persist', () => {
    expect(sql207).toContain("coalesce((v_step->>'is_decision_point')::boolean, false)");
    expect(sql207).toContain("v_step->>'decision_criteria_en'");
    expect(sql207).toContain("v_step->>'decision_criteria_ar'");
  });

  // 21 criticality persists
  it('21: step criticality persists with default medium', () => {
    expect(sql207).toContain("criticality = coalesce(v_step->>'criticality', 'medium')");
  });

  // 22 escalation fields persist
  it('22: escalation fields escalation_trigger_en, escalation_trigger_ar, escalation_destination_role persist', () => {
    expect(sql207).toContain("escalation_trigger_en = v_step->>'escalation_trigger_en'");
    expect(sql207).toContain("escalation_trigger_ar = v_step->>'escalation_trigger_ar'");
    expect(sql207).toContain("escalation_destination_role = v_step->>'escalation_destination_role'");
  });

  // 23 RACI persists
  it('23: step RACI assignments persist with type, role_name, role_label_ar, job_title, sequence_number', () => {
    expect(sql207).toContain('insert into public.sop_procedure_step_raci_assignments (');
    expect(sql207).toContain("sop_version_id, step_id, raci_type, role_name, role_label_ar, job_title, sequence_number");
  });

  // 24 legacy responsible_role behavior preserved
  it('24: legacy responsible_role behavior preserved when RACI is present vs omitted', () => {
    expect(sql207).toContain("v_step ? 'raci_assignments'");
    expect(sql207).toContain("r->>'raci_type' = 'R'");
    expect(sql207).toContain("responsible_role = case when v_step ? 'responsible_role' then nullif(trim(v_step->>'responsible_role'), '') else responsible_role end");
  });

  // 25 section/step client-key maps preserved
  it('25: section_key_map and step_key_map returned in response object', () => {
    expect(sql207).toContain("'section_key_map', v_section_key_map");
    expect(sql207).toContain("'step_key_map', v_step_key_map");
  });

  // 26 start revision still clones all established schemas
  it('26: Migration 206 start_governed_document_revision clones established schemas correctly', () => {
    const sql206 = fs.readFileSync(migration206Path, 'utf8');
    expect(sql206).toContain('create or replace function public.start_governed_document_revision(');
    expect(sql206).toContain('accountable_for_en, accountable_for_ar');
    expect(sql206).toContain('target_value, measurement_frequency, owner_id, description_en, description_ar');
    expect(sql206).toContain('clause_id, link_strength, context_note_en, context_note_ar');
    expect(sql206).toContain('risk_id, relationship_type, context_note_en, context_note_ar');
  });

  // 27 transcription_status database domain remains: not_required | pending | complete
  it('27: transcription_status domain remains not_required | pending | complete', () => {
    const migration201Path = path.resolve(rootDir, 'supabase/migrations/201_governed_policy_sop_core_foundation.sql');
    const sql201 = fs.readFileSync(migration201Path, 'utf8');
    expect(sql201).toContain("transcription_status in ('not_required', 'pending', 'complete')");
  });

  // 28 no Migration206 file modification
  it('28: Migration 206 file is identical to base main commit', () => {
    const baseDiff = execSync('git diff 31890d0710fb326404e443aff1b624ef5685347d -- supabase/migrations/206_governed_sop_template_alignment_and_raci.sql', { encoding: 'utf8' });
    expect(baseDiff.trim()).toBe('');
  });

  // 29 no browser EXECUTE grant
  it('29: no browser EXECUTE grant exists on save_governed_sop_draft', () => {
    const report = analyzePatch83uAuthSurface({
      migrationFiles: [{ path: 'supabase/migrations/207_governed_sop_runtime_contract_remediation.sql', text: sql207 }],
      sourceFiles: [],
    });
    const saveRpc = report.acl_reachable_security_definer_rpcs.reviewed_restricted_security_definers
      .find((r: { name: string }) => r.name === 'save_governed_sop_draft');
    expect(saveRpc).toBeDefined();
    expect(saveRpc?.disposition).toBe('service_role_only');
    expect(saveRpc?.public_execute).toBe(false);
    expect(saveRpc?.anon_execute).toBe(false);
    expect(saveRpc?.authenticated_execute).toBe(false);
    expect(saveRpc?.service_role_execute).toBe(true);
  });

  // 30 Patch83U reviewed ceiling >= 207
  it('30: Patch83U reviewed ceiling includes P3 migration 225', () => {
    const proofScriptPath = path.resolve(rootDir, 'scripts/patch83u-auth-surface-proof.mjs');
    const content = fs.readFileSync(proofScriptPath, 'utf8');
    expect(content).toContain('const reviewedPatch83uMigrationCeiling = 225;');
  });

  it('Deterministic SQL proof script exists and covers Migration 207 production schema persistence', () => {
    expect(fs.existsSync(sqlProofPath)).toBe(true);
    const proof = fs.readFileSync(sqlProofPath, 'utf8');
    expect(proof).toContain('MIGRATION 207 RUNTIME CONTRACT REMEDIATION PROOF');
    expect(proof).toContain('TEST 01: All Families Simultaneous Persistence in Production Schema');
    expect(proof).toContain('TEST 02: Verification of Role Scope Persistence (role_name, job_title)');
    expect(proof).toContain('TEST 03: Verification of Role Responsibility Persistence');
    expect(proof).toContain('TEST 04: Verification of KPI Persistence');
    expect(proof).toContain('TEST 05: Verification of Risk Link Persistence');
    expect(proof).toContain('TEST 06: Verification of Accreditation Link Persistence');
    expect(proof).toContain('TEST 07: Verification of Governed Version Link Persistence');
    expect(proof).toContain('TEST 08: Verification of Procedure Sections, Steps & RACI Persistence');
    expect(proof).toContain('TEST 09: Start Revision Deep-Clone Preserves All Production Schema Fields');
  });
});
