import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = fs.readFileSync(
  path.join(process.cwd(), 'supabase/migrations/229_p3_hosted_service_role_contract_reconciliation.sql'),
  'utf8',
);

describe('P3 hosted service-role contract reconciliation', () => {
  it('preserves explicit de-privileging before hosted and SQL role fallbacks', () => {
    expect(migration).toContain(
      "coalesce(nullif(current_setting(''request.jwt.claim.role'', true), ''''), auth.role(), current_user)",
    );
    expect(migration).toContain('v_legacy_current_user');
    expect(migration).toContain('v_legacy_empty');
    expect(migration).toContain('v_legacy_read');
  });

  it('rewrites function definitions without changing grants, RLS, or tables', () => {
    expect(migration).toContain('pg_get_functiondef(v_function.oid)');
    expect(migration).toContain('execute v_rewritten');
    expect(migration).not.toMatch(/\b(grant|revoke|create policy|alter table|drop table)\b/i);
  });

  it('fails closed if noncanonical reads or rewrite sentinels remain', () => {
    expect(migration).toContain('PATCH229_NONCANONICAL_HOSTED_ROLE_READS_REMAIN');
    expect(migration).toContain('PATCH229_ROLE_SENTINELS_REMAIN');
    expect(migration).toContain('PATCH229_NO_LEGACY_ROLE_READS_RECONCILED');
  });
});
