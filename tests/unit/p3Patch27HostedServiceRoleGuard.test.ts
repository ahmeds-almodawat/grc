import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const sql = fs.readFileSync(
  path.join(process.cwd(), 'supabase/migrations/226_p3_patch27_hosted_service_role_guard.sql'),
  'utf8',
);

describe('P3 Patch27 hosted service-role guard compatibility', () => {
  it('replaces only the stale Patch27 guard with the canonical hosted role contract', () => {
    expect(sql).toContain("auth.role() is distinct from ''service_role''");
    expect(sql).toContain("request.jwt.claim.role");
    expect(sql).toContain('PATCH226_EXPECTED_SERVICE_ROLE_GUARD_NOT_FOUND');
    expect(sql).toContain('PATCH226_STALE_PATCH27_SERVICE_ROLE_GUARDS_REMAIN');
  });

  it('covers every deployed Patch27 authority function with the stale guard', () => {
    expect(sql.match(/::regprocedure/g)).toHaveLength(12);
    expect(sql).toContain('public.request_workflow_approval(uuid,text,text,uuid,text,uuid,jsonb)');
    expect(sql).toContain('public.record_approval_decision(uuid,uuid,text,text,text)');
    expect(sql).toContain('public.configure_approval_authority_rule_stages(uuid,uuid,jsonb)');
  });
});
