import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = fs.readFileSync(
  path.join(
    process.cwd(),
    'supabase/migrations/224_p3_division_post_password_role_activation.sql',
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

const finalizer = sqlFunction('patch83u_finalize_required_password_change');
const reconciler = sqlFunction('patch83u_reconcile_provisioning');

describe('P3 division post-password role activation correction', () => {
  it('uses the canonical scope references throughout password finalization', () => {
    expect(finalizer).toContain(
      "when v_queue.requested_scope = 'division' then v_queue.division_id",
    );
    expect(finalizer).toContain(
      "when v_queue.requested_scope = 'department' then v_queue.department_id",
    );
    expect(finalizer).toMatch(
      /patch83u_role_assignment_valid\([\s\S]*v_role_division_id,[\s\S]*v_role_department_id,[\s\S]*v_role_unit_id/,
    );
    expect(finalizer).toMatch(
      /ur\.division_id is not distinct from v_role_division_id[\s\S]*ur\.department_id is not distinct from v_role_department_id/,
    );
    expect(finalizer).not.toContain('and ur.division_id is null');
  });

  it('recognizes only the exact division activation failure for recovery', () => {
    expect(reconciler).toContain(
      "v_queue.last_error_code = 'PATCH83U_PROVISIONED_ROLE_ACTIVATION_FAILED'",
    );
    expect(reconciler).toContain("v_queue.requested_scope = 'division'");
    expect(reconciler).toContain(
      "v_state.credential_state = 'recovery_required'",
    );
    expect(reconciler).toContain(
      "v_state.operation_source = 'password_change'",
    );
    expect(reconciler).toContain('v_state.reconciliation_auth_changed = true');
    expect(reconciler).toContain(
      "'initial_change_required', 'admin_reset_change_required'",
    );
  });

  it('requires exact Auth, profile, role, and zero-active-role proof', () => {
    expect(reconciler).toContain(
      "u.raw_app_meta_data ->> 'patch83u_provisioning_id' = v_queue.id::text",
    );
    expect(reconciler).toContain(
      'v_auth_version is distinct from v_state.credential_version',
    );
    expect(reconciler).toContain('v_email_identity_count <> 1');
    expect(reconciler).toContain('v_exact_email_identity_count <> 1');
    expect(reconciler).toContain('v_matching_role_count <> 1');
    expect(reconciler).toContain('v_active_role_count <> 0');
    expect(reconciler).toMatch(
      /patch83u_role_assignment_valid\([\s\S]*v_role_division_id,[\s\S]*v_role_department_id,[\s\S]*v_role_unit_id/,
    );
  });

  it('restores only the reserved role, invited profile, and credential gate', () => {
    expect(reconciler).not.toMatch(/insert into public\.user_roles/i);
    expect(reconciler).not.toMatch(
      /(?:insert into|update|delete from) auth\.(?:users|identities|sessions)/i,
    );
    expect(reconciler).toMatch(
      /update public\.user_roles[\s\S]*where id = v_role_id[\s\S]*and is_active = false/,
    );
    expect(reconciler).toMatch(
      /update public\.profiles[\s\S]*user_status = 'active'[\s\S]*user_status = 'invited'/,
    );
    expect(reconciler).toMatch(
      /update public\.user_credential_states[\s\S]*credential_state = 'active'[\s\S]*credential_state = 'recovery_required'[\s\S]*operation_source = 'password_change'/,
    );
    expect(reconciler).toContain(
      "'PATCH83U_DIVISION_PASSWORD_ROLE_ACTIVATED'",
    );
  });

  it('retains service-only protected RPC boundaries', () => {
    expect(finalizer).toContain('perform public.patch83u_require_service_role()');
    expect(finalizer).toContain('perform public.patch83u_require_enforced_runtime()');
    expect(reconciler).toContain(
      'v_org_id := public.patch83u_require_super_admin(p_actor_id)',
    );
    expect(migration).toMatch(
      /revoke all on function public\.patch83u_finalize_required_password_change\([\s\S]*from public, anon, authenticated/,
    );
    expect(migration).toMatch(
      /revoke all on function public\.patch83u_reconcile_provisioning\([\s\S]*from public, anon, authenticated/,
    );
    expect(migration).not.toMatch(/grant\s+[\s\S]*?\bto\s+(?:anon|public)\b/i);
  });
});
