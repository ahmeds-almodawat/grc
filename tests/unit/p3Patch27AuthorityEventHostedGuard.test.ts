import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = fs.readFileSync(
  path.join(process.cwd(), 'supabase/migrations/227_p3_patch27_authority_event_hosted_guard.sql'),
  'utf8',
);

describe('P3 Patch27 authority-event hosted guard', () => {
  it('uses the canonical hosted service-role signal with the SQL fallback', () => {
    expect(migration).toContain("auth.role() is distinct from 'service_role'");
    expect(migration).toContain("current_user <> 'service_role'");
    expect(migration).not.toContain("current_setting('request.jwt.claim.role'");
  });

  it('changes only the authority-event helper contract', () => {
    expect(migration).toContain('create or replace function public.patch27_write_authority_event(');
    expect(migration).not.toMatch(/\b(grant|revoke|policy|alter table)\b/i);
  });
});
