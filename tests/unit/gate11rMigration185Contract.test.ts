import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const migrationPath = resolve(
  root,
  'supabase/migrations/185_pilot_go_no_go_anonymous_policy_reconciliation.sql',
);
const migration = readFileSync(migrationPath, 'utf8');
const sql = migration.replace(/\s+/g, ' ').trim().toLowerCase();

const tables = [
  'pilot_go_no_go_reviews',
  'pilot_go_no_go_events',
] as const;

describe('Production Gate 11R migration 185 policy contract', () => {
  it('binds the exact migration hash and source identity', () => {
    expect(createHash('sha256').update(migration).digest('hex')).toBe(
      '780efe381ac90a5ae4d8cf256f95246966e9b42c91adcd9a6dc7a13030e0ec65',
    );
  });

  it('removes the two universal policies and forces RLS', () => {
    for (const table of tables) {
      expect(sql).toContain(`alter table public.${table} enable row level security`);
      expect(sql).toContain(`alter table public.${table} force row level security`);
      expect(sql).toContain(`revoke all on table public.${table} from public, anon, authenticated, service_role`);
    }
    expect(sql).toContain('drop policy if exists pilot_go_no_go_reviews_select_all');
    expect(sql).toContain('drop policy if exists pilot_go_no_go_events_select_all');
    expect(sql).not.toMatch(/create policy[\s\S]{0,240}(?:using|with check)\s*\(\s*true\s*\)/i);
  });

  it('allows only credential-valid global Super Admin reads', () => {
    expect(sql).toContain('create policy pilot_go_no_go_reviews_super_admin_read');
    expect(sql).toContain('create policy pilot_go_no_go_events_super_admin_read');
    expect(sql.match(/patch83u_credential_access_allowed\(\)/g)?.length).toBeGreaterThanOrEqual(4);
    expect(sql.match(/has_any_role\(array\['super_admin'\]::(?:public\.)?app_role\[\]\)/g)?.length)
      .toBeGreaterThanOrEqual(2);
    expect(sql).toContain('for select to authenticated');
  });

  it('keeps browser writes denied and preserves service-role-only RPCs', () => {
    expect(sql).not.toMatch(/grant\s+(?:insert|update|delete|all)[^;]+to\s+(?:anon|authenticated)/i);
    expect(sql).toContain("has_function_privilege('authenticated', 'public.create_pilot_go_no_go_review(text,uuid)', 'execute')");
    expect(sql).toContain("not has_function_privilege('service_role', 'public.record_pilot_go_no_go_event(uuid,text,text,uuid)', 'execute')");
  });

  it('keeps the dependent dashboard view security-invoker and anonymous-closed', () => {
    expect(sql).toContain("array['security_invoker=true']");
    expect(sql).toContain('revoke all on table public.v_patch44_pilot_go_no_go_dashboard from public, anon, authenticated, service_role');
    expect(sql).toContain('grant select on table public.v_patch44_pilot_go_no_go_dashboard to authenticated, service_role');
  });

  it('fails closed on missing, altered, or unexpected catalog state', () => {
    expect(migration).toContain('PATCH185_REQUIRED_AUTHORIZATION_HELPER_MISSING');
    expect(migration).toContain('PATCH185_POLICY_STATE_CONFLICT');
    expect(migration).toContain('PATCH185_RESTRICTIVE_POLICY_DEFINITION_DRIFT');
    expect(migration).toContain('PATCH185_UNEXPECTED_POLICY_PRESENT');
    expect(migration).toContain('PATCH185_PROTECTED_RPC_ACL_DRIFT');
  });

  it('uses bounded execution and performs no data repair or Auth mutation', () => {
    expect(sql).toContain("set local lock_timeout = '5s'");
    expect(sql).toContain("set local statement_timeout = '60s'");
    expect(sql).toContain('lock table public.pilot_go_no_go_reviews in share row exclusive mode');
    expect(sql).not.toMatch(/\b(?:insert into|update|delete from)\s+(?:public|auth)\./);
    expect(migration).not.toMatch(/zghsgzrdwbqdrpuxanac|zbrjjecpsrzposhuarcn/);
  });
});
