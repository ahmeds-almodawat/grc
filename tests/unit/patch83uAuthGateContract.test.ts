import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();

function source(relativePath: string) {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

describe('Patch 83U frontend authentication contract', () => {
  it('preserves Employee ID login normalization to the canonical auth alias', () => {
    const login = source('src/pages/LoginPage.tsx');
    expect(login).toContain("@almodawat.sa");
    expect(login).toMatch(/trim\(\)[\s\S]*includes\(['\"]@['\"]\)[\s\S]*toLowerCase\(\)/);
  });

  it('renders forced password change before any protected layout', () => {
    const app = source('src/App.tsx');
    const gate = app.indexOf('auth.status === "password_change_required"');
    const forcedPage = app.indexOf('return <ForcedPasswordChange />', gate);
    const layout = app.indexOf('<Layout page=');

    expect(gate).toBeGreaterThan(-1);
    expect(forcedPage).toBeGreaterThan(gate);
    expect(layout).toBeGreaterThan(forcedPage);
  });

  it('verifies credential state before loading profiles or role assignments', () => {
    const provider = source('src/auth/AuthProvider.tsx');
    const credentialRead = provider.indexOf('getCurrentUserCredentialState()');
    const profileRead = provider.indexOf(".from('profiles')", credentialRead);
    const roleRead = provider.indexOf(".from('user_roles')", credentialRead);

    expect(credentialRead).toBeGreaterThan(-1);
    expect(profileRead).toBeGreaterThan(credentialRead);
    expect(roleRead).toBeGreaterThan(profileRead);
    expect(provider).toContain("['inactive', 'archived', 'locked']");
    expect(provider).toContain("credentialState: 'blocked'");
    expect(provider).toContain("supabase.auth.signOut({ scope: 'global' })");
  });

  it('uses only the protected Edge actions and the exact password-change payload', () => {
    const api = source('src/lib/userCredentialApi.ts');
    expect(api).toContain("'patch83u_get_credential_state'");
    expect(api).toContain("'patch83u_change_required_password'");
    expect(api).toContain('current_password: input.currentPassword');
    expect(api).toContain('new_password: input.newPassword');
    expect(api).toContain('confirm_new_password: input.confirmNewPassword');
    expect(api).not.toContain('auth.admin');
    expect(api).not.toContain('service_role');
    expect(api).not.toContain(".from('");
  });

  it('requires current/new/confirmation values and signs out after a successful change', () => {
    const page = source('src/pages/ForcedPasswordChange.tsx');
    expect(page).toContain('currentPassword');
    expect(page).toContain('newPassword');
    expect(page).toContain('confirmPassword');
    expect(page).toContain('newPassword !== confirmPassword');
    expect(page).toContain('confirmNewPassword: confirmPassword');

    const change = page.indexOf('await changeRequiredPassword');
    const signOut = page.indexOf('await auth.signOut()', change);
    expect(change).toBeGreaterThan(-1);
    expect(signOut).toBeGreaterThan(change);
  });

  it('keeps unsupported deployed Edge actions fail closed with no credential bypass', () => {
    const api = source('src/lib/userCredentialApi.ts');
    const provider = source('src/auth/AuthProvider.tsx');
    const credentialRead = api.split('export async function getCurrentUserCredentialState')[1]
      ?.split('export async function listProvisioning')[0] ?? '';

    expect(credentialRead).toContain('invokePrivilegedAction');
    expect(credentialRead).not.toMatch(/catch|fallback|legacy_unmanaged/i);
    expect(api).not.toMatch(/UNSUPPORTED_PRIVILEGED_ACTION[\s\S]{0,500}(legacy_unmanaged|access_allowed:\s*true)/i);
    expect(provider).not.toMatch(/UNSUPPORTED_PRIVILEGED_ACTION[\s\S]{0,500}(continue|allow|active)/i);
  });
});
