import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const migrationPath = path.join(
  root,
  'supabase/migrations/189_patch83u_post_provisioning_role_activation.sql',
);
const migration = readFileSync(migrationPath, 'utf8');

function sqlFunction(name: string): string {
  const marker = `create or replace function public.${name}(`;
  const start = migration.indexOf(marker);
  if (start < 0) throw new Error(`Missing SQL function: ${name}`);
  const end = migration.indexOf('\n$$;', start);
  if (end < 0) throw new Error(`Unterminated SQL function: ${name}`);
  return migration.slice(start, end + 4);
}

const finalizer = sqlFunction('patch83u_finalize_required_password_change');
const provisioningReconciler = sqlFunction('patch83u_reconcile_provisioning');

describe('Patch 83U migration 189 post-provisioning role activation', () => {
  it('A: preserves direct initial-password activation and completion', () => {
    expect(finalizer).toContain(
      "v_state.operation_previous_state = 'initial_change_required'",
    );
    expect(finalizer).toMatch(
      /update public\.user_roles[\s\S]*where id = v_role_id[\s\S]*and user_id = p_actor_id[\s\S]*and is_active = false/,
    );
    expect(finalizer).toMatch(
      /update public\.profiles[\s\S]*set user_status = 'active', is_active = true[\s\S]*user_status = 'invited'/,
    );
    expect(finalizer).toMatch(
      /update public\.user_account_provisioning[\s\S]*provisioning_status = 'completed'[\s\S]*provisioning_status = 'initial_change_required'/,
    );
  });

  it('B: recognizes a pending invited provisioning lifecycle after admin reset', () => {
    const activationDecision = finalizer.slice(
      finalizer.indexOf('v_role_activation_required :='),
      finalizer.indexOf('if v_role_activation_required then'),
    );

    expect(activationDecision).toContain(
      "v_state.operation_previous_state = 'admin_reset_change_required'",
    );
    expect(activationDecision).toContain('v_state.provisioning_id is not null');
    expect(activationDecision).toContain(
      "q0.provisioning_status = 'initial_change_required'",
    );
    expect(activationDecision).toContain("p0.user_status = 'invited'");
    expect(finalizer).toContain("'new_provisioned_role_activated', v_role_update_count = 1");
  });

  it('C: leaves an existing active user admin reset outside role activation', () => {
    const activationRequired = (input: {
      previousState: string;
      provisioningIdPresent: boolean;
      pendingProvisioning: boolean;
      invitedProfile: boolean;
    }) => input.previousState === 'initial_change_required'
      || (
        input.previousState === 'admin_reset_change_required'
        && input.provisioningIdPresent
        && (input.pendingProvisioning || input.invitedProfile)
      );

    expect(activationRequired({
      previousState: 'admin_reset_change_required',
      provisioningIdPresent: true,
      pendingProvisioning: false,
      invitedProfile: false,
    })).toBe(false);
    expect(provisioningReconciler).toMatch(
      /v_state\.credential_state = 'active'[\s\S]*v_profile\.user_status = 'active'[\s\S]*v_role_is_active[\s\S]*v_status := 'completed'/,
    );
  });

  it('D: fails closed for ambiguous or already-active target roles', () => {
    expect(finalizer).toContain('v_matching_role_count <> 1');
    expect(finalizer).toContain('v_active_role_count <> 0');
    expect(provisioningReconciler).toContain('v_matching_role_count <> 1');
    expect(provisioningReconciler).toContain('v_active_role_count <> 0');
    expect(provisioningReconciler).toContain(
      "raise exception 'PATCH83U_POST_PROVISIONING_ROLE_ACTIVATION_PROOF_FAILED'",
    );
  });

  it('E: requires exact provisioning, profile, Auth, and identity proof', () => {
    expect(provisioningReconciler).toContain(
      'v_queue.auth_user_id is distinct from v_auth_user_id',
    );
    expect(provisioningReconciler).toContain(
      'v_queue.profile_id is distinct from v_auth_user_id',
    );
    expect(provisioningReconciler).toContain(
      'v_state.provisioning_id is distinct from v_queue.id',
    );
    expect(provisioningReconciler).toContain(
      'v_auth_version is distinct from v_state.credential_version',
    );
    expect(provisioningReconciler).toContain('v_email_identity_count <> 1');
    expect(provisioningReconciler).toContain('v_exact_email_identity_count <> 1');
    expect(provisioningReconciler).toContain(
      "u.raw_app_meta_data ->> 'patch83u_provisioning_id' = v_queue.id::text",
    );
  });

  it('F: permits only the exact existing role and profile lifecycle mutation', () => {
    expect(provisioningReconciler).toContain(
      "v_queue.requested_role is distinct from 'employee'",
    );
    expect(provisioningReconciler).toContain(
      "v_queue.requested_scope is distinct from 'assigned_only'",
    );
    expect(provisioningReconciler).not.toMatch(/insert into public\.user_roles/i);
    expect(provisioningReconciler).not.toMatch(/update public\.user_credential_states/i);
    expect(provisioningReconciler).not.toMatch(
      /(?:insert into|update|delete from) auth\.(?:users|identities|sessions)/i,
    );
    expect(provisioningReconciler.match(/update public\.user_roles/g)).toHaveLength(1);
    expect(provisioningReconciler.match(/update public\.profiles/g)).toHaveLength(1);
    expect(provisioningReconciler).toContain(
      "'PATCH83U_POST_PROVISIONING_ROLE_ACTIVATED'",
    );
    expect(provisioningReconciler).toContain(
      "'Patch 83U post-provisioning role activation recovery'",
    );
  });

  it('retains the protected RPC boundary and the existing RC3 Edge allowlist', () => {
    expect(finalizer).toContain('perform public.patch83u_require_service_role()');
    expect(finalizer).toContain('perform public.patch83u_require_enforced_runtime()');
    expect(provisioningReconciler).toContain(
      'v_org_id := public.patch83u_require_super_admin(p_actor_id)',
    );
    expect(provisioningReconciler).toContain("v_outcome := 'already_completed'");
    expect(migration).toMatch(
      /revoke all on function public\.patch83u_reconcile_provisioning\([\s\S]*from public, anon, authenticated/,
    );
    expect(migration).toMatch(
      /grant execute on function public\.patch83u_reconcile_provisioning\([\s\S]*to service_role/,
    );
  });
});
