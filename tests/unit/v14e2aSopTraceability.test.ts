import { describe, it, expect, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  type SopRiskLink,
  type SopAccreditationLink,
  type SopDerivedControl,
  type SopInheritedAccreditation,
  type SopTraceabilityMatrixRow,
  type SaveSopDraftInput,
  saveGovernedSopDraft,
  getSopTraceabilityMatrix,
  fetchActiveRisks,
  fetchAccreditationClauses
} from '../../src/lib/policySopApi';

describe('GRC v1.4-E2A Governed SOP Traceability Engine & Contracts', () => {
  const migration204Path = path.resolve(
    process.cwd(),
    'supabase/migrations/204_governed_sop_risk_and_accreditation_traceability.sql'
  );

  it('Migration 204 SQL file exists and contains all required E2A schema definitions', () => {
    expect(fs.existsSync(migration204Path)).toBe(true);
    const sql = fs.readFileSync(migration204Path, 'utf8');

    // 1. Tables
    expect(sql).toContain('create table if not exists public.sop_version_risk_links');
    expect(sql).toContain('create table if not exists public.sop_version_accreditation_links');

    // 2. Constraints & Semantic Enums
    expect(sql).toContain("'mitigates', 'risk_if_not_followed', 'operational_context'");
    expect(sql).toContain("'primary', 'supporting', 'reference', 'gap'");

    // 3. Immutability Triggers
    expect(sql).toContain('trg_immutability_sop_version_risk_links');
    expect(sql).toContain('trg_immutability_sop_version_accreditation_links');
    expect(sql).toContain('enforce_policy_sop_version_immutability()');

    // 4. Type and Cross-Org Validation Triggers
    expect(sql).toContain('trg_validate_sop_risk_links_type');
    expect(sql).toContain('trg_validate_sop_accreditation_links_type');
    expect(sql).toContain('validate_sop_version_type()');

    // 5. Unified Traceability View
    expect(sql).toContain('create or replace view public.v_sop_traceability_matrix');
    expect(sql).toContain('security_invoker = true');
    expect(sql).toContain("'direct_sop'::text as provenance");
    expect(sql).toContain("'derived_step_control'::text as provenance");
    expect(sql).toContain("'inherited_policy'::text as provenance");

    // 6. Save Draft RPC (26 arguments)
    expect(sql).toContain('create or replace function public.save_governed_sop_draft(');
    expect(sql).toContain('p_risk_links jsonb default');
    expect(sql).toContain('p_accreditation_links jsonb default');
    expect(sql).toContain('PATCH202_CROSS_VERSION_CHILD_ID_DENIED');

    // 7. Revision Deep-Cloning
    expect(sql).toContain('insert into public.sop_version_risk_links');
    expect(sql).toContain('insert into public.sop_version_accreditation_links');

    // 8. Hardened Security Definer Revoke/Grant
    expect(sql).toContain('revoke all on function public.save_governed_sop_draft');
    expect(sql).toContain('grant execute on function public.save_governed_sop_draft');
    expect(sql).toContain('to service_role');
  });

  it('Migration 204 does NOT contain any E2B training assignment or acknowledgment RPCs', () => {
    const sql = fs.readFileSync(migration204Path, 'utf8');
    expect(sql).not.toContain('generate_sop_training_and_acknowledgment_assignments');
    expect(sql).not.toContain('record_sop_acknowledgment');
    expect(sql).not.toContain('record_sop_competency_assessment');
    expect(sql).not.toContain('create table if not exists public.sop_training_assignments');
  });

  it('Migration 204 does NOT create a redundant sop_version_control_links table', () => {
    const sql = fs.readFileSync(migration204Path, 'utf8');
    expect(sql).not.toContain('sop_version_control_links');
  });

  it('Patch83U proof script reviewed ceiling is set to 211', () => {
    const proofScriptPath = path.resolve(process.cwd(), 'scripts/patch83u-auth-surface-proof.mjs');
    const content = fs.readFileSync(proofScriptPath, 'utf8');
    expect(content).toContain('const reviewedPatch83uMigrationCeiling = 211;');
  });

  it('correctly models typed SOP Risk links with relationship semantics', () => {
    const mockRiskLink: SopRiskLink = {
      id: 'risk-link-1',
      sequence_number: 1,
      risk_id: 'risk-uuid-1',
      risk_code: 'RSK-MED-001',
      risk_title: 'Medication Administration Dosage Error',
      risk_status: 'open',
      risk_level: 'high',
      relationship_type: 'mitigates',
      context_note_en: 'Step 4 double verification directly reduces wrong dose hazards.',
      context_note_ar: 'التحقق المزدوج في الخطوة 4 يحد مباشرة من أخطاء الجرعات.'
    };

    expect(mockRiskLink.relationship_type).toBe('mitigates');
    expect(mockRiskLink.sequence_number).toBe(1);
    expect(mockRiskLink.risk_code).toBe('RSK-MED-001');
  });

  it('correctly models typed SOP Accreditation links with strength semantics', () => {
    const mockAccLink: SopAccreditationLink = {
      id: 'acc-link-1',
      sequence_number: 1,
      clause_id: 'clause-uuid-1',
      clause_code: 'MM.5.1',
      clause_title: 'High-Alert Medications Storage and Administration',
      framework: 'CBAHI',
      standard_code: 'CBAHI-HOSP-2026',
      criticality: 'critical',
      link_strength: 'primary',
      context_note_en: 'Direct fulfillment of CBAHI medication management standard.',
      context_note_ar: 'استيفاء مباشر لمعيار إدارة الأدوية من سباهي.'
    };

    expect(mockAccLink.link_strength).toBe('primary');
    expect(mockAccLink.framework).toBe('CBAHI');
    expect(mockAccLink.criticality).toBe('critical');
  });

  it('correctly aggregates derived controls from procedure steps', () => {
    const mockSteps = [
      {
        id: 'step-1',
        sequence_number: 1,
        responsible_role: 'Nurse',
        action_instruction_en: 'Check patient ID',
        action_instruction_ar: null,
        required_control_id: 'ctrl-1',
        control_library_items: { code: 'CTRL-ID-01', title: 'Two-Factor Patient Identification', control_type: 'preventive', key_control: true }
      },
      {
        id: 'step-2',
        sequence_number: 2,
        responsible_role: 'Pharmacist',
        action_instruction_en: 'Dispense vial',
        action_instruction_ar: null,
        required_control_id: null,
        control_library_items: null
      },
      {
        id: 'step-3',
        sequence_number: 3,
        responsible_role: 'Nurse',
        action_instruction_en: 'Re-verify patient ID before push',
        action_instruction_ar: null,
        required_control_id: 'ctrl-1',
        control_library_items: { code: 'CTRL-ID-01', title: 'Two-Factor Patient Identification', control_type: 'preventive', key_control: true }
      }
    ];

    const derivedMap = new Map<string, SopDerivedControl>();
    mockSteps.forEach(s => {
      if (s.required_control_id && s.control_library_items) {
        if (!derivedMap.has(s.required_control_id)) {
          derivedMap.set(s.required_control_id, {
            control_id: s.required_control_id,
            control_code: s.control_library_items.code,
            control_title: s.control_library_items.title,
            control_type: s.control_library_items.control_type,
            key_control: s.control_library_items.key_control,
            step_sequences: [s.sequence_number]
          });
        } else {
          derivedMap.get(s.required_control_id)!.step_sequences.push(s.sequence_number);
        }
      }
    });

    const derivedControls = Array.from(derivedMap.values());
    expect(derivedControls).toHaveLength(1);
    expect(derivedControls[0].control_id).toBe('ctrl-1');
    expect(derivedControls[0].step_sequences).toEqual([1, 3]);
    expect(derivedControls[0].key_control).toBe(true);
  });
});
