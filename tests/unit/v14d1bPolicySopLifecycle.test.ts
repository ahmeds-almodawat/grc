import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('GRC v1.4-D1B: Governed Policy & SOP Lifecycle, Review, Approval & Exception Backend Foundation', () => {
  const migrationPath = path.resolve(
    process.cwd(),
    'supabase/migrations/202_governed_policy_sop_lifecycle_foundation.sql'
  );

  it('verifies migration 202 file existence and basic metadata', () => {
    expect(fs.existsSync(migrationPath)).toBe(true);
    const sql = fs.readFileSync(migrationPath, 'utf8');
    expect(sql.length).toBeGreaterThan(1000);
  });

  describe('1. Review Trigger & Exception Tables', () => {
    const sql = fs.readFileSync(migrationPath, 'utf8');

    it('creates governed_document_review_triggers with partial uniqueness for open triggers', () => {
      expect(sql).toMatch(/create table if not exists public\.governed_document_review_triggers/i);
      expect(sql).toMatch(/trigger_type in \('scheduled','regulatory_change','audit_finding','ovr','capa','management_decision','accreditation_finding'\)/i);
      expect(sql).toMatch(/create unique index if not exists uq_open_review_trigger/i);
      expect(sql).toMatch(/where status in \('open', 'in_progress'\)/i);
    });

    it('creates policy_sop_exceptions with date validity check and Patch 27 approval link', () => {
      expect(sql).toMatch(/create table if not exists public\.policy_sop_exceptions/i);
      expect(sql).toMatch(/check \(effective_end_date >= effective_start_date\)/i);
      expect(sql).toMatch(/approval_request_id uuid references public\.approval_requests\(id\)/i);
      expect(sql).toMatch(/status in \('requested','approved','rejected','expired','revoked'\)/i);
    });

    it('creates governed_document_numbering_sequences and safe concurrency generator', () => {
      expect(sql).toMatch(/create table if not exists public\.governed_document_numbering_sequences/i);
      expect(sql).toMatch(/function public\.generate_governed_document_code/i);
    });
  });

  describe('2. Governed Draft Creation & Atomic Save RPCs', () => {
    const sql = fs.readFileSync(migrationPath, 'utf8');

    it('defines create_governed_policy_draft with atomic root, version, details, requirements, and scopes', () => {
      expect(sql).toMatch(/function public\.create_governed_policy_draft\(/i);
      expect(sql).toMatch(/PATCH202_ACTOR_NOT_AUTHORIZED/i);
      expect(sql).toMatch(/insert into public\.controlled_documents/i);
      expect(sql).toMatch(/insert into public\.document_versions/i);
      expect(sql).toMatch(/insert into public\.governed_policy_details/i);
    });

    it('defines create_governed_sop_draft with primary policy binding and procedure steps', () => {
      expect(sql).toMatch(/function public\.create_governed_sop_draft\(/i);
      expect(sql).toMatch(/insert into public\.governed_sop_details/i);
      expect(sql).toMatch(/insert into public\.sop_procedure_steps/i);
    });

    it('defines save_governed_policy_draft and save_governed_sop_draft preserving stable child UUIDs and denying cross-version child IDs', () => {
      expect(sql).toMatch(/function public\.save_governed_policy_draft\(/i);
      expect(sql).toMatch(/function public\.save_governed_sop_draft\(/i);
      expect(sql).toMatch(/PATCH202_CROSS_VERSION_CHILD_ID_DENIED/i);
      expect(sql).toMatch(/v_seen_req_ids/i);
      expect(sql).toMatch(/v_seen_step_ids/i);
    });
  });

  describe('3. Governed Revision, Submission, Approval & Activation RPCs', () => {
    const sql = fs.readFileSync(migrationPath, 'utf8');

    it('defines start_governed_document_revision cloning content while preserving historical version', () => {
      expect(sql).toMatch(/function public\.start_governed_document_revision\(/i);
      expect(sql).toMatch(/for update/i);
      expect(sql).toMatch(/supersedes_version_id/i);
    });

    it('defines submit_governed_document_for_review with Patch 27 approval request creation', () => {
      expect(sql).toMatch(/function public\.submit_governed_document_for_review\(/i);
      expect(sql).toMatch(/PATCH202_VERSION_NOT_EDITABLE_FOR_SUBMISSION/i);
      expect(sql).toMatch(/PATCH202_DUPLICATE_OPEN_SUBMISSION/i);
      expect(sql).toMatch(/insert into public\.approval_requests/i);
    });

    it('defines finalize_governed_document_approval locking the approved version and binding Patch 27 decision', () => {
      expect(sql).toMatch(/function public\.finalize_governed_document_approval\(/i);
      expect(sql).toMatch(/locked_at = now\(\)/i);
      expect(sql).toMatch(/approved_at = now\(\)/i);
      expect(sql).toMatch(/PATCH202_APPROVAL_NOT_FINALIZED/i);
    });

    it('defines activate_governed_document_version superseding prior active version', () => {
      expect(sql).toMatch(/function public\.activate_governed_document_version\(/i);
      expect(sql).toMatch(/superseded_by_version_id = p_version_id/i);
      expect(sql).toMatch(/current_version_id = p_version_id/i);
    });

    it('defines retire_governed_document preserving full history', () => {
      expect(sql).toMatch(/function public\.retire_governed_document\(/i);
      expect(sql).toMatch(/document_status = 'retired'/i);
    });

    it('defines point-in-time version resolution helper get_effective_document_version', () => {
      expect(sql).toMatch(/function public\.get_effective_document_version\(/i);
    });
  });

  describe('4. Review Triggers & Exception Governance RPCs', () => {
    const sql = fs.readFileSync(migrationPath, 'utf8');

    it('defines trigger_governed_document_review and complete_governed_document_review with lifecycle reuse', () => {
      expect(sql).toMatch(/function public\.trigger_governed_document_review\(/i);
      expect(sql).toMatch(/function public\.complete_governed_document_review\(/i);
      expect(sql).toMatch(/public\.start_governed_document_revision\(p_actor_id, v_ver_id/i);
      expect(sql).toMatch(/public\.retire_governed_document\(p_actor_id, v_doc_id/i);
    });

    it('defines request_policy_sop_exception and decide_policy_sop_exception with target version validation and SoD enforcement', () => {
      expect(sql).toMatch(/function public\.request_policy_sop_exception\(/i);
      expect(sql).toMatch(/PATCH202_EXCEPTION_TARGET_NOT_APPROVED/i);
      expect(sql).toMatch(/function public\.decide_policy_sop_exception\(/i);
      expect(sql).toMatch(/PATCH202_SELF_APPROVAL_FORBIDDEN/i);
    });
  });

  describe('5. RLS & Service-Role ACL Hardening', () => {
    const sql = fs.readFileSync(migrationPath, 'utf8');

    it('enforces RLS on new tables with tenant-scoped SELECT', () => {
      expect(sql).toMatch(/alter table public\.governed_document_review_triggers enable row level security;/i);
      expect(sql).toMatch(/alter table public\.policy_sop_exceptions enable row level security;/i);
      expect(sql).toMatch(/create policy review_triggers_select on public\.governed_document_review_triggers/i);
      expect(sql).toMatch(/create policy exceptions_select on public\.policy_sop_exceptions/i);
    });

    it('explicitly revokes all mutation RPCs from public/anon/authenticated and grants strictly to service_role', () => {
      expect(sql).toMatch(/revoke all on function public\.create_governed_policy_draft\(.*\) from public, anon, authenticated;/i);
      expect(sql).toMatch(/grant execute on function public\.create_governed_policy_draft\(.*\) to service_role;/i);
      expect(sql).toMatch(/revoke all on function public\.create_governed_sop_draft\(.*\) from public, anon, authenticated;/i);
      expect(sql).toMatch(/grant execute on function public\.create_governed_sop_draft\(.*\) to service_role;/i);
      expect(sql).toMatch(/revoke all on function public\.save_governed_policy_draft\(.*\) from public, anon, authenticated;/i);
      expect(sql).toMatch(/grant execute on function public\.save_governed_policy_draft\(.*\) to service_role;/i);
      expect(sql).toMatch(/revoke all on function public\.save_governed_sop_draft\(.*\) from public, anon, authenticated;/i);
      expect(sql).toMatch(/grant execute on function public\.save_governed_sop_draft\(.*\) to service_role;/i);
      expect(sql).toMatch(/revoke all on function public\.start_governed_document_revision\(.*\) from public, anon, authenticated;/i);
      expect(sql).toMatch(/grant execute on function public\.start_governed_document_revision\(.*\) to service_role;/i);
      expect(sql).toMatch(/revoke all on function public\.submit_governed_document_for_review\(.*\) from public, anon, authenticated;/i);
      expect(sql).toMatch(/grant execute on function public\.submit_governed_document_for_review\(.*\) to service_role;/i);
      expect(sql).toMatch(/revoke all on function public\.finalize_governed_document_approval\(.*\) from public, anon, authenticated;/i);
      expect(sql).toMatch(/grant execute on function public\.finalize_governed_document_approval\(.*\) to service_role;/i);
      expect(sql).toMatch(/revoke all on function public\.activate_governed_document_version\(.*\) from public, anon, authenticated;/i);
      expect(sql).toMatch(/grant execute on function public\.activate_governed_document_version\(.*\) to service_role;/i);
      expect(sql).toMatch(/revoke all on function public\.retire_governed_document\(.*\) from public, anon, authenticated;/i);
      expect(sql).toMatch(/grant execute on function public\.retire_governed_document\(.*\) to service_role;/i);
      expect(sql).toMatch(/revoke all on function public\.trigger_governed_document_review\(.*\) from public, anon, authenticated;/i);
      expect(sql).toMatch(/grant execute on function public\.trigger_governed_document_review\(.*\) to service_role;/i);
      expect(sql).toMatch(/revoke all on function public\.complete_governed_document_review\(.*\) from public, anon, authenticated;/i);
      expect(sql).toMatch(/grant execute on function public\.complete_governed_document_review\(.*\) to service_role;/i);
      expect(sql).toMatch(/revoke all on function public\.request_policy_sop_exception\(.*\) from public, anon, authenticated;/i);
      expect(sql).toMatch(/grant execute on function public\.request_policy_sop_exception\(.*\) to service_role;/i);
      expect(sql).toMatch(/revoke all on function public\.decide_policy_sop_exception\(.*\) from public, anon, authenticated;/i);
      expect(sql).toMatch(/grant execute on function public\.decide_policy_sop_exception\(.*\) to service_role;/i);
    });
  });
});
