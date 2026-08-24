import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = fs.readFileSync(
  path.join(process.cwd(), 'supabase/migrations/228_p3_patch206_staged_mutation_hosted_guard.sql'),
  'utf8',
);

describe('P3 Patch206 staged mutation hosted guard', () => {
  it('uses canonical hosted role detection and retains the SQL fallback', () => {
    expect(migration).toContain("auth.role() is distinct from 'service_role'");
    expect(migration).toContain("current_user <> 'service_role'");
    expect(migration).not.toContain("current_setting('request.jwt.claim.role'");
  });

  it('retains both fail-closed direct mutation errors without changing grants or triggers', () => {
    expect(migration).toContain('PATCH206_DIRECT_STAGED_REQUEST_MUTATION_FORBIDDEN');
    expect(migration).toContain('PATCH206_DIRECT_STAGED_DECISION_MUTATION_FORBIDDEN');
    expect(migration).not.toMatch(/\b(grant|revoke|create trigger|drop trigger|policy|alter table)\b/i);
  });
});
