import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const finalPasswordFinalizerRpc = 'patch83u_finalize_password_change_after_revocation';
const truncatedPronePasswordFinalizerRpc =
  'patch83u_finalize_required_password_change_after_session_revocation';
const hostedTruncatedPasswordFinalizerRpc =
  'patch83u_finalize_required_password_change_after_session_revoca';
const migration176Sha256 =
  'E221C1C3DED23499D2AC69F33F4869A193AB333DC429719F190708CD142172BC';

function source(relativePath: string) {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

function between(value: string, startMarker: string, endMarker: string) {
  const start = value.indexOf(startMarker);
  if (start < 0) throw new Error(`Missing start marker: ${startMarker}`);
  const end = value.indexOf(endMarker, start + startMarker.length);
  if (end < 0) throw new Error(`Missing end marker: ${endMarker}`);
  return value.slice(start, end);
}

function runtimeSource(relativeDirectory: string): string {
  const absoluteDirectory = path.join(root, relativeDirectory);
  return readdirSync(absoluteDirectory, { withFileTypes: true })
    .map((entry) => {
      const relativePath = path.join(relativeDirectory, entry.name);
      if (entry.isDirectory()) return runtimeSource(relativePath);
      return /\.(?:ts|tsx|js|jsx|mjs|cjs)$/.test(entry.name) ? source(relativePath) : '';
    })
    .join('\n');
}

describe('Patch 83U password-change Auth/session flow contract', () => {
  it('globally revokes before the Auth password update and proves zero sessions before finalization', () => {
    const edge = source('supabase/functions/privileged-action/index.ts');
    const changeBlock = between(
      edge,
      "if (action === 'patch83u_change_required_password')",
      "if (action === 'patch83u_admin_reset_password')",
    );

    const currentPasswordGrant = changeBlock.indexOf('verificationClient.auth.signInWithPassword');
    const begin = changeBlock.indexOf("'patch83u_begin_required_password_change'");
    const globalSignOut = changeBlock.indexOf('serviceClient.auth.admin.signOut');
    const passwordUpdate = changeBlock.indexOf('serviceClient.auth.admin.updateUserById');
    const atomicFinalize = changeBlock.indexOf(
      `'${finalPasswordFinalizerRpc}'`,
    );
    const finalize = changeBlock.indexOf("'patch83u_finalize_required_password_change', {");

    expect(currentPasswordGrant).toBeGreaterThan(-1);
    expect(begin).toBeGreaterThan(currentPasswordGrant);
    expect(globalSignOut).toBeGreaterThan(begin);
    expect(passwordUpdate).toBeGreaterThan(globalSignOut);
    expect(atomicFinalize).toBeGreaterThan(passwordUpdate);
    expect(finalize).toBeGreaterThan(atomicFinalize);
    expect(changeBlock.slice(globalSignOut)).not.toContain('signInWithPassword');
    expect(changeBlock).not.toContain('verificationClient.auth.signOut');
    expect(changeBlock).toContain('globalSessionRevocationAttempted = true');
    expect(changeBlock).toMatch(
      /if \(reauthenticationAccessToken && !globalSessionRevocationAttempted\)[\s\S]*serviceClient\.auth\.admin\.signOut\([\s\S]*reauthenticationAccessToken,[\s\S]*'local'/,
    );
  });

  it('never promotes session_not_found or an ambiguous Auth response to global revocation proof', () => {
    const edge = source('supabase/functions/privileged-action/index.ts');
    const changeBlock = between(
      edge,
      "if (action === 'patch83u_change_required_password')",
      "if (action === 'patch83u_admin_reset_password')",
    );

    expect(changeBlock).toContain('globalSessionRevocationConfirmed = !signOutResult.error');
    expect(changeBlock).toContain('globalSessionRevocationConfirmed = false');
    expect(changeBlock).toContain('if (globalSessionRevocationConfirmed)');
    expect(changeBlock).toContain(
      `'${finalPasswordFinalizerRpc}'`,
    );
    expect(changeBlock).toContain(
      'p_session_revocation_confirmed: false',
    );
    expect(changeBlock).not.toMatch(/if\s*\([^)]*session_not_found[^)]*\)[\s\S]{0,120}=\s*true/i);
  });

  it('uses one service-only transaction to lock, prove zero sessions, and finalize active', () => {
    const migration = source('supabase/migrations/176_patch83u_last_super_admin_recovery.sql');
    const atomicFinalize = between(
      migration,
      'create or replace function public.patch83u_finalize_required_password_change_after_session_revocation(',
      '\n$$;',
    );

    expect(atomicFinalize).toContain('perform public.patch83u_require_service_role()');
    expect(atomicFinalize).toContain('perform public.patch83u_require_enforced_runtime()');
    expect(atomicFinalize).toContain('lock table auth.sessions in share mode');
    expect(atomicFinalize).toMatch(
      /select count\(\*\)::integer[\s\S]*from auth\.sessions s[\s\S]*where s\.user_id = p_actor_id/,
    );
    expect(atomicFinalize).toContain("raise exception 'PATCH83U_AUTH_SESSIONS_STILL_ACTIVE'");
    expect(atomicFinalize).toMatch(
      /public\.patch83u_finalize_required_password_change\([\s\S]*p_verified_auth_email,[\s\S]*true/,
    );
    expect(atomicFinalize).not.toMatch(
      /\b(?:insert into|update|delete from)\s+auth\.(?:users|sessions)\b/i,
    );
  });

  it('uses the explicit sub-63-byte finalizer RPC name without changing migration 176', () => {
    const edge = source('supabase/functions/privileged-action/index.ts');
    const runtime = [
      runtimeSource('src'),
      runtimeSource('supabase/functions'),
    ].join('\n');
    const migration177 = source(
      'supabase/migrations/177_patch83u_explicit_password_finalizer_rpc_name.sql',
    );
    const migration176Bytes = readFileSync(
      path.join(root, 'supabase/migrations/176_patch83u_last_super_admin_recovery.sql'),
    );
    const atomicFinalizerCalls = Array.from(
      edge.matchAll(
        /serviceClient\.rpc\(\s*'([^']*finalize[^']*(?:revocation|revoca)[^']*)'/g,
      ),
      (match) => match[1],
    );

    expect(Buffer.byteLength(finalPasswordFinalizerRpc, 'utf8')).toBe(50);
    expect(Buffer.byteLength(finalPasswordFinalizerRpc, 'utf8')).toBeLessThan(63);
    expect(atomicFinalizerCalls).toEqual([finalPasswordFinalizerRpc]);
    expect(runtime).not.toContain(truncatedPronePasswordFinalizerRpc);
    expect(runtime).not.toContain(hostedTruncatedPasswordFinalizerRpc);
    expect(migration177).toMatch(
      /alter\s+function\s+public\.patch83u_finalize_required_password_change_after_session_revoca\s*\(\s*uuid\s*,\s*uuid\s*,\s*text\s*,\s*integer\s*,\s*text\s*\)\s*rename\s+to\s+patch83u_finalize_password_change_after_revocation\s*;/i,
    );
    expect(migration177).not.toMatch(
      /create\s+(?:or\s+replace\s+)?function\s+public\.patch83u_finalize_password_change_after_revocation/i,
    );
    expect(
      createHash('sha256').update(migration176Bytes).digest('hex').toUpperCase(),
    ).toBe(migration176Sha256);
  });

  it('keeps the browser signed out after a terminal response without a replacement password grant', () => {
    const forcedChange = source('src/pages/ForcedPasswordChange.tsx');
    const authProvider = source('src/auth/AuthProvider.tsx');
    const completion = between(
      authProvider,
      'const completeRequiredPasswordChange = useCallback',
      'const reload = useCallback',
    );

    expect(forcedChange).not.toContain('signInWithPassword');
    expect(forcedChange).toMatch(
      /await changeRequiredPassword\([\s\S]*await auth\.completeRequiredPasswordChange\(result\.status\)/,
    );
    expect(completion).not.toContain('signInWithPassword');
    expect(completion).not.toContain('.auth.signOut');
    expect(completion).toContain('currentSessionRef.current = null');
    expect(completion).toContain('setSession(null)');
    expect(completion).toContain('clearPersistedSessionIfStillMatches(activeSession)');
    expect(forcedChange).toContain('passwordChangeFailureDisposition(changeError)');
    expect(forcedChange).toContain("'password_policy_rejected_after_revocation'");
    expect(forcedChange).toContain(": 'unconfirmed'");
    expect(completion).toContain("outcome === 'unconfirmed'");
    expect(completion).toContain("outcome === 'password_policy_rejected_after_revocation'");
    expect(completion).toContain('Do not retry or sign in until a protected administrator reconciles');
  });

  it('keeps every browser mutation, including reconciliation, blocked during emergency suspension', () => {
    const edge = source('supabase/functions/privileged-action/index.ts');
    const runtimeGate = between(
      edge,
      "const runtimeState = capabilities?.runtime_enforcement_state ?? 'disabled'",
      "if (action === 'patch83t_user_import_identity_references')",
    );

    expect(runtimeGate).toMatch(
      /patch83uEnforcedOnlyActions\.has\(action\)[\s\S]*runtimeState !== 'enforced'/,
    );
    expect(runtimeGate).toContain("runtimeState === 'emergency_suspended'");
    expect(runtimeGate).toContain('Password transitions, provisioning, resets, and reconciliation are disabled during emergency suspension.');
    expect(edge).not.toContain('patch83uEmergencySelfReconciliation');
    expect(edge).not.toContain('PATCH83U_EMERGENCY_SELF_RECOVERY_REQUIRED');
    expect(edge).toMatch(
      /const patch83uEnforcedOnlyActions = new Set\(\[[\s\S]*'patch83u_provision_account'[\s\S]*'patch83u_change_required_password'[\s\S]*'patch83u_admin_reset_password'/,
    );
  });
});
