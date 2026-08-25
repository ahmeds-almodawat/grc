import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = fs.readFileSync(
  path.join(process.cwd(), 'supabase/migrations/223_p3_patch83u_division_provisioning_scope.sql'),
  'utf8',
);

describe('P3 division-scoped provisioning correction', () => {
  it('carries only the canonical division reference into division-scoped roles', () => {
    expect(migration).toContain("when v_queue.requested_scope = 'division' then v_queue.division_id");
    expect(migration).toContain("when v_queue.requested_scope = 'department' then v_queue.department_id");
    expect(migration).toContain('public.patch83u_role_assignment_valid(');
  });

  it('preserves the protected finalization and inactive-role gates', () => {
    expect(migration).toContain('public.patch83u_require_enforced_runtime()');
    expect(migration).toContain('public.patch83u_require_super_admin(p_actor_id)');
    expect(migration).toContain("'initial_change_required'");
    expect(migration).toContain('PATCH83U_PROVISIONED_ROLE_MUST_BE_INACTIVE');
    expect(migration).not.toMatch(/grant\s+.*\b(?:anon|public)\b/i);
  });
});
