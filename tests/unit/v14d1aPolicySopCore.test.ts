import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  listGovernedPolicies,
  listGovernedSops,
  getSopProcedureSteps,
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

  describe('1. Schema & Table Definitions', () => {
    const sql = fs.readFileSync(migrationPath, 'utf8');

    it('creates governed_policy_details with version_id PK, bilingual fields, content mode, and transcription status', () => {
      expect(sql).toMatch(/create table if not exists public\.governed_policy_details/i);
      expect(sql).toMatch(/version_id uuid primary key references public\.document_versions\(id\)/i);
      expect(sql).toMatch(/title_en text not null/i);
      expect(sql).toMatch(/title_ar text/i);
      expect(sql).toMatch(/policy_statement_en text not null/i);
      expect(sql).toMatch(/policy_statement_ar text/i);
      expect(sql).toMatch(/content_mode text not null default 'structured' check \(content_mode in \('structured', 'legacy_controlled_document'\)\)/i);
      expect(sql).toMatch(/transcription_status text not null default 'not_required' check \(transcription_status in \('not_required', 'pending', 'complete'\)\)/i);
      expect(sql).toMatch(/check \(content_mode <> 'structured' or transcription_status in \('not_required', 'complete'\)\)/i);
    });

    it('creates policy_requirements with sequence uniqueness, >=1 constraint, and catalog references', () => {
      expect(sql).toMatch(/create table if not exists public\.policy_requirements/i);
      expect(sql).toMatch(/policy_version_id uuid not null references public\.document_versions\(id\)/i);
      expect(sql).toMatch(/sequence_number integer not null check \(sequence_number >= 1\)/i);
      expect(sql).toMatch(/unique \(policy_version_id, sequence_number\)/i);
      expect(sql).toMatch(/mapped_control_id uuid references public\.control_library_items\(id\)/i);
      expect(sql).toMatch(/linked_accreditation_clause_id uuid references public\.accreditation_clauses\(id\)/i);
    });

    it('creates governed_sop_details with primary policy version binding, link state, and training flags', () => {
      expect(sql).toMatch(/create table if not exists public\.governed_sop_details/i);
      expect(sql).toMatch(/version_id uuid primary key references public\.document_versions\(id\)/i);
      expect(sql).toMatch(/process_name_en text not null/i);
      expect(sql).toMatch(/primary_policy_version_id uuid references public\.document_versions\(id\)/i);
      expect(sql).toMatch(/governance_link_state text not null default 'linked' check \(governance_link_state in \('linked', 'legacy_pending', 'not_applicable'\)\)/i);
      expect(sql).toMatch(/training_required boolean not null default false/i);
      expect(sql).toMatch(/acknowledgment_required boolean not null default false/i);
      expect(sql).toMatch(/competency_assessment_required boolean not null default false/i);
      expect(sql).toMatch(/content_mode text not null default 'structured'/i);
      expect(sql).toMatch(/transcription_status text not null default 'not_required'/i);
    });

    it('enforces primary policy version link-state invariant', () => {
      expect(sql).toMatch(/governance_link_state = 'linked' and primary_policy_version_id is not null/i);
      expect(sql).toMatch(/governance_link_state = 'legacy_pending'/i);
      expect(sql).toMatch(/governance_link_state = 'not_applicable' and primary_policy_version_id is null/i);
    });

    it('creates sop_procedure_steps with sequence uniqueness, >=1 constraint, and step attributes', () => {
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
      expect(sql).toMatch(/nullif\(trim\(coalesce\(role_name, ''\)\), ''\) is not null or\s+nullif\(trim\(coalesce\(job_title, ''\)\), ''\) is not null/i);
      expect(sql).toMatch(/create unique index if not exists uq_doc_ver_role_scope_unique/i);
    });
  });

  describe('2. Direct Authenticated Writes Removal (Blocker A)', () => {
    const sql = fs.readFileSync(migrationPath, 'utf8');

    it('enforces RLS on all 6 new tables', () => {
      expect(sql).toMatch(/alter table public\.governed_policy_details enable row level security;/i);
      expect(sql).toMatch(/alter table public\.policy_requirements enable row level security;/i);
      expect(sql).toMatch(/alter table public\.governed_sop_details enable row level security;/i);
      expect(sql).toMatch(/alter table public\.sop_procedure_steps enable row level security;/i);
      expect(sql).toMatch(/alter table public\.document_version_department_scope enable row level security;/i);
      expect(sql).toMatch(/alter table public\.document_version_role_scope enable row level security;/i);
    });

    it('creates authenticated SELECT policies scoped to parent document organization', () => {
      expect(sql).toMatch(/create policy governed_policy_details_select on public\.governed_policy_details\s+for select to authenticated/i);
      expect(sql).toMatch(/create policy policy_requirements_select on public\.policy_requirements\s+for select to authenticated/i);
      expect(sql).toMatch(/create policy governed_sop_details_select on public\.governed_sop_details\s+for select to authenticated/i);
      expect(sql).toMatch(/create policy sop_procedure_steps_select on public\.sop_procedure_steps\s+for select to authenticated/i);
      expect(sql).toMatch(/create policy doc_ver_dept_scope_select on public\.document_version_department_scope\s+for select to authenticated/i);
      expect(sql).toMatch(/create policy doc_ver_role_scope_select on public\.document_version_role_scope\s+for select to authenticated/i);
    });

    it('confirms ZERO direct authenticated INSERT/UPDATE/DELETE policies exist', () => {
      expect(sql).not.toMatch(/create policy [a-z0-9_]+ on public\.governed_policy_details\s+for (all|insert|update|delete) to authenticated/i);
      expect(sql).not.toMatch(/create policy [a-z0-9_]+ on public\.policy_requirements\s+for (all|insert|update|delete) to authenticated/i);
      expect(sql).not.toMatch(/create policy [a-z0-9_]+ on public\.governed_sop_details\s+for (all|insert|update|delete) to authenticated/i);
      expect(sql).not.toMatch(/create policy [a-z0-9_]+ on public\.sop_procedure_steps\s+for (all|insert|update|delete) to authenticated/i);
      expect(sql).not.toMatch(/create policy [a-z0-9_]+ on public\.document_version_department_scope\s+for (all|insert|update|delete) to authenticated/i);
      expect(sql).not.toMatch(/create policy [a-z0-9_]+ on public\.document_version_role_scope\s+for (all|insert|update|delete) to authenticated/i);
    });
  });

  describe('3. Immutability Guard Covering INSERT, UPDATE, DELETE (Blocker B & Revision Semantics)', () => {
    const sql = fs.readFileSync(migrationPath, 'utf8');

    it('runs enforce_policy_sop_version_immutability BEFORE INSERT OR UPDATE OR DELETE', () => {
      expect(sql).toMatch(/before insert or update or delete on public\.governed_policy_details/i);
      expect(sql).toMatch(/before insert or update or delete on public\.policy_requirements/i);
      expect(sql).toMatch(/before insert or update or delete on public\.governed_sop_details/i);
      expect(sql).toMatch(/before insert or update or delete on public\.sop_procedure_steps/i);
      expect(sql).toMatch(/before insert or update or delete on public\.document_version_department_scope/i);
      expect(sql).toMatch(/before insert or update or delete on public\.document_version_role_scope/i);
    });

    it('raises PATCH201_VERSION_IMMUTABLE_LOCKED when parent version is locked or approved', () => {
      expect(sql).toMatch(/if v_locked_at is not null or v_approved_at is not null then/i);
      expect(sql).toMatch(/raise exception 'PATCH201_VERSION_IMMUTABLE_LOCKED';/i);
    });

    it('preserves draft revision editability when parent document is active (no root status false positive)', () => {
      // Trigger evaluates version-level locked_at / approved_at exclusively, avoiding root status false positive
      expect(sql).not.toMatch(/d\.document_status in \('approved', 'active', 'retired', 'superseded'\)/i);
    });
  });

  describe('4. Document Type & Cross-Organization Referential Integrity', () => {
    const sql = fs.readFileSync(migrationPath, 'utf8');

    it('validates document types for policy details and requirements', () => {
      expect(sql).toMatch(/PATCH201_POLICY_DETAILS_INVALID_DOCUMENT_TYPE/i);
      expect(sql).toMatch(/PATCH201_SOP_DETAILS_INVALID_DOCUMENT_TYPE/i);
      expect(sql).toMatch(/PATCH201_PRIMARY_POLICY_VERSION_INVALID_TYPE/i);
    });

    it('enforces cross-organization integrity guards', () => {
      expect(sql).toMatch(/function public\.validate_department_scope\(\)/i);
      expect(sql).toMatch(/PATCH201_CROSS_ORGANIZATION_REFERENCE_DENIED/i);
    });
  });

  describe('5. Read-Only Catalog Views & Security Invoker', () => {
    const sql = fs.readFileSync(migrationPath, 'utf8');

    it('creates security_invoker catalog views and grants select to authenticated', () => {
      expect(sql).toMatch(/alter view public\.v_governed_policy_catalog set \(security_invoker = true\);/i);
      expect(sql).toMatch(/alter view public\.v_governed_sop_catalog set \(security_invoker = true\);/i);
      expect(sql).toMatch(/alter view public\.v_sop_procedure_step_matrix set \(security_invoker = true\);/i);
      expect(sql).toMatch(/grant select on public\.v_governed_policy_catalog to authenticated;/i);
      expect(sql).toMatch(/grant select on public\.v_governed_sop_catalog to authenticated;/i);
      expect(sql).toMatch(/grant select on public\.v_sop_procedure_step_matrix to authenticated;/i);
    });

    it('explicitly revokes trigger functions from public/anon/authenticated and grants to service_role', () => {
      expect(sql).toMatch(/revoke all on function public\.validate_policy_version_type\(\) from public, anon, authenticated;/i);
      expect(sql).toMatch(/grant execute on function public\.validate_policy_version_type\(\) to service_role;/i);
      expect(sql).toMatch(/revoke all on function public\.validate_sop_version_type\(\) from public, anon, authenticated;/i);
      expect(sql).toMatch(/grant execute on function public\.validate_sop_version_type\(\) to service_role;/i);
      expect(sql).toMatch(/revoke all on function public\.validate_department_scope\(\) from public, anon, authenticated;/i);
      expect(sql).toMatch(/grant execute on function public\.validate_department_scope\(\) to service_role;/i);
      expect(sql).toMatch(/revoke all on function public\.enforce_policy_sop_version_immutability\(\) from public, anon, authenticated;/i);
      expect(sql).toMatch(/grant execute on function public\.enforce_policy_sop_version_immutability\(\) to service_role;/i);
    });
  });

  describe('6. Read API Client Bindings', () => {
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
