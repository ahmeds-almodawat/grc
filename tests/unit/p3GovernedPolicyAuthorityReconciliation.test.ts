import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = fs.readFileSync(
  path.join(
    process.cwd(),
    'supabase/migrations/225_p3_governed_policy_authority_reconciliation.sql',
  ),
  'utf8',
);

function sqlFunction(name: string): string {
  const marker = `create or replace function public.${name}(`;
  const start = migration.indexOf(marker);
  if (start < 0) throw new Error(`Missing SQL function: ${name}`);
  const end = migration.indexOf('\n$$;', start);
  if (end < 0) throw new Error(`Unterminated SQL function: ${name}`);
  return migration.slice(start, end + 4);
}

const createPolicy = sqlFunction('create_governed_policy_draft');
const savePolicy = sqlFunction('save_governed_policy_draft');

describe('P3 governed Policy authority reconciliation', () => {
  it('uses the canonical profile activity and lifecycle state', () => {
    expect(createPolicy).toContain('p.is_active = true');
    expect(createPolicy).toContain("p.user_status::text = 'active'");
    expect(savePolicy).toContain('p.is_active = true');
    expect(savePolicy).toContain("p.user_status::text = 'active'");
    expect(migration).not.toMatch(/profiles[\s\S]{0,180}\bactive_flag\b/i);
  });

  it('preserves the deployed create-Policy parameter defaults', () => {
    for (const parameter of [
      'p_scope_en text default null',
      'p_scope_ar text default null',
      'p_principles_en text default null',
      'p_principles_ar text default null',
      'p_exceptions_summary_en text default null',
      'p_exceptions_summary_ar text default null',
      'p_non_compliance_escalation_en text default null',
      'p_non_compliance_escalation_ar text default null',
      'p_department_id uuid default null',
    ]) {
      expect(createPolicy).toContain(parameter);
    }
  });

  it('limits Policy saves to the same organization and authorized editors', () => {
    expect(savePolicy).toContain("d.document_type = 'policy'");
    expect(savePolicy).toContain("raise exception 'PATCH202_ACTOR_CROSS_ORG_FORBIDDEN'");
    expect(savePolicy).toContain('v_prepared_by');
    expect(savePolicy).toContain('v_doc_owner_id');
    expect(savePolicy).toContain("ur.role in ('super_admin', 'governance_admin')");
    expect(savePolicy).toContain('ur.is_active = true');
    expect(savePolicy).toContain("raise exception 'PATCH202_ACTOR_NOT_AUTHORIZED'");
  });

  it('rejects non-draft or immutable versions before changing content', () => {
    expect(savePolicy).toContain('v.locked_at is not null');
    expect(savePolicy).toContain('v.approved_at is not null');
    expect(savePolicy).toContain("d.document_status <> 'draft'");
    expect(savePolicy).toContain("raise exception 'PATCH201_VERSION_IMMUTABLE_LOCKED'");
    expect(savePolicy.indexOf("raise exception 'PATCH201_VERSION_IMMUTABLE_LOCKED'"))
      .toBeLessThan(savePolicy.indexOf('update public.controlled_documents'));
  });

  it('keeps the Policy root title synchronized with governed details', () => {
    expect(savePolicy).toMatch(
      /update public\.controlled_documents[\s\S]*document_title = p_title_en[\s\S]*updated_by = p_actor_id/,
    );
    expect(savePolicy).toMatch(
      /update public\.governed_policy_details[\s\S]*title_en = p_title_en/,
    );
  });

  it('preserves the service-role-only execution boundary', () => {
    for (const name of ['create_governed_policy_draft', 'save_governed_policy_draft']) {
      expect(migration).toMatch(
        new RegExp(`revoke all on function public\\.${name}\\([\\s\\S]*?from public, anon, authenticated`, 'i'),
      );
      expect(migration).toMatch(
        new RegExp(`grant execute on function public\\.${name}\\([\\s\\S]*?to service_role`, 'i'),
      );
    }
    expect(migration).not.toMatch(/grant\s+execute[\s\S]*?\bto\s+(?:anon|authenticated|public)\b/i);
  });
});
