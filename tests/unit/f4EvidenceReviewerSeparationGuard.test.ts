import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('GRC v1.3 F4 Evidence Reviewer Separation of Duties Remediation', () => {
  const migrationPath = path.resolve(process.cwd(), 'supabase/migrations/198_f4_evidence_reviewer_separation_guard.sql');
  const evidencePagePath = path.resolve(process.cwd(), 'src/pages/Evidence.tsx');
  const i18nContextPath = path.resolve(process.cwd(), 'src/i18n/I18nContext.tsx');

  it('proves migration 198 enforces unconditional evidence reviewer separation', () => {
    expect(fs.existsSync(migrationPath)).toBe(true);
    const sql = fs.readFileSync(migrationPath, 'utf8');

    // Replaces patch23_evidence_governance_bridge
    expect(sql).toContain('create or replace function public.patch23_evidence_governance_bridge');
    expect(sql).toContain('security definer');
    expect(sql).toContain('set search_path = public, pg_temp');

    // Unconditional separation check
    expect(sql).toMatch(/if\s+v_evidence\.uploaded_by\s*=\s*p_actor_id\s+then\s+raise\s+exception\s+'PATCH23_EVIDENCE_REVIEWER_SEPARATION_REQUIRED';/i);

    // Verifies NO privileged-role bypass exists
    expect(sql).not.toContain('v_evidence.uploaded_by = p_actor_id and not v_can_manage');
    expect(sql).not.toContain('uploaded_by = p_actor_id and not');

    // Verifies service-role boundary and ACL
    expect(sql).toMatch(/revoke\s+all\s+on\s+function\s+public\.patch23_evidence_governance_bridge/i);
    expect(sql).toMatch(/grant\s+execute\s+on\s+function\s+public\.patch23_evidence_governance_bridge\s*\([^)]*\)\s*to\s+service_role/i);
  });

  it('proves frontend Evidence.tsx guards against self-review client-side', () => {
    expect(fs.existsSync(evidencePagePath)).toBe(true);
    const code = fs.readFileSync(evidencePagePath, 'utf8');

    // Helper isSelfUploadRow checks authenticated actor ID against uploaded_by / created_by
    expect(code).toContain('function isSelfUploadRow(row: any)');
    expect(code).toContain('uploaderId === currentUserId');

    // Modal opening blocks review decisions on self-uploaded items
    expect(code).toContain("action === 'accept' || action === 'reject' || action === 'revision'");
    expect(code).toContain('isSelfUploadRow(row)');

    // Action handlers fail closed on self-uploaded items
    expect(code).toContain("if ((action === 'accept' || action === 'reject' || action === 'revision') && isSelfUploadRow(row))");
    expect(code).toContain("if (isSelfUploadRow(row))");

    // Table buttons disable self-review actions
    expect(code).toContain('disabled={actionDisabled || isSelfUpload}');
    expect(code).toContain('disabled={isSelfUpload || busyId === row.id}');
  });

  it('proves i18n dictionaries provide bilingual separation of duties strings', () => {
    expect(fs.existsSync(i18nContextPath)).toBe(true);
    const i18n = fs.readFileSync(i18nContextPath, 'utf8');

    expect(i18n).toContain("'evidence.reviewerSeparationRequired'");
    expect(i18n).toContain("'evidence.selfReviewProhibited'");
    expect(i18n).toContain('فصل المهام');
  });
});
