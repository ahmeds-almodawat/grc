import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  listGovernedPolicies,
  listGovernedSops,
  getSopProcedureSteps,
  GovernedPolicyCatalogRow,
  GovernedSopCatalogRow,
  SopProcedureStepMatrixRow,
} from '../../src/lib/policySopApi';

describe('GRC v1.4-D1A: Governed Policy & SOP Backend Core Foundation', () => {
  const migrationPath = path.resolve(
    process.cwd(),
    'supabase/migrations/201_governed_policy_sop_core_foundation.sql'
  );

  it('verifies migration 201 file existence and basic metadata', () => {
    expect(fs.existsSync(migrationPath)).toBe(true);
    const sql = fs.readFileSync(migrationPath, 'utf8');
    expect(sql.length).toBeGreaterThan(1000);
  });

  describe('Schema & Table Definition Invariants', () => {
    const sql = fs.readFileSync(migrationPath, 'utf8');

    it('creates governed_policy_details with version_id PK and structured fields', () => {
      expect(sql).toMatch(/create table if not exists public\.governed_policy_details/i);
      expect(sql).toMatch(/version_id uuid primary key references public\.document_versions\(id\)/i);
      expect(sql).toMatch(/title_en text not null/i);
      expect(sql).toMatch(/policy_statement_en text not null/i);
      expect(sql).toMatch(/content_mode text not null default 'structured'/i);
    });

    it('creates policy_requirements with sequence uniqueness and catalog references', () => {
      expect(sql).toMatch(/create table if not exists public\.policy_requirements/i);
      expect(sql).toMatch(/policy_version_id uuid not null references public\.document_versions\(id\)/i);
      expect(sql).toMatch(/sequence_number integer not null check \(sequence_number >= 1\)/i);
      expect(sql).toMatch(/unique \(policy_version_id, sequence_number\)/i);
      expect(sql).toMatch(/mapped_control_id uuid references public\.control_library_items\(id\)/i);
      expect(sql).toMatch(/linked_accreditation_clause_id uuid references public\.accreditation_clauses\(id\)/i);
    });

    it('creates governed_sop_details with primary policy version binding and link state', () => {
      expect(sql).toMatch(/create table if not exists public\.governed_sop_details/i);
      expect(sql).toMatch(/version_id uuid primary key references public\.document_versions\(id\)/i);
      expect(sql).toMatch(/process_name_en text not null/i);
      expect(sql).toMatch(/primary_policy_version_id uuid references public\.document_versions\(id\)/i);
      expect(sql).toMatch(/governance_link_state text not null default 'linked'/i);
      expect(sql).toMatch(/check \(governance_link_state in \('linked', 'legacy_pending', 'not_applicable'\)\)/i);
      expect(sql).toMatch(/training_required boolean not null default false/i);
      expect(sql).toMatch(/acknowledgment_required boolean not null default false/i);
    });

    it('creates sop_procedure_steps with sequence uniqueness and step attributes', () => {
      expect(sql).toMatch(/create table if not exists public\.sop_procedure_steps/i);
      expect(sql).toMatch(/sop_version_id uuid not null references public\.document_versions\(id\)/i);
      expect(sql).toMatch(/sequence_number integer not null check \(sequence_number >= 1\)/i);
      expect(sql).toMatch(/unique \(sop_version_id, sequence_number\)/i);
      expect(sql).toMatch(/responsible_role text not null/i);
      expect(sql).toMatch(/action_instruction_en text not null/i);
      expect(sql).toMatch(/required_control_id uuid references public\.control_library_items\(id\)/i);
      expect(sql).toMatch(/is_decision_point boolean not null default false/i);
      expect(sql).toMatch(/criticality text not null default 'medium'/i);
    });

    it('creates version-scoped applicability tables for department and role/job-title', () => {
      expect(sql).toMatch(/create table if not exists public\.document_version_department_scope/i);
      expect(sql).toMatch(/unique \(version_id, department_id\)/i);
      expect(sql).toMatch(/create table if not exists public\.document_version_role_scope/i);
      expect(sql).toMatch(/unique \(version_id, role_name, job_title\)/i);
    });
  });

  describe('Triggers, Immutability & Security Definer Guards', () => {
    const sql = fs.readFileSync(migrationPath, 'utf8');

    it('defines validation trigger functions for document types', () => {
      expect(sql).toMatch(/function public\.validate_policy_version_type\(\)/i);
      expect(sql).toMatch(/PATCH201_POLICY_DETAILS_INVALID_DOCUMENT_TYPE/i);
      expect(sql).toMatch(/function public\.validate_sop_version_type\(\)/i);
      expect(sql).toMatch(/PATCH201_SOP_DETAILS_INVALID_DOCUMENT_TYPE/i);
      expect(sql).toMatch(/PATCH201_PRIMARY_POLICY_VERSION_INVALID_TYPE/i);
    });

    it('defines version immutability trigger blocking updates and deletes on locked versions', () => {
      expect(sql).toMatch(/function public\.enforce_policy_sop_version_immutability\(\)/i);
      expect(sql).toMatch(/PATCH201_VERSION_IMMUTABLE_LOCKED/i);
      expect(sql).toMatch(/trg_immutability_governed_policy_details/i);
      expect(sql).toMatch(/trg_immutability_policy_requirements/i);
      expect(sql).toMatch(/trg_immutability_governed_sop_details/i);
      expect(sql).toMatch(/trg_immutability_sop_procedure_steps/i);
      expect(sql).toMatch(/trg_immutability_doc_ver_dept_scope/i);
      expect(sql).toMatch(/trg_immutability_doc_ver_role_scope/i);
    });

    it('enforces RLS on all 6 new tables with parent document organization scoping', () => {
      expect(sql).toMatch(/alter table public\.governed_policy_details enable row level security;/i);
      expect(sql).toMatch(/alter table public\.policy_requirements enable row level security;/i);
      expect(sql).toMatch(/alter table public\.governed_sop_details enable row level security;/i);
      expect(sql).toMatch(/alter table public\.sop_procedure_steps enable row level security;/i);
      expect(sql).toMatch(/alter table public\.document_version_department_scope enable row level security;/i);
      expect(sql).toMatch(/alter table public\.document_version_role_scope enable row level security;/i);
    });

    it('creates security_invoker catalog views and grants select to authenticated', () => {
      expect(sql).toMatch(/alter view public\.v_governed_policy_catalog set \(security_invoker = true\);/i);
      expect(sql).toMatch(/alter view public\.v_governed_sop_catalog set \(security_invoker = true\);/i);
      expect(sql).toMatch(/alter view public\.v_sop_procedure_step_matrix set \(security_invoker = true\);/i);
      expect(sql).toMatch(/grant select on public\.v_governed_policy_catalog to authenticated;/i);
      expect(sql).toMatch(/grant select on public\.v_governed_sop_catalog to authenticated;/i);
      expect(sql).toMatch(/grant select on public\.v_sop_procedure_step_matrix to authenticated;/i);
    });

    it('explicitly revokes trigger functions from public/anon/authenticated and grants execute to service_role', () => {
      expect(sql).toMatch(/revoke all on function public\.validate_policy_version_type\(\) from public, anon, authenticated;/i);
      expect(sql).toMatch(/grant execute on function public\.validate_policy_version_type\(\) to service_role;/i);
      expect(sql).toMatch(/revoke all on function public\.validate_sop_version_type\(\) from public, anon, authenticated;/i);
      expect(sql).toMatch(/grant execute on function public\.validate_sop_version_type\(\) to service_role;/i);
      expect(sql).toMatch(/revoke all on function public\.enforce_policy_sop_version_immutability\(\) from public, anon, authenticated;/i);
      expect(sql).toMatch(/grant execute on function public\.enforce_policy_sop_version_immutability\(\) to service_role;/i);
    });
  });

  describe('Read API Client Bindings', () => {
    it('provides listGovernedPolicies, listGovernedSops, and getSopProcedureSteps functions', async () => {
      expect(typeof listGovernedPolicies).toBe('function');
      expect(typeof listGovernedSops).toBe('function');
      expect(typeof getSopProcedureSteps).toBe('function');

      const policies = await listGovernedPolicies();
      expect(Array.isArray(policies)).toBe(true);

      const sops = await listGovernedSops();
      expect(Array.isArray(sops)).toBe(true);

      const steps = await getSopProcedureSteps('test-uuid');
      expect(Array.isArray(steps)).toBe(true);
    });
  });
});
