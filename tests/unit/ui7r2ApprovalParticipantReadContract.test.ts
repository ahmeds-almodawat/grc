import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/215_ui7_approval_participant_read_contract.sql'),
  'utf8',
);

const relations = [
  'approval_requests',
  'approval_request_stages',
  'approval_decisions',
  'approval_delegations',
  'approval_authority_rules',
];

describe('UI-7R2 approval participant read contract', () => {
  it('adds restrictive participant SELECT gates to every approval relation', () => {
    for (const relation of relations) {
      expect(migration).toMatch(
        new RegExp(`create policy ui7_${relation}_participant_select[\\s\\S]*?on public\\.${relation}[\\s\\S]*?as restrictive[\\s\\S]*?for select[\\s\\S]*?to authenticated`, 'i'),
      );
    }
  });

  it('keeps browser access read-only and signed-in only', () => {
    expect(migration).toMatch(/revoke all privileges[\s\S]*from anon;/i);
    expect(migration).toMatch(/revoke all privileges[\s\S]*from public;/i);
    expect(migration).toMatch(/revoke all privileges[\s\S]*from authenticated;[\s\S]*grant select[\s\S]*to authenticated;/i);
    expect(migration).not.toMatch(/grant\s+(all|insert|update|delete)[\s\S]*to authenticated/i);
  });

  it('keeps participant evaluation private, actor-derived, and Patch83U-gated', () => {
    expect(migration).toContain('create schema if not exists ui7_approval_private');
    expect(migration).toContain('v_actor_id uuid := auth.uid()');
    expect(migration).toContain('public.patch83u_credential_access_allowed() is distinct from true');
    expect(migration).toContain('set search_path = pg_catalog, public, ui7_approval_private, pg_temp');
    expect(migration).toMatch(/revoke all on schema ui7_approval_private from public, anon, authenticated, service_role/i);
    expect(migration).not.toContain('p_actor_id');
  });

  it('does not rewrite Patch27 write policies or create same-organization read-all access', () => {
    expect(migration).not.toMatch(/drop policy if exists approval_.*_org_write_patch27/i);
    expect(migration).not.toMatch(/create policy approval_.*_org_write_patch27/i);
    expect(migration).not.toMatch(/using\s*\(\s*organization_id::text\s*=\s*coalesce/i);
    expect(migration).toContain("ur.role::text in ('super_admin', 'governance_admin')");
    expect(migration).not.toMatch(/'executive'|'auditor'|'compliance_officer'/i);
  });
});
